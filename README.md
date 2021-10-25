## Cross Chain Ample

[![Build Status](https://travis-ci.com/ampleforth/cross-chain-ample.svg?token=xxNsLhLrTiyG3pc78i5v&branch=master)](https://travis-ci.com/ampleforth/ampl-bridge-solidity)&nbsp;[![Coverage Status](https://coveralls.io/repos/github/ampleforth/ampl-bridge-solidity/badge.svg?branch=master&t=QkPsQb)](https://coveralls.io/github/ampleforth/ampl-bridge-solidity?branch=master)

Solidity contracts for cross-chain AMPL through bridges.

It supports integration with any cross chain bridge which supports generic data transfer. To integrate with a new bridge, custom bridge specific 'bridge-gateway' contracts need to be implemented which deals with bridge specific ABIs and data parsing.

[Get up to speed](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-Bridge-Primer).

### Live Deployments

```yaml
# Ethereum Mainnet

# core protocol (controlled by Ampleforth Governance)
token: 0xD46bA6D942050d489DBd938a2C909A5d5039A161
policy: 0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea
orchestrator: 0x6FB00a180781E75F87E2B690Af0196bAa77C7e7C

# bridge contracts (controlled by Ampleforth Bridge DAO on Ethereum)
owner: 0x57981B1EaFe4b18EC97f8B10859B40207b364662
# reports rebase to every bridge in the list
batchRebaseReporter: 0x25fbC7D475B5013f631E5BB7f9Da57A8d1522179
vaults:
  - bridge: meter-passport
    vault: 0x805c7Ecba41f9321bb098ec1cf31d86d9407de2F
  - bridge: matic
    vault: 0xCFedb6b85283fBBD0f5F30c5F75324A4B91819c5

# additional utility contracts
meterPassportBatcher: 0x454de9c544fcae74eb09c57a042349d3ead07e29

# BSC (controlled by Ampleforth Bridge DAO on BSC)
owner: 0x1501FBc20d3D0C1FEF146B528e7Cd9a003aBf281
token: 0xDB021b1B247fe2F1fa57e0A87C748Cc1E321F07F
controller: 0x17F084dFF8a71e38521BCBD3Da871753Dc67aa81
rebaseRelayer: 0x0c0144D04594AB99F4C02691B6684e3d871B589e

# AVAX (controlled by Ampleforth Bridge DAO on AVAX)
owner: 0x744ab0D47Ce9650E4d0eD45112d04BaA19dF4260
token: 0x027dbcA046ca156De9622cD1e2D907d375e53aa7
controller: 0x24232ccAf8bB87908C419aD7dDCca8cc9e74746d
rebaseRelayer: 0xE3a0B70676ed6e1947140Ff0b332cAe7d7f0364B

# Meter (controlled by Ampleforth Bridge DAO on METER)
# TODO: yet to transfer ownership
owner: 0x240aa3CA55D3f8dF80936a84Ff076bF9A09370Fa
token: 0xc67238827da94B15F6bA10F3d35f690809919F75
controller: 0x0AF32F7B0733DBFe59E52712c3fBF2d1B4ebd00f
rebaseRelayer: 0x4960382cA3151Df595b944731304F71Df7eDb35A

# Matic / Polygon (controlled by Ampleforth Bridge DAO on Matic)
owner: 0x5d96A65E51A78C511C545a0247eb2d006912b636
token: 0xc67238827da94B15F6bA10F3d35f690809919F75
controller: 0x0AF32F7B0733DBFe59E52712c3fBF2d1B4ebd00f
rebaseRelayer: 0x4960382cA3151Df595b944731304F71Df7eDb35A
```

### Working Bridges
  * [ChainBridge](https://github.com/ampleforth/ampl-bridge-solidity/wiki/AMPL-ChainBridge)
  * [Polygon](https://docs.matic.network/docs/develop/l1-l2-communication/state-transfer/)

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


## Deployments

### Testnet
* [Deploy meter passport DEV](https://github.com/ampleforth/cross-chain-ample/wiki/AMPL-Meter-Passport-dev-deployment)
* [Deploy Matic DEV](https://github.com/ampleforth/cross-chain-ample/wiki/Matic-dev-deployment)

### Production
* [Deploy meter passport PROD](https://github.com/ampleforth/cross-chain-ample/wiki/AMPL-Meter-Passport-prod-deployment)
* [Deploy Matic PROD](https://github.com/ampleforth/cross-chain-ample/wiki/Matic-prod-deployment)
