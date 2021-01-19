## Cross Chain Ample

[![Build Status](https://travis-ci.com/ampleforth/ampl-bridge-solidity.svg?token=xxNsLhLrTiyG3pc78i5v&branch=master)](https://travis-ci.com/ampleforth/ampl-bridge-solidity)&nbsp;[![Coverage Status](https://coveralls.io/repos/github/ampleforth/ampl-bridge-solidity/badge.svg?branch=master&t=QkPsQb)](https://coveralls.io/github/ampleforth/ampl-bridge-solidity?branch=master)

Solidity contracts for cross-chain AMPL through bridges.

Currently supports integration with ChainSafe's [chain-bridge](https://github.com/ChainSafe/chainbridge-solidity). However it could work with any bridge which supports generic data transfer. To integrate with a new bridge, custom bridge specific 'bridge-gateway' contracts need to be implemented which deals with bridge specific ABIs and data parsing.

[Get up to speed](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-Bridge-Primer).

### Working Bridges
  * [ChainBridge](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-ChainBridge)

## Contracts

1. [Base Chain](./contracts/base-chain)
    * [TokenVault](./contracts/base-chain/TokenVault.sol)
    * [AMPL-Bridge-Gateway](./contracts/base-chain/bridge-gateways)

2. [Satellite Chain](./contracts/satellite-chain)
    * [Bridge-XCAmple-Gateway](./contracts/satellite-chain/bridge-gateways)
    * [XC-Ampleforth](./contracts/satellite-chain/xc-ampleforth)

End to end architecture is described [here](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-Bridge-Architecture).

## Getting Started

```
# Compile contracts
yarn compile

# Lint code
yarn lint

# Format code
yarn format

# Run solidity coverage report (compatible with node v12)
yarn coverage

# Run solidity gas usage report
yarn profile
```

## Contract Integration Tests

This test suite (`/test/intgration`) deploys 1 instance of the base chain contracts and 2 instances
of satellite chain contracts with the same configuration as the final deployment on the same ganache instance. Off-chain service interactions are mocked through testing scripts. ie) Contracts think they are talking to other contracts from a different blockchain but all of them lie on the same ganache instance and off-chain calls are mocked.


1) 1 instance of the Ampleforth Protocol (base chain)
2) 3 instances the bridge protocol contracts; (1 base and 2 satellite chains)
3) 1 instance of the AMPL-Bridge gateway contract (base chain)
4) 2 instances of the Bridge-XCAmple gateway contract (2 satellite chains)

### Test cases

Each new bridge integration should check for the following cases.

**Rebases:**
- [ ] +ve, -ve and neutral rebase is propagated from the base chain to multiple satellite chains, it should update balances in the satellite chains correctly
- [ ] When +ve, -ve and neutral rebases on the base chain are missed by the bridge, then next rebase should update balances correctly on the satellite chains

**Transfers:**
- [ ] User transfers from base to satellite chain and back
- [ ] User transfers from base to satellite chain and back around rebases, where transfers are before, after and in-between rebase propagation to the target chain.

- [ ] User transfers from satellite to another satellite chain and back
- [ ] User transfers from satellite to another satellite chain and back around rebases, where transfers are before, after and in-between rebase propagation to the target chain.


## Deployment

```
yarn hardhat --network ganacheBaseChain testnet_ampl:deploy

yarn hardhat --network ganacheBaseChain  chain_bridge:deploy --chain-id 100
yarn hardhat --network ganacheSatChain1  chain_bridge:deploy --chain-id 200
yarn hardhat --network ganacheSatChain2  chain_bridge:deploy --chain-id 201

yarn hardhat --network ganacheSatChain1 xc_ample:deploy --token-name "sat1-chainBridge-Ample" --token-symbol "sat1CBAmple" --base-chain-network ganacheBaseChain
yarn hardhat --network ganacheSatChain2 xc_ample:deploy --token-name "sat2-chainBridge-Ample" --token-symbol "sat2CBAmple" --base-chain-network ganacheBaseChain

yarn hardhat --network ganacheBaseChain  base_chain_bridge_gateway:deploy
yarn hardhat --network ganacheSatChain1 satellite_chain_bridge_gateway:deploy
yarn hardhat --network ganacheSatChain2 satellite_chain_bridge_gateway:deploy
```
