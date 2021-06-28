const fs = require('fs');
const { getAdminAddress } = require('@openzeppelin/upgrades-core');

const DEPLOYMENT_CONFIG_PATH = __dirname + '/../sdk/deployments';
const { getEthersProvider } = require('./utils');

const BLOCKS_PER_SEC = 1 / 15;

const ContractABIPaths = {
  // Openzepppelin
  ProxyAdmin: '@openzeppelin/upgrades/contracts/upgradeability',

  // Ampleforth
  UFragments: 'uFragments/contracts',
  UFragmentsPolicy: 'uFragments/contracts',
  Orchestrator: 'uFragments/contracts',
  MedianOracle: 'market-oracle/contracts',

  // Chainbridge
  Bridge: 'chainbridge-solidity/contracts',
  GenericHandler: 'chainbridge-solidity/contracts/handlers',
  ERC20Handler: 'chainbridge-solidity/contracts/handlers',
  ERC721Handler: 'chainbridge-solidity/contracts/handlers',

  // cross-chain ample
  XCAmple: 'contracts/satellite-chain/xc-ampleforth',
  XCAmpleController: 'contracts/satellite-chain/xc-ampleforth',
  BatchTxExecutor: 'contracts/_utilities',

  TokenVault: 'contracts/base-chain',

  AMPLChainBridgeGateway: 'contracts/base-chain/bridge-gateways',
  ChainBridgeXCAmpleGateway: 'contracts/satellite-chain/bridge-gateways',
  AMPLChainBridgeGateway: 'contracts/base-chain/bridge-gateways',
  ChainBridgeXCAmpleGateway: 'contracts/satellite-chain/bridge-gateways',

  AMPLMaticRebaseGateway: 'contracts/base-chain/bridge-gateways',
  AMPLMaticTransferGateway: 'contracts/base-chain/bridge-gateways',
  MaticXCAmpleRebaseGateway: 'contracts/satellite-chain/bridge-gateways',
  MaticXCAmpleTransferGateway:
    'contracts/satellite-chain/bridge-gateways',

  // utilities
  ChainBridgeBatchRebaseReport: 'contracts/_utilities',
};

const getCompiledContractFactory = (ethers, contract) => {
  return ethers.getContractFactory(
    `${ContractABIPaths[contract]}/${contract}.sol:${contract}`,
  );
};

const deployContract = async (ethers, contractName, signer, args, txParams) => {
  const Factory = await getCompiledContractFactory(ethers, contractName);
  const contract = await Factory.connect(signer).deploy(...args, txParams);
  await contract.deployTransaction.wait();
  return contract;
};

const deployProxyAdminContract = async (ethers, signer, txParams) => {
  return deployContract(ethers, 'ProxyAdmin', signer, [], txParams);
};

const deployProxyContract = async (
  ethers,
  contractName,
  newProxyAdmin,
  signer,
  args,
  initializerDef,
  txParams,
) => {
  const ProxyAdminFactory = await getCompiledContractFactory(
    ethers,
    'ProxyAdmin',
  );
  const Factory = await getCompiledContractFactory(ethers, contractName);
  const contract = await upgrades.deployProxy(
    Factory.connect(signer),
    args,
    initializerDef,
    txParams,
  );
  await contract.deployTransaction.wait();
  const defaultProxyAdmin = ProxyAdminFactory.connect(signer).attach(
    await getAdminAddress(signer.provider, contract.address),
  );
  const refChangeTx = await defaultProxyAdmin.changeProxyAdmin(
    contract.address,
    newProxyAdmin.address,
    txParams,
  );
  await refChangeTx.wait();

  return contract;
};

const getDeployedContractInstance = async (network, contractName, provider) => {
  const contractData = await readContractDeploymentData(network, contractName);
  return new ethers.Contract(contractData.address, contractData.abi, provider);
};

const readDeploymentData = (network) => {
  const addressFile = `${DEPLOYMENT_CONFIG_PATH}/${network}.json`;
  return JSON.parse(fs.readFileSync(addressFile));
};

const readContractDeploymentData = async (network, contractRef) => {
  const deploymentData = await readDeploymentData(network);
  return deploymentData[contractRef];
};

const writeBulkDeploymentData = (network, dt) => {
  const addressFile = `${DEPLOYMENT_CONFIG_PATH}/${network}.json`;
  const chainAddresses = fs.existsSync(addressFile)
    ? JSON.parse(fs.readFileSync(addressFile))
    : {};
  const updatedAddresses = Object.assign(chainAddresses, dt);
  fs.writeFileSync(addressFile, JSON.stringify(updatedAddresses, null, 2));
  console.log('Output written to', addressFile);
};

const writeDeploymentData = async (network, contractRef, contract) => {
  const addressFile = `${DEPLOYMENT_CONFIG_PATH}/${network}.json`;

  const chainAddresses = fs.existsSync(addressFile)
    ? JSON.parse(fs.readFileSync(addressFile))
    : {};

  if (contract.deployTransaction) {
    const tx = await contract.deployTransaction;
    const txR = await tx.wait();
    chainAddresses[contractRef] = {
      address: contract.address,
      abi: contract.interface.format(),
      hash: tx.hash,
      blockNumber: txR.blockNumber,
    };
  } else {
    chainAddresses[contractRef] = {
      address: contract.address,
      abi: contract.interface.format(),
    };
  }

  fs.writeFileSync(addressFile, JSON.stringify(chainAddresses, null, 2));
};

const writeProxyDeploymentData = async (network, contractRef, contract) => {
  const addressFile = `${DEPLOYMENT_CONFIG_PATH}/${network}.json`;

  const chainAddresses = fs.existsSync(addressFile)
    ? JSON.parse(fs.readFileSync(addressFile))
    : {};

  const tx = await contract.deployTransaction;
  const txR = await tx.wait();
  chainAddresses[contractRef] = {
    address: contract.address,
    abi: contract.interface.format(),
    hash: tx.hash,
    blockNumber: txR.blockNumber,
    proxyAdmin: await getAdminAddress(
      getEthersProvider(network),
      contract.address,
    ),
  };

  fs.writeFileSync(addressFile, JSON.stringify(chainAddresses, null, 2));
};

const filterContractEvents = async (
  ethers,
  provider,
  address,
  abi,
  event,
  startBlock,
  endBlock,
  timeFrameSec = 7 * 24 * 3600,
) => {
  endBlock = endBlock || (await provider.getBlockNumber());
  const freq = timeFrameSec * BLOCKS_PER_SEC;

  let logs = [];
  for (let i = startBlock; i <= endBlock; i += freq) {
    // console.log(i, startBlock, endBlock)
    const _logs = await provider.getLogs({
      address: address,
      fromBlock: ethers.utils.hexlify(i),
      toBlock: ethers.utils.hexlify(i + freq > endBlock ? endBlock : i + freq),
    });
    logs = logs.concat(_logs);
  }

  const contractInterface = new ethers.utils.Interface(abi);
  const decodedEvents = logs.reduce((m, log) => {
    try {
      log.parsed = contractInterface.parseLog(log);
      log.parsed.name == event ? m.push(log) : m;
      return m;
    } catch (e) {
      return m;
    }
  }, []);
  return decodedEvents;
};

module.exports = {
  readDeploymentData,
  readContractDeploymentData,
  writeBulkDeploymentData,
  writeDeploymentData,

  getCompiledContractFactory,
  getDeployedContractInstance,

  deployContract,
  deployProxyAdminContract,
  deployProxyContract,

  filterContractEvents,
};
