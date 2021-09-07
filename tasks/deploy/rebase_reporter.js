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
    'BatchTxCaller',
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
  'Prepares transaction to be executed by the batcher',
)
  .addParam(
    'satelliteChainNetworks',
    'List of satellite chain hardhat networks',
    [],
    types.json,
  )
  .addParam(
    'bridges',
    'The corresponding bridge type for each of the provided network',
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

    // group sat networks by bridge
    const bridgeNetowrks = {};
    for (const n in args.satelliteChainNetworks) {
      const network = args.satelliteChainNetworks[n];
      const bridge = args.bridges[n];
      if (!bridgeNetowrks[bridge]) {
        bridgeNetowrks[bridge] = [];
      }
      bridgeNetowrks[bridge].push(network);
    }

    // Iterate through sat chains
    // group by bridge type and build tx
    const transactions = [];
    for (const b in bridgeNetowrks) {
      if (b == 'chainBridge') {
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
        for (const n in bridgeNetowrks[b]) {
          const network = bridgeNetowrks[b][n];
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

        transactions.push({
          destination: cbBatchRebaseReporter.address,
          data: tx.data,
          value: totalFee.toString(),
        });
      } else if (b == 'matic') {
        const rebaseGateway = await getDeployedContractInstance(
          baseChainNetwork,
          `${b}/rebaseGateway`,
          baseChainProvider,
        );

        const tx = await rebaseGateway.populateTransaction.reportRebase();
        transactions.push({
          destination: rebaseGateway.address,
          data: tx.data,
          value: '0',
        });
      } else {
        console.error('Invalid bridge reference');
        return;
      }
    }

    console.log(transactions);
  });
