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
  await rateOracle.connect(deployer).addProvider(deployerAddress, txParams);
  await rateOracle.connect(deployer).pushReport(AMPL_BASE_RATE, txParams);

  const cpiOracle = await deployContract(
    ethers,
    'MedianOracle',
    deployer,
    [3600 * 24 * 365, 0, 1],
    txParams,
  );
  await cpiOracle.addProvider(deployerAddress, txParams);
  await cpiOracle.connect(deployer).pushReport(AMPL_BASE_CPI, txParams);

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
  await policy.connect(deployer).setMarketOracle(rateOracle.address, txParams);
  await policy.connect(deployer).setCpiOracle(cpiOracle.address, txParams);
  await policy.connect(deployer).setRebaseLag(1, txParams);
  await policy
    .connect(deployer)
    .setRebaseTimingParameters(1, 0, 3600, txParams);

  await ampl.connect(deployer).setMonetaryPolicy(policy.address, txParams);

  const orchestrator = await deployContract(
    ethers,
    'Orchestrator',
    deployer,
    [policy.address],
    txParams,
  );
  await policy
    .connect(deployer)
    .setOrchestrator(orchestrator.address, txParams);

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

  await xcAmple.setController(xcAmpleController.address);
  await xcAmpleController.setRebaseRelayer(rebaseRelayer.address);

  return { proxyAdmin, xcAmple, xcAmpleController, rebaseRelayer };
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

  const erc20Handler = await deployContract(
    ethers,
    'ERC20Handler',
    deployer,
    [bridge.address, [], [], []],
    txParams,
  );

  const erc721Handler = await deployContract(
    ethers,
    'ERC721Handler',
    deployer,
    [bridge.address, [], [], []],
    txParams,
  );

  const batchRebaseReporter = await deployContract(
    ethers,
    'ChainBridgeBatchRebaseReport',
    deployer,
    [],
    txParams,
  );

  return {
    bridge,
    genericHandler,
    erc20Handler,
    erc721Handler,
    batchRebaseReporter,
  };
}

async function deployChainBridgeBaseChainGatewayContracts(
  { ampl, policy, bridge, genericHandler },
  ethers,
  deployer,
  txParams = {},
) {
  const tokenVault = await deployContract(
    ethers,
    'TokenVault',
    deployer,
    [],
    txParams,
  );

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

  const reportRebaseFnSig = CB_FUNCTION_SIG_baseChainReportRebase(
    rebaseGateway,
  );
  await bridge
    .connect(deployer)
    .adminSetGenericResource(
      genericHandler.address,
      XC_REBASE_RESOURCE_ID,
      rebaseGateway.address,
      ...reportRebaseFnSig,
      txParams,
    );

  const transferFnSig = CB_FUNCTION_SIG_baseChainTransfer(transferGateway);
  await bridge
    .connect(deployer)
    .adminSetGenericResource(
      genericHandler.address,
      XC_TRANSFER_RESOURCE_ID,
      transferGateway.address,
      ...transferFnSig,
      txParams,
    );

  await tokenVault.addBridgeGateway(transferGateway.address);

  return { tokenVault, rebaseGateway, transferGateway };
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

  await xcAmpleController
    .connect(deployer)
    .addBridgeGateway(rebaseGateway.address);
  await xcAmpleController
    .connect(deployer)
    .addBridgeGateway(transferGateway.address);

  const reportRebaseFnSig = CB_FUNCTION_SIG_satelliteChainReportRebase(
    rebaseGateway,
  );
  await bridge.adminSetGenericResource(
    genericHandler.address,
    XC_REBASE_RESOURCE_ID,
    rebaseGateway.address,
    ...reportRebaseFnSig,
    txParams,
  );
  const transferFnSig = CB_FUNCTION_SIG_satelliteChainTransfer(transferGateway);
  await bridge.adminSetGenericResource(
    genericHandler.address,
    XC_TRANSFER_RESOURCE_ID,
    transferGateway.address,
    ...transferFnSig,
    txParams,
  );

  return { rebaseGateway, transferGateway };
}

module.exports = {
  deployAMPLContracts,
  deployXCAmpleContracts,
  deployChainBridgeContracts,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts,
};
