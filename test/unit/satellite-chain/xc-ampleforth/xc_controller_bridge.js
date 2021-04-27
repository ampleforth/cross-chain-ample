const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

let accounts,
  deployer,
  bridge,
  bridgeOther,
  beneficiaryAddress,
  controller,
  mockToken;
async function setupContracts() {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  bridgeOther = accounts[2];
  beneficiaryAddress = await accounts[3].getAddress();

  mockToken = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockXCAmple.sol:MockXCAmple',
    )
  )
    .connect(deployer)
    .deploy();

  // deploy upgradable token
  const factory = await ethers.getContractFactory(
    'contracts/satellite-chain/xc-ampleforth/XCAmpleController.sol:XCAmpleController',
  );
  controller = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)',
    },
  );
  await controller.connect(deployer).addBridgeGateway(bridge.getAddress());
  await controller.connect(deployer).addBridgeGateway(bridgeOther.getAddress());
}

async function getBlockTime(b = 'latest') {
  return (await ethers.provider.getBlock(b)).timestamp;
}

describe('XCAmpleController:mint:accessControl', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).mint(beneficiaryAddress, 1234),
    ).to.be.revertedWith('XCAmpleController: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).mint(beneficiaryAddress, 1234)).to
      .not.be.reverted;
    await expect(controller.connect(bridgeOther).mint(beneficiaryAddress, 1234))
      .to.not.be.reverted;
  });
});

describe('XCAmpleController:mint', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  describe('when mint amount is small', function () {
    it('should mint correct amount of ampl', async function () {
      await expect(controller.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(mockToken, 'Mint')
        .withArgs(beneficiaryAddress, 1001);
    });
    it('should log Mint event', async function () {
      await expect(controller.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(controller, 'GatewayMint')
        .withArgs(await bridge.getAddress(), beneficiaryAddress, 1001);
    });
  });
});

describe('XCAmpleController:burn:accessControl', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).burn(beneficiaryAddress, 4321),
    ).to.be.revertedWith('XCAmpleController: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 4321)).to
      .not.be.reverted;
    await expect(controller.connect(bridgeOther).burn(beneficiaryAddress, 4321))
      .to.not.be.reverted;
  });
});

describe('XCAmpleController:burn', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should burn correct amount of ampl', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(mockToken, 'Burn')
      .withArgs(beneficiaryAddress, 999);
  });

  it('should log Burn event', async function () {
    await expect(controller.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(controller, 'GatewayBurn')
      .withArgs(await bridge.getAddress(), beneficiaryAddress, 999);
  });
});

describe('XCAmpleController:reportRebase:accessControl', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).reportRebase(762, 234235445645645),
    ).to.be.revertedWith('XCAmpleController: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).reportRebase(762, 234235445645645))
      .to.not.be.reverted;
    await expect(
      controller.connect(bridgeOther).reportRebase(762, 234235445645645),
    ).to.not.be.reverted;
  });
});

describe('XCAmpleController:reportRebase', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should update the next rebase data', async function () {
    expect(await controller.nextGlobalAmpleforthEpoch()).to.eq(0);
    expect(await controller.nextGlobalAMPLSupply()).to.eq(0);

    await controller.connect(bridge).reportRebase(762, 234235445645645);
    expect(await controller.nextGlobalAmpleforthEpoch()).to.eq(762);
    expect(await controller.nextGlobalAMPLSupply()).to.eq(234235445645645);

    await controller.connect(bridge).reportRebase(763, 56464566546);
    expect(await controller.nextGlobalAmpleforthEpoch()).to.eq(763);
    expect(await controller.nextGlobalAMPLSupply()).to.eq(56464566546);
  });

  it('should log the rebase report', async function () {
    const r = await controller
      .connect(bridge)
      .reportRebase(762, 234235445645645);
    const t = await getBlockTime(r.blockNumber);
    expect((async () => r)())
      .to.emit(controller, 'GatewayRebaseReported')
      .withArgs(await bridge.getAddress(), 762, 234235445645645, t);
  });
});

describe('XCAmpleController:mint:accessControl', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).mint(beneficiaryAddress, 1234),
    ).to.be.revertedWith('XCAmpleController: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).mint(beneficiaryAddress, 1234)).to
      .not.be.reverted;
    await expect(controller.connect(bridgeOther).mint(beneficiaryAddress, 1234))
      .to.not.be.reverted;
  });
});
