const { txTask, types, loadSignerSync } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');

const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');
const {
  computePackedXCRebaseData,
  executeXCRebase,
  XC_REBASE_RESOURCE_ID,
} = require('../../sdk/chain_bridge');
const { printRebaseInfo, execRebase } = require('../../sdk/ampleforth');

txTask('testnet:rebase:base_chain', 'Executes rebase on the base chain')
  .addParam('rebasePerc', 'The rebase percentage to be applied', 0, types.float)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);

    const rateOracle = await getDeployedContractInstance(
      hre.network.name,
      'rateOracle',
      hre.ethers.provider,
    );
    const orchestrator = await getDeployedContractInstance(
      hre.network.name,
      'orchestrator',
      hre.ethers.provider,
    );
    const policy = await getDeployedContractInstance(
      hre.network.name,
      'policy',
      hre.ethers.provider,
    );

    await printRebaseInfo(policy);
    console.log('Executing rebase');
    await execRebase(
      args.rebasePerc,
      rateOracle,
      orchestrator,
      policy,
      sender,
      txParams,
    );
    await printRebaseInfo(policy);
  });

txTask(
  'chain_bridge:batch_report_rebase',
  'Reports most recent rebase to bridge on base chain for list of given satellite chains through chain bridge',
)
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
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);
    console.log(txParams);

    const baseChainNetwork = hre.network.name;
    const baseChainProvider = hre.ethers.provider;
    const policy = await getDeployedContractInstance(
      baseChainNetwork,
      'policy',
      baseChainProvider,
    );
    await printRebaseInfo(policy);

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
    const batchRebaseReporter = await getDeployedContractInstance(
      baseChainNetwork,
      'chainBridge/batchRebaseReporter',
      baseChainProvider,
    );

    const satelliteChainIDs = [];
    for (let n in args.satelliteChainNetworks) {
      const network = args.satelliteChainNetworks[n];
      const provider = await getEthersProvider(network);
      const satelliteChainBridge = await getDeployedContractInstance(
        network,
        'chainBridge/bridge',
        provider,
      );
      const satelliteChainID = await satelliteChainBridge._domainID();
      satelliteChainIDs.push(satelliteChainID);
    }
    const totalFee = await batchRebaseReporter.calculateFee(
      await policy.address,
      baseChainBridge.address,
      satelliteChainIDs,
      XC_REBASE_RESOURCE_ID,
    );

    console.log('Initiating cross-chain rebase', satelliteChainIDs);
    console.log('totalFee', totalFee.toString());
    txParams.value = totalFee;
    const tx = await batchRebaseReporter
      .connect(sender)
      .execute(
        policy.address,
        baseChainBridge.address,
        satelliteChainIDs,
        XC_REBASE_RESOURCE_ID,
        txParams,
      );

    const txR = await tx.wait();
    console.log(txR.transactionHash);
  });

txTask(
  'chain_bridge:report_rebase',
  'Reports most recent rebase to bridge on base chain to a given satellite chains through chain bridge',
)
  .addParam('satelliteChainNetwork', 'List of satellite chain hardhat networks')
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);
    console.log(txParams);

    const baseChainNetwork = hre.network.name;
    const baseChainProvider = hre.ethers.provider;
    const policy = await getDeployedContractInstance(
      baseChainNetwork,
      'policy',
      baseChainProvider,
    );
    await printRebaseInfo(policy);

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

    const satChainNetwork = args.satelliteChainNetwork;
    const satProvider = await getEthersProvider(satChainNetwork);
    const satelliteChainBridge = await getDeployedContractInstance(
      satChainNetwork,
      'chainBridge/bridge',
      satProvider,
    );
    const satelliteChainGenericHandler = await getDeployedContractInstance(
      satChainNetwork,
      'chainBridge/genericHandler',
      satProvider,
    );
    const satelliteChainID = await satelliteChainBridge._domainID();
    const totalFee = await baseChainBridge.calculateFee(
      satelliteChainID,
      XC_REBASE_RESOURCE_ID,
      (
        await computePackedXCRebaseData(
          sender,
          policy,
          satelliteChainGenericHandler,
        )
      ).data,
      [],
    );
    console.log('Initiating cross-chain rebase', satelliteChainID);
    console.log('totalFee', totalFee.toString());
    txParams.value = totalFee;
    const { tx, txR } = await executeXCRebase(
      sender,
      baseChainBridge,
      satelliteChainBridge,
      satelliteChainGenericHandler,
      policy,
      txParams,
    );

    await tx.wait();
    console.log(txR.transactionHash);
  });

txTask(
  'matic:report_rebase',
  'Reports most recent rebase to bridge on base chain for list of given satellite chains through matic bridge',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  if (txParams.gasPrice == 0) {
    txParams.gasPrice = await hre.ethers.provider.getGasPrice();
  }
  const sender = await loadSignerSync(args, hre.ethers.provider);
  const senderAddress = await sender.getAddress();
  console.log('Sender:', senderAddress);
  console.log(txParams);

  const baseChainNetwork = hre.network.name;
  const baseChainProvider = hre.ethers.provider;
  const rebaseGateway = await getDeployedContractInstance(
    baseChainNetwork,
    'matic/rebaseGateway',
    baseChainProvider,
  );
  const tx = await rebaseGateway.connect(sender).reportRebase(txParams);

  const txR = await tx.wait();
  console.log(txR.transactionHash);
});

txTask(
  'rebase:satellite_chain',
  'Executes rebase on the list of given satellite chains',
)
  .addParam(
    'networks',
    'List of satellite chain hardhat networks',
    [],
    types.json,
  )
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }

    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = await getEthersProvider(network);

      const sender = await loadSignerSync(args, provider);
      const senderAddress = await sender.getAddress();
      console.log('Sender:', senderAddress);
      console.log(txParams);

      const xcAmpleController = await getDeployedContractInstance(
        network,
        'xcAmpleController',
        provider,
      );
      console.log('Executing rebase on:', network);

      const tx = await xcAmpleController.connect(sender).rebase(txParams);
      await tx.wait();
      await printRebaseInfo(xcAmpleController);
    }
  });
