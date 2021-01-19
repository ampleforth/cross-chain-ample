const { task } = require('hardhat/config');
const constants = require('../constants');
const {writeAddresses} = require('../utils');

task(
  'chain_bridge:deploy',
  'Deploy chainbridge and handler contracts contracts',
)
  .addParam(
    'chainId',
    'Chain ID for the instance'
  )
  .addParam('relayers', 'Comma separated list of initial relayers', '')
  .addParam(
    'relayerThreshold',
    'Number of votes required for a proposal to pass',
    '1',
  )
  .addParam(
    'fee',
    'Fee to be taken when making a deposit (decimals allowed)',
    '0',
  )
  .addParam(
    'expiry',
    'Number of blocks after which a proposal is considered canceled',
    '100',
  )
  .setAction(async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();
    console.log('Deployer:', deployerAddress);

    console.log('Deploying chain-bridge contracts...');
    const initialRelayers = args.relayers ? args.relayers.split(',') : [deployerAddress];

    const bridge = await (
      await ethers.getContractFactory(
        'chainbridge-solidity/contracts/Bridge.sol:Bridge',
      )
    )
      .connect(deployer)
      .deploy(
        args.chainId,
        initialRelayers,
        args.relayerThreshold,
        args.fee,
        args.expiry,
      );

    const genericHandler = await (
      await ethers.getContractFactory(
        'chainbridge-solidity/contracts/handlers/GenericHandler.sol:GenericHandler',
      )
    )
      .connect(deployer)
      .deploy(bridge.address, [], [], [], [], []);

    // Deploy other handler if required
    console.log('Deployed contracts...');

    const dt = {
      chainBridge: {
        bridge: bridge.address,
        genericHandler: genericHandler.address,
      }
    };
    await writeAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name, dt);
    console.log(dt);
  });
