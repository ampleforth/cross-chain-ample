const { AMPL_BASE_RATE, AMPL_BASE_CPI } = require('../../sdk/ampleforth');

const {
  deployContract,
  deployProxyAdminContract,
  deployProxyContract
} = require('../contracts');

async function deployAMPLTestnetContracts (
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const deployerAddress = await deployer.getAddress();

  const proxyAdmin = await deployProxyAdminContract(ethers, deployer, txParams);

  const ampl = await deployProxyContract(
    ethers,
    'UFragmentsTestnet',
    proxyAdmin,
    deployer,
    [deployerAddress],
    { initializer: 'initialize(address)' },
    txParams,
    waitBlocks,
  );

  const rateOracle = await deployContract(
    ethers,
    'MedianOracle',
    deployer,
    [3600 * 24 * 365, 0, 1],
    txParams,
    waitBlocks,
  );
  await (
    await rateOracle.connect(deployer).addProvider(deployerAddress, txParams)
  ).wait(waitBlocks);
  await (
    await rateOracle.connect(deployer).pushReport(AMPL_BASE_RATE, txParams)
  ).wait(waitBlocks);

  const cpiOracle = await deployContract(
    ethers,
    'MedianOracle',
    deployer,
    [3600 * 24 * 365, 0, 1],
    txParams,
    waitBlocks,
  );
  await (
    await cpiOracle.addProvider(deployerAddress, txParams)
  ).wait(waitBlocks);
  await (
    await cpiOracle.connect(deployer).pushReport(AMPL_BASE_CPI, txParams)
  ).wait(waitBlocks);

  const policy = await deployProxyContract(
    ethers,
    'UFragmentsPolicy',
    proxyAdmin,
    deployer,
    [deployerAddress, ampl.address, AMPL_BASE_CPI.toString()],
    {
      initializer: 'initialize(address,address,uint256)'
    },
    txParams,
    waitBlocks,
  );
  await (
    await policy.connect(deployer).setMarketOracle(rateOracle.address, txParams)
  ).wait(waitBlocks);
  await (
    await policy.connect(deployer).setCpiOracle(cpiOracle.address, txParams)
  ).wait(waitBlocks);
  await (
    await policy.connect(deployer).setRebaseLag(1, txParams)
  ).wait(waitBlocks);
  await (
    await policy
      .connect(deployer)
      .setRebaseTimingParameters(1, 0, 3600, txParams)
  ).wait(waitBlocks);
  await (
    await ampl.connect(deployer).setMonetaryPolicy(policy.address, txParams)
  ).wait(waitBlocks);

  const orchestrator = await deployContract(
    ethers,
    'Orchestrator',
    deployer,
    [policy.address],
    txParams,
    waitBlocks,
  );
  await (
    await policy
      .connect(deployer)
      .setOrchestrator(orchestrator.address, txParams)
  ).wait(waitBlocks);

  return {
    proxyAdmin,
    ampl,
    policy,
    orchestrator,
    rateOracle,
    cpiOracle
  };
}

async function deployXCAmpleContracts (
  { tokenSymbol, tokenName, globalAmpleforthEpoch, globalAMPLSupply },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
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
    waitBlocks,
  );

  const xcAmpleController = await deployProxyContract(
    ethers,
    'XCAmpleController',
    proxyAdmin,
    deployer,
    [xcAmple.address, globalAmpleforthEpoch],
    {
      initializer: 'initialize(address,uint256)'
    },
    txParams,
    waitBlocks,
  );

  const rebaseRelayer = await deployContract(
    ethers,
    'BatchTxExecutor',
    deployer,
    [],
    txParams,
    waitBlocks,
  );

  await (
    await xcAmple.setController(xcAmpleController.address, txParams)
  ).wait(waitBlocks);
  await (
    await xcAmpleController.setRebaseRelayer(rebaseRelayer.address, txParams)
  ).wait(waitBlocks);

  return { proxyAdmin, xcAmple, xcAmpleController, rebaseRelayer };
}

module.exports = {
  deployAMPLTestnetContracts,
  deployXCAmpleContracts
};
