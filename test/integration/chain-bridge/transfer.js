const { ethers } = require('@nomiclabs/buidler');
// const { expect } = require('chai');

const {
  setupAMPLContracts,
  setupXCAMPLContracts,
  setupBridgeContracts,
  setupBridgeGatewayContracts,
  propagateAndExecuteXCRebase,
  propagateXCTransfer,
  toAmplDenomination
} = require('./helper');

let accounts,
  deployer,
  deployerAddress,
  relayer,
  otherUser,
  otherUserAddress,
  amplContracts,
  xcAmplContracts,
  bridgeContracts,
  bridgeGatewayContracts,
  ampl,
  policy,
  orchestrator,
  rateOracle,
  xcAmpl,
  xcPolicy,
  xcOrchestrator,
  ethBridge,
  ethBridgeHandler,
  tronBridge,
  tronBridgeHandler,
  ethChainID,
  tronChainID,
  amplVault,
  amplBridgeGateway,
  bridgeXcPolicyGateway,
  rebaseReportResource;
async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  deployerAddress = await deployer.getAddress();
  relayer = accounts[1];
  otherUser = accounts[2];
  otherUserAddress = await otherUser.getAddress();

  amplContracts = await setupAMPLContracts(deployer);
  ({ ampl, policy, orchestrator, rateOracle } = amplContracts);

  xcAmplContracts = await setupXCAMPLContracts(deployer);
  ({ xcAmpl, xcPolicy, xcOrchestrator } = xcAmplContracts);

  bridgeContracts = await setupBridgeContracts(deployer, relayer);
  ({ ethChainID, tronChainID } = bridgeContracts);
  ethBridge = bridgeContracts[ethChainID];
  ethBridgeHandler = bridgeContracts[ethChainID];
  tronBridge = bridgeContracts[tronChainID];
  tronBridgeHandler = bridgeContracts[tronChainID];

  bridgeGatewayContracts = await setupBridgeGatewayContracts(
    deployer,
    amplContracts,
    xcAmplContracts,
    bridgeContracts,
  );
  ({
    amplVault,
    amplBridgeGateway,
    bridgeXcPolicyGateway,
    rebaseReportResource
  } = bridgeGatewayContracts);
}

describe.only('Chain Bridge integration', function () {
  before(setupContracts);

  describe('when rebase is reported', function () {
    it('should propagate rebase to other chain', async function () {
      // execute new rebase
      await orchestrator.rebase();

      // propagate
      const { txOutFrom, txInTo } = await propagateAndExecuteXCRebase(
        deployer,
        relayer,
        amplContracts,
        xcAmplContracts,
        bridgeContracts,
        bridgeGatewayContracts,
      );

      const transferAmt = toAmplDenomination('1000');
      await ampl.connect(deployer).approve(amplVault.address, transferAmt);
      await propagateXCTransfer(
        deployer,
        relayer,
        bridgeContracts.ethChainID,
        bridgeContracts.tronChainID,
        bridgeContracts,
        bridgeGatewayContracts,
        ampl,
        deployerAddress,
        otherUserAddress,
        transferAmt,
      );

      console.log((await ampl.balanceOf(deployerAddress)).toString());
      console.log((await xcAmpl.balanceOf(otherUserAddress)).toString());

      // await expect(
      //   (async () => txOutFrom)()
      // )
      //   .to.emit(amplBridgeGateway, 'XCRebaseReportOut')
      //   .withArgs(epoch, totalSupply);

      // await expect(
      //   (async () => txInTo)()
      // )
      //   .to.emit(bridgeXcPolicyGateway, 'XCRebaseReportIn')
      //   .withArgs(epoch, totalSupply, epoch, totalSupply);
    });
  });
});
