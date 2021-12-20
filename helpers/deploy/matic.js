const { deployContract } = require('../contracts');

async function deployMaticBaseChainGatewayContracts (
  { ampl, policy, tokenVault, checkpointManagerAddress, fxRootAddress },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const rebaseGateway = await deployContract(
    ethers,
    'AMPLMaticRebaseGateway',
    deployer,
    [checkpointManagerAddress, fxRootAddress, ampl.address, policy.address],
    txParams,
    waitBlocks,
  );
  const transferGateway = await deployContract(
    ethers,
    'AMPLMaticTransferGateway',
    deployer,
    [checkpointManagerAddress, fxRootAddress, ampl.address, tokenVault.address],
    txParams,
    waitBlocks,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await tokenVault.owner()) === deployerAddress) {
    await (
      await tokenVault.connect(deployer).addBridgeGateway(rebaseGateway.address)
    ).wait(waitBlocks);
    await (
      await tokenVault
        .connect(deployer)
        .addBridgeGateway(transferGateway.address)
    ).wait(waitBlocks);
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

async function deployMaticSatelliteChainGatewayContracts (
  { xcAmple, xcAmpleController, fxChildAddress },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const rebaseGateway = await deployContract(
    ethers,
    'MaticXCAmpleRebaseGateway',
    deployer,
    [fxChildAddress, xcAmple.address, xcAmpleController.address],
    txParams,
    waitBlocks,
  );
  const transferGateway = await deployContract(
    ethers,
    'MaticXCAmpleTransferGateway',
    deployer,
    [fxChildAddress, xcAmple.address, xcAmpleController.address],
    txParams,
    waitBlocks,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await xcAmpleController.owner()) === deployerAddress) {
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(rebaseGateway.address)
    ).wait(waitBlocks);
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(transferGateway.address)
    ).wait(waitBlocks);
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
  deployMaticBaseChainGatewayContracts,
  deployMaticSatelliteChainGatewayContracts
};
