module.exports = {
  extends: ['google', 'standard', 'plugin:prettier/recommended', 'mocha'],
  env: {
    mocha: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 8,
  },
  globals: {
    artifacts: true,
    assert: true,
    contract: true,
    expect: true,
    Promise: true,
    web3: true,
  },
  plugins: ['prettier', 'spellcheck', 'chai-friendly'],
  rules: {
    'prettier/prettier': 0,
    'require-jsdoc': 0,
    'guard-for-in': 0,
    semi: [2, 'always'],
    'prefer-const': 2,
    'no-unused-expressions': 0,
    'chai-friendly/no-unused-expressions': 2,
    'spellcheck/spell-checker': [
      2,
      {
        comments: true,
        strings: true,
        identifiers: true,
        lang: 'en_US',
        skipWords: [
          // misc
          'deployer',
          'http',
          'https',
          'github',
          'chai',
          'argv',
          'jsonrpc',
          'timestamp',
          'uint256',
          'erc20',
          'bignumber',
          'lodash',
          'seedrandom',
          'sinon',
          'yaml',
          'posix',
          'promisify',
          'passcode',
          'geth',
          'rpcmsg',
          'stdev',
          'stochasm',
          'aggregator',
          'whitelist',
          'ethereum',
          'testrpc',
          'solc',
          'whitelisted',
          'unlockable',
          'openzeppelin',
          'checksum',
          'unstakes',
          'txfee',
          'relayer',
          'struct',
          'const',
          'mlog',
          'ascii',
          'mainnet',
          'rinkeby',
          'ethereumjs',
          'priv',
          'keystore',
          'hdwallet',
          'keyfile',
          'kovan',
          'ethers',
          'nomadiclabs',
          'buidler',
          'initializer',
          'nomiclabs',
          'upgradable',
          'ethersproject',
          'hexlify',
          'utf8',
          'Utf8Bytes',
          'keccak256',
          'Sighash',
          'ecsign',

          // shorthand
          'args',
          'util',
          'utils',
          'prev',
          'init',
          'params',
          'async',
          'vals',
          'addrs',
          'bals',
          'addr',
          'perc',
          'opcode',
          'aprox',

          // project-specific
          'rebase',
          'gons',
          'blockchain',
          'minlot',
          'redemptions',
          'rebased',
          'ganache',
          'ethclient',
          'bytecode',
          'Binance',
          'ampl',
          'unstake',
          'unstaked',
          'unstaking',
          'ampls',
          'staker',
          'ownable',
          'Balancer',
          'Denormalized',
          'rebalance',
          'resync',
          'bmath',
          'Orchestrator',
          'xcampleforth',
          'ampleforth',
          'upgradeable',
          'chainsafe',
          'chainbridge',
          'amples',
          'xcampl',
          'acala',
          'rebasing',
          'depositer',
          'coinmarketcap',
          'nonces',
          'testnet',
          'etherscan',
          'goerli',
          'relayers',
          'offchain',

          // names
          'nithin',
          'naguib',
        ],
        skipIfMatch: ['http(s)?://[^s]*', 'Sha3', '0x*', 'Utf8'],
        minLength: 4,
      },
    ],
  },
};
