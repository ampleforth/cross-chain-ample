const { task } = require('hardhat/config');
const constants = require('../constants');
const {readAddresses, getFunctionSignature,writeAddresses} = require('../utils')

task(
  'base_chain_bridge_gateway:deploy',
  'Deploys the chain gateway contract and connects it with chain-bridge and the AMPL token',
)
  .setAction(async (args, hre) => {
    console.log(args);

    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();
    console.log('Deployer:', deployerAddress);

    console.log('Deploying gateway contracts...');
    const chainAddresses = await readAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name);

    const tokenVault = await (
      await hre.ethers.getContractFactory(
        'contracts/base-chain/TokenVault.sol:TokenVault',
      )
    )
      .connect(deployer)
      .deploy();

    const gatewayFactory = await hre.ethers.getContractFactory(
      'contracts/base-chain/bridge-gateways/AMPLChainBridgeGateway.sol:AMPLChainBridgeGateway',
    )
    const rebaseGateway = await gatewayFactory
      .connect(deployer)
      .deploy(
        chainAddresses.chainBridge.genericHandler,
        chainAddresses.ampl,
        chainAddresses.monetaryPolicy,
        tokenVault.address,
      );
    const transferGateway = await gatewayFactory
      .connect(deployer)
      .deploy(
        chainAddresses.chainBridge.genericHandler,
        chainAddresses.ampl,
        chainAddresses.monetaryPolicy,
        tokenVault.address,
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
      getFunctionSignature(rebaseGateway, 'validateRebaseReport'),
      0,
      constants.CB_BLANK_FUNCTION_SIG,
    );

    await bridge.adminSetGenericResource(
      chainAddresses.chainBridge.genericHandler,
      constants.CB_TRANSFER_RESOURCE,
      transferGateway.address,
      getFunctionSignature(transferGateway, 'validateAndLock'),
      // https://github.com/ChainSafe/chainbridge-solidity/blob/master/contracts/handlers/GenericHandler.sol#L170
      12, // Padding for the depositor address validation
      getFunctionSignature(transferGateway, 'unlock'),
    );

    console.log('Deployed contracts...');
    const dt = {
      chainBridgeGateway: {
        tokenVault: tokenVault.address,
        transferGateway: transferGateway.address,
        rebaseGateway: rebaseGateway.address,
      }
    };
    await writeAddresses(constants.DEPLOYMENT_CONFIG_PATH, network.name, dt);
    console.log(dt);
  });
