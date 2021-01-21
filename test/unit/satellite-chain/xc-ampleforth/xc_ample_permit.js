const { network, ethers, upgrades } = require('hardhat');
const { Wallet, BigNumber } = require('ethers');
const { expect } = require('chai');

const DECIMALS = 9;
const INITIAL_AMPL_SUPPLY = ethers.utils.parseUnits('50', 6 + DECIMALS);

const {
  EIP712_DOMAIN_TYPEHASH,
  EIP2612_PERMIT_TYPEHASH,
  getDomainSeparator,
  signEIP712Permission
} = require('../../_utilities/signatures');

const EIP712_REVISION = '1';

const amt = BigNumber.from('999');

let accounts,
  deployer,
  deployerAddress,
  owner,
  ownerAddress,
  spender,
  spenderAddress,
  xcAmple;

async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];

  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  deployerAddress = await deployer.getAddress();

  owner = Wallet.createRandom();
  ownerAddress = await owner.getAddress();

  spender = Wallet.createRandom();
  spenderAddress = await spender.getAddress();

  // deploy upgradeable token
  const factory = await ethers.getContractFactory(
    'contracts/satellite-chain/xc-ampleforth/XCAmple.sol:XCAmple',
  );
  xcAmple = await upgrades.deployProxy(
    factory.connect(deployer),
    ['XCAmple123', 'xcAMPL', INITIAL_AMPL_SUPPLY],
    { initializer: 'initialize(string,string,uint256)' },
  );
}

// https://eips.ethereum.org/EIPS/eip-2612
// Test cases as in:
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/drafts/ERC20Permit.test.js
describe('XCAmple:Initialization', () => {
  before('setup XCAmple contract', setupContracts);

  it('should set the EIP2612 parameters', async function () {
    expect(await xcAmple.EIP712_REVISION()).to.eq('0x31');
    expect(await xcAmple.EIP712_DOMAIN()).to.eq(EIP712_DOMAIN_TYPEHASH);
    expect(await xcAmple.PERMIT_TYPEHASH()).to.eq(EIP2612_PERMIT_TYPEHASH);
    // with hard-coded parameters
    expect(await xcAmple.DOMAIN_SEPARATOR()).to.eq(
      getDomainSeparator(
        EIP712_REVISION,
        'XCAmple123',
        xcAmple.address,
        network.config.chainId,
      ),
    );
  });

  it('initial nonce is 0', async function () {
    expect(await xcAmple.nonces(deployerAddress)).to.eq('0');
    expect(await xcAmple.nonces(ownerAddress)).to.eq('0');
    expect(await xcAmple.nonces(spenderAddress)).to.eq('0');
  });
});

// Using the cases specified by:
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/drafts/ERC20Permit.test.js
describe('XCAmple:EIP-2612 Permit', () => {
  const MAX_DEADLINE = BigNumber.from(2).pow(256).sub(1);

  beforeEach('setup XCAmple contract', setupContracts);

  describe('permit', function () {
    const signPermission = async (
      signer,
      owner,
      spender,
      value,
      nonce,
      deadline,
    ) => {
      return signEIP712Permission(
        EIP712_REVISION,
        'XCAmple123',
        xcAmple.address,
        network.config.chainId,
        signer,
        owner,
        spender,
        value,
        nonce,
        deadline,
      );
    };

    it('accepts owner signature', async function () {
      const { v, r, s } = await signPermission(
        owner,
        ownerAddress,
        spenderAddress,
        amt,
        0,
        MAX_DEADLINE,
      );
      await expect(
        xcAmple
          .connect(deployer)
          .permit(ownerAddress, spenderAddress, amt, MAX_DEADLINE, v, r, s),
      )
        .to.emit(xcAmple, 'Approval')
        .withArgs(ownerAddress, spenderAddress, amt);
      expect(await xcAmple.nonces(ownerAddress)).to.eq('1');
      expect(await xcAmple.allowance(ownerAddress, spenderAddress)).to.eq(amt);
    });

    it('rejects reused signature', async function () {
      const { v, r, s } = await signPermission(
        owner,
        ownerAddress,
        spenderAddress,
        amt,
        0,
        MAX_DEADLINE,
      );
      await xcAmple
        .connect(deployer)
        .permit(ownerAddress, spenderAddress, amt, MAX_DEADLINE, v, r, s);
      await expect(
        xcAmple
          .connect(deployer)
          .permit(ownerAddress, spenderAddress, amt, MAX_DEADLINE, v, r, s),
      ).to.be.reverted;
    });

    it('rejects other signature', async function () {
      const { v, r, s } = await signPermission(
        spender,
        ownerAddress,
        spenderAddress,
        amt,
        0,
        MAX_DEADLINE,
      );
      await expect(
        xcAmple
          .connect(deployer)
          .permit(ownerAddress, spenderAddress, amt, MAX_DEADLINE, v, r, s),
      ).to.be.reverted;
    });

    it('rejects expired permit', async function () {
      const currentTs = (await ethers.provider.getBlock('latest')).timestamp;
      const olderTs = currentTs - 3600 * 24 * 7;
      const deadline = BigNumber.from(olderTs);
      const { v, r, s } = await signPermission(
        owner,
        ownerAddress,
        spenderAddress,
        amt,
        0,
        deadline,
      );
      await expect(
        xcAmple
          .connect(deployer)
          .permit(ownerAddress, spenderAddress, amt, deadline, v, r, s),
      ).to.be.reverted;
    });
  });
});
