## AMPL Bridge Solidity

Solidity contracts for cross-chain AMPL through bridges.

Currently supports integration with ChainSafe's [chain-bridge](https://github.com/ChainSafe/chainbridge-solidity). However it could work with any bridge which supports generic data transfer. To integrate with a new bridge, custom bridge specific 'bridge-gateway' contracts need to be implemented which deals with bridge specific ABIs and data parsing.

[Get up to speed](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-Bridge-Primer).

### Working Bridges
  * [ChainBridge](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-ChainBridge)

## Components

1. [XC-Ampleforth](./contracts/xc-ampleforth) - Satellite chain
2. [BridgeGateways](./contracts/bridge-gateways/chain-bridge) - Base chain & Satellite chain
3. [TokenVault](./contracts/TokenVault.sol) - Base chain

## Getting Started

```
yarn install
yarn test
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
