const { txTask, types, loadSignerSync } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');

const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');
const { executeXCTransfer } = require('../../sdk/chain_bridge');
const { toAmplFixedPt, printRebaseInfo } = require('../../sdk/ampleforth');

txTask(
  'chain_bridge:xc_transfer',
  'Executes cross chain transfer through chain bridge',
)
  .addParam(
    'recipientAddress',
    'The address of the recipient on the target chain',
  )
  .addParam('amount', 'The amount of AMPL to transfer', 0, types.float)
  .addParam('targetChainNetwork', 'The hre network of target chain')
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    const recipientAddress = args.recipientAddress;
    console.log('Sender:', senderAddress);
    console.log('Recipient:', recipientAddress);

    const sourceChainNetwork = hre.network.name;
    const sourceChainAddresses = await readDeploymentData(hre.network.name);
    const sourceChainProvider = hre.ethers.provider;
    const targetChainProvider = getEthersProvider(args.targetChainNetwork);

    const sourceChainBridge = await getDeployedContractInstance(
      sourceChainNetwork,
      'chainBridge/bridge',
      sourceChainProvider,
    );
    const targetChainBridge = await getDeployedContractInstance(
      args.targetChainNetwork,
      'chainBridge/bridge',
      targetChainProvider,
    );
    const targetChainGenericHandler = await getDeployedContractInstance(
      args.targetChainNetwork,
      'chainBridge/genericHandler',
      targetChainProvider,
    );

    const transferAmt = toAmplFixedPt(args.amount);

    let token, policy;
    if (sourceChainAddresses.isBaseChain) {
      token = await getDeployedContractInstance(
        sourceChainNetwork,
        'ampl',
        sourceChainProvider,
      );
      policy = await getDeployedContractInstance(
        sourceChainNetwork,
        'policy',
        sourceChainProvider,
      );
      await printRebaseInfo(policy);

      const approveTx = await token
        .connect(sender)
        .approve(
          sourceChainAddresses['chainBridge/tokenVault'].address,
          transferAmt,
        );
      await approveTx.wait();
    } else {
      token = await getDeployedContractInstance(
        sourceChainNetwork,
        'xcAmple',
        sourceChainProvider,
      );
      policy = await getDeployedContractInstance(
        sourceChainNetwork,
        'xcAmpleController',
        sourceChainProvider,
      );
      await printRebaseInfo(policy);

      const approveTx = await token
        .connect(sender)
        .approve(policy.address, transferAmt);
      await approveTx.wait();
    }

    const { txR } = await executeXCTransfer(
      sender,
      recipientAddress,
      transferAmt,
      policy,
      sourceChainBridge,
      targetChainBridge,
      targetChainGenericHandler,
      txParams,
    );
    console.log(txR.transactionHash);
  });

txTask('matic:xc_transfer', 'Executes cross chain transfer through matic')
  .addParam(
    'recipientAddress',
    'The address of the recipient on the target chain',
  )
  .addParam('amount', 'The amount of AMPL to transfer', 0, types.float)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }
    const sender = await loadSignerSync(args, hre.ethers.provider);
    const senderAddress = await sender.getAddress();
    const recipientAddress = args.recipientAddress;
    console.log('Sender:', senderAddress);
    console.log('Recipient:', recipientAddress);

    const sourceChainNetwork = hre.network.name;
    const sourceChainAddresses = await readDeploymentData(hre.network.name);
    const sourceChainProvider = hre.ethers.provider;

    const transferGateway = await getDeployedContractInstance(
      sourceChainNetwork,
      'matic/transferGateway',
      sourceChainProvider,
    );

    let token, approvalContract;
    if (sourceChainAddresses.isBaseChain) {
      token = await getDeployedContractInstance(
        sourceChainNetwork,
        'ampl',
        sourceChainProvider,
      );
      approvalContract = sourceChainAddresses['matic/tokenVault'].address;
    } else {
      token = await getDeployedContractInstance(
        sourceChainNetwork,
        'xcAmple',
        sourceChainProvider,
      );
      approvalContract = sourceChainAddresses['xcAmpleController'].address;
    }

    const transferAmt = toAmplFixedPt(args.amount);

    const approvalTx = await token
      .connect(sender)
      .approve(approvalContract, transferAmt, txParams);
    await approvalTx.wait();

    const tx = await transferGateway
      .connect(sender)
      .transfer(recipientAddress, transferAmt, txParams);
    const txR = await tx.wait();

    console.log(txR.transactionHash);
  });
