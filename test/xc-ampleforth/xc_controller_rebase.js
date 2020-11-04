const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts, deployer, bridge, controller, mockToken, mockOrchestrator;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];

  mockToken = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();
  await mockToken.updateTotalSupply(1000);

  mockOrchestrator = await (
    await ethers.getContractFactory('MockXCOrchestrator')
  )
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
  await controller
    .connect(deployer)
    .setOrchestrator(ethers.constants.AddressZero);
}

async function getBlockTime () {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function increaseTime (seconds) {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await getBlockTime())
      .toNumber()
  ]);
}

describe('XCAmpleforthController:rebase:accessControl', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).rebase(2, 1000),
    ).to.be.revertedWith(
      'XCAmpleforthController: Bridge gateway not whitelisted',
    );
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be.reverted;
  });
});

describe('XCAmpleforthController:rebase:epoch', async () => {
  beforeEach('setup XCAmpleforthController contract', setupContracts);

  describe('when epoch is not new', function () {
    it('should revert', async function () {
      await expect(
        controller.connect(bridge).rebase(1, 1000),
      ).to.be.revertedWith('XCAmpleforthController: Epoch not new');
    });
  });

  describe('when epoch is new', function () {
    it('should NOT revert', async function () {
      await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be
        .reverted;
    });
  });
});

describe('XCAmpleforthController:rebase', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should update epoch', async function () {
    await controller.connect(bridge).rebase(2, 50626634);
    expect(await controller.currentAMPLEpoch()).to.eq(2);
  });

  it('should update rebaseTimestampSec', async function () {
    const t1 = await controller.rebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).rebase(2, 50626634);
    const t2 = await controller.rebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).rebase(3, 50626634);
    const t3 = await controller.rebaseTimestampSec();
    expect(t2.sub(t1)).to.gte(3600);
    expect(t3.sub(t2)).to.gte(3600);
  });

  it('should invoke rebase on the token contract', async function () {
    await expect(controller.connect(bridge).rebase(2, 50626634))
      .to.emit(mockToken, 'MockRebase')
      .withArgs(2, 50626634);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 50626634);
    const t = await controller.rebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, 10634511, t);
  });

  it('should NOT allow successive invocation', async function () {
    await controller.connect(bridge).rebase(2, 50626634);
    await expect(
      controller.connect(bridge).rebase(2, 50626634),
    ).to.be.revertedWith('XCAmpleforthController: Epoch not new');
    await increaseTime(3600);
    await expect(
      controller.connect(bridge).rebase(2, 50626634),
    ).to.be.revertedWith('XCAmpleforthController: Epoch not new');
  });
});

describe('XCAmpleforthController:rebase:contraction', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 22692382);
    const t = await controller.rebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, -17299741, t);
  });
});

describe('XCAmpleforthController:rebase:noChange', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 39992123);
    const t = await controller.rebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'LogRebase')
      .withArgs(2, 0, t);
  });
});

describe('XCAmpleforthController:rebase:orchestratorSuccess', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockOrchestrator.updateSuccessState(2); // orchestrator returns true
    await controller.setOrchestrator(mockOrchestrator.address);
  });

  it('should execute rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be.reverted;
  });
});

describe('XCAmpleforthController:rebase:orchestratorFailure', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockOrchestrator.updateSuccessState(0); // orchestrator returns false
    await controller.setOrchestrator(mockOrchestrator.address);
  });

  it('should revert rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.be.reverted;
  });
});

describe('XCAmpleforthController:rebase:orchestratorFailure', async () => {
  beforeEach('setup XCAmpleforthController contract', async () => {
    await setupContracts();
    await mockOrchestrator.updateSuccessState(1); // orchestrator reverts
    await controller.setOrchestrator(mockOrchestrator.address);
  });

  it('should revert rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.be.reverted;
  });
});
