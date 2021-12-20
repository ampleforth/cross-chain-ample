const { Bridge } = require('arb-ts');
const { hexDataLength } = require('@ethersproject/bytes');
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
  deployArbitrumBaseChainGatewayContracts,
  deployArbitrumSatelliteChainGatewayContracts
} = require('../../helpers/deploy');

txTask(
  'deploy:arbitrum_base_chain',
  'Deploys the chain gateway on the base chain',
).setAction(async (args, hre) => {
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
    'arbitrum/tokenVault',
    hre.ethers.provider,
  );

  const { gateway } = await deployArbitrumBaseChainGatewayContracts(
    {
      ampl,
      policy,
      tokenVault
    },
    hre.ethers,
    deployer,
    txParams,
    5,
  );

  console.log('------------------------------------------------------------');
  console.log('Writing data to file');
  await writeDeploymentData(
    hre.network.name,
    'arbitrum/transferGateway',
    gateway,
  );
  await writeDeploymentData(
    hre.network.name,
    'arbitrum/rebaseGateway',
    gateway,
  );

  console.log('------------------------------------------------------------');
  console.log('Verify on etherscan');
  await etherscanVerify(hre, gateway.address, [
    ampl.address,
    policy.address,
    tokenVault.address
  ]);
});

txTask(
  'deploy:arbitrum_satellite_chain',
  'Deploys the chain gateway contract and connects it with arbitrum bridge and the cross-chain ample token',
).setAction(async (args, hre) => {
  // NOTE: gas estimation is off on arbitrum
  // const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
  // if (txParams.gasPrice === 0) {
  //   txParams.gasPrice = await hre.ethers.provider.getGasPrice();
  // }
  const txParams = {};
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

  const { gateway } = await deployArbitrumSatelliteChainGatewayContracts(
    { xcAmple, xcAmpleController },
    hre.ethers,
    deployer,
    txParams,
    5,
  );

  console.log('------------------------------------------------------------');
  console.log('Writing data to file');
  await writeDeploymentData(
    hre.network.name,
    'arbitrum/transferGateway',
    gateway,
  );
  await writeDeploymentData(
    hre.network.name,
    'arbitrum/rebaseGateway',
    gateway,
  );

  console.log('------------------------------------------------------------');
  console.log('Verify on etherscan');
  await etherscanVerify(hre, gateway.address, [
    xcAmple.address,
    xcAmpleController.address
  ]);
});

txTask('deploy:arbitrum_connection', 'Connects the two gateway contracts')
  .addParam('baseChainNetwork', 'The network name of the base chain network')
  .addParam(
    'satChainNetwork',
    'The network name of the satellite chain network',
  )
  .addParam('baseInbox', 'The address of the arbitrum inbox on the base chain')
  .addParam(
    'baseRouter',
    'The address of the arbitrum router contract on the base chain',
  )
  .addParam(
    'satRouter',
    'The address of the arbitrum router contract on the satellite chain',
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

    const baseGateway = await getDeployedContractInstance(
      args.baseChainNetwork,
      'arbitrum/rebaseGateway',
      baseChainProvider,
    );
    const ampl = await getDeployedContractInstance(
      args.baseChainNetwork,
      'ampl',
      baseChainProvider,
    );

    const satGateway = await getDeployedContractInstance(
      args.satChainNetwork,
      'arbitrum/rebaseGateway',
      satChainProvider,
    );
    const xcAmple = await getDeployedContractInstance(
      args.satChainNetwork,
      'xcAmple',
      satChainProvider,
    );

    await (
      await baseGateway
        .connect(baseChainSigner)
        .initialize(
          args.baseInbox,
          args.baseRouter,
          xcAmple.address,
          satGateway.address,
          txParams,
        )
    ).wait(2);

    // NOTE: gas estimation is off on arbitrum
    await (
      await satGateway
        .connect(satChainSigner)
        .initialize(args.satRouter, ampl.address, baseGateway.address, {})
    ).wait(2);
  });

txTask('deploy:arbitrum_register_testnet', 'Registers the token to the router')
  .addParam('baseChainNetwork', 'The network name of the base chain network')
  .addParam(
    'satChainNetwork',
    'The network name of the satellite chain network',
  )
  .addParam(
    'baseRouter',
    'The address of the arbitrum router contract on the base chain',
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

    const routerABI = [
      {
        inputs: [
          { internalType: 'address', name: '_gateway', type: 'address' },
          { internalType: 'uint256', name: '_maxGas', type: 'uint256' },
          { internalType: 'uint256', name: '_gasPriceBid', type: 'uint256' },
          {
            internalType: 'uint256',
            name: '_maxSubmissionCost',
            type: 'uint256'
          }
        ],
        name: 'setGateway',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function'
      }
    ];
    const router = new hre.ethers.Contract(
      args.baseRouter,
      routerABI,
      hre.ethers.provider,
    );

    const ampl = await getDeployedContractInstance(
      args.baseChainNetwork,
      'ampl',
      baseChainProvider,
    );

    const baseGateway = await getDeployedContractInstance(
      args.baseChainNetwork,
      'arbitrum/transferGateway',
      baseChainProvider,
    );

    const arb = await Bridge.init(baseChainSigner, satChainSigner);
    const fnDataBytes = hre.ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [baseGateway.address, '0', '0', '0'],
    );
    const fnBytesLength = hexDataLength(fnDataBytes) + 4;
    const [_submissionPriceWei] = await arb.l2Bridge.getTxnSubmissionPrice(
      fnBytesLength,
    );
    const submissionPriceWei = _submissionPriceWei.mul(5); // buffer can be reduced
    const maxGas = 500000;
    const gasPriceBid = await satChainProvider.getGasPrice();
    const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas));

    const ptx = await router.populateTransaction.setGateway(
      baseGateway.address,
      maxGas,
      gasPriceBid,
      submissionPriceWei,
    );

    const tx = await ampl
      .connect(baseChainSigner)
      .externalCall(ptx.to, ptx.data, callValue, {
        ...txParams,
        value: callValue
      });

    console.log(tx.hash);

    await tx.wait(2);
  });
