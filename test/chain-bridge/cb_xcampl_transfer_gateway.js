const { ethers } = require('@nomiclabs/buidler');
const { expect } = require('chai');

let accounts,
  deployer,
  depositorAddress,
  recipient,
  recipientAddress,
  bridge,
  bridgeAddress,
  xcAmpl,
  xcAmplPolicy,
  gateway;
async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  depositorAddress = await deployer.getAddress();
  bridge = accounts[1];
  bridgeAddress = await bridge.getAddress();
  recipient = accounts[2];
  recipientAddress = await recipient.getAddress();

  xcAmpl = await (await ethers.getContractFactory('MockXCAmpl'))
    .connect(deployer)
    .deploy();
  xcAmplPolicy = await (await ethers.getContractFactory('MockXCAmplPolicy'))
    .connect(deployer)
    .deploy();

  gateway = await (
    await ethers.getContractFactory('ChainBridgeXCAmpleforthPolicyGateway')
  )
    .connect(deployer)
    .deploy(bridgeAddress, xcAmpl.address, xcAmplPolicy.address);

  await xcAmplPolicy.updateAMPLEpoch(1);
  await xcAmpl.updateTotalAMPLSupply(50000);
}

describe('ChainBridgeXCAmpleforthPolicyGateway:Initialization', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.xcAmpl()).to.eq(xcAmpl.address);
    expect(await gateway.xcAmplPolicy()).to.eq(xcAmplPolicy.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:mint:accessControl', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway
        .connect(deployer)
        .mint(depositorAddress, recipientAddress, 1001, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(
      gateway
        .connect(bridge)
        .mint(depositorAddress, recipientAddress, 1001, 50000),
    ).to.not.be.reverted;
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:mint', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('when recorded supply = total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 25000, 2002, 50000);
    });

    it('should mint from xcAmplPolicy', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:mint', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('when recorded supply > total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 100000, 500, 50000);
    });

    it('should mint from xcAmplPolicy', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, 500);
    });
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:mint', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('when recorded supply < total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(depositorAddress, recipientAddress, 1001, 25000, 2002, 50000);
    });

    it('should mint from xcAmplPolicy', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:mint', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('large numbers', function () {
    const MAX_SUPPLY = ethers.BigNumber.from(2).pow(128).sub(1);
    const HALF_MAX_SUPPLY = MAX_SUPPLY.div(2);
    it('should mint correct number of ampls', async function () {
      await xcAmpl.updateTotalAMPLSupply(HALF_MAX_SUPPLY);
      await expect(
        gateway
          .connect(bridge)
          .mint(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            MAX_SUPPLY,
          ),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, '49999999999999999999');

      await xcAmpl.updateTotalAMPLSupply(MAX_SUPPLY);
      await expect(
        gateway
          .connect(bridge)
          .mint(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            HALF_MAX_SUPPLY,
          ),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, '200000000000000000000');

      await expect(
        gateway
          .connect(bridge)
          .mint(
            depositorAddress,
            recipientAddress,
            '100000000000000000000',
            MAX_SUPPLY,
          ),
      )
        .to.emit(xcAmplPolicy, 'MockMint')
        .withArgs(recipientAddress, '100000000000000000000');
    });
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:validateAndBurn:accessControl', () => {
  before(
    'setup ChainBridgeXCAmpleforthPolicyGateway contract',
    async function () {
      await setupContracts();
    },
  );

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway
        .connect(deployer)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await gateway
      .connect(bridge)
      .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000);

    await expect(
      gateway
        .connect(bridge)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    ).to.not.be.reverted;
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:validateAndBurn', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway
          .connect(bridge)
          .validateAndBurn(depositorAddress, recipientAddress, 1001, 50001),
      ).to.be.revertedWith(
        'ChainBridgeXCAmpleforthPolicyGateway: recorded total supply not consistent',
      );
    });
  });
});

describe('ChainBridgeXCAmpleforthPolicyGateway:validateAndBurn', () => {
  before('setup ChainBridgeXCAmpleforthPolicyGateway contract', setupContracts);

  it('should emit XCTransferOut', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(gateway, 'XCTransferOut')
      .withArgs(depositorAddress, recipientAddress, 1001, 50000);
  });

  it('should update the policy', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(xcAmplPolicy, 'MockBurn')
      .withArgs(depositorAddress, 1001);
  });
});
