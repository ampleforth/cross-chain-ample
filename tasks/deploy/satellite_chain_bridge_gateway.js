const { task } = require('hardhat/config');
const constants = require('../constants');
const {readAddresses,getFunctionSignature,writeAddresses} = require('../utils')

task(
  'satellite_chain_bridge_gateway:deploy',
  'Deploys the chain bridge gateway contracts and connects it with chain-bridge and the xc-ample token',
)
  .setAction(async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();
    console.log('Deployer:', deployerAddress);

    console.log('Deploying gateway contracts...');
    const chainAddresses = await readAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name);

    const gatewayFactory = await hre.ethers.getContractFactory(
      'contracts/satellite-chain/bridge-gateways/ChainBridgeXCAmpleGateway.sol:ChainBridgeXCAmpleGateway',
    )
    const rebaseGateway = await gatewayFactory
      .connect(deployer)
      .deploy(
        chainAddresses.chainBridge.genericHandler,
        chainAddresses.xcAmple,
        chainAddresses.xcAmpleController,
      );
    const transferGateway = await gatewayFactory
      .connect(deployer)
      .deploy(
        chainAddresses.chainBridge.genericHandler,
        chainAddresses.xcAmple,
        chainAddresses.xcAmpleController,
      );

    const bridgeFactory = await hre.ethers.getContractFactory(
      'chainbridge-solidity/contracts/Bridge.sol:Bridge'
    )
    const bridge = await bridgeFactory
      .connect(deployer)
      .attach(chainAddresses.chainBridge.bridge)
    await bridge.adminSetGenericResource(
      chainAddresses.chainBridge.genericHandler,
      constants.CB_REBASE_RESOURCE,
      rebaseGateway.address,
      constants.CB_BLANK_FUNCTION_SIG,
      0,
      getFunctionSignature(rebaseGateway, 'reportRebase'),
    );

    await bridge.adminSetGenericResource(
      chainAddresses.chainBridge.genericHandler,
      constants.CB_TRANSFER_RESOURCE,
      transferGateway.address,
      getFunctionSignature(transferGateway, 'validateAndBurn'),
      12, // Padding for the depositor address validation
      getFunctionSignature(transferGateway, 'mint'),
    );

    console.log('Deployed contracts...');
    const dt = {
      chainBridgeGateway: {
        transferGateway: transferGateway.address,
        rebaseGateway: rebaseGateway.address,
      }
    };
    await writeAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name, dt);
    console.log(dt);
  });
