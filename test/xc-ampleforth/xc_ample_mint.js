const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

const DECIMALS = 9;
const toUFrgDenomination = ample => ethers.utils.parseUnits(ample, DECIMALS);

const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + DECIMALS);
const MAX_SUPPLY = ethers.BigNumber.from('2').pow(128).sub(1);
const unitTokenAmount = toUFrgDenomination('1');

let accounts, deployer, otherUser, xcAmple, initialSupply;

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

  // fetch initial supply
  initialSupply = await xcAmple.globalAMPLSupply();
}

describe('XCAmple:mint:accessControl', () => {
  before('setup XCAmple contract', setupContracts);

  it('should NOT be callable by other user', async function () {
    await expect(
      xcAmple.connect(otherUser).mint(otherUser.getAddress(), unitTokenAmount),
    ).to.be.reverted;
  });

  it('should be callable by controller', async function () {
    await expect(
      xcAmple.connect(deployer).mint(otherUser.getAddress(), unitTokenAmount),
    ).not.to.be.reverted;
  });
});

describe('XCAmple:mint', () => {
  beforeEach('setup XCAmple contract', setupContracts);

  describe('when mint address is zero address', () => {
    it('should revert', async function () {
      await expect(
        xcAmple
          .connect(deployer)
          .mint(ethers.constants.AddressZero, unitTokenAmount),
      ).to.be.reverted;
    });
  });

  describe('when mint address is contract address', () => {
    it('should revert', async function () {
      await expect(
        xcAmple.connect(deployer).mint(xcAmple.address, unitTokenAmount),
      ).to.be.reverted;
    });
  });

  describe('when mint value > globalAMPLSupply', () => {
    it('should revert', async function () {
      const mintAmt = initialSupply.add(unitTokenAmount);
      await expect(
        xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      ).to.be.reverted;
    });
  });

  describe('when total supply > globalAMPLSupply', () => {
    it('should revert', async function () {
      await xcAmple
        .connect(deployer)
        .mint(otherUser.getAddress(), toUFrgDenomination('45000000'));
      await expect(
        xcAmple
          .connect(deployer)
          .mint(otherUser.getAddress(), toUFrgDenomination('5000001')),
      ).to.be.reverted;
    });
  });

  describe('when mint value > MAX_SUPPLY', () => {
    const totalAmplAmt = MAX_SUPPLY.add(1);

    it('should revert', async function () {
      await xcAmple.rebase(1, totalAmplAmt);
      await xcAmple
        .connect(deployer)
        .mint(deployer.getAddress(), MAX_SUPPLY.sub(1));
      await expect(xcAmple.connect(deployer).mint(otherUser.getAddress(), 1))
        .not.to.be.reverted;
      await expect(xcAmple.connect(deployer).mint(otherUser.getAddress(), 1)).to
        .be.reverted;
    });
  });

  describe('when total supply is 0', () => {
    const mintAmt = toUFrgDenomination('500000');

    it('should mint tokens to wallet', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should update total supply', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.totalSupply()).to.eq(mintAmt);
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcAmple, 'Transfer')
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
      await xcAmple
        .connect(deployer)
        .mint(deployer.getAddress(), toUFrgDenomination('30000000'));
    });

    it('should mint tokens to wallet', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should not affect other wallets', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.balanceOf(await deployer.getAddress())).to.eq(
        toUFrgDenomination('30000000'),
      );
    });

    it('should update total supply', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.totalSupply()).to.eq(toUFrgDenomination('33500000'));
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcAmple, 'Transfer')
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
      await xcAmple.rebase(1, MAX_SUPPLY);
      await xcAmple.connect(deployer).mint(deployer.getAddress(), initialBal);
    });

    it('should mint tokens to wallet', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.balanceOf(await otherUser.getAddress())).to.eq(
        mintAmt,
      );
    });

    it('should update total supply', async function () {
      await xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt);
      expect(await xcAmple.totalSupply()).to.eq(MAX_SUPPLY);
    });

    it('should log Transfer from zero address', async function () {
      await expect(
        xcAmple.connect(deployer).mint(otherUser.getAddress(), mintAmt),
      )
        .to.emit(xcAmple, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          await otherUser.getAddress(),
          mintAmt,
        );
    });
  });
});
