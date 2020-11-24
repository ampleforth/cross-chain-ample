const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  bridge,
  bridgeAddress,
  controller,
  mockToken,
  mockRebaseRelayer;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  bridge = accounts[1];

  bridgeAddress = await bridge.getAddress();

  mockToken = await (await ethers.getContractFactory('MockXCAmple'))
    .connect(deployer)
    .deploy();
  await mockToken.updateTotalSupply(1000);

  mockRebaseRelayer = await (
    await ethers.getContractFactory('MockRebaseRelayer')
  )
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
  await controller.connect(deployer).addBridgeGateway(bridge.getAddress());
  await controller
    .connect(deployer)
    .setRebaseRelayer(ethers.constants.AddressZero);
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

describe('XCAmpleController:rebase:accessControl', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      controller.connect(deployer).rebase(2, 1000),
    ).to.be.revertedWith('XCAmpleController: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be.reverted;
  });
});

describe('XCAmpleController:rebase:epoch', async () => {
  beforeEach('setup XCAmpleController contract', setupContracts);

  describe('when epoch is not new', function () {
    it('should revert', async function () {
      await expect(
        controller.connect(bridge).rebase(1, 1000),
      ).to.be.revertedWith('XCAmpleController: Epoch not new');
    });
  });

  describe('when epoch is new', function () {
    it('should NOT revert', async function () {
      await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be
        .reverted;
    });
  });
});

describe('XCAmpleController:rebase', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should update epoch', async function () {
    await controller.connect(bridge).rebase(2, 50626634);
    expect(await controller.globalAmpleforthEpoch()).to.eq(2);
  });

  it('should update lastRebaseTimestampSec', async function () {
    const t1 = await controller.lastRebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).rebase(2, 50626634);
    const t2 = await controller.lastRebaseTimestampSec();
    await increaseTime(3600);
    await controller.connect(bridge).rebase(3, 50626634);
    const t3 = await controller.lastRebaseTimestampSec();
    expect(t2.sub(t1)).to.gte(3600);
    expect(t3.sub(t2)).to.gte(3600);
  });

  it('should invoke rebase on the token contract', async function () {
    await expect(controller.connect(bridge).rebase(2, 50626634))
      .to.emit(mockToken, 'LogRebase')
      .withArgs(2, 50626634);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 50626634);
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'GatewayRebase')
      .withArgs(bridgeAddress, 2, 10634511, t);
  });

  it('should NOT allow successive invocation', async function () {
    await controller.connect(bridge).rebase(2, 50626634);
    await expect(
      controller.connect(bridge).rebase(2, 50626634),
    ).to.be.revertedWith('XCAmpleController: Epoch not new');
    await increaseTime(3600);
    await expect(
      controller.connect(bridge).rebase(2, 50626634),
    ).to.be.revertedWith('XCAmpleController: Epoch not new');
  });
});

describe('XCAmpleController:rebase:contraction', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 22692382);
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'GatewayRebase')
      .withArgs(bridgeAddress, 2, -17299741, t);
  });
});

describe('XCAmpleController:rebase:noChange', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockToken.updateTotalSupply(39992123);
  });

  it('should log Rebase with supply delta', async function () {
    const r = await controller.connect(bridge).rebase(2, 39992123);
    const t = await controller.lastRebaseTimestampSec();
    expect((async () => r)())
      .to.emit(controller, 'GatewayRebase')
      .withArgs(bridgeAddress, 2, 0, t);
  });
});

describe('XCAmpleController:rebase:rebaseRelayerSuccess', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(2); // rebaseRelayer returns true
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should execute rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.not.be.reverted;
  });
});

describe('XCAmpleController:rebase:rebaseRelayerFailure', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(0); // rebaseRelayer returns false
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should revert rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.be.reverted;
  });
});

describe('XCAmpleController:rebase:rebaseRelayerFailure', async () => {
  beforeEach('setup XCAmpleController contract', async () => {
    await setupContracts();
    await mockRebaseRelayer.updateSuccessState(1); // rebaseRelayer reverts
    await controller.setRebaseRelayer(mockRebaseRelayer.address);
  });

  it('should revert rebase', async function () {
    await expect(controller.connect(bridge).rebase(2, 1000)).to.be.reverted;
  });
});
