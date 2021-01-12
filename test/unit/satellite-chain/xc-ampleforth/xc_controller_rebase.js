const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { increaseTime } = require('../../../_helpers/ethers_helpers');

let accounts,
  deployer,
  bridge,
  rebaseCaller,
  controller,
  mockToken,
  mockRebaseRelayer;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];
  rebaseCaller = accounts[2];

  mockToken = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockXCAmple.sol:MockXCAmple',
    )
  )
    .connect(deployer)
    .deploy();
  await mockToken.updateGlobalAMPLSupply(1000);

  mockRebaseRelayer = await (
    await ethers.getContractFactory('MockRebaseRelayer')
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
      initializer: 'initialize(address,uint256)'
    },
  );
  await controller.connect(deployer).addBridgeGateway(bridge.getAddress());
  await controller
    .connect(deployer)
    .setRebaseRelayer(ethers.constants.AddressZero);
}

describe('XCAmpleController:rebase:epoch', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  describe('when epoch is not new', function () {
    it('should revert', async function () {
      await controller.connect(bridge).reportRebase(1, 1000);
      await expect(
        controller.connect(rebaseCaller).rebase(),
      ).to.be.revertedWith('XCAmpleController: Epoch not new');
    });
  });

  describe('when epoch is new', function () {
    it('should NOT revert', async function () {
      await controller.connect(bridge).reportRebase(2, 1000);
      await expect(controller.connect(rebaseCaller).rebase()).to.not.be
        .reverted;
    });
  });
});

describe('XCAmpleController:rebase', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateGlobalAMPLSupply(39992123);
  });

  it('should update epoch', async function () {
    await controller.connect(bridge).reportRebase(2, 50626634);
    await controller.connect(rebaseCaller).rebase();
    expect(await controller.globalAmpleforthEpoch()).to.eq(2);
  });

  it('should update lastRebaseTimestampSec', async function () {
    const t1 = await controller.lastRebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).reportRebase(2, 50626634);
    await controller.connect(rebaseCaller).rebase();
    const t2 = await controller.lastRebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).reportRebase(3, 50626634);
    await controller.connect(rebaseCaller).rebase();
    const t3 = await controller.lastRebaseTimestampSec();
    expect(t2.sub(t1)).to.gte(3600);
    expect(t3.sub(t2)).to.gte(3600);
  });

  it('should invoke rebase on the token contract', async function () {
    await controller.connect(bridge).reportRebase(2, 50626634);
    await expect(controller.connect(rebaseCaller).rebase())
      .to.emit(mockToken, 'Rebase')
      .withArgs(2, 50626634);
  });

  it('should log Rebase with supply delta', async function () {
    await controller.connect(bridge).reportRebase(2, 50626634);
    const r = await controller.connect(rebaseCaller).rebase();
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, 10634511, t);
  });

  it('should NOT allow successive invocation', async function () {
    await controller.connect(bridge).reportRebase(2, 50626634);
    await controller.connect(rebaseCaller).rebase();

    await controller.connect(bridge).reportRebase(2, 50626634);
    await expect(controller.connect(rebaseCaller).rebase()).to.be.revertedWith(
      'XCAmpleController: Epoch not new',
    );

    await increaseTime(3600);

    await controller.connect(bridge).reportRebase(2, 50626634);
    await expect(controller.connect(rebaseCaller).rebase()).to.be.revertedWith(
      'XCAmpleController: Epoch not new',
    );
  });
});

describe('XCAmpleController:rebase:contraction', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateGlobalAMPLSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    await controller.connect(bridge).reportRebase(2, 22692382);
    const r = await controller.connect(rebaseCaller).rebase();
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, -17299741, t);
  });
});

describe('XCAmpleController:rebase:noChange', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateGlobalAMPLSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    await controller.connect(bridge).reportRebase(2, 39992123);
    const r = await controller.connect(rebaseCaller).rebase();
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, 0, t);
  });
});

describe('XCAmpleController:rebase:rebaseRelayerSuccess', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(2); // rebaseRelayer returns true
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should execute rebase', async function () {
    await controller.connect(bridge).reportRebase(2, 1000);
    await expect(controller.connect(rebaseCaller).rebase()).to.not.be.reverted;
  });
});

describe('XCAmpleController:rebase:rebaseRelayerFailure', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(0); // rebaseRelayer returns false
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should revert rebase', async function () {
    await controller.connect(bridge).reportRebase(2, 1000);
    await expect(controller.connect(rebaseCaller).rebase()).to.be.reverted;
  });
});

describe('XCAmpleController:rebase:rebaseRelayerFailure', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(1); // rebaseRelayer reverts
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should revert rebase', async function () {
    await controller.connect(bridge).reportRebase(2, 1000);
    await expect(controller.connect(rebaseCaller).rebase()).to.be.reverted;
  });
});
