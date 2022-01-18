const { ethers } = require('hardhat');
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
  ampl,
  xcAmple,
  xcController,
  gateway;

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

  xcAmple = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockXCAmple.sol:MockXCAmple',
    )
  )
    .connect(deployer)
    .deploy();
  xcController = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockXCAmpleController.sol:MockXCAmpleController',
    )
  )
    .connect(deployer)
    .deploy();

  ampl = await (
    await ethers.getContractFactory('contracts/_mocks/MockAmpl.sol:MockAmpl')
  )
    .connect(deployer)
    .deploy();

  gateway = await (
    await ethers.getContractFactory(
      'contracts/_mocks/MockArbitrum.sol:MockArbitrumXCAmpleGateway',
    )
  )
    .connect(deployer)
    .deploy(xcAmple.address, xcController.address);

  await gateway.initialize(routerAddress, ampl.address, counterpartAddress);

  await ampl.updateTotalSupply(50000);
  await xcController.updateAMPLEpoch(1);
  await xcAmple.updateGlobalAMPLSupply(50000);
}

describe('ArbitrumXCAmpleGateway:Initialization', () => {
  before('setup ArbitrumXCAmpleGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.xcAmple()).to.eq(xcAmple.address);
    expect(await gateway.xcController()).to.eq(xcController.address);
    expect(await gateway.ampl()).to.eq(ampl.address);
    expect(await gateway.router()).to.eq(routerAddress);
    expect(await gateway.counterpartGateway()).to.eq(counterpartAddress);
  });
});

describe('ArbitrumXCAmpleGateway:reportRebaseCommit:accessControl', () => {
  before('setup ArbitrumXCAmpleGateway contract', setupContracts);

  it('should NOT be callable by non gateway', async function () {
    await expect(
      gateway.connect(deployer).reportRebaseCommit(1, 50000),
    ).to.be.revertedWith('ArbitrumXCAmpleGateway: ONLY_COUNTERPART_GATEWAY');
  });
});

describe('ArbitrumXCAmpleGateway:reportRebaseCommit', () => {
  before('setup ArbitrumXCAmpleGateway contract', setupContracts);

  describe('when on-chain supply is different', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(
        gateway.connect(counterpartGateway).reportRebaseCommit(2, 100000),
      )
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 100000, 1, 50000);

      await expect(
        gateway.connect(counterpartGateway).reportRebaseCommit(3, 40000),
      )
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(3, 40000, 1, 50000);
    });
  });

  describe('when on-chain supply is the same', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(
        gateway.connect(counterpartGateway).reportRebaseCommit(2, 50000),
      )
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 50000, 1, 50000);
    });
  });
});

describe('ArbitrumXCAmpleGateway:outboundTransfer:accessControl', () => {
  before('setup ArbitrumXCAmpleGateway contract', setupContracts);

  it('should NOT be callable by non-gateway', async function () {
    await expect(
      gateway
        .connect(depositor)
        .outboundTransfer(ampl.address, recipientAddress, 1001, 0, 0, []),
    ).to.be.revertedWith('ArbitrumXCAmpleGateway: NOT_FROM_ROUTER');
  });

  it('should NOT be callable for other tokens', async function () {
    await expect(
      gateway
        .connect(router)
        .outboundTransfer(xcAmple.address, recipientAddress, 1001, 0, 0, []),
    ).to.be.revertedWith('ArbitrumXCAmpleGateway: ONLY_AMPL_ALLOWED');
  });

  it('should NOT allow extra data', async function () {
    const data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [depositorAddress, '0x01'],
    );

    await expect(
      gateway
        .connect(router)
        .outboundTransfer(ampl.address, recipientAddress, 1001, 0, 0, data),
    ).to.be.revertedWith('ArbitrumXCAmpleGateway: EXTRA_DATA_DISABLED');
  });
});

describe('ArbitrumXCAmpleGateway:outboundTransfer', () => {
  let r, seqNumber, exitNum;
  before('setup ArbitrumXCAmpleGateway contract', async function () {
    await setupContracts();

    // router usually does this encoding part
    const data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [depositorAddress, '0x'],
    );

    exitNum = await gateway.exitNum();

    seqNumber = await gateway
      .connect(router)
      .callStatic.outboundTransfer(
        ampl.address,
        recipientAddress,
        1001,
        0,
        0,
        data,
      );

    r = gateway
      .connect(router)
      .outboundTransfer(ampl.address, recipientAddress, 1001, 0, 0, data);
  });

  it('should emit XCTransferOut', async function () {
    await expect(r)
      .to.emit(gateway, 'XCTransferOut')
      .withArgs(depositorAddress, ethers.constants.AddressZero, 1001, 50000);
  });

  it('should emit WithdrawalInitiated', async function () {
    await expect(r)
      .to.emit(gateway, 'WithdrawalInitiated')
      .withArgs(
        ampl.address,
        depositorAddress,
        recipientAddress,
        seqNumber,
        exitNum,
        1001,
      );
  });

  it('should increment exitNum', async function () {
    expect(await gateway.exitNum()).to.eq(exitNum.add(1));
  });

  it('should burn xcAmples', async function () {
    await expect(r)
      .to.emit(xcController, 'Burn')
      .withArgs(depositorAddress, 1001);
  });
});

describe('ArbitrumXCAmpleGateway:finalizeInboundTransfer:accessControl', () => {
  before('setup ArbitrumXCAmpleGateway contract', setupContracts);

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
      'ArbitrumXCAmpleGateway: ONLY_COUNTERPART_GATEWAY',
    );
  });
});

describe('ArbitrumXCAmpleGateway:finalizeInboundTransfer', () => {
  let r;

  describe('when supply is out of sync', function () {
    before('setup ArbitrumXCAmpleGateway contract', async function () {
      await setupContracts();

      const data = ethers.utils.defaultAbiCoder.encode(['uint256'], [50000]);

      await xcAmple.updateGlobalAMPLSupply(100000);

      r = gateway
        .connect(counterpartGateway)
        .finalizeInboundTransfer(
          ampl.address,
          depositorAddress,
          recipientAddress,
          1001,
          data,
        );
    });

    it('should emit XCTransferIn', async function () {
      await expect(r)
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(
          ethers.constants.AddressZero,
          recipientAddress,
          50000,
          2002,
          100000,
        );
    });

    it('should emit DepositFinalized', async function () {
      await expect(r)
        .to.emit(gateway, 'DepositFinalized')
        .withArgs(ampl.address, depositorAddress, recipientAddress, 2002);
    });

    it('should mint', async function () {
      await expect(r)
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, 2002);
    });
  });

  describe('when supply is in sync', function () {
    before('setup ArbitrumXCAmpleGateway contract', async function () {
      await setupContracts();

      const data = ethers.utils.defaultAbiCoder.encode(['uint256'], [50000]);

      r = gateway
        .connect(counterpartGateway)
        .finalizeInboundTransfer(
          ampl.address,
          depositorAddress,
          recipientAddress,
          1001,
          data,
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

    it('should emit DepositFinalized', async function () {
      await expect(r)
        .to.emit(gateway, 'DepositFinalized')
        .withArgs(ampl.address, depositorAddress, recipientAddress, 1001);
    });

    it('should mint', async function () {
      await expect(r)
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, 1001);
    });
  });
});
