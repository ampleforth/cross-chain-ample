const { ethers } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  recipient,
  bridge,
  bridgeAddress,
  xcAmpl,
  xcAmplPolicy,
  gateway;
async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  bridgeAddress = await bridge.getAddress();
  recipient = accounts[2];

  xcAmpl = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();
  xcAmplPolicy = await (await ethers.getContractFactory('MockXCAmplPolicy'))
    .connect(deployer)
    .deploy();

  gateway = await (
    await ethers.getContractFactory('ChainBridgeXCAmpleforthPolicyGateway')
  )
    .connect(deployer)
    .deploy(bridgeAddress, xcAmpl.address, xcAmplPolicy.address);

  await xcAmplPolicy.updateAMPLEpoch(1);
  await xcAmpl.updateTotalAMPLSupply(50000);
}

describe('ChainBridgeXCAmpleforthPolicyGateway:Initialization', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.xcAmpl()).to.eq(xcAmpl.address);
    expect(await gateway.xcAmplPolicy()).to.eq(xcAmplPolicy.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:reportRebase:accessControl', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway.connect(deployer).reportRebase(1, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(gateway.connect(bridge).reportRebase(1, 50000)).to.not.be
      .reverted;
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:reportRebase', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('when on-chain supply is different', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(gateway.connect(bridge).reportRebase(2, 100000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 100000, 1, 50000);

      await expect(gateway.connect(bridge).reportRebase(3, 40000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(3, 40000, 1, 50000);
    });
  });

  describe('when on-chain supply is the same', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(gateway.connect(bridge).reportRebase(2, 50000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 50000, 1, 50000);
    });
  });
});
