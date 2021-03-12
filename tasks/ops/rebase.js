const { txTask, types, loadSignerSync } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');

const { getDeployedContractInstance } = require('../../helpers/contracts');
const { executeXCRebase } = require('../../sdk/chain_bridge');
const { printRebaseInfo, execRebase } = require('../../sdk/ampleforth');

txTask('testnet:rebase:base_chain', 'Executes rebase on the base chain')
  .addParam('rebasePerc', 'The rebase percentage to be applied', 0, types.float)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    const sender = await loadSignerSync(args, hre);
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
    const sender = await loadSignerSync(args, hre);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);

    const baseChainNetwork = hre.network.name;
    const baseChainProvider = hre.ethers.provider;
    const baseChainBridge = await getDeployedContractInstance(
      baseChainNetwork,
      'chainBridge/bridge',
      baseChainProvider,
    );
    const policy = await getDeployedContractInstance(
      baseChainNetwork,
      'policy',
      baseChainProvider,
    );
    await printRebaseInfo(policy);

    console.log('Initiating cross-chain rebase');
    for (let n in args.satelliteChainNetworks) {
      const satelliteChainNetwork = args.satelliteChainNetworks[n];
      const chainAddresses = await readDeploymentData(network);
      const satelliteChainProvider = getEthersProvider(network);

      const satelliteChainBridge = await getDeployedContractInstance(
        args.satelliteChainNetwork,
        'chainBridge/bridge',
        satelliteChainProvider,
      );
      const satelliteChainGenericHandler = await getDeployedContractInstance(
        args.satelliteChainNetwork,
        'chainBridge/genericHandler',
        satelliteChainProvider,
      );
      console.log('Initiating report rebase to:', satelliteChainNetwork);
      const { txR } = await executeXCRebase(
        sender,
        baseChainBridge,
        satelliteChainBridge,
        satelliteChainGenericHandler,
        policy,
        txParams,
      );
      console.log(txR.transactionHash);
    }
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
    const sender = await loadSignerSync(args, hre);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);

    for (let n in args.networks) {
      const satelliteChainNetwork = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const satelliteChainProvider = getEthersProvider(network);

      const xcAmpleController = await getDeployedContractInstance(
        satelliteChainNetwork,
        'xcAmpleController',
        satelliteChainProvider,
      );

      await printRebaseInfo(xcAmpleController);
      console.log('Executing rebase on:', satelliteChainNetwork);
      const tx = await xcAmpleController.connect(sender).rebase(txParams);
      await tx.wait();
      await printRebaseInfo(xcAmpleController);
    }
  });
