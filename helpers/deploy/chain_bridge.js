const {
  XC_REBASE_RESOURCE_ID,
  XC_TRANSFER_RESOURCE_ID,
  CB_FUNCTION_SIG_BC_REPORT_REBASE,
  CB_FUNCTION_SIG_SC_REPORT_REBASE,
  CB_FUNCTION_SIG_BC_TRANSFER,
  CB_FUNCTION_SIG_SC_TRANSFER
} = require('../../sdk/chain_bridge');

const { deployContract } = require('../contracts');

async function deployChainBridgeHelpers (
  bridge,
  { chainId, relayers, relayerThreshold, fee, expiry },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const batchRebaseReporter = await deployContract(
    ethers,
    'ChainBridgeBatchRebaseReport',
    deployer,
    [],
    txParams,
    waitBlocks,
  );

  return {
    batchRebaseReporter
  };
}

async function deployChainBridgeContracts (
  { chainId, relayers, relayerThreshold, fee, expiry },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const bridge = await deployContract(
    ethers,
    'Bridge',
    deployer,
    [chainId, relayers, relayerThreshold, fee, expiry],
    txParams,
    waitBlocks,
  );

  const genericHandler = await deployContract(
    ethers,
    'GenericHandler',
    deployer,
    [bridge.address, [], [], [], [], []],
    txParams,
    waitBlocks,
  );

  const helpers = await deployChainBridgeHelpers(
    bridge,
    { chainId, relayers, relayerThreshold, fee, expiry },
    ethers,
    deployer,
    txParams,
    waitBlocks,
  );

  return {
    bridge,
    genericHandler,
    ...helpers
  };
}

async function deployChainBridgeBaseChainGatewayContracts (
  { ampl, policy, bridge, genericHandler, tokenVault },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const rebaseGateway = await deployContract(
    ethers,
    'AMPLChainBridgeGateway',
    deployer,
    [genericHandler.address, ampl.address, policy.address, tokenVault.address],
    txParams,
    waitBlocks,
  );
  const transferGateway = await deployContract(
    ethers,
    'AMPLChainBridgeGateway',
    deployer,
    [genericHandler.address, ampl.address, policy.address, tokenVault.address],
    txParams,
    waitBlocks,
  );

  const deployerAddress = await deployer.getAddress();
  const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
  const isAdmin = await bridge.hasRole(adminRole, deployerAddress);

  const reportRebaseFnSig = CB_FUNCTION_SIG_BC_REPORT_REBASE(rebaseGateway);

  if (isAdmin) {
    await (
      await bridge
        .connect(deployer)
        .adminSetGenericResource(
          genericHandler.address,
          XC_REBASE_RESOURCE_ID,
          rebaseGateway.address,
          ...reportRebaseFnSig,
          txParams,
        )
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_REBASE_RESOURCE_ID,
      rebaseGateway.address,
      ...reportRebaseFnSig
    ]);
  }

  const transferFnSig = CB_FUNCTION_SIG_BC_TRANSFER(transferGateway);
  if (isAdmin) {
    await (
      await bridge
        .connect(deployer)
        .adminSetGenericResource(
          genericHandler.address,
          XC_TRANSFER_RESOURCE_ID,
          transferGateway.address,
          ...transferFnSig,
          txParams,
        )
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_TRANSFER_RESOURCE_ID,
      transferGateway.address,
      ...transferFnSig
    ]);
  }

  if ((await tokenVault.owner()) === deployerAddress) {
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
    console.log('addBridgeGateway', [transferGateway.address]);
  }

  return { rebaseGateway, transferGateway };
}

async function deployChainBridgeSatelliteChainGatewayContracts (
  { xcAmple, xcAmpleController, bridge, genericHandler },
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const rebaseGateway = await deployContract(
    ethers,
    'ChainBridgeXCAmpleGateway',
    deployer,
    [genericHandler.address, xcAmple.address, xcAmpleController.address],
    txParams,
    waitBlocks,
  );
  const transferGateway = await deployContract(
    ethers,
    'ChainBridgeXCAmpleGateway',
    deployer,
    [genericHandler.address, xcAmple.address, xcAmpleController.address],
    txParams,
    waitBlocks,
  );

  await (
    await xcAmpleController
      .connect(deployer)
      .addBridgeGateway(rebaseGateway.address, txParams)
  ).wait(waitBlocks);

  await (
    await xcAmpleController
      .connect(deployer)
      .addBridgeGateway(transferGateway.address, txParams)
  ).wait(waitBlocks);

  const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
  const isAdmin = await bridge.hasRole(adminRole, await deployer.getAddress());

  const reportRebaseFnSig = CB_FUNCTION_SIG_SC_REPORT_REBASE(rebaseGateway);
  if (isAdmin) {
    await (
      await bridge.adminSetGenericResource(
        genericHandler.address,
        XC_REBASE_RESOURCE_ID,
        rebaseGateway.address,
        ...reportRebaseFnSig,
        txParams,
      )
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_REBASE_RESOURCE_ID,
      rebaseGateway.address,
      ...reportRebaseFnSig
    ]);
  }

  const transferFnSig = CB_FUNCTION_SIG_SC_TRANSFER(transferGateway);
  if (isAdmin) {
    await (
      await bridge.adminSetGenericResource(
        genericHandler.address,
        XC_TRANSFER_RESOURCE_ID,
        transferGateway.address,
        ...transferFnSig,
        txParams,
      )
    ).wait(waitBlocks);
  } else {
    console.log(
      'Failed adding generic resource to bridge, deployer key not bridge owner',
    );
    console.log('Execute the following on-chain');
    console.log('adminSetGenericResource', [
      genericHandler.address,
      XC_TRANSFER_RESOURCE_ID,
      transferGateway.address,
      ...transferFnSig
    ]);
  }

  return { rebaseGateway, transferGateway };
}

module.exports = {
  deployChainBridgeContracts,
  deployChainBridgeHelpers,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts
};
