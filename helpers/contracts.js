const fs = require('fs');
const path = require('path');
const { getAdminAddress } = require('@openzeppelin/upgrades-core');

const DEPLOYMENT_CONFIG_PATH = path.join(__dirname, '/../sdk/deployments');
const { getEthersProvider } = require('./utils');

const BLOCKS_PER_SEC = 1 / 15;

const ContractABIPaths = {
  // Openzeppelin
  ProxyAdmin: '@openzeppelin/upgrades/contracts/upgradeability',

  // Ampleforth
  UFragments: 'ampleforth-contracts/contracts',
  UFragmentsPolicy: 'ampleforth-contracts/contracts',
  Orchestrator: 'ampleforth-contracts/contracts',
  MedianOracle: 'market-oracle/contracts',
  UFragmentsTestnet: 'contracts/_test',

  // Chainbridge
  Bridge: 'chainbridge-solidity/contracts',
  GenericHandler: 'chainbridge-solidity/contracts/handlers',
  ERC20Handler: 'chainbridge-solidity/contracts/handlers',
  ERC721Handler: 'chainbridge-solidity/contracts/handlers',

  // cross-chain ample
  XCAmple: 'contracts/satellite-chain/xc-ampleforth',
  XCAmpleController: 'contracts/satellite-chain/xc-ampleforth',
  BatchTxExecutor: 'contracts/_utilities',
  BatchTxCaller: 'contracts/_utilities',

  TokenVault: 'contracts/base-chain',

  AMPLChainBridgeGateway: 'contracts/base-chain/bridge-gateways',
  ChainBridgeXCAmpleGateway: 'contracts/satellite-chain/bridge-gateways',

  AMPLMaticRebaseGateway: 'contracts/base-chain/bridge-gateways',
  AMPLMaticTransferGateway: 'contracts/base-chain/bridge-gateways',
  MaticXCAmpleRebaseGateway: 'contracts/satellite-chain/bridge-gateways',
  MaticXCAmpleTransferGateway: 'contracts/satellite-chain/bridge-gateways',

  // utilities
  ChainBridgeBatchRebaseReport: 'contracts/_utilities'
};

const sleep = sec => {
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
};

const getCompiledContractFactory = (ethers, contract) => {
  return ethers.getContractFactory(
    `${ContractABIPaths[contract]}/${contract}.sol:${contract}`,
  );
};

const deployContract = async (
  ethers,
  contractName,
  signer,
  args,
  txParams,
  waitBlocks = 0,
) => {
  // console.log('Deploying', contractName);
  const Factory = await getCompiledContractFactory(ethers, contractName);
  const contract = await Factory.connect(signer).deploy(...args, txParams);
  if (waitBlocks > 0) {
    await contract.deployTransaction.wait(waitBlocks);
  }
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
  waitBlocks = 0,
) => {
  // console.log('Deploying proxy', contractName);
  const ProxyAdminFactory = await getCompiledContractFactory(
    ethers,
    'ProxyAdmin',
  );
  const Factory = await getCompiledContractFactory(ethers, contractName);
  const contract = await hre.upgrades.deployProxy(
    Factory.connect(signer),
    args,
    initializerDef,
    txParams,
  );
  if (waitBlocks > 0) {
    await contract.deployTransaction.wait(waitBlocks);
  }

  const defaultProxyAdmin = ProxyAdminFactory.connect(signer).attach(
    await getAdminAddress(signer.provider, contract.address),
  );
  const refChangeTx = await defaultProxyAdmin.changeProxyAdmin(
    contract.address,
    newProxyAdmin.address,
    txParams,
  );

  if (waitBlocks > 0) {
    await refChangeTx.wait(waitBlocks);
  }

  return contract;
};

const upgradeProxyContract = async (
  ethers,
  network,
  contractName,
  deployedContractRef,
  signer,
  txParams,
  force = false,
) => {
  const proxyAdmin = await getDeployedContractInstance(
    network,
    'proxyAdmin',
    ethers.provider,
  );

  const proxy = await getDeployedContractInstance(
    network,
    deployedContractRef,
    ethers.provider,
  );

  const currentImplAddr = await proxyAdmin.getProxyImplementation(
    proxy.address,
  );
  console.log(
    `Current implementation for ${contractName} is at`,
    currentImplAddr,
  );

  // deploy new implementation
  let newImplAddress;
  if (!force) {
    const Factory = await getCompiledContractFactory(ethers, contractName);
    newImplAddress = await hre.upgrades.prepareUpgrade(
      proxy.address,
      Factory.connect(signer),
    );
    await sleep(30);
  } else {
    console.log('CAUTION: Skipping storage layout verification!');
    const newImpl = await deployContract(
      ethers,
      contractName,
      signer,
      [],
      txParams,
    );
    newImplAddress = newImpl.address;
  }
  console.log(`New implementation for ${contractName} is at`, newImplAddress);

  if ((await proxyAdmin.owner()) === (await signer.getAddress())) {
    console.log('CAUTION: Executing live upgrade!');
    console.log('CANCEL NOW to stop, this action is not reversible');
    await sleep(15);

    await proxyAdmin
      .connect(signer)
      .upgrade(proxy.address, newImplAddress, txParams);
  } else {
    console.log('Signer not proxy owner, cant upgrade');
    console.log(
      `Execute proxyAdmin.upgrade(${proxy.address}, ${newImplAddress})`,
    );
  }

  const contractData = await readContractDeploymentData(
    network,
    deployedContractRef,
  );
  const impl = new ethers.Contract(
    newImplAddress,
    contractData.abi,
    ethers.provider,
  );
  await impl.deployed();
  return impl;
};

const getDeployedContractInstance = async (network, contractName, provider) => {
  const contractData = await readContractDeploymentData(network, contractName);
  // TODO: pass ethers down
  return new hre.ethers.Contract(
    contractData.address,
    contractData.abi,
    provider,
  );
};

const readDeploymentData = network => {
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
      blockNumber: txR.blockNumber
    };
  } else {
    chainAddresses[contractRef] = {
      address: contract.address,
      abi: contract.interface.format()
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
    )
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
  startBlock = startBlock || 0;
  endBlock = endBlock || (await provider.getBlockNumber());
  const freq = timeFrameSec * BLOCKS_PER_SEC;

  console.log(address, event, startBlock, endBlock, timeFrameSec);

  let logs = [];
  for (let i = startBlock; i <= endBlock; i += freq) {
    console.log(startBlock, endBlock, i, logs.length);
    const getLogs = async (tries = 25) => {
      if (tries === 0) {
        throw new Error('Max tries reached');
      }
      try {
        const r = await provider.getLogs({
          address: address,
          fromBlock: ethers.utils.hexlify(i),
          toBlock: ethers.utils.hexlify(
            i + freq > endBlock ? endBlock : i + freq,
          )
        });
        return r;
      } catch (e) {
        console.log('Failed', e);
        await sleep(25 - tries);
        return getLogs(tries - 1);
      }
    };
    const _logs = await getLogs();
    logs = logs.concat(_logs);
    await sleep(0.1);
  }

  const contractInterface = new ethers.utils.Interface(abi);
  const decodedEvents = logs.reduce((m, log) => {
    try {
      log.parsed = contractInterface.parseLog(log);
      if (!log.parsed) {
        throw new Error('Parse error');
      }
      if (log.parsed.name === event) {
        m.push(log);
      }
      return m;
    } catch (e) {
      console.log(e, log);
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
  writeProxyDeploymentData,

  getCompiledContractFactory,
  getDeployedContractInstance,

  deployContract,
  deployProxyAdminContract,
  deployProxyContract,
  upgradeProxyContract,

  filterContractEvents
};
