const { AMPL_BASE_RATE, AMPL_BASE_CPI } = require('../sdk/ampleforth');

const {
  XC_REBASE_RESOURCE_ID,
  XC_TRANSFER_RESOURCE_ID,
  CB_FUNCTION_SIG_baseChainReportRebase,
  CB_FUNCTION_SIG_satelliteChainReportRebase,
  CB_FUNCTION_SIG_baseChainTransfer,
  CB_FUNCTION_SIG_satelliteChainTransfer,
} = require('../sdk/chain_bridge');

const {
  deployContract,
  deployProxyAdminContract,
  deployProxyContract,
} = require('./contracts');

async function deployAMPLContracts(ethers, deployer, txParams = {}) {
  const deployerAddress = await deployer.getAddress();

  const proxyAdmin = await deployProxyAdminContract(ethers, deployer, txParams);

  const ampl = await deployProxyContract(
    ethers,
    'UFragments',
    proxyAdmin,
    deployer,
    [deployerAddress],
    { initializer: 'initialize(address)' },
    txParams,
  );

  const rateOracle = await deployContract(
    ethers,
    'MedianOracle',
    deployer,
    [3600 * 24 * 365, 0, 1],
    txParams,
  );
  await (
    await rateOracle.connect(deployer).addProvider(deployerAddress, txParams)
  ).wait();
  await (
    await rateOracle.connect(deployer).pushReport(AMPL_BASE_RATE, txParams)
  ).wait();

  const cpiOracle = await deployContract(
    ethers,
    'MedianOracle',
    deployer,
    [3600 * 24 * 365, 0, 1],
    txParams,
  );
  await (await cpiOracle.addProvider(deployerAddress, txParams)).wait();
  await (
    await cpiOracle.connect(deployer).pushReport(AMPL_BASE_CPI, txParams)
  ).wait();

  const policy = await deployProxyContract(
    ethers,
    'UFragmentsPolicy',
    proxyAdmin,
    deployer,
    [deployerAddress, ampl.address, AMPL_BASE_CPI.toString()],
    {
      initializer: 'initialize(address,address,uint256)',
    },
    txParams,
  );
  await (
    await policy.connect(deployer).setMarketOracle(rateOracle.address, txParams)
  ).wait();
  await (
    await policy.connect(deployer).setCpiOracle(cpiOracle.address, txParams)
  ).wait();
  await (await policy.connect(deployer).setRebaseLag(1, txParams)).wait();
  await (
    await policy
      .connect(deployer)
      .setRebaseTimingParameters(1, 0, 3600, txParams)
  ).wait();
  await (
    await ampl.connect(deployer).setMonetaryPolicy(policy.address, txParams)
  ).wait();

  const orchestrator = await deployContract(
    ethers,
    'Orchestrator',
    deployer,
    [policy.address],
    txParams,
  );
  await (
    await policy
      .connect(deployer)
      .setOrchestrator(orchestrator.address, txParams)
  ).wait();

  return {
    proxyAdmin,
    ampl,
    policy,
    orchestrator,
    rateOracle,
    cpiOracle,
  };
}

async function deployXCAmpleContracts(
  { tokenSymbol, tokenName, globalAmpleforthEpoch, globalAMPLSupply },
  ethers,
  deployer,
  txParams = {},
) {
  const proxyAdmin = await deployProxyAdminContract(ethers, deployer, txParams);

  const xcAmple = await deployProxyContract(
    ethers,
    'XCAmple',
    proxyAdmin,
    deployer,
    [tokenName, tokenSymbol, globalAMPLSupply],
    { initializer: 'initialize(string,string,uint256)' },
    txParams,
  );

  const xcAmpleController = await deployProxyContract(
    ethers,
    'XCAmpleController',
    proxyAdmin,
    deployer,
    [xcAmple.address, globalAmpleforthEpoch],
    {
      initializer: 'initialize(address,uint256)',
    },
    txParams,
  );

  const rebaseRelayer = await deployContract(
    ethers,
    'BatchTxExecutor',
    deployer,
    [],
    txParams,
  );

  await (
    await xcAmple.setController(xcAmpleController.address, txParams)
  ).wait();
  await (
    await xcAmpleController.setRebaseRelayer(rebaseRelayer.address, txParams)
  ).wait();

  return { proxyAdmin, xcAmple, xcAmpleController, rebaseRelayer };
}

async function deployChainBridgeHelpers(
  bridge,
  { chainId, relayers, relayerThreshold, fee, expiry },
  ethers,
  deployer,
  txParams = {},
) {
  const batchRebaseReporter = await deployContract(
    ethers,
    'ChainBridgeBatchRebaseReport',
    deployer,
    [],
    txParams,
  );

  return {
    batchRebaseReporter,
  };
}

async function deployChainBridgeContracts(
  { chainId, relayers, relayerThreshold, fee, expiry },
  ethers,
  deployer,
  txParams = {},
) {
  const bridge = await deployContract(
    ethers,
    'Bridge',
    deployer,
    [chainId, relayers, relayerThreshold, fee, expiry],
    txParams,
  );

  const genericHandler = await deployContract(
    ethers,
    'GenericHandler',
    deployer,
    [bridge.address, [], [], [], [], []],
    txParams,
  );

  const helpers = await deployChainBridgeHelpers(
    bridge,
    { chainId, relayers, relayerThreshold, fee, expiry },
    ethers,
    deployer,
    txParams,
  );

  return {
    bridge,
    genericHandler,
    ...helpers,
  };
}

async function deployTokenVault(ethers, deployer, txParams = {}) {
  const tokenVault = await deployContract(
    ethers,
    'TokenVault',
    deployer,
    [],
    txParams,
  );

  return tokenVault;
}

async function deployChainBridgeBaseChainGatewayContracts(
  { ampl, policy, bridge, genericHandler, tokenVault },
  ethers,
  deployer,
  txParams = {},
) {
  const rebaseGateway = await deployContract(
    ethers,
    'AMPLChainBridgeGateway',
    deployer,
    [genericHandler.address, ampl.address, policy.address, tokenVault.address],
    txParams,
  );
  const transferGateway = await deployContract(
    ethers,
    'AMPLChainBridgeGateway',
    deployer,
    [genericHandler.address, ampl.address, policy.address, tokenVault.address],
    txParams,
  );

  const deployerAddress = await deployer.getAddress();
  const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
  const isAdmin = await bridge.hasRole(adminRole, deployerAddress);

  const reportRebaseFnSig = CB_FUNCTION_SIG_baseChainReportRebase(
    rebaseGateway,
  );

  if (isAdmin) {
    await (
      await bridge
        .connect(deployer)
        .adminSetGenericResource(
          genericHandler.address,
          XC_REBASE_RESOURCE_ID,
          rebaseGateway.address,
          ...reportRebaseFnSig,
          txParams,
        )
    ).wait();
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_REBASE_RESOURCE_ID,
      rebaseGateway.address,
      ...reportRebaseFnSig,
    ]);
  }

  const transferFnSig = CB_FUNCTION_SIG_baseChainTransfer(transferGateway);
  if (isAdmin) {
    await (
      await bridge
        .connect(deployer)
        .adminSetGenericResource(
          genericHandler.address,
          XC_TRANSFER_RESOURCE_ID,
          transferGateway.address,
          ...transferFnSig,
          txParams,
        )
    ).wait();
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_TRANSFER_RESOURCE_ID,
      transferGateway.address,
      ...transferFnSig,
    ]);
  }

  if ((await tokenVault.owner()) == deployerAddress) {
    await (
      await tokenVault
        .connect(deployer)
        .addBridgeGateway(transferGateway.address)
    ).wait();
  } else {
    console.log(
      'Failed to add whitelist transfer gateway to vault as deployer not vault owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [transferGateway.address]);
  }

  return { rebaseGateway, transferGateway };
}

async function deployChainBridgeSatelliteChainGatewayContracts(
  { xcAmple, xcAmpleController, bridge, genericHandler },
  ethers,
  deployer,
  txParams = {},
) {
  const rebaseGateway = await deployContract(
    ethers,
    'ChainBridgeXCAmpleGateway',
    deployer,
    [genericHandler.address, xcAmple.address, xcAmpleController.address],
    txParams,
  );
  const transferGateway = await deployContract(
    ethers,
    'ChainBridgeXCAmpleGateway',
    deployer,
    [genericHandler.address, xcAmple.address, xcAmpleController.address],
    txParams,
  );

  try {
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(rebaseGateway.address, txParams)
    ).wait();
  } catch (e) {
    console.log(
      'Failed adding rebase gateway to controller, deployer key not controller owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [rebaseGateway.address]);
  }

  try {
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(transferGateway.address, txParams)
    ).wait();
  } catch (e) {
    console.log(
      'Failed adding rebase gateway to controller, deployer key not controller owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [transferGateway.address]);
  }

  const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
  const isAdmin = await bridge.hasRole(adminRole, await deployer.getAddress());

  const reportRebaseFnSig = CB_FUNCTION_SIG_satelliteChainReportRebase(
    rebaseGateway,
  );
  if (isAdmin) {
    await (
      await bridge.adminSetGenericResource(
        genericHandler.address,
        XC_REBASE_RESOURCE_ID,
        rebaseGateway.address,
        ...reportRebaseFnSig,
        txParams,
      )
    ).wait();
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_REBASE_RESOURCE_ID,
      rebaseGateway.address,
      ...reportRebaseFnSig,
    ]);
  }

  const transferFnSig = CB_FUNCTION_SIG_satelliteChainTransfer(transferGateway);
  if (isAdmin) {
    await (
      await bridge.adminSetGenericResource(
        genericHandler.address,
        XC_TRANSFER_RESOURCE_ID,
        transferGateway.address,
        ...transferFnSig,
        txParams,
      )
    ).wait();
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_TRANSFER_RESOURCE_ID,
      transferGateway.address,
      ...transferFnSig,
    ]);
  }

  return { rebaseGateway, transferGateway };
}

async function deployMaticBaseChainGatewayContracts(
  { ampl, policy, tokenVault, checkpointManagerAddress, fxRootAddress },
  ethers,
  deployer,
  txParams = {},
) {
  const rebaseGateway = await deployContract(
    ethers,
    'AMPLMaticRebaseGateway',
    deployer,
    [checkpointManagerAddress, fxRootAddress, ampl.address, policy.address],
    txParams,
  );
  const transferGateway = await deployContract(
    ethers,
    'AMPLMaticTransferGateway',
    deployer,
    [checkpointManagerAddress, fxRootAddress, ampl.address, tokenVault.address],
    txParams,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await tokenVault.owner()) == deployerAddress) {
    await (
      await tokenVault.connect(deployer).addBridgeGateway(rebaseGateway.address)
    ).wait();
    await (
      await tokenVault
        .connect(deployer)
        .addBridgeGateway(transferGateway.address)
    ).wait();
  } else {
    console.log(
      'Failed to add whitelist transfer gateway to vault as deployer not vault owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [rebaseGateway.address]);
    console.log('addBridgeGateway', [transferGateway.address]);
  }

  return { rebaseGateway, transferGateway };
}

async function deployMaticSatelliteChainGatewayContracts(
  { xcAmple, xcAmpleController, fxChildAddress },
  ethers,
  deployer,
  txParams = {},
) {
  const rebaseGateway = await deployContract(
    ethers,
    'MaticXCAmpleRebaseGateway',
    deployer,
    [fxChildAddress, xcAmple.address, xcAmpleController.address],
    txParams,
  );
  const transferGateway = await deployContract(
    ethers,
    'MaticXCAmpleTransferGateway',
    deployer,
    [fxChildAddress, xcAmple.address, xcAmpleController.address],
    txParams,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await xcAmpleController.owner()) == deployerAddress) {
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(rebaseGateway.address)
    ).wait();
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(transferGateway.address)
    ).wait();
  } else {
    console.log(
      'Failed to add whitelist transfer gateway to XCAmpleController as deployer owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [rebaseGateway.address]);
    console.log('addBridgeGateway', [transferGateway.address]);
  }

  return { rebaseGateway, transferGateway };
}

module.exports = {
  deployAMPLContracts,
  deployXCAmpleContracts,
  deployChainBridgeContracts,
  deployChainBridgeHelpers,
  deployTokenVault,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts,
  deployMaticBaseChainGatewayContracts,
  deployMaticSatelliteChainGatewayContracts,
};
