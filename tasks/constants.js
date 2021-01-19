const ethers = require('ethers');
const {createResourceID} = require('./utils')

const COMPILED_CONTRACTS_PATH = __dirname + '/../artifacts';
const DEPLOYMENT_CONFIG_PATH = __dirname + '/../deployments';
const HARDHAT_CONFIG_PATH = __dirname + '/../hardhat.config.js';

const ContractABIs = {
  Bridge: require(COMPILED_CONTRACTS_PATH +
    '/chainbridge-solidity/contracts/Bridge.sol/Bridge.json'),
  GenericHandler: require(COMPILED_CONTRACTS_PATH +
    '/chainbridge-solidity/contracts/handlers/GenericHandler.sol/GenericHandler.json'),

  AMPLChainBridgeGateway: require(COMPILED_CONTRACTS_PATH +
    '/contracts/base-chain/bridge-gateways/AMPLChainBridgeGateway.sol/AMPLChainBridgeGateway.json'),
  ChainBridgeXCAmpleGateway: require(COMPILED_CONTRACTS_PATH +
    '/contracts/satellite-chain/bridge-gateways/ChainBridgeXCAmpleGateway.sol/ChainBridgeXCAmpleGateway.json'),

  XCAmple: require(COMPILED_CONTRACTS_PATH +
    '/contracts/satellite-chain/xc-ampleforth/XCAmple.sol/XCAmple.json'),
  XCAmplController: require(COMPILED_CONTRACTS_PATH +
    '/contracts/satellite-chain/xc-ampleforth/XCAmpleController.sol/XCAmpleController.json'),
  BatchTxExecutor: require(COMPILED_CONTRACTS_PATH +
    '/contracts/_utilities/BatchTxExecutor.sol/BatchTxExecutor.json'),

  UFragments: require(COMPILED_CONTRACTS_PATH +
    '/uFragments/contracts/UFragments.sol/UFragments.json'),
  UFragmentsPolicy: require(COMPILED_CONTRACTS_PATH +
    '/uFragments/contracts/UFragmentsPolicy.sol/UFragmentsPolicy.json'),
};

const AMPL_DECIMALS = 9;
const toAmplDenomination = (ample) =>
  ethers.utils.parseUnits(ample, AMPL_DECIMALS);
const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + AMPL_DECIMALS);
const DECIMALS = 18;
const AMPL_BASE_RATE = ethers.utils.parseUnits('1', DECIMALS);
const AMPL_BASE_CPI = ethers.utils.parseUnits('100', DECIMALS);


const CB_DEFAULT_SOURCE_ID = 0;
const CB_DEFAULT_DEST_ID = 1;
const CB_REBASE_RESOURCE = createResourceID('Ampleforth::rebaseReport');
const CB_TRANSFER_RESOURCE =createResourceID('AMPL::transfer');
const CB_BLANK_FUNCTION_SIG = '0x00000000';

module.exports = {
  ContractABIs,

  COMPILED_CONTRACTS_PATH,
  DEPLOYMENT_CONFIG_PATH,
  HARDHAT_CONFIG_PATH,

  CB_DEFAULT_SOURCE_ID,
  CB_DEFAULT_DEST_ID,
  CB_REBASE_RESOURCE,
  CB_TRANSFER_RESOURCE,
  CB_BLANK_FUNCTION_SIG,

  AMPL_DECIMALS,
  INITIAL_SUPPLY,
  DECIMALS,
  AMPL_BASE_RATE,
  AMPL_BASE_CPI,
};
