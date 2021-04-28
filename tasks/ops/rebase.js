const { txTask, types, loadSignerSync } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');

const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');
const {
  executeXCRebase,
  XC_REBASE_RESOURCE_ID,
} = require('../../sdk/chain_bridge');
const { printRebaseInfo, execRebase } = require('../../sdk/ampleforth');

txTask('testnet:rebase:base_chain', 'Executes rebase on the base chain')
  .addParam('rebasePerc', 'The rebase percentage to be applied', 0, types.float)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
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
  'report_rebase:base_chain',
  'Reports most recent rebase to bridge on base chain for list of given satellite chains',
)
  .addParam(
    'satelliteChainNetworks',
    'List of satellite chain hardhat networks',
    [],
    types.json,
  )
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
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
      const satelliteChainID = await satelliteChainBridge._chainID();
      satelliteChainIDs.push(satelliteChainID);
    }

    console.log('Initiating cross-chain rebase', satelliteChainIDs);
    const tx = await batchRebaseReporter
      .connect(sender)
      .execute(
        policy.address,
        baseChainBridge.address,
        satelliteChainIDs,
        XC_REBASE_RESOURCE_ID,
      );

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
