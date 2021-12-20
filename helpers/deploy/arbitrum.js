const { deployContract } = require('../contracts');

async function deployArbitrumBaseChainGatewayContracts (
  { ampl, policy, tokenVault },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const gateway = await deployContract(
    ethers,
    'AMPLArbitrumGateway',
    deployer,
    [ampl.address, policy.address, tokenVault.address],
    txParams,
    waitBlocks,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await tokenVault.owner()) === deployerAddress) {
    await (
      await tokenVault.connect(deployer).addBridgeGateway(gateway.address)
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed to add whitelist transfer gateway to vault as deployer not vault owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [gateway.address]);
  }

  return { gateway };
}

async function deployArbitrumSatelliteChainGatewayContracts (
  { xcAmple, xcAmpleController },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const gateway = await deployContract(
    ethers,
    'ArbitrumXCAmpleGateway',
    deployer,
    [xcAmple.address, xcAmpleController.address],
    txParams,
    waitBlocks,
  );

  const deployerAddress = await deployer.getAddress();
  if ((await xcAmpleController.owner()) === deployerAddress) {
    await (
      await xcAmpleController
        .connect(deployer)
        .addBridgeGateway(gateway.address)
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed to add whitelist transfer gateway to XCAmpleController as deployer owner',
    );
    console.log('Execute the following on-chain');
    console.log('addBridgeGateway', [gateway.address]);
  }

  return { gateway };
}

module.exports = {
  deployArbitrumBaseChainGatewayContracts,
  deployArbitrumSatelliteChainGatewayContracts
};
