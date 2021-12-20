const { txTask, types, loadSignerSync } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const { Bridge } = require('arb-ts');
const { hexDataLength } = require('@ethersproject/bytes');

const { getDeployedContractInstance } = require('../../helpers/contracts');
const { XC_REBASE_RESOURCE_ID } = require('../../sdk/chain_bridge');
const { printRebaseInfo, execRebase } = require('../../sdk/ampleforth');

txTask('testnet:rebase:base_chain', 'Executes rebase on the base chain')
  .addParam('rebasePerc', 'The rebase percentage to be applied', '0')
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice === 0) {
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
  'chain_bridge:report_rebase',
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
    if (txParams.gasPrice === 0) {
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
    const batchRebaseReporter = await getDeployedContractInstance(
      baseChainNetwork,
      'chainBridge/batchRebaseReporter',
      baseChainProvider,
    );

    const satelliteChainIDs = [];
    let totalFee = hre.ethers.BigNumber.from('0');
    for (const n in args.satelliteChainNetworks) {
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

    console.log('Initiating cross-chain rebase', satelliteChainIDs);
    const tx = await batchRebaseReporter
      .connect(sender)
      .execute(
        policy.address,
        baseChainBridge.address,
        satelliteChainIDs,
        XC_REBASE_RESOURCE_ID,
        { value: totalFee },
      );

    const txR = await tx.wait();
    console.log(txR.transactionHash);
  });

txTask(
  'matic:report_rebase',
  'Reports most recent rebase to bridge on base chain to the matic satellite chain',
).setAction(async (args, hre) => {
  const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  if (txParams.gasPrice === 0) {
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
  const tx = await rebaseGateway.connect(sender).reportRebaseInit(txParams);

  const txR = await tx.wait();
  console.log(txR.transactionHash);
});

txTask(
  'arbitrum:report_rebase',
  'Reports most recent rebase to bridge on base chain to the arbitrum, satellite chain',
)
  .addParam(
    'satChainNetwork',
    'The network name of the satellite chain network',
  )
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice === 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    console.log('Sender:', senderAddress);
    console.log(txParams);

    const baseChainNetwork = hre.network.name;
    const baseChainProvider = hre.ethers.provider;
    const baseChainSigner = loadSignerSync(args, baseChainProvider);

    const satChainProvider = getEthersProvider(args.satChainNetwork);
    const satChainSigner = loadSignerSync(args, satChainProvider);

    const policy = await getDeployedContractInstance(
      hre.network.name,
      'policy',
      hre.ethers.provider,
    );

    const rebaseGateway = await getDeployedContractInstance(
      baseChainNetwork,
      'arbitrum/rebaseGateway',
      baseChainProvider,
    );

    const arb = await Bridge.init(baseChainSigner, satChainSigner);
    const fnDataBytes = hre.ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      await policy.globalAmpleforthEpochAndAMPLSupply(),
    );
    const fnBytesLength = hexDataLength(fnDataBytes) + 4;
    const [_submissionPriceWei] = await arb.l2Bridge.getTxnSubmissionPrice(
      fnBytesLength,
    );
    const submissionPriceWei = _submissionPriceWei.mul(5); // buffer can be reduced
    const maxGas = 200000;
    const gasPriceBid = await satChainProvider.getGasPrice();
    const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas));
    txParams.value = callValue;

    const tx = await rebaseGateway
      .connect(sender)
      .reportRebaseInit(submissionPriceWei, maxGas, gasPriceBid, txParams);

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
    if (txParams.gasPrice === 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }

    for (const n in args.networks) {
      const network = args.networks[n];
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
