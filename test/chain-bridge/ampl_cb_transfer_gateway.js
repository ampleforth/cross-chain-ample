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
  vault,
  gateway;
async function setupContracts () {
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
  vault = await (await ethers.getContractFactory('MockVault'))
    .connect(deployer)
    .deploy();

  gateway = await (await ethers.getContractFactory('AmplCBTransferGateway'))
    .connect(deployer)
    .deploy(bridgeAddress, ampl.address, vault.address);

  await ampl.updateTotalSupply(50000);
}

describe('AmplCBTransferGateway:Initialization', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.ampl()).to.eq(ampl.address);
    expect(await gateway.vault()).to.eq(vault.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('AmplCBTransferGateway:validateAndLock:accessControl', () => {
  before('setup AmplCBTransferGateway contract', async function () {
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

describe('AmplCBTransferGateway:validateAndLock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway
          .connect(bridge)
          .validateAndLock(depositorAddress, recipientAddress, 1001, 50001),
      ).to.be.revertedWith(
        'AmplCBTransferGateway: recorded total supply not consistent',
      );
    });
  });
});

describe('AmplCBTransferGateway:validateAndLock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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

describe('AmplCBTransferGateway:unlock:accessControl', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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

describe('AmplCBTransferGateway:unlock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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

describe('AmplCBTransferGateway:unlock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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

describe('AmplCBTransferGateway:unlock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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

describe('AmplCBTransferGateway:unlock', () => {
  before('setup AmplCBTransferGateway contract', setupContracts);

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
