const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts, deployer, policy, mockToken;
async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];

  mockToken = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();

  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmpleforthController');
  policy = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)',
    },
  );
}

describe('XCAmpleforthController:Initialization', () => {
  before('setup XCAmpleforthController contract', setupContracts);

  it('should initialize the token reference', async function () {
    expect(await policy.xcAmpl()).to.eq(mockToken.address);
  });

  it('should initialize the epoch', async function () {
    expect(await policy.currentAMPLEpoch()).to.eq(1);
  });

  it('should set the owner', async function () {
    expect(await policy.owner()).to.eq(await deployer.getAddress());
  });
});

describe('XCAmpleforthController:setOrchestrator', async () => {
  let orchestrator;
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    orchestrator = await accounts[1].getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(
      policy.connect(accounts[5]).setOrchestrator(orchestrator),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(policy.connect(deployer).setOrchestrator(orchestrator)).to.not
      .be.reverted;
  });

  it('should update the Orchestrator reference', async function () {
    expect(await policy.orchestrator()).to.be.eq(ethers.constants.AddressZero);
    await policy.connect(deployer).setOrchestrator(orchestrator);
    expect(await policy.orchestrator()).to.be.eq(orchestrator);
  });
});

describe('XCAmpleforthController:addBridgeGateway', async () => {
  let bridge, other;
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    bridge = await accounts[1].getAddress();
    other = await accounts[3].getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      policy.connect(accounts[5]).addBridgeGateway(bridge),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    expect(policy.connect(deployer).addBridgeGateway(bridge)).to.not.be
      .reverted;
  });

  it('should add to the whitelist', async function () {
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.false;
    await policy.connect(deployer).addBridgeGateway(bridge);
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.true;
  });

  it('should NOT affect others', async function () {
    expect(await policy.whitelistedBridgeGateways(other)).to.be.false;
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.false;
    await policy.connect(deployer).addBridgeGateway(bridge);
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.true;
    expect(await policy.whitelistedBridgeGateways(other)).to.be.false;
  });
});

describe('XCAmpleforthController:removeBridgeGateway', async () => {
  let bridge, other;
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    bridge = await accounts[1].getAddress();
    other = await accounts[3].getAddress();
    await policy.connect(deployer).addBridgeGateway(bridge);
    await policy.connect(deployer).addBridgeGateway(other);
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(
      policy.connect(accounts[5]).removeBridgeGateway(bridge),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(policy.connect(deployer).removeBridgeGateway(bridge)).to.not.be
      .reverted;
  });

  it('should remove from the whitelist', async function () {
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.true;
    await policy.connect(deployer).removeBridgeGateway(bridge);
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.false;
  });

  it('should NOT affect others', async function () {
    expect(await policy.whitelistedBridgeGateways(other)).to.be.true;
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.true;
    await policy.connect(deployer).removeBridgeGateway(bridge);
    expect(await policy.whitelistedBridgeGateways(bridge)).to.be.false;
    expect(await policy.whitelistedBridgeGateways(other)).to.be.true;
  });
});
