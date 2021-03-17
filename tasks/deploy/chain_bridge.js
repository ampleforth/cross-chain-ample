const {
  types,
  task,
  txTask,
  cbDeployTask,
  loadSignerSync,
  etherscanVerify,
} = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  deployContract,
  getDeployedContractInstance,
  readDeploymentData,
  writeDeploymentData,
} = require('../../helpers/contracts');

const {
  deployChainBridgeContracts,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts,
} = require('../../helpers/deploy');

cbDeployTask(
  'deploy:chain_bridge:base_chain',
  'Deploys the chain gateway contract and connects it with chain-bridge and the AMPL token',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  const deployer = loadSignerSync(args, hre.ethers.provider);
  const deployerAddress = await deployer.getAddress();
  const chainAddresses = await readDeploymentData(hre.network.name);

  console.log('------------------------------------------------------------');
  console.log('Deploying contracts on base-chain');
  console.log('Deployer:', deployerAddress);

  const {
    bridge,
    genericHandler,
    erc20Handler,
    erc721Handler,
    batchRebaseReporter,
  } = await deployChainBridgeContracts(args, hre.ethers, deployer, txParams);

  const ampl = await getDeployedContractInstance(
    hre.network.name,
    'ampl',
    hre.ethers.provider,
  );

  const policy = await getDeployedContractInstance(
    hre.network.name,
    'policy',
    hre.ethers.provider,
  );

  const {
    tokenVault,
    rebaseGateway,
    transferGateway,
  } = await deployChainBridgeBaseChainGatewayContracts(
    {
      bridge,
      genericHandler,
      ampl,
      policy,
    },
    hre.ethers,
    deployer,
    txParams,
  );

  console.log('------------------------------------------------------------');
  console.log('Writing data to file');
  await writeDeploymentData(hre.network.name, 'chainBridge/bridge', bridge);
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/genericHandler',
    genericHandler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/erc20Handler',
    erc20Handler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/erc721Handler',
    erc721Handler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/transferGateway',
    transferGateway,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/rebaseGateway',
    rebaseGateway,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/tokenVault',
    tokenVault,
  );
  await writeDeploymentData(hre.network.name, 'chainBridge/batchRebaseReporter', batchRebaseReporter);

  console.log('------------------------------------------------------------');
  console.log('Verify on etherscan');
  await etherscanVerify(hre, tokenVault.address);
  await etherscanVerify(hre, bridge.address, [args.chainId, args.relayers, args.relayerThreshold, args.fee, args.expiry]);
  await etherscanVerify(hre, genericHandler.address, [bridge.address, [], [], [], [], []]);
  await etherscanVerify(hre, erc20Handler.address, [bridge.address, [], [], []]);
  await etherscanVerify(hre, erc721Handler.address, [bridge.address, [], [], []]);
  await etherscanVerify(hre, transferGateway.address, [genericHandler.address, ampl.address, policy.address, tokenVault.address]);
  await etherscanVerify(hre, rebaseGateway.address, [genericHandler.address, ampl.address, policy.address, tokenVault.address]);
  await etherscanVerify(hre, batchRebaseReporter.address);
});

cbDeployTask(
  'deploy:chain_bridge:satellite_chain',
  'Deploys the chain gateway contract and connects it with chain-bridge and the cross-chain ample token',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  const deployer = loadSignerSync(args, hre.ethers.provider);
  const deployerAddress = await deployer.getAddress();
  const chainAddresses = await readDeploymentData(hre.network.name);

  console.log('------------------------------------------------------------');
  console.log('Deploying contracts on satellite-chain');
  console.log('Deployer:', deployerAddress);

  const {
    bridge,
    genericHandler,
    erc20Handler,
    erc721Handler,
  } = await deployChainBridgeContracts(args, hre.ethers, deployer, txParams);

  const xcAmple = await getDeployedContractInstance(
    hre.network.name,
    'xcAmple',
    hre.ethers.provider,
  );

  const xcAmpleController = await getDeployedContractInstance(
    hre.network.name,
    'xcAmpleController',
    hre.ethers.provider,
  );

  const {
    rebaseGateway,
    transferGateway,
  } = await deployChainBridgeSatelliteChainGatewayContracts(
    { xcAmple, xcAmpleController, bridge, genericHandler },
    hre.ethers,
    deployer,
    txParams,
  );

  console.log('------------------------------------------------------------');
  console.log('Writing data to file');
  await writeDeploymentData(hre.network.name, 'chainBridge/bridge', bridge);
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/genericHandler',
    genericHandler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/erc20Handler',
    erc20Handler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/erc721Handler',
    erc721Handler,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/transferGateway',
    transferGateway,
  );
  await writeDeploymentData(
    hre.network.name,
    'chainBridge/rebaseGateway',
    rebaseGateway,
  );

  console.log('------------------------------------------------------------');
  console.log('Verify on etherscan');
  await etherscanVerify(hre, bridge.address, [args.chainId, args.relayers, args.relayerThreshold, args.fee, args.expiry]);
  await etherscanVerify(hre, genericHandler.address, [bridge.address, [], [], [], [], []]);
  await etherscanVerify(hre, erc20Handler.address, [bridge.address, [], [], []]);
  await etherscanVerify(hre, erc721Handler.address, [bridge.address, [], [], []]);
  await etherscanVerify(hre, transferGateway.address, [genericHandler.address, xcAmple.address, xcAmpleController.address]);
  await etherscanVerify(hre, rebaseGateway.address, [genericHandler.address, xcAmple.address, xcAmpleController.address]);
});
