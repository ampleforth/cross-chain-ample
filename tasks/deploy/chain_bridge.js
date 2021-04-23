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
  writeBulkDeploymentData,
  getCompiledContractFactory,
} = require('../../helpers/contracts');

const {
  deployChainBridgeContracts,
  deployChainBridgeHandlers,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts,
} = require('../../helpers/deploy');

task(
  'deploy:chain_bridge_use_deployed',
  'Generates deployment files for a deployed instance of Bridge',
)
  .addParam('bridgeAddress', 'The address of the bridge contract')
  .setAction(async (args, hre) => {
    const Bridge = await getCompiledContractFactory(hre.ethers, 'Bridge');
    await writeBulkDeploymentData(hre.network.name, {
      'chainBridge/bridge': {
        address: args.bridgeAddress,
        abi: Bridge.interface.format(),
      },
    });
  });

cbDeployTask(
  'deploy:chain_bridge_base_chain',
  'Deploys the chain gateway contract and connects it with chain-bridge and the AMPL token',
)
  .addParam('useDeployed', 'Use deployed bridge', false, types.boolean)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    const deployer = loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();
    const chainAddresses = await readDeploymentData(hre.network.name);

    console.log('------------------------------------------------------------');
    console.log('Deploying contracts on base-chain');
    console.log('Deployer:', deployerAddress);
    console.log(txParams);

    let bridge,
      handlers,
      genericHandler,
      erc20Handler,
      erc721Handler,
      batchRebaseReporter;

    if (args.useDeployed) {
      console.log('Using deployed bridge');
      bridge = await getDeployedContractInstance(
        hre.network.name,
        'chainBridge/bridge',
        hre.ethers.provider,
      );
      handlers = await deployChainBridgeHandlers(
        bridge,
        args,
        hre.ethers,
        deployer,
        txParams,
      );
    } else {
      handlers = await deployChainBridgeContracts(
        args,
        hre.ethers,
        deployer,
        txParams,
      );
    }
    genericHandler = handlers.genericHandler;
    erc20Handler = handlers.erc20Handler;
    erc721Handler = handlers.erc721Handler;
    batchRebaseReporter = handlers.batchRebaseReporter;

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
    if (args.useDeployed) {
      await writeBulkDeploymentData(hre.network.name, {
        'chainBridge/bridge': {
          address: bridge.address,
          abi: bridge.interface.format(),
        },
      });
    } else {
      await writeDeploymentData(hre.network.name, 'chainBridge/bridge', bridge);
    }
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
    await writeDeploymentData(
      hre.network.name,
      'chainBridge/batchRebaseReporter',
      batchRebaseReporter,
    );

    console.log('------------------------------------------------------------');
    console.log('Verify on etherscan');
    await etherscanVerify(hre, tokenVault.address);
    await etherscanVerify(hre, bridge.address, [
      args.chainId,
      args.relayers,
      args.relayerThreshold,
      args.fee,
      args.expiry,
    ]);
    await etherscanVerify(hre, genericHandler.address, [
      bridge.address,
      [],
      [],
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, erc20Handler.address, [
      bridge.address,
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, erc721Handler.address, [
      bridge.address,
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, transferGateway.address, [
      genericHandler.address,
      ampl.address,
      policy.address,
      tokenVault.address,
    ]);
    await etherscanVerify(hre, rebaseGateway.address, [
      genericHandler.address,
      ampl.address,
      policy.address,
      tokenVault.address,
    ]);
    await etherscanVerify(hre, batchRebaseReporter.address);
  });

cbDeployTask(
  'deploy:chain_bridge_satellite_chain',
  'Deploys the chain gateway contract and connects it with chain-bridge and the cross-chain ample token',
)
  .addParam('useDeployed', 'Use deployed bridge', false, types.boolean)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    const deployer = loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();
    const chainAddresses = await readDeploymentData(hre.network.name);

    console.log('------------------------------------------------------------');
    console.log('Deploying contracts on satellite-chain');
    console.log('Deployer:', deployerAddress);
    console.log(txParams);

    let bridge, handlers, genericHandler, erc20Handler, erc721Handler;

    if (args.useDeployed) {
      console.log('Using deployed bridge');
      bridge = await getDeployedContractInstance(
        hre.network.name,
        'chainBridge/bridge',
        hre.ethers.provider,
      );
      handlers = await deployChainBridgeHandlers(
        bridge,
        args,
        hre.ethers,
        deployer,
        txParams,
      );
    } else {
      handlers = await deployChainBridgeContracts(
        args,
        hre.ethers,
        deployer,
        txParams,
      );
    }
    genericHandler = handlers.genericHandler;
    erc20Handler = handlers.erc20Handler;
    erc721Handler = handlers.erc721Handler;

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
    if (args.useDeployed) {
      await writeBulkDeploymentData(hre.network.name, {
        'chainBridge/bridge': {
          address: bridge.address,
          abi: bridge.interface.format(),
        },
      });
    } else {
      await writeDeploymentData(hre.network.name, 'chainBridge/bridge', bridge);
    }
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
    await etherscanVerify(hre, bridge.address, [
      args.chainId,
      args.relayers,
      args.relayerThreshold,
      args.fee,
      args.expiry,
    ]);
    await etherscanVerify(hre, genericHandler.address, [
      bridge.address,
      [],
      [],
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, erc20Handler.address, [
      bridge.address,
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, erc721Handler.address, [
      bridge.address,
      [],
      [],
      [],
    ]);
    await etherscanVerify(hre, transferGateway.address, [
      genericHandler.address,
      xcAmple.address,
      xcAmpleController.address,
    ]);
    await etherscanVerify(hre, rebaseGateway.address, [
      genericHandler.address,
      xcAmple.address,
      xcAmpleController.address,
    ]);
  });
