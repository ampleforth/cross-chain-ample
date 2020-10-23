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

let accounts, deployer, xcampleforth;

async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  // deploy upgradable token
  const factory = await ethers.getContractFactory('XCAmpleforth');
  xcampleforth = await upgrades.deployProxy(
    factory.connect(deployer),
    ['XCAmpleforth', 'xcAMPL', INITIAL_AMPL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)'
    },
  );
}

describe('XCAmpleforth', () => {
  before('setup XCAmpleforth contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    const user = accounts[1];
    await expect(user.sendTransaction({ to: xcampleforth.address, value: 1 }))
      .to.be.reverted;
  });
});

describe('XCAmpleforth:Initialization', () => {
  before('setup XCAmpleforth contract', setupContracts);

  it('should set the totalAMPLSupply', async function () {
    expect(await xcampleforth.totalAMPLSupply()).to.eq(INITIAL_AMPL_SUPPLY);
  });

  it('should set the totalSupply', async function () {
    expect(await xcampleforth.totalSupply()).to.eq(0);
  });

  it('should set the owner', async function () {
    expect(await xcampleforth.owner()).to.eq(await deployer.getAddress());
  });

  it('should set detailed ERC20 parameters', async function () {
    expect(await xcampleforth.name()).to.eq('XCAmpleforth');
    expect(await xcampleforth.symbol()).to.eq('xcAMPL');
    expect(await xcampleforth.decimals()).to.eq(DECIMALS);
  });
});

describe('XCAmpleforth:setMonetaryPolicy', async () => {
  let policy, policyAddress;

  before('setup XCAmpleforth contract', async () => {
    await setupContracts();
    policy = accounts[1];
    policyAddress = await policy.getAddress();
  });

  it('should set reference to policy contract', async function () {
    await expect(
      xcampleforth.connect(deployer).setMonetaryPolicy(policyAddress),
    )
      .to.emit(xcampleforth, 'LogMonetaryPolicyUpdated')
      .withArgs(policyAddress);
    expect(await xcampleforth.monetaryPolicy()).to.eq(policyAddress);
  });
});

describe('XCAmpleforth:setMonetaryPolicy:accessControl', async () => {
  let policy, policyAddress;

  before('setup XCAmpleforth contract', async () => {
    await setupContracts();
    policy = accounts[1];
    policyAddress = await policy.getAddress();
  });

  it('should be callable by owner', async function () {
    await expect(
      xcampleforth.connect(deployer).setMonetaryPolicy(policyAddress),
    ).to.not.be.reverted;
  });
});

describe('XCAmpleforth:setMonetaryPolicy:accessControl', async () => {
  let policy, policyAddress, user;

  before('setup XCAmpleforth contract', async () => {
    await setupContracts();
    policy = accounts[1];
    user = accounts[2];
    policyAddress = await policy.getAddress();
  });

  it('should NOT be callable by non-owner', async function () {
    await expect(xcampleforth.connect(user).setMonetaryPolicy(policyAddress)).to
      .be.reverted;
  });
});

describe('XCAmpleforth:Rebase:accessControl', async () => {
  let user, userAddress;

  before('setup XCAmpleforth contract', async function () {
    await setupContracts();
    user = accounts[1];
    userAddress = await user.getAddress();
    await xcampleforth.connect(deployer).setMonetaryPolicy(userAddress);
  });

  it('should not be callable by others', async function () {
    await expect(xcampleforth.connect(deployer).rebase(1, 1)).to.be.reverted;
  });

  it('should be callable by monetary policy', async function () {
    await expect(xcampleforth.connect(user).rebase(1, 1)).to.not.be.reverted;
  });
});

describe('XCAmpleforth:Rebase:Expansion', async () => {
  // Rebase +5M (10%), with starting balances A:750 and B:250.
  let A, B, policy;

  before('setup XCAmpleforth contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    policy = accounts[1];
    await xcampleforth
      .connect(deployer)
      .setMonetaryPolicy(await policy.getAddress());
    await xcampleforth
      .connect(policy)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcampleforth
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcampleforth
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcampleforth.connect(policy).rebase(1, EXPANDED_AMPL_SUPPLY))
      .to.emit(xcampleforth, 'LogRebase')
      .withArgs(1, EXPANDED_AMPL_SUPPLY);
  });

  it('should increase the totalAMPLSupply', async function () {
    expect(await xcampleforth.totalAMPLSupply()).to.eq(EXPANDED_AMPL_SUPPLY);
  });

  it('should increase the totalSupply', async function () {
    expect(await xcampleforth.totalSupply()).to.eq(EXPANDED_XCAMPL_SUPPLY);
  });

  it('should increase individual balances', async function () {
    expect(await xcampleforth.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('825'),
    );
    expect(await xcampleforth.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('275'),
    );
  });

  it('should return the new AMPL supply', async function () {
    const returnVal = await xcampleforth
      .connect(policy)
      .callStatic.rebase(2, EXPANDED_AMPL_SUPPLY);
    await xcampleforth.connect(policy).rebase(2, EXPANDED_AMPL_SUPPLY);
    expect(await xcampleforth.totalAMPLSupply()).to.eq(returnVal);
  });
});

describe('XCAmpleforth:Rebase:NoChange', function () {
  // Rebase (0%), with starting balances A:750 and B:250.
  let A, B, policy;

  before('setup XCAmpleforth contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    policy = accounts[1];
    await xcampleforth
      .connect(deployer)
      .setMonetaryPolicy(await policy.getAddress());
    await xcampleforth
      .connect(policy)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcampleforth
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcampleforth
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcampleforth.connect(policy).rebase(1, INITIAL_AMPL_SUPPLY))
      .to.emit(xcampleforth, 'LogRebase')
      .withArgs(1, INITIAL_AMPL_SUPPLY);
  });

  it('should NOT CHANGE the totalAMPLSupply', async function () {
    expect(await xcampleforth.totalAMPLSupply()).to.eq(INITIAL_AMPL_SUPPLY);
  });

  it('should NOT CHANGE the totalSupply', async function () {
    expect(await xcampleforth.totalSupply()).to.eq(INITIAL_XCAMPL_SUPPLY);
  });

  it('should NOT CHANGE individual balances', async function () {
    expect(await xcampleforth.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('750'),
    );
    expect(await xcampleforth.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('250'),
    );
  });
});

describe('XCAmpleforth:Rebase:Contraction', function () {
  // Rebase -5M (-10%), with starting balances A:750 and B:250.
  let A, B, policy;

  before('setup XCAmpleforth contract', async function () {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    policy = accounts[1];
    await xcampleforth
      .connect(deployer)
      .setMonetaryPolicy(await policy.getAddress());
    await xcampleforth
      .connect(policy)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
    await xcampleforth
      .connect(deployer)
      .transfer(await A.getAddress(), toUFrgDenomination('750'));
    await xcampleforth
      .connect(deployer)
      .transfer(await B.getAddress(), toUFrgDenomination('250'));
  });

  it('should emit Rebase', async function () {
    await expect(xcampleforth.connect(policy).rebase(1, CONTRACTED_AMPL_SUPPLY))
      .to.emit(xcampleforth, 'LogRebase')
      .withArgs(1, CONTRACTED_AMPL_SUPPLY);
  });

  it('should decrease the totalAMPLSupply', async function () {
    expect(await xcampleforth.totalAMPLSupply()).to.eq(CONTRACTED_AMPL_SUPPLY);
  });

  it('should decrease the totalSupply', async function () {
    expect(await xcampleforth.totalSupply()).to.eq(CONTRACTED_XCAMPL_SUPPLY);
  });

  it('should decrease individual balances', async function () {
    expect(await xcampleforth.balanceOf(await A.getAddress())).to.eq(
      toUFrgDenomination('675'),
    );
    expect(await xcampleforth.balanceOf(await B.getAddress())).to.eq(
      toUFrgDenomination('225'),
    );
  });
});

describe('XCAmpleforth:Transfer', function () {
  let A, B, C;

  before('setup XCAmpleforth contract', async () => {
    await setupContracts();
    A = accounts[2];
    B = accounts[3];
    C = accounts[4];
    await xcampleforth
      .connect(deployer)
      .setMonetaryPolicy(await deployer.getAddress());
    await xcampleforth
      .connect(deployer)
      .mint(deployer.getAddress(), INITIAL_XCAMPL_SUPPLY);
  });

  describe('deployer transfers 12 to A', function () {
    it('should have correct balances', async function () {
      const deployerBefore = await xcampleforth.balanceOf(
        await deployer.getAddress(),
      );
      await xcampleforth
        .connect(deployer)
        .transfer(await A.getAddress(), toUFrgDenomination('12'));
      expect(await xcampleforth.balanceOf(await deployer.getAddress())).to.eq(
        deployerBefore.sub(toUFrgDenomination('12')),
      );
      expect(await xcampleforth.balanceOf(await A.getAddress())).to.eq(
        toUFrgDenomination('12'),
      );
    });
  });

  describe('deployer transfers 15 to B', async function () {
    it('should have balances [973,15]', async function () {
      const deployerBefore = await xcampleforth.balanceOf(
        await deployer.getAddress(),
      );
      await xcampleforth
        .connect(deployer)
        .transfer(await B.getAddress(), toUFrgDenomination('15'));
      expect(await xcampleforth.balanceOf(await deployer.getAddress())).to.eq(
        deployerBefore.sub(toUFrgDenomination('15')),
      );
      expect(await xcampleforth.balanceOf(await B.getAddress())).to.eq(
        toUFrgDenomination('15'),
      );
    });
  });

  describe('deployer transfers the rest to C', async function () {
    it('should have balances [0,973]', async function () {
      const deployerBefore = await xcampleforth.balanceOf(
        await deployer.getAddress(),
      );
      await xcampleforth
        .connect(deployer)
        .transfer(await C.getAddress(), deployerBefore);
      expect(await xcampleforth.balanceOf(await deployer.getAddress())).to.eq(
        0,
      );
      expect(await xcampleforth.balanceOf(await C.getAddress())).to.eq(
        deployerBefore,
      );
    });
  });

  describe('when the recipient address is the contract address', function () {
    it('reverts on transfer', async function () {
      await expect(
        xcampleforth.connect(A).transfer(xcampleforth.address, unitTokenAmount),
      ).to.be.reverted;
    });

    it('reverts on transferFrom', async function () {
      await expect(
        xcampleforth
          .connect(A)
          .transferFrom(
            await A.getAddress(),
            xcampleforth.address,
            unitTokenAmount,
          ),
      ).to.be.reverted;
    });
  });

  describe('when the recipient is the zero address', function () {
    it('emits an approval event', async function () {
      await expect(
        xcampleforth
          .connect(A)
          .approve(ethers.constants.AddressZero, transferAmount),
      )
        .to.emit(xcampleforth, 'Approval')
        .withArgs(
          await A.getAddress(),
          ethers.constants.AddressZero,
          transferAmount,
        );
    });

    it('transferFrom should fail', async function () {
      await expect(
        xcampleforth
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
