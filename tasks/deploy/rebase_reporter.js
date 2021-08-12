const {
  task,
  txTask,
  loadSignerSync,
  etherscanVerify,
} = require('../../helpers/tasks');
const {
  getCompiledContractFactory,
  getDeployedContractInstance,
  writeDeploymentData,
  deployContract,
} = require('../../helpers/contracts');
const { getEthersProvider } = require('../../helpers/utils');
const { XC_REBASE_RESOURCE_ID } = require('../../sdk/chain_bridge');

txTask(
  'deploy:rebase_reporter',
  'Deploy batch rebase reporter utility',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  if (txParams.gasPrice == 0) {
    txParams.gasPrice = await hre.ethers.provider.getGasPrice();
  }

  const deployer = await loadSignerSync(args, hre.ethers.provider);
  const deployerAddress = await deployer.getAddress();

  console.log('------------------------------------------------------------');
  console.log('Deployer:', deployerAddress);
  console.log(txParams);

  console.log('------------------------------------------------------------');
  console.log('Deploying batchRebaseReporter on base chain');
  const batchRebaseReporter = await deployContract(
    ethers,
    'BatchTxExecutor',
    deployer,
    [],
    txParams,
  );
  await batchRebaseReporter.deployTransaction.wait(5);

  console.log('------------------------------------------------------------');
  console.log('Writing data to file');
  await writeDeploymentData(
    hre.network.name,
    'batchRebaseReporter',
    batchRebaseReporter,
  );

  console.log('------------------------------------------------------------');
  console.log('Verify on etherscan');
  await etherscanVerify(hre, batchRebaseReporter.address);
});

txTask(
  'deploy:rebase_reporter:prep_tx',
  'Prepares transaction to be added to the batcher',
)
  .addParam('bridge', 'The bridge reference')
  .addParam(
    'satelliteChainNetworks',
    'List of satellite chain hardhat networks',
    [],
    types.json,
  )
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }

    const deployer = await loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();

    let txDestination;
    let txValue;
    let txData;

    const baseChainNetwork = hre.network.name;
    const baseChainProvider = hre.ethers.provider;
    const policy = await getDeployedContractInstance(
      baseChainNetwork,
      'policy',
      baseChainProvider,
    );

    if (args.bridge == 'chainBridge') {
      // Chainbridge contracts
      const baseChainBridge = await getDeployedContractInstance(
        baseChainNetwork,
        'chainBridge/bridge',
        baseChainProvider,
      );
      const baseChainGenericHandler = await getDeployedContractInstance(
        baseChainNetwork,
        'chainBridge/genericHandler',
        baseChainProvider,
      );
      const cbBatchRebaseReporter = await getDeployedContractInstance(
        baseChainNetwork,
        'chainBridge/batchRebaseReporter',
        baseChainProvider,
      );

      const satelliteChainIDs = [];
      let totalFee = hre.ethers.BigNumber.from('0');
      for (let n in args.satelliteChainNetworks) {
        const network = args.satelliteChainNetworks[n];
        const provider = await getEthersProvider(network);
        const satelliteChainBridge = await getDeployedContractInstance(
          network,
          'chainBridge/bridge',
          provider,
        );
        const satelliteChainID = await satelliteChainBridge._chainID();
        satelliteChainIDs.push(satelliteChainID);

        const fee = await baseChainBridge.getFee(satelliteChainID);
        totalFee = totalFee.add(fee);
      }
      const tx = await cbBatchRebaseReporter.populateTransaction.execute(
        policy.address,
        baseChainBridge.address,
        satelliteChainIDs,
        XC_REBASE_RESOURCE_ID,
      );
      txDestination = cbBatchRebaseReporter.address;
      txValue = totalFee;
      txData = tx.data;
    } else if (args.bridge == 'matic') {
      const rebaseGateway = await getDeployedContractInstance(
        baseChainNetwork,
        `${args.bridge}/rebaseGateway`,
        baseChainProvider,
      );

      const tx = await rebaseGateway.populateTransaction.reportRebase();
      txDestination = rebaseGateway.address;
      txValue = '0';
      txData = tx.data;
    } else {
      console.error('Invalid bridge reference');
      return;
    }

    const batchRebaseReporter = await getDeployedContractInstance(
      baseChainNetwork,
      'batchRebaseReporter',
      baseChainProvider,
    );

    if ((await batchRebaseReporter.owner()) == deployerAddress) {
      await batchRebaseReporter
        .connect(deployer)
        .addTransaction(txDestination, txValue, txData);
      console.log('Executed transaction', batchRebaseReporter.address);
    } else {
      console.log(
        'Execute the following on the batcher',
        batchRebaseReporter.address,
      );
    }

    console.log('addTransaction(destination, value, data)');
    console.log('destination:', txDestination);
    console.log('value:', txValue);
    console.log('data:', txData);
  });
