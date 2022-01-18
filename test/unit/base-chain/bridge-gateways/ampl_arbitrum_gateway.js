const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

let accounts,
  deployer,
  depositor,
  depositorAddress,
  recipient,
  recipientAddress,
  router,
  routerAddress,
  counterpartGateway,
  counterpartAddress,
  inbox,
  ampl,
  policy,
  vault,
  xcAmple,
  gateway;

// l2 gas parameters
const maxSubmissionCost = 1;
const maxGas = 500000;
const gasPriceBid = 0;

async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  depositor = deployer;
  depositorAddress = await deployer.getAddress();
  recipient = accounts[1];
  recipientAddress = await recipient.getAddress();
  router = accounts[2];
  routerAddress = await router.getAddress();
  counterpartGateway = accounts[3];
  counterpartAddress = await counterpartGateway.getAddress();

  inbox = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockArbitrum.sol:MockArbitrumInbox',
    )
  )
    .connect(deployer)
    .deploy();

  const uFragmentsFactory = await ethers.getContractFactory(
    'uFragments/contracts/UFragments.sol:UFragments',
  );
  ampl = await upgrades.deployProxy(
    uFragmentsFactory.connect(deployer),
    [depositorAddress],
    { initializer: 'initialize(address)' },
  );
  await ampl.setMonetaryPolicy(depositorAddress);

  policy = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockAmpleforth.sol:MockAmpleforth',
    )
  )
    .connect(deployer)
    .deploy();
  vault = await (
    await ethers.getContractFactory('contracts/_mocks/MockVault.sol:MockVault')
  )
    .connect(deployer)
    .deploy();

  xcAmple = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockXCAmple.sol:MockXCAmple',
    )
  )
    .connect(deployer)
    .deploy();

  gateway = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockArbitrum.sol:MockAMPLArbitrumGateway',
    )
  )
    .connect(deployer)
    .deploy(ampl.address, policy.address, vault.address);

  await gateway.initialize(
    inbox.address,
    routerAddress,
    xcAmple.address,
    counterpartAddress,
  );
  await inbox.setL2ToL1Sender(counterpartAddress);

  await policy.updateEpoch(1);
  await ampl.rebase(1, '-49999999999950000');
}

describe('AMPLArbitrumGateway:Initialization', () => {
  before('setup AMPLArbitrumGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.ampl()).to.eq(ampl.address);
    expect(await gateway.policy()).to.eq(policy.address);
    expect(await gateway.vault()).to.eq(vault.address);
    expect(await gateway.inbox()).to.eq(inbox.address);
    expect(await gateway.router()).to.eq(routerAddress);
    expect(await gateway.counterpartGateway()).to.eq(counterpartAddress);
    expect(await gateway.xcAmple()).to.eq(xcAmple.address);
    expect(await gateway.calculateL2TokenAddress(ampl.address)).to.eq(
      xcAmple.address,
    );
  });
});

describe('AMPLArbitrumGateway:reportRebaseInit', () => {
  let r, seqNumber;
  before('setup AMPLArbitrumGateway contract', async function () {
    await setupContracts();
    seqNumber = await gateway
      .connect(depositor)
      .callStatic.reportRebaseInit(maxSubmissionCost, maxGas, gasPriceBid);
    r = gateway
      .connect(depositor)
      .reportRebaseInit(maxSubmissionCost, maxGas, gasPriceBid);
  });

  it('should emit XCRebaseReportOut', async function () {
    await expect(r).to.emit(gateway, 'XCRebaseReportOut').withArgs(1, 50000);
  });

  it('should emit RebaseReportInitiated', async function () {
    await expect(r)
      .to.emit(gateway, 'RebaseReportInitiated')
      .withArgs(seqNumber);
  });
});

describe('AMPLArbitrumGateway:outboundTransfer:accessControl', () => {
  before('setup AMPLArbitrumGateway contract', setupContracts);

  it('should NOT be callable by non-router', async function () {
    await expect(
      gateway
        .connect(depositor)
        .outboundTransfer(
          ampl.address,
          recipientAddress,
          1001,
          maxGas,
          gasPriceBid,
          [],
        ),
    ).to.be.revertedWith('AMPLArbitrumGateway: NOT_FROM_ROUTER');
  });

  it('should NOT be callable for other tokens', async function () {
    await expect(
      gateway
        .connect(router)
        .outboundTransfer(
          xcAmple.address,
          recipientAddress,
          1001,
          maxGas,
          gasPriceBid,
          [],
        ),
    ).to.be.revertedWith('AMPLArbitrumGateway: ONLY_AMPL_ALLOWED');
  });

  it('should NOT allow extra data', async function () {
    let data = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [
        maxSubmissionCost,
        ethers.utils.defaultAbiCoder.encode(['uint256'], ['123'])
      ],
    );

    data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [depositorAddress, data],
    );

    await expect(
      gateway
        .connect(router)
        .outboundTransfer(
          ampl.address,
          recipientAddress,
          1001,
          maxGas,
          gasPriceBid,
          data,
        ),
    ).to.be.revertedWith('AMPLArbitrumGateway: EXTRA_DATA_DISABLED');
  });
});

describe('AMPLArbitrumGateway:outboundTransfer', () => {
  let r, seqNumber;
  before('setup AMPLArbitrumGateway contract', async function () {
    await setupContracts();

    // router usually does this encoding part
    let data = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [maxSubmissionCost, '0x'],
    );

    data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [depositorAddress, data],
    );

    await ampl.connect(depositor).approve(gateway.address, 1001);

    seqNumber = await gateway
      .connect(router)
      .callStatic.outboundTransfer(
        ampl.address,
        recipientAddress,
        1001,
        maxGas,
        gasPriceBid,
        data,
      );
    r = gateway
      .connect(router)
      .outboundTransfer(
        ampl.address,
        recipientAddress,
        1001,
        maxGas,
        gasPriceBid,
        data,
      );
  });

  it('should emit XCTransferOut', async function () {
    await expect(r)
      .to.emit(gateway, 'XCTransferOut')
      .withArgs(depositorAddress, ethers.constants.AddressZero, 1001, 50000);
  });

  it('should emit DepositInitiated', async function () {
    await expect(r)
      .to.emit(gateway, 'DepositInitiated')
      .withArgs(
        ampl.address,
        depositorAddress,
        recipientAddress,
        seqNumber,
        1001,
      );
  });

  it('should lock into vault', async function () {
    await expect(r)
      .to.emit(vault, 'Lock')
      .withArgs(ampl.address, gateway.address, 1001);
  });
});

describe('AMPLArbitrumGateway:finalizeInboundTransfer:accessControl', () => {
  before('setup AMPLArbitrumGateway contract', setupContracts);

  it('should revert when called by non counterpart', async function () {
    const r = gateway
      .connect(deployer)
      .finalizeInboundTransfer(
        ampl.address,
        depositorAddress,
        recipientAddress,
        1001,
        [],
      );
    await expect(r).to.be.revertedWith(
      'AMPLArbitrumGateway: ONLY_COUNTERPART_GATEWAY',
    );
  });
});

describe('AMPLArbitrumGateway:finalizeInboundTransfer', () => {
  let r;

  describe('when supply is out of sync', function () {
    before('setup AMPLArbitrumGateway contract', async function () {
      await setupContracts();

      const exitNum = 123213213;
      const withdrawData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [exitNum, 50000],
      );

      await policy.updateEpoch(2);
      await ampl.rebase(2, 50000);

      r = gateway
        .connect(counterpartGateway)
        .finalizeInboundTransfer(
          ampl.address,
          depositorAddress,
          recipientAddress,
          1001,
          withdrawData,
        );
    });

    it('should emit XCTransferIn', async function () {
      await expect(r)
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(
          ethers.constants.AddressZero,
          recipientAddress,
          50000,
          1001,
          100000,
        );
    });

    it('should emit WithdrawalFinalized', async function () {
      await expect(r)
        .to.emit(gateway, 'WithdrawalFinalized')
        .withArgs(
          ampl.address,
          depositorAddress,
          recipientAddress,
          123213213,
          2002,
        );
    });

    it('should unlock from vault', async function () {
      await expect(r)
        .to.emit(vault, 'Unlock')
        .withArgs(ampl.address, recipientAddress, 2002);
    });
  });

  describe('when supply is in sync', function () {
    before('setup AMPLArbitrumGateway contract', async function () {
      await setupContracts();

      const exitNum = 89324;
      const withdrawData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256'],
        [exitNum, 50000],
      );

      r = gateway
        .connect(counterpartGateway)
        .finalizeInboundTransfer(
          ampl.address,
          depositorAddress,
          recipientAddress,
          1001,
          withdrawData,
        );
    });

    it('should emit XCTransferIn', async function () {
      await expect(r)
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(
          ethers.constants.AddressZero,
          recipientAddress,
          50000,
          1001,
          50000,
        );
    });

    it('should emit WithdrawalFinalized', async function () {
      await expect(r)
        .to.emit(gateway, 'WithdrawalFinalized')
        .withArgs(
          ampl.address,
          depositorAddress,
          recipientAddress,
          89324,
          1001,
        );
    });

    it('should unlock from vault', async function () {
      await expect(r)
        .to.emit(vault, 'Unlock')
        .withArgs(ampl.address, recipientAddress, 1001);
    });
  });
});
