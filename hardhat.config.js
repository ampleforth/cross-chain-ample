require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ganache');
require('@openzeppelin/hardhat-upgrades');

require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-etherscan');

require('./tasks/deploy/ampleforth');
require('./tasks/deploy/chain_bridge');

require('./tasks/ops/rebase');
require('./tasks/ops/xc_transfer');

require('./tasks/info/ampl');
require('./tasks/info/chain_bridge');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.4.24'
      },
      {
        version: '0.7.6'
      },
      {
        version: '0.6.4'
      },
      {
        version: '0.5.12'
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

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },

  networks: {
    hardhat: {},

    gethBaseChain: {
      url: 'http://localhost:7545'
    },
    gethSatChain1: {
      url: 'http://localhost:7550'
    },
    gethSatChain2: {
      url: 'http://localhost:7555'
    },

    rinkebyBaseChain: {
      url: 'https://rinkeby.infura.io/v3/b117b6719619448892c158d64291aa24'
    },
    goerliSatChain1: {
      url: 'https://goerli.infura.io/v3/b117b6719619448892c158d64291aa24'
    }
  }
};
