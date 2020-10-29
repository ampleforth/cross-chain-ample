const { ethers } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  depositorAddress,
  recipient,
  recipientAddress,
  bridge,
  bridgeAddress,
  ampl,
  policy,
  vault,
  gateway;
async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  depositorAddress = await deployer.getAddress();
  bridge = accounts[1];
  bridgeAddress = await bridge.getAddress();
  recipient = accounts[2];
  recipientAddress = await recipient.getAddress();

  ampl = await (await ethers.getContractFactory('MockAmpl'))
    .connect(deployer)
    .deploy();
  policy = await (await ethers.getContractFactory('MockAmplPolicy'))
    .connect(deployer)
    .deploy();
  vault = await (await ethers.getContractFactory('MockVault'))
    .connect(deployer)
    .deploy();

  gateway = await (
    await ethers.getContractFactory('AmpleforthChainBridgeGateway')
  )
    .connect(deployer)
    .deploy(bridgeAddress, ampl.address, policy.address, vault.address);

  await policy.updateEpoch(1);
  await ampl.updateTotalSupply(50000);
}

describe('AmpleforthChainBridgeGateway:Initialization', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.ampl()).to.eq(ampl.address);
    expect(await gateway.policy()).to.eq(policy.address);
    expect(await gateway.vault()).to.eq(vault.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('AmpleforthChainBridgeGateway:validateRebaseReport:accessControl', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway.connect(deployer).validateRebaseReport(1, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(gateway.connect(bridge).validateRebaseReport(1, 50000)).to.not
      .be.reverted;
  });
});

describe('AmpleforthChainBridgeGateway:validateRebaseReport', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('when epoch is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway.connect(bridge).validateRebaseReport(2, 50000),
      ).to.be.revertedWith(
        'AmpleforthChainBridgeGateway: recorded epoch not consistent',
      );
    });
  });

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway.connect(bridge).validateRebaseReport(1, 50001),
      ).to.be.revertedWith(
        'AmpleforthChainBridgeGateway: recorded total supply not consistent',
      );
    });
  });
});

describe('AmpleforthChainBridgeGateway:validateRebaseReport', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  it('should emit XCRebaseReportOut', async function () {
    await expect(gateway.connect(bridge).validateRebaseReport(1, 50000))
      .to.emit(gateway, 'XCRebaseReportOut')
      .withArgs(1, 50000);
  });
});

describe('AmpleforthChainBridgeGateway:validateAndLock:accessControl', () => {
  before('setup AmpleforthChainBridgeGateway contract', async function () {
    await setupContracts();
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway
        .connect(deployer)
        .validateAndLock(depositorAddress, recipientAddress, 1001, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await gateway
      .connect(bridge)
      .validateAndLock(depositorAddress, recipientAddress, 1001, 50000);

    await expect(
      gateway
        .connect(bridge)
        .validateAndLock(depositorAddress, recipientAddress, 1001, 50000),
    ).to.not.be.reverted;
  });
});

describe('AmpleforthChainBridgeGateway:validateAndLock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway
          .connect(bridge)
          .validateAndLock(depositorAddress, recipientAddress, 1001, 50001),
      ).to.be.revertedWith(
        'AmpleforthChainBridgeGateway: recorded total supply not consistent',
      );
    });
  });
});

describe('AmpleforthChainBridgeGateway:validateAndLock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  it('should emit XCTransferOut', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndLock(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(gateway, 'XCTransferOut')
      .withArgs(depositorAddress, recipientAddress, 1001, 50000);
  });

  it('should lock into vault', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndLock(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(vault, 'MockLock')
      .withArgs(depositorAddress, 1001);
  });
});

describe('AmpleforthChainBridgeGateway:unlock:accessControl', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway
        .connect(deployer)
        .unlock(depositorAddress, recipientAddress, 1001, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(
      gateway
        .connect(bridge)
        .unlock(depositorAddress, recipientAddress, 1001, 50000),
    ).to.not.be.reverted;
  });
});

describe('AmpleforthChainBridgeGateway:unlock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('when recorded supply = total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 25000, 2002, 50000);
    });

    it('should unlock from vault', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('AmpleforthChainBridgeGateway:unlock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('when recorded supply > total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 100000, 500, 50000);
    });

    it('should unlock from vault', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, 500);
    });
  });
});

describe('AmpleforthChainBridgeGateway:unlock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('when recorded supply < total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 25000, 2002, 50000);
    });

    it('should unlock from vault', async function () {
      await expect(
        gateway
          .connect(bridge)
          .unlock(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('AmpleforthChainBridgeGateway:unlock', () => {
  before('setup AmpleforthChainBridgeGateway contract', setupContracts);

  describe('large numbers', function () {
    const MAX_SUPPLY = ethers.BigNumber.from(2).pow(128).sub(1);
    const HALF_MAX_SUPPLY = MAX_SUPPLY.div(2);
    it('should unlock correct number of ampls', async function () {
      await ampl.updateTotalSupply(HALF_MAX_SUPPLY);
      await expect(
        gateway
          .connect(bridge)
          .unlock(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            MAX_SUPPLY,
          ),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, '49999999999999999999');

      await ampl.updateTotalSupply(MAX_SUPPLY);
      await expect(
        gateway
          .connect(bridge)
          .unlock(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            HALF_MAX_SUPPLY,
          ),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, '200000000000000000000');

      await expect(
        gateway
          .connect(bridge)
          .unlock(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            MAX_SUPPLY,
          ),
      )
        .to.emit(vault, 'MockUnlock')
        .withArgs(recipientAddress, '100000000000000000000');
    });
  });
});
