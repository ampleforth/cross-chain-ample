require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ganache');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('solidity-coverage');

require('./tasks/deploy/xc_ample');
require('./tasks/deploy/testnet_ampl');
require('./tasks/deploy/chain_bridge');
require('./tasks/deploy/base_chain_bridge_gateway');
require('./tasks/deploy/satellite_chain_bridge_gateway');

require('./tasks/testnet/report_rebase');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.4.24'
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  mocha: {
    timeout: 100000
  },
  gasReporter: {
    currency: 'USD',
    enabled: !!process.env.REPORT_GAS,
    excludeContracts: ['_mocks', '_external', 'uFragments'],
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },

  networks: {
    hardhat: {},
    ganacheBaseChain: {
      url: 'http://localhost:8545'
    },
    ganacheSatChain1: {
      url: 'http://localhost:8546'
    },
    ganacheSatChain2: {
      url: 'http://localhost:8547'
    }
  }
};
