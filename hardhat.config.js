require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ganache');
require('@openzeppelin/hardhat-upgrades');

require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-etherscan');

require('./tasks/deploy/ampleforth');
require('./tasks/deploy/chain_bridge');
require('./tasks/deploy/matic');
require('./tasks/deploy/arbitrum');
require('./tasks/deploy/rebase_reporter');

require('./tasks/ops/rebase');
require('./tasks/ops/xc_transfer');

require('./tasks/info/config');
require('./tasks/info/ampl');
require('./tasks/info/chain_bridge');
require('./tasks/info/cb_ampl_tx');

require('./tasks/upgrade');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.4.24'
      },
      {
        version: '0.5.12'
      },
      {
        version: '0.6.4'
      },
      {
        version: '0.6.8'
      },
      {
        version: '0.6.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.7.3',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.7.6',
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
    timeout: 1000000
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

    // meter-passport
    dev1RopstenBaseChain: {
      url: 'https://eth-ropsten.alchemyapi.io/v2/' + process.env.ALCHEMY_SECRET
    },
    dev1BscTestnetSatChain: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545'
    },
    dev1MeterTestnetSatChain: {
      url: 'https://rpctest.meter.io'
    },

    // matic
    dev2GoerliBaseChain: {
      url: 'https://eth-goerli.alchemyapi.io/v2/' + process.env.ALCHEMY_SECRET
    },
    dev2MumbaiSatChain: {
      url: 'https://polygon-mumbai.infura.io/v3/' + process.env.INFURA_SECRET
    },

    // arbitrum
    dev3RinkebyBaseChain: {
      url: 'https://eth-rinkeby.alchemyapi.io/v2/' + process.env.ALCHEMY_SECRET
    },
    dev3RinkebyArbitrumSatChain: {
      url: 'https://rinkeby.arbitrum.io/rpc'
    },

    // prod
    prodEthereumBaseChain: {
      url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_SECRET
    },
    prodBscSatChain: {
      url: 'https://bsc-dataseed.binance.org'
    },
    prodAvaxSatChain: {
      url: 'https://api.avax.network/ext/bc/C/rpc'
    },
    prodMeterSatChain: {
      url: 'https://rpc.meter.io'
    },
    prodMaticSatChain: {
      url: 'https://polygon-mainnet.infura.io/v3/' + process.env.INFURA_SECRET
    }
  }
};
