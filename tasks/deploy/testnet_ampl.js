const { task } = require('hardhat/config');
const constants = require('../constants');
const {writeAddresses} = require('../utils');

task('testnet_ampl:deploy', 'Deploy ampleforth contracts').setAction(
  async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();
    console.log('Deployer:', deployerAddress);

    console.log('Deploying contracts on satellite-chain...');
    const ampl = await upgrades.deployProxy(
      (
        await ethers.getContractFactory(
          'uFragments/contracts/UFragments.sol:UFragments',
        )
      ).connect(deployer),
      [await deployer.getAddress()],
      {
        initializer: 'initialize(address)',
      },
    );
    const rateOracle = await (
      await ethers.getContractFactory(
        'market-oracle/contracts/MedianOracle.sol:MedianOracle',
      )
    )
      .connect(deployer)
      .deploy(3600 * 24 * 365, 0, 1);
    await rateOracle.connect(deployer).addProvider(deployerAddress);
    await rateOracle.connect(deployer).pushReport(constants.AMPL_BASE_RATE);
    const cpiOracle = await (
      await ethers.getContractFactory(
        'market-oracle/contracts/MedianOracle.sol:MedianOracle',
      )
    )
      .connect(deployer)
      .deploy(3600 * 24 * 365, 0, 1);
    await cpiOracle.addProvider(deployerAddress);
    await cpiOracle.connect(deployer).pushReport(constants.AMPL_BASE_CPI);
    const monetaryPolicy = await upgrades.deployProxy(
      (
        await ethers.getContractFactory(
          'uFragments/contracts/UFragmentsPolicy.sol:UFragmentsPolicy',
        )
      ).connect(deployer),
      [
        await deployer.getAddress(),
        ampl.address,
        constants.AMPL_BASE_CPI.toString(),
      ],
      {
        initializer: 'initialize(address,address,uint256)',
      },
    );
    await monetaryPolicy.connect(deployer).setMarketOracle(rateOracle.address);
    await monetaryPolicy.connect(deployer).setCpiOracle(cpiOracle.address);
    await monetaryPolicy.connect(deployer).setRebaseLag(1);
    await monetaryPolicy
      .connect(deployer)
      .setRebaseTimingParameters(1, 0, 3600);
    await ampl.connect(deployer).setMonetaryPolicy(monetaryPolicy.address);
    const orchestrator = await (
      await ethers.getContractFactory(
        'uFragments/contracts/Orchestrator.sol:Orchestrator',
      )
    )
      .connect(deployer)
      .deploy(monetaryPolicy.address);
    await monetaryPolicy.setOrchestrator(orchestrator.address);
    console.log('Deployed contracts on base-chain...');

    const execRebase = async percChange => {
      await rateOracle.pushReport(
        constants.AMPL_BASE_RATE.add(constants.AMPL_BASE_RATE.mul(percChange).div(100)),
      );
      await orchestrator.rebase();
    };
    await execRebase(0);

    const dt = {
      ampl: ampl.address,
      monetaryPolicy: monetaryPolicy.address,
      orchestrator: orchestrator.address,
      rateOracle: rateOracle.address,
      cpiOracle: cpiOracle.address,
    };
    await writeAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name, dt);
    console.log(dt);
  },
);
