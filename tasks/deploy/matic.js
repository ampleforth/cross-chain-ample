const {
  txTask,
  loadSignerSync,
  etherscanVerify
} = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  getDeployedContractInstance,
  writeDeploymentData
} = require('../../helpers/contracts');

const {
  deployMaticBaseChainGatewayContracts,
  deployMaticSatelliteChainGatewayContracts
} = require('../../helpers/deploy');

txTask(
  'deploy:matic_base_chain',
  'Deploys the chain gateway contract and connects it with matic bridge and the AMPL token',
)
  .addParam('checkpointManager', 'The address of the matic checkpoint manager')
  .addParam('fxRoot', 'The address of the matic fx root')
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice === 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const deployer = loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();

    console.log('------------------------------------------------------------');
    console.log('Deploying contracts on base-chain');
    console.log('Deployer:', deployerAddress);
    console.log(txParams);

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

    const tokenVault = await getDeployedContractInstance(
      hre.network.name,
      'matic/tokenVault',
      hre.ethers.provider,
    );

    const { rebaseGateway, transferGateway } =
      await deployMaticBaseChainGatewayContracts(
        {
          ampl,
          policy,
          tokenVault,
          checkpointManagerAddress: args.checkpointManager,
          fxRootAddress: args.fxRoot
        },
        hre.ethers,
        deployer,
        txParams,
        2,
      );

    console.log('------------------------------------------------------------');
    console.log('Writing data to file');
    await writeDeploymentData(
      hre.network.name,
      'matic/transferGateway',
      transferGateway,
    );
    await writeDeploymentData(
      hre.network.name,
      'matic/rebaseGateway',
      rebaseGateway,
    );

    console.log('------------------------------------------------------------');
    console.log('Verify on etherscan');
    await etherscanVerify(hre, transferGateway.address, [
      args.checkpointManager,
      args.fxRoot,
      ampl.address,
      tokenVault.address
    ]);
    await etherscanVerify(hre, rebaseGateway.address, [
      args.checkpointManager,
      args.fxRoot,
      ampl.address,
      policy.address
    ]);
  });

txTask(
  'deploy:matic_satellite_chain',
  'Deploys the chain gateway contract and connects it with matic bridge and the cross-chain ample token',
)
  .addParam('fxChild', 'The address of the matic fx child')
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice === 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const deployer = loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();

    console.log('------------------------------------------------------------');
    console.log('Deploying contracts on satellite-chain');
    console.log('Deployer:', deployerAddress);
    console.log(txParams);

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

    const { rebaseGateway, transferGateway } =
      await deployMaticSatelliteChainGatewayContracts(
        { xcAmple, xcAmpleController, fxChildAddress: args.fxChild },
        hre.ethers,
        deployer,
        txParams,
        2,
      );

    console.log('------------------------------------------------------------');
    console.log('Writing data to file');
    await writeDeploymentData(
      hre.network.name,
      'matic/transferGateway',
      transferGateway,
    );
    await writeDeploymentData(
      hre.network.name,
      'matic/rebaseGateway',
      rebaseGateway,
    );

    console.log('------------------------------------------------------------');
    console.log('Verify on etherscan');
    await etherscanVerify(hre, transferGateway.address, [
      args.fxChild,
      xcAmple.address,
      xcAmpleController.address
    ]);
    await etherscanVerify(hre, rebaseGateway.address, [
      args.fxChild,
      xcAmple.address,
      xcAmpleController.address
    ]);
  });

txTask('deploy:matic_connection', 'Connects the two gateway contracts')
  .addParam('baseChainNetwork', 'The network name of the base chain network')
  .addParam(
    'satChainNetwork',
    'The network name of the satellite chain network',
  )
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice === 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }

    const baseChainProvider = getEthersProvider(args.baseChainNetwork);
    const satChainProvider = getEthersProvider(args.satChainNetwork);

    const baseChainSigner = loadSignerSync(args, baseChainProvider);
    const satChainSigner = loadSignerSync(args, satChainProvider);

    const baseRebaseGateway = await getDeployedContractInstance(
      args.baseChainNetwork,
      'matic/rebaseGateway',
      baseChainProvider,
    );
    const satRebaseGateway = await getDeployedContractInstance(
      args.satChainNetwork,
      'matic/rebaseGateway',
      satChainProvider,
    );

    const baseTransferGateway = await getDeployedContractInstance(
      args.baseChainNetwork,
      'matic/transferGateway',
      baseChainProvider,
    );
    const satTransferGateway = await getDeployedContractInstance(
      args.satChainNetwork,
      'matic/transferGateway',
      satChainProvider,
    );

    await (
      await baseRebaseGateway
        .connect(baseChainSigner)
        .setFxChildTunnel(satRebaseGateway.address, txParams)
    ).wait(2);
    await (
      await satRebaseGateway
        .connect(satChainSigner)
        .setFxRootTunnel(baseRebaseGateway.address, txParams)
    ).wait(2);

    await (
      await baseTransferGateway
        .connect(baseChainSigner)
        .setFxChildTunnel(satTransferGateway.address, txParams)
    ).wait(2);

    await (
      await satTransferGateway
        .connect(satChainSigner)
        .setFxRootTunnel(baseTransferGateway.address, txParams)
    ).wait(2);
  });
