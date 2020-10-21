const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

const DECIMALS = 9;
const toUFrgDenomination = ample => ethers.utils.parseUnits(ample, DECIMALS);

const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + DECIMALS);
const MAX_SUPPLY = ethers.BigNumber.from('2').pow(128).sub(1);
const unitTokenAmount = toUFrgDenomination('1');

let accounts, deployer, otherUser, xcAmple;

async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  otherUser = accounts[1];

  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmple');
  xcAmple = await upgrades.deployProxy(
    factory.connect(deployer),
    ['XCAmple', 'xcAMPL', INITIAL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)'
    },
  );
  await xcAmple.setController(deployer.getAddress());
}

describe('XCAmple:burn:accessControl', function () {
  before('setup XCAmple contract', setupContracts);
  beforeEach(async function () {
    await xcAmple
      .connect(deployer)
      .mint(otherUser.getAddress(), unitTokenAmount);
  });

  it('should NOT be callable by other user', async function () {
    await expect(
      xcAmple.connect(otherUser).burn(otherUser.getAddress(), unitTokenAmount),
    ).to.be.reverted;
  });

  it('should be callable by controller', async function () {
    await expect(
      xcAmple.connect(deployer).burn(otherUser.getAddress(), unitTokenAmount),
    ).not.to.be.reverted;
  });
});

describe('XCAmple:burn', () => {
  beforeEach('setup XCAmple contract', setupContracts);

  describe('when burn address is zero address', () => {
    it('should revert', async function () {
      await expect(
        xcAmple
          .connect(deployer)
          .burn(ethers.constants.AddressZero, unitTokenAmount),
      ).to.be.reverted;
    });
  });

  describe('when burn value > user balance', () => {
    it('should revert', async function () {
      const mintAmt = toUFrgDenomination('1000000');
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      const burnAmt = (await xcAmple.balanceOf(otherUser.getAddress())).add(1);
      await expect(
        xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt),
      ).to.be.reverted;
    });
  });

  describe('when burn value = user balance', () => {
    const amt1 = toUFrgDenomination('1000000');
    const amt2 = toUFrgDenomination('12343588');
    const totalAmt = amt1.add(amt2);
    beforeEach(async function () {
      await xcAmple.connect(deployer).mint(deployer.getAddress(), amt2);
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), amt1);
    });
    it('should burn tokens from wallet', async function () {
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), amt1);
      expect(await xcAmple.balanceOf(otherUser.getAddress())).to.eq(0);
    });
    it('should NOT affect other wallets', async function () {
      expect(await xcAmple.balanceOf(deployer.getAddress())).to.eq(amt2);
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), amt1);
      expect(await xcAmple.balanceOf(deployer.getAddress())).to.eq(amt2);
    });
    it('should update the total supply', async function () {
      expect(await xcAmple.totalSupply()).to.eq(totalAmt);
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), amt1);
      expect(await xcAmple.totalSupply()).to.eq(amt2);
    });
    it('should log Transfer to zero address', async function () {
      await expect(xcAmple.connect(deployer).burn(otherUser.getAddress(), amt1))
        .to.emit(xcAmple, 'Transfer')
        .withArgs(
          await otherUser.getAddress(),
          ethers.constants.AddressZero,
          amt1,
        );
    });
  });

  describe('when burn value < user balance', () => {
    const mintAmt = toUFrgDenomination('1000000');
    const remainingBal = toUFrgDenomination('1');
    const burnAmt = mintAmt.sub(remainingBal);

    beforeEach(async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
    });
    it('should burn tokens from wallet', async function () {
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt);
      expect(await xcAmple.balanceOf(otherUser.getAddress())).to.eq(
        remainingBal,
      );
    });
    it('should update the total supply', async function () {
      expect(await xcAmple.totalSupply()).to.eq(mintAmt);
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt);
      expect(await xcAmple.totalSupply()).to.eq(remainingBal);
    });
    it('should log Transfer to zero address', async function () {
      await expect(
        xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt),
      )
        .to.emit(xcAmple, 'Transfer')
        .withArgs(
          await otherUser.getAddress(),
          ethers.constants.AddressZero,
          burnAmt,
        );
    });
  });

  describe('when burning large value', () => {
    const remainingBal = toUFrgDenomination('3');
    const burnAmt = MAX_SUPPLY.sub(remainingBal);

    beforeEach(async function () {
      await xcAmple.rebase(1, MAX_SUPPLY);
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), MAX_SUPPLY);
    });

    it('should burn tokens from wallet', async function () {
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt);
      expect(await xcAmple.balanceOf(otherUser.getAddress())).to.eq(
        remainingBal,
      );
    });
    it('should update the total supply', async function () {
      expect(await xcAmple.totalSupply()).to.eq(MAX_SUPPLY);
      await xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt);
      expect(await xcAmple.totalSupply()).to.eq(remainingBal);
    });
    it('should log Transfer to zero address', async function () {
      await expect(
        xcAmple.connect(deployer).burn(otherUser.getAddress(), burnAmt),
      )
        .to.emit(xcAmple, 'Transfer')
        .withArgs(
          await otherUser.getAddress(),
          ethers.constants.AddressZero,
          burnAmt,
        );
    });
  });
});
