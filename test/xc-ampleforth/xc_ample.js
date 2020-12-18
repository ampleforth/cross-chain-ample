const { ethers, upgrades } = require('@nomiclabs/buidler');
const { expect } = require('chai');

// NOTE: This is a copy of all the test-cases for the core ampleforth token
// https://github.com/ampleforth/uFragments/blob/master/test/unit/UFragments.js

const DECIMALS = 9;
const toUFrgDenomination = ample => ethers.utils.parseUnits(ample, DECIMALS);

const INITIAL_AMPL_SUPPLY = ethers.utils.parseUnits('50', 6 + DECIMALS);
const REBASE_AMT = INITIAL_AMPL_SUPPLY.div(10);
const EXPANDED_AMPL_SUPPLY = INITIAL_AMPL_SUPPLY.add(REBASE_AMT);
const CONTRACTED_AMPL_SUPPLY = INITIAL_AMPL_SUPPLY.sub(REBASE_AMT);

const INITIAL_XCAMPL_SUPPLY = INITIAL_AMPL_SUPPLY.div(2);
const EXPANDED_XCAMPL_SUPPLY = EXPANDED_AMPL_SUPPLY.div(2);
const CONTRACTED_XCAMPL_SUPPLY = CONTRACTED_AMPL_SUPPLY.div(2);

const transferAmount = toUFrgDenomination('10');
const unitTokenAmount = toUFrgDenomination('1');

let accounts, deployer, xcAmple;

async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmple');
  xcAmple = await upgrades.deployProxy(
    factory.connect(deployer),
    ['XCAmple', 'xcAMPL', INITIAL_AMPL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)'
    },
  );
}

describe('XCAmple', () => {
  before('setup XCAmple contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    const user = accounts[1];
    await expect(user.sendTransaction({ to: xcAmple.address, value: 1 })).to.be
      .reverted;
  });
});

describe('XCAmple:Initialization', () => {
  before('setup XCAmple contract', setupContracts);

  it('should set the totalAMPLSupply', async function () {
    expect(await xcAmple.totalAMPLSupply()).to.eq(INITIAL_AMPL_SUPPLY);
  });

  it('should set the totalSupply', async function () {
    expect(await xcAmple.totalSupply()).to.eq(0);
  });

  it('should set the owner', async function () {
    expect(await xcAmple.owner()).to.eq(await deployer.getAddress());
  });

  it('should set detailed ERC20 parameters', async function () {
    expect(await xcAmple.name()).to.eq('XCAmple');
    expect(await xcAmple.symbol()).to.eq('xcAMPL');
    expect(await xcAmple.decimals()).to.eq(DECIMALS);
  });
});

describe('XCAmple:setController', async () => {
  let controller, controllerAddress;

  before('setup XCAmple contract', async () => {
    await setupContracts();
    controller = accounts[1];
    controllerAddress = await controller.getAddress();
  });

  it('should set reference to controller contract', async function () {
    await expect(xcAmple.connect(deployer).setController(controllerAddress))
      .to.emit(xcAmple, 'ControllerUpdated')
      .withArgs(controllerAddress);
    expect(await xcAmple.controller()).to.eq(controllerAddress);
  });
});

describe('XCAmple:setController:accessControl', async () => {
  let controller, controllerAddress;

  before('setup XCAmple contract', async () => {
    await setupContracts();
    controller = accounts[1];
    controllerAddress = await controller.getAddress();
  });

  it('should be callable by owner', async function () {
    await expect(xcAmple.connect(deployer).setController(controllerAddress)).to
      .not.be.reverted;
  });
});

describe('XCAmple:setController:accessControl', async () => {
  let controller, controllerAddress, user;

  before('setup XCAmple contract', async () => {
    await setupContracts();
    controller = accounts[1];
    user = accounts[2];
    controllerAddress = await controller.getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(xcAmple.connect(user).setController(controllerAddress)).to.be
      .reverted;
  });
});

describe('XCAmple:Rebase:accessControl', async () => {
  let user, userAddress;

  before('setup XCAmple contract', async function () {
    await setupContracts();
    user = accounts[1];
    userAddress = await user.getAddress();
    await xcAmple.connect(deployer).setController(userAddress);
  });

  it('should not be callable by others', async function () {
    await expect(xcAmple.connect(deployer).rebase(1, 1)).to.be.reverted;
  });

  it('should be callable by controller', async function () {
    await expect(xcAmple.connect(user).rebase(1, 1)).to.not.be.reverted;
  });
});

describe('XCAmple:Rebase:Expansion', async () => {
  // Rebase +5M (10%), with starting balances A:750 and B:250.
  let A, B, controller;

  before('setup XCAmple contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    controller = accounts[1];
    await xcAmple
      .connect(deployer)
      .setController(await controller.getAddress());
    await xcAmple
      .connect(controller)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcAmple
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcAmple
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcAmple.connect(controller).rebase(1, EXPANDED_AMPL_SUPPLY))
      .to.emit(xcAmple, 'LogRebase')
      .withArgs(1, EXPANDED_AMPL_SUPPLY);
  });

  it('should increase the totalAMPLSupply', async function () {
    expect(await xcAmple.totalAMPLSupply()).to.eq(EXPANDED_AMPL_SUPPLY);
  });

  it('should increase the totalSupply', async function () {
    expect(await xcAmple.totalSupply()).to.eq(EXPANDED_XCAMPL_SUPPLY);
  });

  it('should increase individual balances', async function () {
    expect(await xcAmple.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('825'),
    );
    expect(await xcAmple.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('275'),
    );
  });

  it('should return the new AMPL supply', async function () {
    const returnVal = await xcAmple
      .connect(controller)
      .callStatic.rebase(2, EXPANDED_AMPL_SUPPLY);
    await xcAmple.connect(controller).rebase(2, EXPANDED_AMPL_SUPPLY);
    expect(await xcAmple.totalAMPLSupply()).to.eq(returnVal);
  });
});

describe('XCAmple:Rebase:NoChange', function () {
  // Rebase (0%), with starting balances A:750 and B:250.
  let A, B, controller;

  before('setup XCAmple contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    controller = accounts[1];
    await xcAmple
      .connect(deployer)
      .setController(await controller.getAddress());
    await xcAmple
      .connect(controller)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcAmple
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcAmple
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcAmple.connect(controller).rebase(1, INITIAL_AMPL_SUPPLY))
      .to.emit(xcAmple, 'LogRebase')
      .withArgs(1, INITIAL_AMPL_SUPPLY);
  });

  it('should NOT CHANGE the totalAMPLSupply', async function () {
    expect(await xcAmple.totalAMPLSupply()).to.eq(INITIAL_AMPL_SUPPLY);
  });

  it('should NOT CHANGE the totalSupply', async function () {
    expect(await xcAmple.totalSupply()).to.eq(INITIAL_XCAMPL_SUPPLY);
  });

  it('should NOT CHANGE individual balances', async function () {
    expect(await xcAmple.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('750'),
    );
    expect(await xcAmple.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('250'),
    );
  });
});

describe('XCAmple:Rebase:Contraction', function () {
  // Rebase -5M (-10%), with starting balances A:750 and B:250.
  let A, B, controller;

  before('setup XCAmple contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    controller = accounts[1];
    await xcAmple
      .connect(deployer)
      .setController(await controller.getAddress());
    await xcAmple
      .connect(controller)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcAmple
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcAmple
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcAmple.connect(controller).rebase(1, CONTRACTED_AMPL_SUPPLY))
      .to.emit(xcAmple, 'LogRebase')
      .withArgs(1, CONTRACTED_AMPL_SUPPLY);
  });

  it('should decrease the totalAMPLSupply', async function () {
    expect(await xcAmple.totalAMPLSupply()).to.eq(CONTRACTED_AMPL_SUPPLY);
  });

  it('should decrease the totalSupply', async function () {
    expect(await xcAmple.totalSupply()).to.eq(CONTRACTED_XCAMPL_SUPPLY);
  });

  it('should decrease individual balances', async function () {
    expect(await xcAmple.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('675'),
    );
    expect(await xcAmple.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('225'),
    );
  });
});

describe('XCAmple:Transfer', function () {
  let A, B, C;

  before('setup XCAmple contract', async () => {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    C = accounts[4];
    await xcAmple.connect(deployer).setController(await deployer.getAddress());
    await xcAmple
      .connect(deployer)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
  });

  describe('deployer transfers 12 to A', function () {
    it('should have correct balances', async function () {
      const deployerBefore = await xcAmple.balanceOf(
        await deployer.getAddress(),
      );
      await xcAmple
        .connect(deployer)
        .transfer(await A.getAddress(), toUFrgDenomination('12'));
      expect(await xcAmple.balanceOf(await deployer.getAddress())).to.eq(
        deployerBefore.sub(toUFrgDenomination('12')),
      );
      expect(await xcAmple.balanceOf(await A.getAddress())).to.eq(
        toUFrgDenomination('12'),
      );
    });
  });

  describe('deployer transfers 15 to B', async function () {
    it('should have balances [973,15]', async function () {
      const deployerBefore = await xcAmple.balanceOf(
        await deployer.getAddress(),
      );
      await xcAmple
        .connect(deployer)
        .transfer(await B.getAddress(), toUFrgDenomination('15'));
      expect(await xcAmple.balanceOf(await deployer.getAddress())).to.eq(
        deployerBefore.sub(toUFrgDenomination('15')),
      );
      expect(await xcAmple.balanceOf(await B.getAddress())).to.eq(
        toUFrgDenomination('15'),
      );
    });
  });

  describe('deployer transfers the rest to C', async function () {
    it('should have balances [0,973]', async function () {
      const deployerBefore = await xcAmple.balanceOf(
        await deployer.getAddress(),
      );
      await xcAmple
        .connect(deployer)
        .transfer(await C.getAddress(), deployerBefore);
      expect(await xcAmple.balanceOf(await deployer.getAddress())).to.eq(0);
      expect(await xcAmple.balanceOf(await C.getAddress())).to.eq(
        deployerBefore,
      );
    });
  });

  describe('when the recipient address is the contract address', function () {
    it('reverts on transfer', async function () {
      await expect(
        xcAmple.connect(A).transfer(xcAmple.address, unitTokenAmount),
      ).to.be.reverted;
    });

    it('reverts on transferFrom', async function () {
      await expect(
        xcAmple
          .connect(A)
          .transferFrom(await A.getAddress(), xcAmple.address, unitTokenAmount),
      ).to.be.reverted;
    });
  });

  describe('when the recipient is the zero address', function () {
    it('emits an approval event', async function () {
      await expect(
        xcAmple
          .connect(A)
          .approve(ethers.constants.AddressZero, transferAmount),
      )
        .to.emit(xcAmple, 'Approval')
        .withArgs(
          await A.getAddress(),
          ethers.constants.AddressZero,
          transferAmount,
        );
    });

    it('transferFrom should fail', async function () {
      await expect(
        xcAmple
          .connect(C)
          .transferFrom(
            await A.getAddress(),
            ethers.constants.AddressZero,
            unitTokenAmount,
          ),
      ).to.be.reverted;
    });
  });
});
