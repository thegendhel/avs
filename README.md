# Veritrade

Create proof of your CEX trades Pnl and verify it onchain via AVS

## Overview

![alt text](https://github.com/thegendhel/avs/blob/main/veritrade.png?raw=true)

The trader create a ticket in the service, which will later be used by AVS to obtain the API key and signature needed to call the Binance API.

The trader executes Create Task transaction in the Veritrade smart contract, including the ticket data.

AVS Veritrade, which monitors new tasks, then uses the ticket to call the Mock Veritrade service API to obtain the trader's API key and signature.

AVS Veritrade then uses the API key and signature to call the Binance API and verify them.

If valid, AVS Veritrade will execute Complete Task in the Veritrade smart contract to issue an NFT to the trader's wallet.

## AVS Smartcontracts

### Build

```shell
$ forge build
```

### Deploy Eigen

```shell
$ forge script script/DeployEigenLayerCore.s.sol --rpc-url <RPC_URL> --broadcast
```

### Deploy Veritrade

```shell
$ forge script script/VeritradeDeployer.s.sol --rpc-url  <RPC_URL> --broadcast
```

## AVS Operator

### Run AVS Operator

```shell
$ npm start start:operator
```

### Run AVS Operator Skip Operator Register

```shell
$ npm start start:operator:skip
```

### Run Traffic

```shell
$ npm start start:traffic
```

### Run Mock ticket service

```shell
$ npm start start:service
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
