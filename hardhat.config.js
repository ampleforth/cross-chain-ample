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

require('./tasks/info/config');
require('./tasks/info/ampl');
require('./tasks/info/chain_bridge');
require('./tasks/info/cb_ampl_tx');

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
        version: '0.6.8'
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

  bscscan: {
    apiKey: process.env.BSCSCAN_API_KEY
  },

  networks: {
    localGethBaseChain: {
      url: 'http://localhost:7545'
    },
    localGethSatChain1: {
      url: 'http://localhost:7550'
    },
    localGethSatChain2: {
      url: 'http://localhost:7555'
    },

    devRopstenBaseChain: {
      url: 'https://eth-ropsten.alchemyapi.io/v2/' + process.env.ALCHEMY_SECRET
    },
    devBscTestnetSatChain: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545'
    },
    devMeterTestnetSatChain: {
      url: 'http://s11.meter.io:8545'
    },

    prodEthereumBaseChain: {
      url: 'https://eth-mainnet.alchemyapi.io/v2/' + process.env.ALCHEMY_SECRET
    },
    prodBscSatChain: {
      url: 'https://bsc-dataseed.binance.org/'
    }
  }
};
