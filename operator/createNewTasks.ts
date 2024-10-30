import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/veritrade/${chainId}.json`), 'utf8'));
const veritradeServiceManagerAddress = avsDeploymentData.addresses.veritradeServiceManager;
const veritradeServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/VeritradeServiceManager.json'), 'utf8'));
// Initialize contract objects from ABIs
const veritradeServiceManager = new ethers.Contract(veritradeServiceManagerAddress, veritradeServiceManagerABI, wallet);

// Function to generate random data
function generateRandomData(): [string, string, string] {
    const tickets = ['uJklm', 'kkLyu', 'skcku', 'jkuio', 'mlkui', 'suiko', 'cklius', 'bnjkty'];
    const userIds = ['111111', '222222', '333333', '444444', '111111', '343434', '656565', '78989'];
    const receivers = ['0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B', '0xa96d6cd30d61c27b125d81B2AAd64c56c46FB79B'];

    const index = Math.floor(Math.random() * tickets.length);

    const ticket = tickets[index];
    const userId = userIds[index];
    const receiver = receivers[index];

    console.log(`Random: ${ticket} ${userId} ${receiver}`);
    return [ticket, userId, receiver];
  }

async function createNewTask(ticket: string, userId: string, receiver: string) {
    console.log(`Creating Task with ticket: ${ticket}, userId: ${userId}, receiver: ${receiver}`);

    // NEW TASK
    try {
        // Send a transaction to the createNewTask function
        const txTask = await veritradeServiceManager.createTask(ticket, userId, receiver);
        
        // Wait for the transaction to be mined
        const receiptTask = await txTask.wait();

        console.log(`Create New Task Transaction successful with hash: ${receiptTask.hash}`);
        console.log(`\n`);
    } catch (error) {
        console.error('Error sending transaction:', error);
        return;
    }
  
}

// Function to create a new task with a random name every 15 seconds
function startCreatingTasks() {

  let data = generateRandomData();
  console.log(`Creating new task with data: ${data}`);
  createNewTask(data[0], data[1], data[2]);

  setInterval(() => {
    data = generateRandomData();
    console.log(`Creating new task with data: ${data}`);
    createNewTask(data[0], data[1], data[2]);
  }, 5000);
}

// Start the process
startCreatingTasks();