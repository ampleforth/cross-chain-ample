const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts, deployer, orchestrator, bridge, policy, mockToken;
async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  orchestrator = accounts[1];
  bridge = accounts[2];

  mockToken = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();

  const factory = await ethers.getContractFactory('XCAmpleforthPolicy');
  policy = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)',
    },
  );
  await policy.connect(deployer).addBridgeGateway(bridge.getAddress());
  await policy.connect(deployer).setOrchestrator(orchestrator.getAddress());
}

async function getBlockTime() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function increaseTime(seconds) {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await getBlockTime())
      .toNumber(),
  ]);
}

describe('XCAmpleforthPolicy:rebase:accessControl', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', async () => {
    await setupContracts();
    await policy.connect(deployer).setRebaseReportDelay(0);
    await policy.connect(bridge).reportRebase(2, 1000);
  });

  it('should NOT be callable by non-orchestrator', async function () {
    await expect(policy.connect(deployer).rebase()).to.be.revertedWith(
      'XCAmpleforthPolicy: Rebase caller not orchestrator',
    );
  });

  it('should be callable by orchestrator', async function () {
    await expect(policy.connect(orchestrator).rebase()).to.not.be.reverted;
  });
});

describe('XCAmpleforthPolicy:rebase:timing', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', async () => {
    await setupContracts();
    await policy.connect(deployer).setRebaseReportDelay(3600);
  });

  describe('when sufficient time NOT elapsed', function () {
    it('should revert', async function () {
      await policy.connect(bridge).reportRebase(2, 1000);
      await increaseTime(3000);
      await expect(policy.connect(orchestrator).rebase()).to.be.revertedWith(
        'XCAmpleforthPolicy: Report too fresh',
      );
    });
  });

  describe('when sufficient time elapsed', function () {
    it('should NOT revert', async function () {
      await policy.connect(bridge).reportRebase(2, 1000);
      await increaseTime(3601);
      await expect(policy.connect(orchestrator).rebase()).to.not.be.reverted;
    });
  });
});

describe('XCAmpleforthPolicy:rebase:epoch', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', async () => {
    await setupContracts();
    await policy.connect(deployer).setRebaseReportDelay(0);
  });

  describe('when epoch is not new', function () {
    it('should revert', async function () {
      await policy.connect(bridge).reportRebase(1, 1000);
      await expect(policy.connect(orchestrator).rebase()).to.be.revertedWith(
        'XCAmpleforthPolicy: Epoch not new',
      );
    });
  });

  describe('when epoch is new', function () {
    it('should NOT revert', async function () {
      await policy.connect(bridge).reportRebase(2, 1000);
      await expect(policy.connect(orchestrator).rebase()).to.not.be.reverted;
    });
  });
});

describe('XCAmpleforthPolicy:rebase', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
    await policy.connect(bridge).reportRebase(2, 50626634);
    await increaseTime(3600);
  });

  it('should update epoch', async function () {
    await policy.connect(orchestrator).rebase();
    expect(await policy.currentAMPLEpoch()).to.eq(2);
  });

  it('should update rebaseTimestampSec', async function () {
    const t1 = await policy.rebaseReportTimestampSec();
    await policy.connect(orchestrator).rebase();
    const t2 = await policy.rebaseTimestampSec();
    expect(t2.sub(t1)).to.gte(3600);
  });

  it('should invoke rebase on the token contract', async function () {
    await expect(policy.connect(orchestrator).rebase())
      .to.emit(mockToken, 'MockRebase')
      .withArgs(2, 50626634);
  });

  it('should log Rebase', async function () {
    const r = await policy.connect(orchestrator).rebase();
    const t = await policy.rebaseTimestampSec();
    expect((async () => r)())
      .to.emit(policy, 'LogRebase')
      .withArgs(2, 10634511, t);
  });

  it('should NOT allow successive invocation', async function () {
    await policy.connect(orchestrator).rebase();
    await expect(policy.connect(orchestrator).rebase()).to.be.revertedWith(
      'XCAmpleforthPolicy: Epoch not new',
    );
    await increaseTime(3600);
    await expect(policy.connect(orchestrator).rebase()).to.be.revertedWith(
      'XCAmpleforthPolicy: Epoch not new',
    );
  });
});
