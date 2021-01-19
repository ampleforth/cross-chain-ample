const { task } = require('hardhat/config');
const ethers = require('ethers');
const constants = require('../constants');
const {readAddresses, writeAddresses} = require('../utils');

task('xc_ample:deploy', 'Deploy xc_ampleforth contracts')
  .addParam(
    'baseChainNetwork',
    'The hardhat network name of the base chain'
  )
  .addParam(
    'tokenSymbol',
    'The full name of the cross-chain ample ERC-20 token',
  )
  .addParam('tokenName', 'The symbol of the cross-chain ample ERC-20 token')
  .setAction(async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();
    console.log('Deployer:', deployerAddress);

    console.log('Reading base-chain parameters...');
    const hhConfig = require(constants.HARDHAT_CONFIG_PATH);
    const baseChainAddresses = await readAddresses(constants.DEPLOYMENT_CONFIG_PATH, args.baseChainNetwork);

    const baseChainProvider = new ethers.providers.JsonRpcProvider(
      hhConfig.networks[args.baseChainNetwork].url,
    );
    const amplToken = new ethers.Contract(
      baseChainAddresses.ampl,
      constants.ContractABIs.UFragments.abi,
      baseChainProvider,
    );
    const monetaryPolicy = new ethers.Contract(
      baseChainAddresses.monetaryPolicy,
      constants.ContractABIs.UFragmentsPolicy.abi,
      baseChainProvider,
    );

    // NOTE: do not run this script around rebase, there's a minute chance that
    // the epoch and global supply can go out of sync
    const epoch = await monetaryPolicy.epoch();
    const globalAMPLSupply = await amplToken.totalSupply();

    console.log(
      'Epoch',
      epoch.toNumber(),
      ', TotalSupply',
      globalAMPLSupply.toString(),
    );

    console.log('Deploying contracts on satellite-chain...');
    const xcAmpleFactory = await hre.ethers.getContractFactory(
      'contracts/satellite-chain/xc-ampleforth/XCAmple.sol:XCAmple',
    );
    const xcAmple = await upgrades.deployProxy(
      xcAmpleFactory.connect(deployer),
      [args.tokenName, args.tokenSymbol, globalAMPLSupply],
      { initializer: 'initialize(string,string,uint256)' },
    );

    const xcAmpleControllerfactory = await hre.ethers.getContractFactory(
      'contracts/satellite-chain/xc-ampleforth/XCAmpleController.sol:XCAmpleController',
    );
    const xcAmpleController = await upgrades.deployProxy(
      xcAmpleControllerfactory.connect(deployer),
      [xcAmple.address, epoch],
      {
        initializer: 'initialize(address,uint256)',
      },
    );

    const rebaseRelayerFactory = await hre.ethers.getContractFactory(
      'contracts/_utilities/BatchTxExecutor.sol:BatchTxExecutor',
    );
    const rebaseRelayer = await rebaseRelayerFactory.connect(deployer).deploy();
    console.log('Deployed contracts on satellite-chain...');

    console.log('Setting contract references...');
    await xcAmpleController.setRebaseRelayer(rebaseRelayer.address);

    const dt = {
      xcAmple: xcAmple.address,
      xcAmpleController: xcAmpleController.address,
      rebaseRelayer: rebaseRelayer.address,
    };
    await writeAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name, dt);
    console.log(dt);
  });
