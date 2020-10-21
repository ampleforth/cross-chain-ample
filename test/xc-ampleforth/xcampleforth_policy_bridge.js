const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  bridge,
  bridgeOther,
  beneficiaryAddress,
  policy,
  mockToken;
async function setupContracts() {
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
  const factory = await ethers.getContractFactory('XCAmpleforthPolicy');
  policy = await upgrades.deployProxy(
    factory.connect(deployer),
    [mockToken.address, 1],
    {
      initializer: 'initialize(address,uint256)',
    },
  );
  await policy.connect(deployer).addBridgeGateway(bridge.getAddress());
  await policy.connect(deployer).addBridgeGateway(bridgeOther.getAddress());
}

describe('XCAmpleforthPolicy:reportRebase:accessControl', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      policy.connect(deployer).reportRebase(762, 234235445645645),
    ).to.be.revertedWith('XCAmpleforthPolicy: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(policy.connect(bridge).reportRebase(762, 234235445645645)).to
      .not.be.reverted;
    await expect(policy.connect(bridgeOther).reportRebase(762, 234235445645645))
      .to.not.be.reverted;
  });
});

describe('XCAmpleforthPolicy:reportRebase', async () => {
  let t, t1, t2;
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  it('should update the next rebase data', async function () {
    expect(await policy.nextAMPLEpoch()).to.eq(0);
    expect(await policy.nextTotalAMPLSupply()).to.eq(0);
    t = await policy.rebaseReportTimestampSec();
    expect(t).to.eq(0);

    await policy.connect(bridge).reportRebase(762, 234235445645645);
    expect(await policy.nextAMPLEpoch()).to.eq(762);
    expect(await policy.nextTotalAMPLSupply()).to.eq(234235445645645);
    t1 = await policy.rebaseReportTimestampSec();
    expect(t1).to.gt(t);

    await policy.connect(bridge).reportRebase(763, 56464566546);
    expect(await policy.nextAMPLEpoch()).to.eq(763);
    expect(await policy.nextTotalAMPLSupply()).to.eq(56464566546);
    t2 = await policy.rebaseReportTimestampSec();
    expect(t2).to.gte(t1);
  });

  it('should log the rebase report', async function () {
    const r = await policy.connect(bridge).reportRebase(762, 234235445645645);
    t = await policy.rebaseReportTimestampSec();
    expect((async () => r)())
      .to.emit(policy, 'RebaseReported')
      .withArgs(await bridge.getAddress(), 762, 234235445645645, t);
  });
});

describe('XCAmpleforthPolicy:mint:accessControl', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      policy.connect(deployer).mint(beneficiaryAddress, 1234),
    ).to.be.revertedWith('XCAmpleforthPolicy: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(policy.connect(bridge).mint(beneficiaryAddress, 1234)).to.not
      .be.reverted;
    await expect(policy.connect(bridgeOther).mint(beneficiaryAddress, 1234)).to
      .not.be.reverted;
  });
});

describe('XCAmpleforthPolicy:mint', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  describe('when mint amount is small', function () {
    it('should mint correct amount of ampl', async function () {
      await expect(policy.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(mockToken, 'MockMint')
        .withArgs(beneficiaryAddress, 1001);
    });
    it('should log Mint event', async function () {
      await expect(policy.connect(bridge).mint(beneficiaryAddress, 1001))
        .to.emit(policy, 'Mint')
        .withArgs(await bridge.getAddress(), beneficiaryAddress, 1001);
    });
  });
});

describe('XCAmpleforthPolicy:burn:accessControl', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  it('should NOT be callable by non-bridge', async function () {
    await expect(
      policy.connect(deployer).burn(beneficiaryAddress, 4321),
    ).to.be.revertedWith('XCAmpleforthPolicy: Bridge gateway not whitelisted');
  });

  it('should be callable by bridge', async function () {
    await expect(policy.connect(bridge).burn(beneficiaryAddress, 4321)).to.not
      .be.reverted;
    await expect(policy.connect(bridgeOther).burn(beneficiaryAddress, 4321)).to
      .not.be.reverted;
  });
});

describe('XCAmpleforthPolicy:burn', async () => {
  beforeEach('setup XCAmpleforthPolicy contract', setupContracts);

  it('should burn correct amount of ampl', async function () {
    await expect(policy.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(mockToken, 'MockBurn')
      .withArgs(beneficiaryAddress, 999);
  });

  it('should log Burn event', async function () {
    await expect(policy.connect(bridge).burn(beneficiaryAddress, 999))
      .to.emit(policy, 'Burn')
      .withArgs(await bridge.getAddress(), beneficiaryAddress, 999);
  });
});
