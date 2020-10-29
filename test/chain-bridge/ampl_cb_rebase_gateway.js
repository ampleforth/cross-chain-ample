const { ethers } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  recipient,
  bridge,
  bridgeAddress,
  ampl,
  policy,
  gateway;
async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  bridgeAddress = await bridge.getAddress();
  recipient = accounts[2];

  ampl = await (await ethers.getContractFactory('MockAmpl'))
    .connect(deployer)
    .deploy();
  policy = await (await ethers.getContractFactory('MockAmplPolicy'))
    .connect(deployer)
    .deploy();

  gateway = await (await ethers.getContractFactory('AmplCBRebaseGateway'))
    .connect(deployer)
    .deploy(bridgeAddress, ampl.address, policy.address);

  await policy.updateEpoch(1);
  await ampl.updateTotalSupply(50000);
}

describe('AmplCBRebaseGateway:Initialization', () => {
  before('setup AmplCBRebaseGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.ampl()).to.eq(ampl.address);
    expect(await gateway.policy()).to.eq(policy.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('AmplCBRebaseGateway:validateRebaseReport:accessControl', () => {
  before('setup AmplCBRebaseGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway.connect(deployer).validateRebaseReport(1, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(gateway.connect(bridge).validateRebaseReport(1, 50000)).to.not
      .be.reverted;
  });
});

describe('AmplCBRebaseGateway:validateRebaseReport', () => {
  before('setup AmplCBRebaseGateway contract', setupContracts);

  describe('when epoch is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway.connect(bridge).validateRebaseReport(2, 50000),
      ).to.be.revertedWith(
        'AmplCBRebaseGateway: recorded epoch not consistent',
      );
    });
  });

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway.connect(bridge).validateRebaseReport(1, 50001),
      ).to.be.revertedWith(
        'AmplCBRebaseGateway: recorded total supply not consistent',
      );
    });
  });
});

describe('AmplCBRebaseGateway:validateRebaseReport', () => {
  before('setup AmplCBRebaseGateway contract', setupContracts);

  it('should emit XCRebaseReportOut', async function () {
    await expect(gateway.connect(bridge).validateRebaseReport(1, 50000))
      .to.emit(gateway, 'XCRebaseReportOut')
      .withArgs(1, 50000);
  });
});
