const {
  types,
  task,
  cbDeployTask,
  loadSignerSync,
} = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
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
  const deployer = loadSignerSync(args, hre);
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
});

cbDeployTask(
  'deploy:chain_bridge:satellite_chain',
  'Deploys the chain gateway contract and connects it with chain-bridge and the cross-chain ample token',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  const deployer = loadSignerSync(args, hre);
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
});

// TODO: move this ot info
task('deploy:chain_bridge:config_file', 'Generates chian_bridge config file')
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam('relayerAddress', 'Address of the relayer')
  .setAction(async (args, hre) => {
    const chains = [];
    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);
      const bridge = await getDeployedContractInstance(
        network,
        'chainBridge/bridge',
        provider,
      );
      const chainID = await bridge._chainID();
      chains.push({
        name: network,
        type: 'ethereum',
        id: `${chainID}`,
        endpoint: provider.connection.url,
        from: args.relayerAddress,
        opts: {
          bridge: chainAddresses['chainBridge/bridge'].address,
          genericHandler: chainAddresses['chainBridge/genericHandler'].address,
          erc20Handler: chainAddresses['chainBridge/erc20Handler'].address,
          erc721Handler: chainAddresses['chainBridge/erc721Handler'].address,
          startBlock: `${chainAddresses['chainBridge/bridge'].blockNumber}`,
        },
      });
    }
    const chainBridgeConfig = { chains };
    console.log(JSON.stringify(chainBridgeConfig, null, 2));
  });
