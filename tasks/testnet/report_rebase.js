const { task } = require('hardhat/config');
const constants = require('../constants');
const {readAddresses, packXCRebaseData} = require('../utils')

task(
  'report_rebase:testnet',
  'Reports most recent rebase via bridge',
)
  .setAction(async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const depositor = accounts[0];
    const depositorAddress = await depositor.getAddress();
    console.log('Depositor:', depositorAddress);

    const chainAddresses = await readAddresses(constants.DEPLOYMENT_CONFIG_PATH, hre.network.name);

    const bridgeFactory = await hre.ethers.getContractFactory(
      'chainbridge-solidity/contracts/Bridge.sol:Bridge'
    )
    const bridge = await bridgeFactory
      .connect(depositor)
      .attach(chainAddresses.chainBridge.bridge);

    const amplFactory = await hre.ethers.getContractFactory(
      'uFragments/contracts/UFragments.sol:UFragments'
    )
    const amplToken = await amplFactory
      .connect(depositor)
      .attach(chainAddresses.ampl);

    const policyFactory = await hre.ethers.getContractFactory(
      'uFragments/contracts/UFragmentsPolicy.sol:UFragmentsPolicy'
    )
    const monetaryPolicy = await policyFactory
      .connect(depositor)
      .attach(chainAddresses.monetaryPolicy);

    const globalAmpleforthEpoch = await monetaryPolicy.epoch();
    const globalAMPLSupply = await amplToken.totalSupply();

    await bridge.connect(depositor).deposit('200',
      constants.CB_REBASE_RESOURCE,
      packXCRebaseData(globalAmpleforthEpoch, globalAMPLSupply));

  });
