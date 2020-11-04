const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  bridge,
  bridgeOther,
  beneficiaryAddress,
  controller,
  mockToken;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  bridgeOther = accounts[2];
  beneficiaryAddress = await accounts[3].getAddress();

  mockToken = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();

  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmpleforthController');
  controller = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)'
    },
  );
  await controller.connect(deployer).addBridgeGateway(bridge.getAddress());
  await controller.connect(deployer).addBridgeGateway(bridgeOther.getAddress());
}

describe('XCAmpleforthController:mint:accessControl', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).mint(beneficiaryAddress, 1234),
    ).to.be.revertedWith(
      'XCAmpleforthController: Bridge gateway not whitelisted',
    );
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).mint(beneficiaryAddress, 1234)).to
      .not.be.reverted;
    await expect(controller.connect(bridgeOther).mint(beneficiaryAddress, 1234))
      .to.not.be.reverted;
  });
});

describe('XCAmpleforthController:mint', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  describe('when mint amount is small', function () {
    it('should mint correct amount of ampl', async function () {
      await expect(controller.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(mockToken, 'MockMint')
        .withArgs(beneficiaryAddress, 1001);
    });
    it('should log Mint event', async function () {
      await expect(controller.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(controller, 'Mint')
        .withArgs(await bridge.getAddress(), beneficiaryAddress, 1001);
    });
  });
});

describe('XCAmpleforthController:burn:accessControl', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).burn(beneficiaryAddress, 4321),
    ).to.be.revertedWith(
      'XCAmpleforthController: Bridge gateway not whitelisted',
    );
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 4321)).to
      .not.be.reverted;
    await expect(controller.connect(bridgeOther).burn(beneficiaryAddress, 4321))
      .to.not.be.reverted;
  });
});

describe('XCAmpleforthController:burn', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  it('should burn correct amount of ampl', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(mockToken, 'MockBurn')
      .withArgs(beneficiaryAddress, 999);
  });

  it('should log Burn event', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(controller, 'Burn')
      .withArgs(await bridge.getAddress(), beneficiaryAddress, 999);
  });
});
