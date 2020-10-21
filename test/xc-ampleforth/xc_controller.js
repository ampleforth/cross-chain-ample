const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts, deployer, controller, mockToken;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];

  mockToken = await (await ethers.getContractFactory('MockXCAmple'))
    .connect(deployer)
    .deploy();

  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmpleController');
  controller = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)'
    },
  );
}

describe('XCAmpleController:Initialization', () => {
  before('setup XCAmpleController contract', setupContracts);

  it('should initialize the token reference', async function () {
    expect(await controller.xcAmple()).to.eq(mockToken.address);
  });

  it('should initialize the epoch', async function () {
    expect(await controller.currentAMPLEpoch()).to.eq(1);
  });

  it('should set the owner', async function () {
    expect(await controller.owner()).to.eq(await deployer.getAddress());
  });
});

describe('XCAmpleController:setRebaseRelayer', async () => {
  let rebaseRelayer;
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    rebaseRelayer = await accounts[1].getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    expect(controller.connect(accounts[5]).setRebaseRelayer(rebaseRelayer)).to
      .be.reverted;
  });

  it('should be callable by owner', async function () {
    expect(controller.connect(deployer).setRebaseRelayer(rebaseRelayer)).to.not
      .be.reverted;
  });

  it('should update the RebaseRelayer reference', async function () {
    expect(await controller.rebaseRelayer()).to.be.eq(
      ethers.constants.AddressZero,
    );
    await controller.connect(deployer).setRebaseRelayer(rebaseRelayer);
    expect(await controller.rebaseRelayer()).to.be.eq(rebaseRelayer);
  });
});

describe('XCAmpleController:addBridgeGateway', async () => {
  let bridge, other;
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    bridge = await accounts[1].getAddress();
    other = await accounts[3].getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    expect(controller.connect(accounts[5]).addBridgeGateway(bridge)).to.be
      .reverted;
  });

  it('should be callable by owner', async function () {
    expect(controller.connect(deployer).addBridgeGateway(bridge)).to.not.be
      .reverted;
  });

  it('should add to the whitelist', async function () {
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.false;
    await expect(controller.connect(deployer).addBridgeGateway(bridge))
      .to.emit(controller, 'GatewayWhitelistUpdated')
      .withArgs(bridge, true);
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.true;
  });

  it('should NOT affect others', async function () {
    expect(await controller.whitelistedBridgeGateways(other)).to.be.false;
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.false;
    await controller.connect(deployer).addBridgeGateway(bridge);
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.true;
    expect(await controller.whitelistedBridgeGateways(other)).to.be.false;
  });
});

describe('XCAmpleController:removeBridgeGateway', async () => {
  let bridge, other;
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    bridge = await accounts[1].getAddress();
    other = await accounts[3].getAddress();
    await controller.connect(deployer).addBridgeGateway(bridge);
    await controller.connect(deployer).addBridgeGateway(other);
  });

  it('should NOT be callable by non-owner', async function () {
    expect(controller.connect(accounts[5]).removeBridgeGateway(bridge)).to.be
      .reverted;
  });

  it('should be callable by owner', async function () {
    expect(controller.connect(deployer).removeBridgeGateway(bridge)).to.not.be
      .reverted;
  });

  it('should remove from the whitelist', async function () {
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.true;
    await expect(controller.connect(deployer).removeBridgeGateway(bridge))
      .to.emit(controller, 'GatewayWhitelistUpdated')
      .withArgs(bridge, false);
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.false;
  });

  it('should NOT affect others', async function () {
    expect(await controller.whitelistedBridgeGateways(other)).to.be.true;
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.true;
    await controller.connect(deployer).removeBridgeGateway(bridge);
    expect(await controller.whitelistedBridgeGateways(bridge)).to.be.false;
    expect(await controller.whitelistedBridgeGateways(other)).to.be.true;
  });
});
