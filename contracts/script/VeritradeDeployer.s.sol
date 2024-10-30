// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import {VeritradeDeploymentLib} from "./utils/VeritradeDeploymentLib.sol";
import {CoreDeploymentLib} from "./utils/CoreDeploymentLib.sol";
import {UpgradeableProxyLib} from "./utils/UpgradeableProxyLib.sol";
import {StrategyBase} from "@eigenlayer/contracts/strategies/StrategyBase.sol";
import {ERC20Mock} from "../test/ERC20Mock.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {StrategyFactory} from "@eigenlayer/contracts/strategies/StrategyFactory.sol";
import {StrategyManager} from "@eigenlayer/contracts/core/StrategyManager.sol";

import {Quorum, StrategyParams, IStrategy} from "@eigenlayer-middleware/src/interfaces/IECDSAStakeRegistryEventsAndErrors.sol";

contract VeritradeDeployer is Script {
    using CoreDeploymentLib for *;
    using UpgradeableProxyLib for address;

    address private deployer;
    address proxyAdmin;
    IStrategy veritradeStrategy;
    CoreDeploymentLib.DeploymentData coreDeployment;
    VeritradeDeploymentLib.DeploymentData veritradeDeployment;
    Quorum internal quorum;
    ERC20Mock token;

    function setUp() public virtual {
        deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        vm.label(deployer, "Deployer");

        coreDeployment = CoreDeploymentLib.readDeploymentJson(
            "deployments/core/",
            block.chainid
        );
        token = new ERC20Mock();
        veritradeStrategy = IStrategy(
            StrategyFactory(coreDeployment.strategyFactory).deployNewStrategy(
                token
            )
        );

        quorum.strategies.push(
            StrategyParams({strategy: veritradeStrategy, multiplier: 10_000})
        );
    }

    function run() external {
        vm.startBroadcast(deployer);
        proxyAdmin = UpgradeableProxyLib.deployProxyAdmin();
        veritradeDeployment = VeritradeDeploymentLib.deployContracts(
            proxyAdmin,
            coreDeployment,
            quorum
        );

        veritradeDeployment.strategy = address(veritradeStrategy);
        veritradeDeployment.token = address(token);
        vm.stopBroadcast();

        verifyDeployment();
        VeritradeDeploymentLib.writeDeploymentJson(veritradeDeployment);
    }

    function verifyDeployment() internal view {
        require(
            veritradeDeployment.stakeRegistry != address(0),
            "StakeRegistry address cannot be zero"
        );
        require(
            veritradeDeployment.veritradeServiceManager != address(0),
            "VeritradeServiceManager address cannot be zero"
        );
        require(
            veritradeDeployment.strategy != address(0),
            "Strategy address cannot be zero"
        );
        require(proxyAdmin != address(0), "ProxyAdmin address cannot be zero");
        require(
            coreDeployment.delegationManager != address(0),
            "DelegationManager address cannot be zero"
        );
        require(
            coreDeployment.avsDirectory != address(0),
            "AVSDirectory address cannot be zero"
        );
    }
}
