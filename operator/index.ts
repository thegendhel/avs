import { ethers } from "ethers";
import axios from 'axios';
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
    throw new Error("process.env object is empty");
}

const args = process.argv.slice(2);
const skipArg = args.find((arg) => arg.startsWith("--skip-operator"));
const isRegisterOperatorSkip = skipArg ? true : false;

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/veritrade/${chainId}.json`), 'utf8'));
// Load core deployment data
const coreDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`), 'utf8'));


const delegationManagerAddress = coreDeploymentData.addresses.delegation; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const veritradeServiceManagerAddress = avsDeploymentData.addresses.veritradeServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IDelegationManager.json'), 'utf8'));
const ecdsaRegistryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ECDSAStakeRegistry.json'), 'utf8'));
const veritradeServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/VeritradeServiceManager.json'), 'utf8'));
const avsDirectoryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IAVSDirectory.json'), 'utf8'));

// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(delegationManagerAddress, delegationManagerABI, wallet);
const veritradeServiceManager = new ethers.Contract(veritradeServiceManagerAddress, veritradeServiceManagerABI, wallet);
const ecdsaRegistryContract = new ethers.Contract(ecdsaStakeRegistryAddress, ecdsaRegistryABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);


const signAndRespondToTask = async (taskIndex: number, task: any) => {

    let pass = false;
    let metadata = "https://ms.blocknaut.xyz/metadata.json";

    try {

        const tresp = await axios.get(`https://ticketmock.blocknaut.xyz/ticket/${task[0]}`, {});
        if (tresp.status >= 200 && tresp.status < 300) {
            console.log('Get Ticket Credential:', tresp.data);
        } else {
            throw new Error(`HTTP error! Status: ${tresp.status}`);
        }

        metadata = tresp.data.metadata;

        const bresp = await axios.get(`https://fapi.binance.com/fapi/v1/userTrades?${tresp.data.query_string}`, {
            headers: {
                'X-MBX-APIKEY': tresp.data.api_key,
            },
        });

        // TODO: We should compare data from Ticket Metadata and Binance here
        pass = true;

        console.log('Get Binance Trade Data:', bresp.data);

    } catch (error) {
        console.error('Error fetching data:', error);
    }


    if (pass) {
        const messageHash = ethers.solidityPackedKeccak256(["uint32"], [taskIndex]);
        const messageBytes = ethers.getBytes(messageHash);
        const signature = await wallet.signMessage(messageBytes);

        console.log(`Signing and responding to task ${taskIndex}`);

        const operators = [await wallet.getAddress()];
        const signatures = [signature];
        const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address[]", "bytes[]", "uint32"],
            [operators, signatures, ethers.toBigInt(await provider.getBlockNumber()-1)]
        );

        try {
            interface Task {
                ticket: string;
                userId: string;
                receiver: string;
                taskCreatedBlock: bigint;
            }

            const params: Task = {
                ticket: task[0],
                userId: task[1],
                receiver: task[2],
                taskCreatedBlock: task[3],
            };
            
            // Send a transaction to the createNewTask function
            const tx = await veritradeServiceManager.completeTask(
                metadata,
                params,
                taskIndex,
                signedTask
            );
            
            // Wait for the transaction to be mined
            const receipt = await tx.wait();
            
            console.log(`Complete Task Transaction successful with hash: ${receipt.hash}`);
            console.log(`\n`);
          } catch (error) {
            console.error('Error sending transaction:', error);
            return;
          }
    }
};

const registerOperator = async () => {
    
    // Registers as an Operator in EigenLayer.
    try {
        const tx1 = await delegationManager.registerAsOperator({
            __deprecated_earningsReceiver: await wallet.address,
            delegationApprover: "0x0000000000000000000000000000000000000000",
            stakerOptOutWindowBlocks: 0
        }, "");
        await tx1.wait();
        console.log("Operator registered to Core EigenLayer contracts");
    } catch (error) {
        console.error("Error in registering as operator:", error);
    }
    
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now

    // Define the output structure
    let operatorSignatureWithSaltAndExpiry = {
        signature: "",
        salt: salt,
        expiry: expiry
    };

    // Calculate the digest hash, which is a unique value representing the operator, avs, unique value (salt) and expiration date.
    const operatorDigestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address, 
        await veritradeServiceManager.getAddress(), 
        salt, 
        expiry
    );
    console.log(operatorDigestHash);
    
    // Sign the digest hash with the operator's private key
    console.log("Signing digest hash with operator's private key");
    const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
    const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

    // Encode the signature in the required format
    operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(operatorSignedDigestHash).serialized;

    console.log("Registering Operator to AVS Registry contract");

    try {    
        // Register Operator to AVS
        // Per release here: https://github.com/Layr-Labs/eigenlayer-middleware/blob/v0.2.1-mainnet-rewards/src/unaudited/ECDSAStakeRegistry.sol#L49
        const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
            operatorSignatureWithSaltAndExpiry,
            wallet.address
        );
        await tx2.wait();
        console.log("Operator registered on AVS successfully");
    } catch (error) {
        console.error("Error in registering as operator:", error);
    }
};

const monitorNewTasks = async () => {
    veritradeServiceManager.on("NewTaskCreated", async (taskIndex: number, task: any) => {
        console.log(`New task detected: Data ==> ${task}`);
        await signAndRespondToTask(taskIndex, task);
    });

    console.log("Monitoring for new tasks...");
};

const main = async () => {
    if (!isRegisterOperatorSkip) {
        await registerOperator();
    }
    
    monitorNewTasks().catch((error) => {
        console.error("Error monitoring tasks:", error);
    });
};

main().catch((error) => {
    console.error("Error in main function:", error);
});