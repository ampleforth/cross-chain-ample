const { ethers } = require('hardhat');
const { expect } = require('chai');

let accounts,
  deployer,
  deployerAddress,
  bridge,
  bridgeAddress,
  otherBridge,
  otherBridgeAddress,
  vault,
  mockToken;
async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  otherBridge = accounts[3];
  deployerAddress = await deployer.getAddress();
  bridgeAddress = await bridge.getAddress();
  otherBridgeAddress = await otherBridge.getAddress();

  mockToken = await (
    await ethers.getContractFactory('contracts/_mocks/MockERC20.sol:MockERC20')
  )
    .connect(deployer)
    .deploy('MockToken', 'MOCK');

  vault = await (
    await ethers.getContractFactory(
      'contracts/base-chain/TokenVault.sol:TokenVault',
    )
  )
    .connect(deployer)
    .deploy();
}

describe('TokenVault:Initialization', () => {
  before('setup TokenVault contract', setupContracts);

  it('should set the owner', async function () {
    expect(await vault.owner()).to.eq(await deployer.getAddress());
  });
});

describe('TokenVault:addBridgeGateway', async () => {
  beforeEach('setup TokenVault contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      vault.connect(accounts[5]).addBridgeGateway(bridgeAddress),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(vault.connect(deployer).addBridgeGateway(bridgeAddress)).to.not
      .be.reverted;
  });

  it('should add to the whitelist', async function () {
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.false;
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.true;
  });

  it('should fail on re-add', async function () {
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await expect(
      vault.connect(deployer).addBridgeGateway(bridgeAddress),
    ).to.be.revertedWith('TokenVault: Bridge gateway already whitelisted');
  });

  it('should NOT affect others', async function () {
    expect(await vault.whitelistedBridgeGateways(otherBridgeAddress)).to.be
      .false;
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.false;
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.true;
    expect(await vault.whitelistedBridgeGateways(otherBridgeAddress)).to.be
      .false;
  });
});

describe('TokenVault:removeBridgeGateway', async () => {
  beforeEach('setup TokenVault contract', async () => {
    await setupContracts();
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await vault.connect(deployer).addBridgeGateway(otherBridgeAddress);
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(
      vault.connect(accounts[5]).removeBridgeGateway(bridgeAddress),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should fail on re-remove', async function () {
    await vault.connect(deployer).removeBridgeGateway(bridgeAddress);
    await expect(
      vault.connect(deployer).removeBridgeGateway(bridgeAddress),
    ).to.be.revertedWith('TokenVault: Bridge gateway not whitelisted');
  });

  it('should be callable by owner', async function () {
    await expect(vault.connect(deployer).removeBridgeGateway(bridgeAddress)).to
      .not.be.reverted;
  });

  it('should remove from the whitelist', async function () {
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.true;
    await vault.connect(deployer).removeBridgeGateway(bridgeAddress);
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.false;
  });

  it('should NOT affect others', async function () {
    expect(await vault.whitelistedBridgeGateways(otherBridgeAddress)).to.be
      .true;
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.true;
    await vault.connect(deployer).removeBridgeGateway(bridgeAddress);
    expect(await vault.whitelistedBridgeGateways(bridgeAddress)).to.be.false;
    expect(await vault.whitelistedBridgeGateways(otherBridgeAddress)).to.be
      .true;
  });
});

describe('TokenVault:lock:accessControl', async () => {
  beforeEach('setup TokenVault contract', async function () {
    await setupContracts();
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await vault.connect(deployer).addBridgeGateway(otherBridgeAddress);
    await mockToken.connect(deployer).approve(vault.address, 10000);
  });

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      vault.connect(deployer).lock(mockToken.address, deployerAddress, 123),
    ).to.be.revertedWith('TokenVault: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(
      vault.connect(bridge).lock(mockToken.address, deployerAddress, 123),
    ).to.not.be.reverted;
    await expect(
      vault.connect(otherBridge).lock(mockToken.address, deployerAddress, 123),
    ).to.not.be.reverted;
  });
});

describe('TokenVault:lock', async () => {
  beforeEach('setup TokenVault contract', async function () {
    await setupContracts();
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await mockToken.connect(deployer).approve(vault.address, 999);
  });

  it('should transfer tokens from the depositor to the contract', async function () {
    const _b = await mockToken.balanceOf(deployerAddress);
    await expect(
      vault.connect(bridge).lock(mockToken.address, deployerAddress, 999),
    )
      .to.emit(mockToken, 'Transfer')
      .withArgs(deployerAddress, vault.address, 999);
    const b = await mockToken.balanceOf(deployerAddress);
    expect(_b.sub(b)).to.eq(999);
  });

  it('should update total locked', async function () {
    await vault.connect(bridge).lock(mockToken.address, deployerAddress, 999);
    expect(await vault.totalLocked(mockToken.address)).to.eq(999);
  });

  it('should log Locked event', async function () {
    await expect(
      vault.connect(bridge).lock(mockToken.address, deployerAddress, 999),
    )
      .to.emit(vault, 'GatewayLocked')
      .withArgs(
        await bridge.getAddress(),
        mockToken.address,
        deployerAddress,
        999,
      );
  });
});

describe('TokenVault:unlock:accessControl', async () => {
  beforeEach('setup TokenVault contract', async function () {
    await setupContracts();
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await vault.connect(deployer).addBridgeGateway(otherBridgeAddress);
    await mockToken.connect(deployer).approve(vault.address, 10000);
    await vault.connect(bridge).lock(mockToken.address, deployerAddress, 9999);
  });

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      vault.connect(deployer).unlock(mockToken.address, deployerAddress, 123),
    ).to.be.revertedWith('TokenVault: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(
      vault.connect(bridge).unlock(mockToken.address, deployerAddress, 9990),
    ).to.not.be.reverted;
    await expect(
      vault.connect(otherBridge).unlock(mockToken.address, deployerAddress, 9),
    ).to.not.be.reverted;
  });
});

describe('TokenVault:unlock', async () => {
  beforeEach('setup TokenVault contract', async function () {
    await setupContracts();
    await vault.connect(deployer).addBridgeGateway(bridgeAddress);
    await mockToken.connect(deployer).approve(vault.address, 10000);
    await vault.connect(bridge).lock(mockToken.address, deployerAddress, 9999);
  });

  it('should transfer tokens from the contract to recipient', async function () {
    const _b = await mockToken.balanceOf(deployerAddress);
    await expect(
      vault.connect(bridge).unlock(mockToken.address, deployerAddress, 999),
    )
      .to.emit(mockToken, 'Transfer')
      .withArgs(vault.address, deployerAddress, 999);
    const b = await mockToken.balanceOf(deployerAddress);
    expect(b.sub(_b)).to.eq(999);
  });

  it('should update total unlocked', async function () {
    await vault.connect(bridge).unlock(mockToken.address, deployerAddress, 999);
    expect(await vault.totalLocked(mockToken.address)).to.eq(9000);
  });

  it('should log Unlocked event', async function () {
    await expect(
      vault.connect(bridge).unlock(mockToken.address, deployerAddress, 999),
    )
      .to.emit(vault, 'GatewayUnlocked')
      .withArgs(
        await bridge.getAddress(),
        mockToken.address,
        deployerAddress,
        999,
      );
  });
});
