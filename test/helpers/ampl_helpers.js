const { ethers, upgrades } = require('hardhat');
const { getBlockTime, increaseTime } = require('./ethers_helpers');

const AMPL_DECIMALS = 9;
const toAmplDenomination = ample =>
  ethers.utils.parseUnits(ample, AMPL_DECIMALS);
const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + AMPL_DECIMALS);
const DECIMALS = 18;
const BASE_RATE = ethers.utils.parseUnits('1', DECIMALS);
const BASE_CPI = ethers.utils.parseUnits('100', DECIMALS);

async function setupAMPLContracts (deployer) {
  const deployerAddress = await deployer.getAddress();
  const ampl = await upgrades.deployProxy(
    (
      await ethers.getContractFactory(
        'contracts/_external/uFragments/UFragments.sol:UFragments',
      )
    ).connect(deployer),
    [await deployer.getAddress()],
    {
      initializer: 'initialize(address)'
    },
  );
  const rateOracle = await (
    await ethers.getContractFactory(
      'contracts/_external/uFragments/MedianOracle.sol:MedianOracle',
    )
  )
    .connect(deployer)
    .deploy(3600 * 24 * 365, 0, 1);
  await rateOracle.connect(deployer).addProvider(deployerAddress);
  await rateOracle.connect(deployer).pushReport(BASE_RATE);
  const cpiOracle = await (
    await ethers.getContractFactory(
      'contracts/_external/uFragments/MedianOracle.sol:MedianOracle',
    )
  )
    .connect(deployer)
    .deploy(3600 * 24 * 365, 0, 1);
  await cpiOracle.addProvider(deployerAddress);
  await cpiOracle.connect(deployer).pushReport(BASE_CPI);
  const policy = await upgrades.deployProxy(
    (
      await ethers.getContractFactory(
        'contracts/_external/uFragments/UFragmentsPolicy.sol:UFragmentsPolicy',
      )
    ).connect(deployer),
    [await deployer.getAddress(), ampl.address, BASE_CPI.toString()],
    {
      initializer: 'initialize(address,address,uint256)'
    },
  );
  await policy.connect(deployer).setMarketOracle(rateOracle.address);
  await policy.connect(deployer).setCpiOracle(cpiOracle.address);
  await policy.connect(deployer).setRebaseLag(1);
  await policy.connect(deployer).setRebaseTimingParameters(1, 0, 3600);
  await ampl.connect(deployer).setMonetaryPolicy(policy.address);
  const orchestrator = await (
    await ethers.getContractFactory(
      'contracts/_external/uFragments/Orchestrator.sol:Orchestrator',
    )
  )
    .connect(deployer)
    .deploy(policy.address);
  await policy.setOrchestrator(orchestrator.address);

  const increaseTimeToNextRebase = async () => {
    const now = await getBlockTime();
    const lastRebaseTime = (await policy.lastRebaseTimestampSec()).toNumber();
    const minRebaseInterval = (
      await policy.minRebaseTimeIntervalSec()
    ).toNumber();
    const nextRebaseTime = lastRebaseTime + minRebaseInterval;
    const waitTime = nextRebaseTime - now;
    if (waitTime > 0) {
      await increaseTime(waitTime);
    }
  };

  const execRebase = async percChange => {
    await rateOracle.pushReport(
      BASE_RATE.add(BASE_RATE.mul(percChange).div(100)),
    );
    await increaseTimeToNextRebase();
    await orchestrator.rebase();
  };

  const getCurrentState = async () => {
    const epoch = await policy.epoch();
    const totalSupply = await ampl.totalSupply();
    return { epoch, totalSupply };
  };

  await execRebase(0);

  return {
    ampl,
    rateOracle,
    cpiOracle,
    policy,
    orchestrator,
    getCurrentState,
    execRebase
  };
}

async function setupXCAMPLContracts (deployer) {
  const xcAmpl = await upgrades.deployProxy(
    (
      await ethers.getContractFactory(
        'contracts/xc-ampleforth/XCAmple.sol:XCAmple',
      )
    ).connect(deployer),
    ['XCAmple', 'xcAMPL', INITIAL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)'
    },
  );

  const xcController = await upgrades.deployProxy(
    (
      await ethers.getContractFactory(
        'contracts/xc-ampleforth/XCAmpleController.sol:XCAmpleController',
      )
    ).connect(deployer),
    [xcAmpl.address, 1],
    {
      initializer: 'initialize(address,uint256)'
    },
  );
  await xcAmpl.setController(xcController.address);

  const xcRebaseRelayer = await (
    await ethers.getContractFactory(
      'contracts/utilities/BatchTxExecutor.sol:BatchTxExecutor',
    )
  )
    .connect(deployer)
    .deploy();
  await xcController.setRebaseRelayer(xcRebaseRelayer.address);

  const getCurrentState = async () => {
    const epoch = await xcController.globalAmpleforthEpoch();
    const totalSupply = await xcAmpl.globalAMPLSupply();
    return { epoch, totalSupply };
  };

  return { xcRebaseRelayer, xcController, xcAmpl, getCurrentState };
}

module.exports = {
  setupAMPLContracts,
  setupXCAMPLContracts,
  toAmplDenomination
};
