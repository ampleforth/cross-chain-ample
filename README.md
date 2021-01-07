## AMPL Bridge Solidity

Solidity contracts for cross-chain AMPL through bridges.

Currently supports integration with ChainSafe's [chain-bridge](https://github.com/ChainSafe/chainbridge-solidity). However it could work with any bridge which supports generic data transfer. To integrate with a new bridge, custom bridge specific 'bridge-gateway' contracts need to be implemented which deals with bridge specific ABIs and data parsing.

[Read more](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-Bridge-Primer)

### Working Bridges
  * [ChainBridge](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-ChainBridge)

## Components

1. [XC-Ampleforth](./contracts/xc-ampleforth) - OtherChain
2. [BridgeGateways](./contracts/bridge-gateways/chain-bridge) - Ethereum/OtherChain
3. [TokenVault](./contracts/TokenVault.sol) - Ethereum

## Getting Started

```
yarn install
yarn test
```

## Contract Integration Tests

This test suite deploys the Ampleforth Protocol, Bridge Protocol and Bridge Gateway contracts with the same configuration as the final deployment. Off-chain service interactions are mocked through testing scripts.

### Test cases

Each bridge integration should check for the following cases.

Rebases:
- [ ] +ve, -ve and neutral rebase is propagated from the source chain to the target chain, it should update balances in the target chain correctly
- [ ] When +ve, -ve and neutral are missed by the bridge, then next rebase should update balances correctly

Transfers:
- [ ] User transfers from source chain to target chain and back
- [ ] User transfers from source chain to target chain and back around rebases, where transfers are before, after and in-between rebase propagation.
