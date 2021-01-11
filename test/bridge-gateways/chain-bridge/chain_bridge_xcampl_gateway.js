const { ethers } = require('hardhat');
const { expect } = require('chai');

let accounts,
  deployer,
  depositorAddress,
  recipient,
  recipientAddress,
  bridge,
  bridgeAddress,
  xcAmpl,
  xcController,
  gateway;
async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  depositorAddress = await deployer.getAddress();
  bridge = accounts[1];
  bridgeAddress = await bridge.getAddress();
  recipient = accounts[2];
  recipientAddress = await recipient.getAddress();

  xcAmpl = await (
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

  gateway = await (
    await ethers.getContractFactory(
      'contracts/bridge-gateways/chain-bridge/ChainBridgeXCAmpleGateway.sol:ChainBridgeXCAmpleGateway',
    )
  )
    .connect(deployer)
    .deploy(bridgeAddress, xcAmpl.address, xcController.address);

  await xcController.updateAMPLEpoch(1);
  await xcAmpl.updateGlobalAMPLSupply(50000);
}

describe('ChainBridgeXCAmpleGateway:Initialization', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  it('should initialize the references', async function () {
    expect(await gateway.xcAmpl()).to.eq(xcAmpl.address);
    expect(await gateway.xcController()).to.eq(xcController.address);
  });

  it('should set the owner', async function () {
    expect(await gateway.owner()).to.eq(bridgeAddress);
  });
});

describe('ChainBridgeXCAmpleGateway:reportRebase:accessControl', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    await expect(
      gateway.connect(deployer).reportRebase(1, 50000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should be callable by owner', async function () {
    await expect(gateway.connect(bridge).reportRebase(1, 50000)).to.not.be
      .reverted;
  });
});

describe('ChainBridgeXCAmpleGateway:reportRebase', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('when on-chain supply is different', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(gateway.connect(bridge).reportRebase(2, 100000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 100000, 1, 50000);

      await expect(gateway.connect(bridge).reportRebase(3, 40000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(3, 40000, 1, 50000);
    });
  });

  describe('when on-chain supply is the same', async function () {
    it('should emit XCRebaseReportIn', async function () {
      await expect(gateway.connect(bridge).reportRebase(2, 50000))
        .to.emit(gateway, 'XCRebaseReportIn')
        .withArgs(2, 50000, 1, 50000);
    });
  });
});

describe('ChainBridgeXCAmpleGateway:mint:accessControl', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

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

describe('ChainBridgeXCAmpleGateway:mint', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('when recorded supply = total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(recipientAddress, 25000, 2002, 50000);
    });

    it('should mint from xcController', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('ChainBridgeXCAmpleGateway:mint', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('when recorded supply < total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(recipientAddress, 100000, 500, 50000);
    });

    it('should mint from xcController', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 100000),
      )
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, 500);
    });
  });
});

describe('ChainBridgeXCAmpleGateway:mint', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('when recorded supply > total supply', function () {
    it('should emit XCTransferIn', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(gateway, 'XCTransferIn')
        .withArgs(recipientAddress, 25000, 2002, 50000);
    });

    it('should mint from xcController', async function () {
      await expect(
        gateway
          .connect(bridge)
          .mint(depositorAddress, recipientAddress, 1001, 25000),
      )
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, 2002);
    });
  });
});

describe('ChainBridgeXCAmpleGateway:mint', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('large numbers', function () {
    const MAX_SUPPLY = ethers.BigNumber.from(2).pow(128).sub(1);
    const HALF_MAX_SUPPLY = MAX_SUPPLY.div(2);
    it('should mint correct number of ampls', async function () {
      await xcAmpl.updateGlobalAMPLSupply(HALF_MAX_SUPPLY);
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
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, '49999999999999999999');

      await xcAmpl.updateGlobalAMPLSupply(MAX_SUPPLY);
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
        .to.emit(xcController, 'Mint')
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
        .to.emit(xcController, 'Mint')
        .withArgs(recipientAddress, '100000000000000000000');
    });
  });
});

describe('ChainBridgeXCAmpleGateway:validateAndBurn:accessControl', () => {
  before('setup ChainBridgeXCAmpleGateway contract', async function () {
    await setupContracts();
  });

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

describe('ChainBridgeXCAmpleGateway:validateAndBurn', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  describe('when total supply is not consistent', async function () {
    it('should revert', async function () {
      await expect(
        gateway
          .connect(bridge)
          .validateAndBurn(depositorAddress, recipientAddress, 1001, 50001),
      ).to.be.revertedWith(
        'ChainBridgeXCAmpleGateway: total supply not consistent',
      );
    });
  });
});

describe('ChainBridgeXCAmpleGateway:validateAndBurn', () => {
  before('setup ChainBridgeXCAmpleGateway contract', setupContracts);

  it('should emit XCTransferOut', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(gateway, 'XCTransferOut')
      .withArgs(depositorAddress, 1001, 50000);
  });

  it('should burn from xcController', async function () {
    await expect(
      gateway
        .connect(bridge)
        .validateAndBurn(depositorAddress, recipientAddress, 1001, 50000),
    )
      .to.emit(xcController, 'Burn')
      .withArgs(depositorAddress, 1001);
  });
});
