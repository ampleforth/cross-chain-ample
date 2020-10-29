const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

const DECIMALS = 9;
const toUFrgDenomination = (ample) => ethers.utils.parseUnits(ample, DECIMALS);

const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + DECIMALS);
const MAX_SUPPLY = ethers.BigNumber.from('2').pow(128).sub(1);
const unitTokenAmount = toUFrgDenomination('1');

let accounts, deployer, otherUser, xcampleforth, initialSupply;

async function setupContracts() {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  otherUser = accounts[1];

  const factory = await ethers.getContractFactory('XCAmpleforth');
  xcampleforth = await upgrades.deployProxy(
    factory.connect(deployer),
    ['XCAmpleforth', 'xcAMPL', INITIAL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)',
    },
  );
  await xcampleforth.setMonetaryPolicy(deployer.getAddress());

  // fetch initial supply
  initialSupply = await xcampleforth.totalAMPLSupply();
}

describe('XCAmpleforth:mint:accessControl', () => {
  before('setup XCAmpleforth contract', setupContracts);

  it('should NOT be callable by other user', async function () {
    await expect(
      xcampleforth
        .connect(otherUser)
        .mint(otherUser.getAddress(), unitTokenAmount),
    ).to.be.reverted;
  });

  it('should be callable by policy', async function () {
    await expect(
      xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), unitTokenAmount),
    ).not.to.be.reverted;
  });
});

describe('XCAmpleforth:mint', () => {
  beforeEach('setup XCAmpleforth contract', setupContracts);

  describe('when mint address is zero address', () => {
    it('should revert', async function () {
      await expect(
        xcampleforth
          .connect(deployer)
          .mint(ethers.constants.AddressZero, unitTokenAmount),
      ).to.be.reverted;
    });
  });

  describe('when mint value > totalAMPLSupply', () => {
    it('should revert', async function () {
      const mintAmt = initialSupply.add(unitTokenAmount);
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      ).to.be.reverted;
    });
  });

  describe('when total supply > totalAMPLSupply', () => {
    it('should revert', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), toUFrgDenomination('45000000'));
      await expect(
        xcampleforth
          .connect(deployer)
          .mint(otherUser.getAddress(), toUFrgDenomination('5000001')),
      ).to.be.reverted;
    });
  });

  describe('when mint value > MAX_SUPPLY', () => {
    const totalAmplAmt = MAX_SUPPLY.add(1);

    it('should revert', async function () {
      await xcampleforth.rebase(1, totalAmplAmt);
      await xcampleforth
        .connect(deployer)
        .mint(deployer.getAddress(), MAX_SUPPLY.sub(1));
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), 1),
      ).not.to.be.reverted;
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), 1),
      ).to.be.reverted;
    });
  });

  describe('when total supply is 0', () => {
    const mintAmt = toUFrgDenomination('500000');

    it('should mint tokens to wallet', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should update total supply', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.totalSupply()).to.eq(mintAmt);
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcampleforth, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await otherUser.getAddress(),
          mintAmt,
        );
    });
  });

  describe('when total supply > 0', () => {
    const mintAmt = toUFrgDenomination('3500000');
    beforeEach(async function () {
      await xcampleforth
        .connect(deployer)
        .mint(deployer.getAddress(), toUFrgDenomination('30000000'));
    });

    it('should mint tokens to wallet', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should not affect other wallets', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.balanceOf(await deployer.getAddress())).to.eq(
        toUFrgDenomination('30000000'),
      );
    });

    it('should update total supply', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.totalSupply()).to.eq(
        toUFrgDenomination('33500000'),
      );
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcampleforth, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await otherUser.getAddress(),
          mintAmt,
        );
    });
  });

  describe('when minting large value', () => {
    const initialBal = toUFrgDenomination('100000000000');
    const mintAmt = MAX_SUPPLY.sub(initialBal);

    beforeEach(async function () {
      await xcampleforth.rebase(1, MAX_SUPPLY);
      await xcampleforth
        .connect(deployer)
        .mint(deployer.getAddress(), initialBal);
    });

    it('should mint tokens to wallet', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should update total supply', async function () {
      await xcampleforth
        .connect(deployer)
        .mint(otherUser.getAddress(), mintAmt);
      expect(await xcampleforth.totalSupply()).to.eq(MAX_SUPPLY);
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcampleforth.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcampleforth, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await otherUser.getAddress(),
          mintAmt,
        );
    });
  });
});
