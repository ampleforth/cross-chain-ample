const { ethers } = require('hardhat');
const { expect } = require('chai');

const ETH_CHAIN_ID = '1';
const TRON_CHAIN_ID = '2';
const ACALA_CHAIN_ID = '3';
const RELAYER_TRESHOLD = 2;

const {
  executeXCRebase,
  executeXCTransfer,
  XC_REBASE_RESOURCE_ID,
  XC_TRANSFER_RESOURCE_ID,
  packXCTransferData
} = require('../../sdk/chain_bridge');
const { execRebase, toAmplFixedPt } = require('../../sdk/ampleforth');

const {
  deployAMPLContracts,
  deployXCAmpleContracts,
  deployChainBridgeContracts,
  deployChainBridgeBaseChainGatewayContracts,
  deployChainBridgeSatelliteChainGatewayContracts
} = require('../../helpers/deploy');

const { parseEventFromLogs } = require('../helpers/ethers');

let accounts,
  deployer,
  relayer,
  baseChainBridgeContracts,
  satChain1BridgeContracts,
  satChain2BridgeContracts,
  baseChainAmplContracts,
  satChain1AmplContracts,
  satChain2AmplContracts,
  bridgeContractsMap,
  amplContractsMap,
  userABaseChainWallet,
  userBBaseChainWallet,
  userASatChain1Wallet,
  userBSatChain1Wallet,
  userASatChain2Wallet,
  userBSatChain2Wallet;

async function setupContracts () {
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  relayer = accounts[1];

  userABaseChainWallet = accounts[2];
  userBBaseChainWallet = accounts[3];

  userASatChain1Wallet = accounts[4];
  userBSatChain1Wallet = accounts[5];

  userASatChain2Wallet = accounts[6];
  userBSatChain2Wallet = accounts[7];

  baseChainAmplContracts = await deployAMPLContracts(ethers, deployer);
  baseChainBridgeContracts = await deployChainBridgeContracts(
    {
      chainId: ETH_CHAIN_ID,
      relayers: [await deployer.getAddress(), await relayer.getAddress()],
      relayerThreshold: RELAYER_TRESHOLD,
      fee: 0,
      expiry: 1000
    },
    ethers,
    deployer,
  );
  const baseChainBridgeGatewayContracts = await deployChainBridgeBaseChainGatewayContracts(
    { ...baseChainAmplContracts, ...baseChainBridgeContracts },
    ethers,
    deployer,
  );
  baseChainBridgeContracts = Object.assign(
    baseChainBridgeContracts,
    baseChainBridgeGatewayContracts,
  );

  const [
    globalAmpleforthEpoch,
    globalAMPLSupply
  ] = await baseChainAmplContracts.policy.globalAmpleforthEpochAndAMPLSupply();

  satChain1AmplContracts = await deployXCAmpleContracts(
    {
      tokenSymbol: 'satChain1XCAmple',
      tokenName: 'satChain1XCAmple',
      globalAmpleforthEpoch,
      globalAMPLSupply
    },
    ethers,
    deployer,
  );
  satChain1BridgeContracts = await deployChainBridgeContracts(
    {
      chainId: TRON_CHAIN_ID,
      relayers: [await deployer.getAddress(), await relayer.getAddress()],
      relayerThreshold: RELAYER_TRESHOLD,
      fee: 0,
      expiry: 1000
    },
    ethers,
    deployer,
  );
  const satChain1BridgeGatewayContracts = await deployChainBridgeSatelliteChainGatewayContracts(
    { ...satChain1AmplContracts, ...satChain1BridgeContracts },
    ethers,
    deployer,
  );
  satChain1BridgeContracts = Object.assign(
    satChain1BridgeContracts,
    satChain1BridgeGatewayContracts,
  );

  satChain2AmplContracts = await deployXCAmpleContracts(
    {
      tokenSymbol: 'satChain2XCAmple',
      tokenName: 'satChain2XCAmple',
      globalAmpleforthEpoch,
      globalAMPLSupply
    },
    ethers,
    deployer,
  );
  satChain2BridgeContracts = await deployChainBridgeContracts(
    {
      chainId: ACALA_CHAIN_ID,
      relayers: [await deployer.getAddress(), await relayer.getAddress()],
      relayerThreshold: RELAYER_TRESHOLD,
      fee: 0,
      expiry: 1000
    },
    ethers,
    deployer,
  );
  const satChain2BridgeGatewayContracts = await deployChainBridgeSatelliteChainGatewayContracts(
    { ...satChain2AmplContracts, ...satChain2BridgeContracts },
    ethers,
    deployer,
  );
  satChain2BridgeContracts = Object.assign(
    satChain2BridgeContracts,
    satChain2BridgeGatewayContracts,
  );

  bridgeContractsMap = {
    base: baseChainBridgeContracts,
    sat1: satChain1BridgeContracts,
    sat2: satChain2BridgeContracts
  };

  amplContractsMap = {
    base: baseChainAmplContracts,
    sat1: satChain1AmplContracts,
    sat2: satChain2AmplContracts
  };

  // On the main-chain userA and userB have 100k AMPLs each
  await baseChainAmplContracts.ampl
    .connect(deployer)
    .transfer(await userABaseChainWallet.getAddress(), toAmplFixedPt('100000'));

  await baseChainAmplContracts.ampl
    .connect(deployer)
    .transfer(await userBBaseChainWallet.getAddress(), toAmplFixedPt('100000'));
}

async function mockOffchain (
  toChainBridge,
  fromChainID,
  depositNonce,
  resourceID,
  dataHash,
  data,
) {
  await toChainBridge
    .connect(relayer)
    .voteProposal(fromChainID, depositNonce, resourceID, dataHash);

  await toChainBridge
    .connect(deployer)
    .voteProposal(fromChainID, depositNonce, resourceID, dataHash);

  await toChainBridge
    .connect(deployer)
    .executeProposal(fromChainID, depositNonce, data, resourceID);
  // console.log((await toChainBridge.getProposal(fromChainID, depositNonce, dataHash))._status);
}

async function execXCReportRebase (chain) {
  const fromChainID = await baseChainBridgeContracts.bridge._chainID();
  const toChainID = await bridgeContractsMap[chain].bridge._chainID();

  // Triggering rebase report to sat chain
  const { data, dataHash, depositNonce, resourceID } = await executeXCRebase(
    deployer,
    baseChainBridgeContracts.bridge,
    bridgeContractsMap[chain].bridge,
    bridgeContractsMap[chain].genericHandler,
    baseChainAmplContracts.policy,
  );

  // Executing rebase report on sat chain
  await mockOffchain(
    bridgeContractsMap[chain].bridge,
    fromChainID,
    depositNonce,
    resourceID,
    dataHash,
    data,
  );
}

// Executes rebase end to end
async function execXCRebaseE2E (perc, chainSubset = []) {
  const chains =
    chainSubset.length === 0 ? Object.keys(bridgeContractsMap) : chainSubset;

  // Base chain rebase
  await execRebase(
    perc,
    amplContractsMap['base'].rateOracle,
    amplContractsMap['base'].orchestrator,
    amplContractsMap['base'].policy,
    deployer,
  );

  // Report rebase to sat chain
  let b;
  for (b in chains) {
    const chain = chains[b];
    if (chain !== 'base') {
      await execXCReportRebase(chain);
    }
  }

  // Sat chain rebase
  for (b in chains) {
    const chain = chains[b];
    if (chain !== 'base') {
      await amplContractsMap[chain].xcAmpleController.rebase();
    }
  }
}

async function execXCSend (
  fromChain,
  toChain,
  fromAccount,
  toAccount,
  amount,
  setApproval = true,
) {

  if (setApproval) {
    if (fromChain === 'base') {
      await baseChainAmplContracts.ampl
        .connect(fromAccount)
        .approve(bridgeContractsMap[fromChain].tokenVault.address, amount);
    } else {
      await amplContractsMap[fromChain].xcAmple
        .connect(fromAccount)
        .approve(amplContractsMap[fromChain].xcAmpleController.address, amount);
    }
  }

  const policy =
    fromChain === 'base'
      ? amplContractsMap[fromChain].policy
      : amplContractsMap[fromChain].xcAmpleController;
  const fromChainBridge = bridgeContractsMap[fromChain].bridge;
  const toChainBridge = bridgeContractsMap[toChain].bridge;
  const toChainHandler = bridgeContractsMap[toChain].genericHandler;
  const fromChainID = await fromChainBridge._chainID();

  const { data, dataHash, depositNonce, resourceID } = await executeXCTransfer(
    fromAccount,
    await toAccount.getAddress(),
    amount,
    policy,
    fromChainBridge,
    toChainBridge,
    toChainHandler,
  );

  await mockOffchain(
    toChainBridge,
    fromChainID,
    depositNonce,
    resourceID,
    dataHash,
    data,
  );
}

async function getBalancesAndSupply () {
  const userAEthBal = await baseChainAmplContracts.ampl.balanceOf(
    await userABaseChainWallet.getAddress(),
  );
  const userBEthBal = await baseChainAmplContracts.ampl.balanceOf(
    await userBBaseChainWallet.getAddress(),
  );

  const userATronBal = await satChain1AmplContracts.xcAmple.balanceOf(
    await userASatChain1Wallet.getAddress(),
  );
  const userBTronBal = await satChain1AmplContracts.xcAmple.balanceOf(
    await userBSatChain1Wallet.getAddress(),
  );

  const userAAcalaBal = await satChain2AmplContracts.xcAmple.balanceOf(
    await userASatChain2Wallet.getAddress(),
  );
  const userBAcalaBal = await satChain2AmplContracts.xcAmple.balanceOf(
    await userBSatChain2Wallet.getAddress(),
  );

  const sat1Supply = await satChain1AmplContracts.xcAmple.totalSupply();
  const sat2Supply = await satChain2AmplContracts.xcAmple.totalSupply();

  return {
    baseBalances: [userAEthBal, userBEthBal],
    sat1Balances: [userATronBal, userBTronBal],
    sat2Balances: [userAAcalaBal, userBAcalaBal],
    sat1Supply,
    sat2Supply
  };
}

async function checkBalancesAndSupply (
  baseBalances,
  sat1Balances,
  sat1Supply,
  sat2Balances,
  sat2Supply,
) {
  const ROUNDING_ERROR_TOLARANCE = '0.00000001'; // 1e8, 0.00000001 AMPL
  const ROUNDING_ERROR_LIMIT = toAmplFixedPt(ROUNDING_ERROR_TOLARANCE);

  const cmp = (a, b) => {
    try {
      expect(a.sub(b).abs()).to.lte(ROUNDING_ERROR_LIMIT);
    } catch (e) {
      console.error('comparing', a.toString(), b.toString());
      throw e;
    }
  };

  const b = await getBalancesAndSupply();

  let b_;
  for (b_ in baseBalances) {
    cmp(toAmplFixedPt(baseBalances[b_]), b.baseBalances[b_]);
  }

  for (b_ in sat1Balances) {
    cmp(toAmplFixedPt(sat1Balances[b_]), b.sat1Balances[b_]);
  }
  cmp(toAmplFixedPt(sat1Supply), b.sat1Supply);

  for (b_ in sat2Balances) {
    cmp(toAmplFixedPt(sat2Balances[b_]), b.sat2Balances[b_]);
  }

  cmp(toAmplFixedPt(sat2Supply), b.sat2Supply);
}

describe('Rebase scenarios', function () {
  beforeEach(async function () {
    await setupContracts();
    await execXCSend(
      'base',
      'sat1',
      userABaseChainWallet,
      userASatChain1Wallet,
      toAmplFixedPt('2500'),
    );
    await execXCSend(
      'base',
      'sat1',
      userBBaseChainWallet,
      userBSatChain1Wallet,
      toAmplFixedPt('10000'),
    );
    await execXCSend(
      'base',
      'sat2',
      userBBaseChainWallet,
      userBSatChain2Wallet,
      toAmplFixedPt('10000'),
    );
  });

  describe('when neutral rebase is propagated from base chain to satellite chains', function () {
    it('should not-change the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );
      await execXCRebaseE2E(0);
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );
    });
  });

  describe('when +ve rebase is propagated from base chain to satellite chains', function () {
    it('should increase the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );
      await execXCRebaseE2E(+10);
      await checkBalancesAndSupply(
        ['107250', '88000'],
        ['2750', '11000'],
        '13750',
        ['0', '11000'],
        '11000',
      );
    });
  });

  describe('when -ve rebase is propagated from base chain to satellite chains', function () {
    it('should decrease the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );
      await execXCRebaseE2E(-10);
      await checkBalancesAndSupply(
        ['87750', '72000'],
        ['2250', '9000'],
        '11250',
        ['0', '9000'],
        '9000',
      );
    });
  });

  describe('when neutral rebase not reported to the satellite chain, the next rebase', function () {
    it('should not-change the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );

      await execRebase(
        0,
        baseChainAmplContracts.rateOracle,
        baseChainAmplContracts.orchestrator,
        baseChainAmplContracts.policy,
        deployer,
      );

      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );

      await execRebase(
        0,
        baseChainAmplContracts.rateOracle,
        baseChainAmplContracts.orchestrator,
        baseChainAmplContracts.policy,
        deployer,
      );

      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );
    });
  });

  describe('when +ve rebase not reported to the satellite chain, the next rebase', function () {
    it('should update the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );

      // rebase not propagated to sat1
      await execXCRebaseE2E(+10, ['base', 'sat2']);
      await checkBalancesAndSupply(
        ['107250', '88000'],
        ['2500', '10000'],
        '12500',
        ['0', '11000'],
        '11000',
      );

      // all chains get the rebase
      await execXCRebaseE2E(+10);

      await checkBalancesAndSupply(
        ['117975', '96800'],
        ['3025', '12100'],
        '15125',
        ['0', '12100'],
        '12100',
      );
    });
  });

  describe('when -ve rebase not reported to the satellite chain, the next rebase', function () {
    it('should update the satellite chain xc-ample balance', async function () {
      await checkBalancesAndSupply(
        ['97500', '80000'],
        ['2500', '10000'],
        '12500',
        ['0', '10000'],
        '10000',
      );

      // rebase not propagated to sat1
      await execXCRebaseE2E(-10, ['base', 'sat2']);
      await checkBalancesAndSupply(
        ['87750', '72000'],
        ['2500', '10000'],
        '12500',
        ['0', '9000'],
        '9000',
      );

      // all chains get the rebase
      await execXCRebaseE2E(-10);

      await checkBalancesAndSupply(
        ['78975', '64800'],
        ['2025', '8100'],
        '10125',
        ['0', '8100'],
        '8100',
      );
    });
  });
});

describe('Transfers scenarios', function () {
  beforeEach(async function () {
    await setupContracts();
  });

  describe('transfer from base when user has NOT approved the vault', function () {
    it('should revert', async function () {
      await baseChainAmplContracts.ampl
        .connect(userBBaseChainWallet)
        .approve(
          bridgeContractsMap['base'].tokenVault.address,
          toAmplFixedPt('0'),
        );
      await expect(
        execXCSend(
          'base',
          'sat1',
          userBBaseChainWallet,
          userBSatChain1Wallet,
          toAmplFixedPt('5000'),
          false,
        ),
      ).to.be.reverted;
    });
  });

  describe('transfer from base when user has approved the vault', function () {
    it('should NOT revert', async function () {
      await baseChainAmplContracts.ampl
        .connect(userBBaseChainWallet)
        .approve(
          bridgeContractsMap['base'].tokenVault.address,
          toAmplFixedPt('5000'),
        );

      await expect(
        execXCSend(
          'base',
          'sat1',
          userBBaseChainWallet,
          userBSatChain1Wallet,
          toAmplFixedPt('5000'),
          false,
        ),
      ).not.to.be.reverted;
    });
  });

  describe('cross-chain transfer when attacker fudges packed data', function () {
    it('should revert', async function () {
      // userA authorizes vault
      await baseChainAmplContracts.ampl
        .connect(userABaseChainWallet)
        .approve(
          bridgeContractsMap['base'].tokenVault.address,
          toAmplFixedPt('1000'),
        );

      // userB front-runs A, tries to transfer userA's funds to a different wallet
      // on the satellite chain
      const fromChainBridge = baseChainBridgeContracts.bridge;
      const toChainBridge = satChain1BridgeContracts.bridge;
      const senderAddress = await userABaseChainWallet.getAddress();
      const recipientAddress = await userASatChain1Wallet.getAddress();
      const maliciousRecipientAddress = await userBSatChain1Wallet.getAddress();
      const r = await baseChainAmplContracts.policy.globalAmpleforthEpochAndAMPLSupply();

      const correctData = packXCTransferData(
        senderAddress,
        recipientAddress,
        toAmplFixedPt('1000'),
        r[1],
      );

      const maliciousData = packXCTransferData(
        senderAddress,
        maliciousRecipientAddress,
        toAmplFixedPt('1000'),
        r[1],
      );

      await expect(
        fromChainBridge
          .connect(userBBaseChainWallet)
          .deposit(
            await toChainBridge._chainID(),
            XC_TRANSFER_RESOURCE_ID,
            maliciousData,
          ),
      ).to.be.revertedWith('incorrect depositer in the data');

      await expect(
        fromChainBridge
          .connect(userABaseChainWallet)
          .deposit(
            await toChainBridge._chainID(),
            XC_TRANSFER_RESOURCE_ID,
            correctData,
          ),
      ).not.to.be.reverted;
    });
  });

  describe('user transfers from base chain to satellite chain and back', function () {
    it('should update balances correctly', async function () {
      await checkBalancesAndSupply(
        ['100000', '100000'],
        ['0', '0'],
        '0',
        [],
        '0',
      );

      await execXCSend(
        'base',
        'sat1',
        userABaseChainWallet,
        userASatChain1Wallet,
        toAmplFixedPt('5000'),
      );
      await checkBalancesAndSupply(
        ['95000', '100000'],
        ['5000', '0'],
        '5000',
        [],
        '0',
      );

      await execXCSend(
        'base',
        'sat1',
        userBBaseChainWallet,
        userBSatChain1Wallet,
        toAmplFixedPt('25000'),
      );
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['5000', '25000'],
        '30000',
        [],
        '0',
      );

      await execXCSend(
        'sat1',
        'base',
        userASatChain1Wallet,
        userBBaseChainWallet,
        toAmplFixedPt('2500'),
      );
      await checkBalancesAndSupply(
        ['95000', '77500'],
        ['2500', '25000'],
        '27500',
        [],
        '0',
      );

      await execXCSend(
        'sat1',
        'base',
        userBSatChain1Wallet,
        userBBaseChainWallet,
        toAmplFixedPt('24000'),
      );
      await checkBalancesAndSupply(
        ['95000', '101500'],
        ['2500', '1000'],
        '3500',
        [],
        '0',
      );
    });

    describe('user does not approve Vault on base chain', function() {
      it('should revert', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await baseChainAmplContracts.ampl
          .connect(userBBaseChainWallet)
          .approve(
            bridgeContractsMap['base'].tokenVault.address,
            toAmplFixedPt('0'), // Approve 0
          );

        await expect(
          execXCSend(
            'base',
            'sat1',
            userBBaseChainWallet,
            userBSatChain1Wallet,
            toAmplFixedPt('5000'),
            false,  // Use existing approval and don't auto-approve.
          ),
        ).to.be.reverted;
      })
    });

    describe('user does not approve Controller on satellite chain', function() {
      it('should revert', async function () {

        // Setup by placing amples on satellite chain
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        // Test transfer from satellite chain
        await amplContractsMap['sat1'].xcAmple
          .connect(userASatChain1Wallet)
          .approve(
            amplContractsMap['sat1'].xcAmpleController.address,
            toAmplFixedPt('0'),  // Approve 0
          );
        await expect(
          execXCSend(
            'sat1',
            'base',
            userASatChain1Wallet,
            userABaseChainWallet,
            toAmplFixedPt('1'),
            false,  // Use existing approval and don't auto-approve.
          ),
        ).to.be.reverted;
      });
    });
  });

  describe('user transfers from base chain to satellite chain and back around rebase', function () {
    describe('neutral rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(+0);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(+0);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await checkBalancesAndSupply(
          ['97500', '100000'],
          ['2500', '0'],
          '2500',
          [],
          '0',
        );
      });
    });

    describe('neutral rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(+0, ['base']);
        await execXCReportRebase(['sat1']);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(+0, ['base']);
        await execXCReportRebase(['sat1']);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['97500', '100000'],
          ['2500', '0'],
          '2500',
          [],
          '0',
        );
      });
    });

    describe('neutral rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await execXCRebaseE2E(+0);
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await execXCRebaseE2E(+0);
        await checkBalancesAndSupply(
          ['97500', '100000'],
          ['2500', '0'],
          '2500',
          [],
          '0',
        );
      });
    });
  });

  describe('user transfers from base chain to satellite chain and back around rebase', function () {
    describe('+ve rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(+10);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await checkBalancesAndSupply(
          ['105000', '110000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(+10);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await checkBalancesAndSupply(
          ['118000', '121000'],
          ['3000', '0'],
          '3000',
          [],
          '0',
        );
      });
    });

    describe('+ve rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(+10, ['base']);
        await execXCReportRebase(['sat1']);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['105000', '110000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(+10, ['base']);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await execXCReportRebase(['sat1']);
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['118250', '121000'],
          ['2750', '0'],
          '2750',
          [],
          '0',
        );
      });
    });

    describe('+ve rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await execXCRebaseE2E(+10);
        await checkBalancesAndSupply(
          ['104500', '110000'],
          ['5500', '0'],
          '5500',
          [],
          '0',
        );

        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await execXCRebaseE2E(+10);
        await checkBalancesAndSupply(
          ['117700', '121000'],
          ['3300', '0'],
          '3300',
          [],
          '0',
        );
      });
    });
  });

  describe('user transfers from base chain to satellite chain and back around rebase', function () {
    describe('-ve rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(-10);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await checkBalancesAndSupply(
          ['85000', '90000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(-10);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await checkBalancesAndSupply(
          ['79000', '81000'],
          ['2000', '0'],
          '2000',
          [],
          '0',
        );
      });
    });

    describe('-ve rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCRebaseE2E(-10, ['base']);
        await execXCReportRebase(['sat1']);
        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['85000', '90000'],
          ['5000', '0'],
          '5000',
          [],
          '0',
        );

        await execXCRebaseE2E(-10, ['base']);
        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await execXCReportRebase(['sat1']);
        await satChain1AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['78750', '81000'],
          ['2250', '0'],
          '2250',
          [],
          '0',
        );
      });
    });

    describe('-ve rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['100000', '100000'],
          ['0', '0'],
          '0',
          [],
          '0',
        );

        await execXCSend(
          'base',
          'sat1',
          userABaseChainWallet,
          userASatChain1Wallet,
          toAmplFixedPt('5000'),
        );
        await execXCRebaseE2E(-10);
        await checkBalancesAndSupply(
          ['85500', '90000'],
          ['4500', '0'],
          '4500',
          [],
          '0',
        );

        await execXCSend(
          'sat1',
          'base',
          userASatChain1Wallet,
          userABaseChainWallet,
          toAmplFixedPt('2500'),
        );
        await execXCRebaseE2E(-10);
        await checkBalancesAndSupply(
          ['79200', '81000'],
          ['1800', '0'],
          '1800',
          [],
          '0',
        );
      });
    });
  });

  describe('user transfers from satellite chain to another satellite chain and back', function () {
    beforeEach(async function () {
      await execXCSend(
        'base',
        'sat1',
        userABaseChainWallet,
        userASatChain1Wallet,
        toAmplFixedPt('5000'),
      );
      await execXCSend(
        'base',
        'sat1',
        userBBaseChainWallet,
        userBSatChain1Wallet,
        toAmplFixedPt('25000'),
      );
    });

    it('should update balances correctly', async function () {
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['5000', '25000'],
        '30000',
        ['0', '0'],
        '0',
      );

      await execXCSend(
        'sat1',
        'sat2',
        userASatChain1Wallet,
        userASatChain2Wallet,
        toAmplFixedPt('1000'),
      );
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['4000', '25000'],
        '29000',
        ['1000', '0'],
        '1000',
      );

      await execXCSend(
        'sat1',
        'sat2',
        userBSatChain1Wallet,
        userBSatChain2Wallet,
        toAmplFixedPt('5000'),
      );
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['4000', '20000'],
        '24000',
        ['1000', '5000'],
        '6000',
      );

      await execXCSend(
        'sat2',
        'sat1',
        userASatChain2Wallet,
        userASatChain1Wallet,
        toAmplFixedPt('500'),
      );
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['4500', '20000'],
        '24500',
        ['500', '5000'],
        '5500',
      );

      await execXCSend(
        'sat2',
        'sat1',
        userBSatChain2Wallet,
        userBSatChain1Wallet,
        toAmplFixedPt('5000'),
      );
      await checkBalancesAndSupply(
        ['95000', '75000'],
        ['4500', '25000'],
        '29500',
        ['500', '0'],
        '500',
      );
    });
  });

  describe('user transfers from satellite chain to another satellite chain and back around rebase', function () {
    beforeEach(async function () {
      await execXCSend(
        'base',
        'sat1',
        userABaseChainWallet,
        userASatChain1Wallet,
        toAmplFixedPt('5000'),
      );
    });

    describe('neutral rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(+0);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4000', '0'],
          '4000',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(+0);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4500', '0'],
          '4500',
          ['500', '0'],
          '500',
        );
      });
    });

    describe('neutral rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(+0, ['base', 'sat1']);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4000', '0'],
          '4000',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(+0, ['base', 'sat1']);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4500', '0'],
          '4500',
          ['500', '0'],
          '500',
        );
      });
    });

    describe('neutral rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCRebaseE2E(+0);
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4000', '0'],
          '4000',
          ['1000', '0'],
          '1000',
        );

        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCRebaseE2E(+0);
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['4500', '0'],
          '4500',
          ['500', '0'],
          '500',
        );
      });
    });
  });

  describe('user transfers from satellite chain to satellite chain and back around rebase', function () {
    beforeEach(async function () {
      await execXCSend(
        'base',
        'sat1',
        userABaseChainWallet,
        userASatChain1Wallet,
        toAmplFixedPt('5000'),
      );
    });

    describe('+ve rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(+10);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await checkBalancesAndSupply(
          ['104500', '110000'],
          ['4500', '0'],
          '4500',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(+10);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await checkBalancesAndSupply(
          ['114950', '121000'],
          ['5450', '0'],
          '5450',
          ['600', '0'],
          '600',
        );
      });
    });

    describe('+ve rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(+10, ['base', 'sat1']);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['104500', '110000'],
          ['4500', '0'],
          '4500',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(+10, ['base', 'sat1']);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['114950', '121000'],
          ['5500', '0'],
          '5500',
          ['550', '0'],
          '550',
        );
      });
    });

    describe('+ve rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCRebaseE2E(+10);
        await checkBalancesAndSupply(
          ['104500', '110000'],
          ['4400', '0'],
          '4400',
          ['1100', '0'],
          '1100',
        );

        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCRebaseE2E(+10);
        await checkBalancesAndSupply(
          ['114950', '121000'],
          ['5390', '0'],
          '5390',
          ['660', '0'],
          '660',
        );
      });
    });
  });

  describe('user transfers from satellite chain to satellite chain and back around rebase', function () {
    beforeEach(async function () {
      await execXCSend(
        'base',
        'sat1',
        userABaseChainWallet,
        userASatChain1Wallet,
        toAmplFixedPt('5000'),
      );
    });

    describe('-ve rebase finalized before transaction initiated on the source', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(-10);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await checkBalancesAndSupply(
          ['85500', '90000'],
          ['3500', '0'],
          '3500',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(-10);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await checkBalancesAndSupply(
          ['76950', '81000'],
          ['3650', '0'],
          '3650',
          ['400', '0'],
          '400',
        );
      });
    });

    describe('-ve rebase finalized before transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCRebaseE2E(-10, ['base', 'sat1']);
        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['85500', '90000'],
          ['3500', '0'],
          '3500',
          ['1000', '0'],
          '1000',
        );

        await execXCRebaseE2E(-10, ['base', 'sat1']);
        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCReportRebase(['sat2']);
        await satChain2AmplContracts.xcAmpleController.rebase();
        await checkBalancesAndSupply(
          ['76950', '81000'],
          ['3600', '0'],
          '3600',
          ['450', '0'],
          '450',
        );
      });
    });

    describe('-ve rebase finalized after transaction finalized on the target', function () {
      it('should update balances correctly', async function () {
        await checkBalancesAndSupply(
          ['95000', '100000'],
          ['5000', '0'],
          '5000',
          ['0', '0'],
          '0',
        );

        await execXCSend(
          'sat1',
          'sat2',
          userASatChain1Wallet,
          userASatChain2Wallet,
          toAmplFixedPt('1000'),
        );
        await execXCRebaseE2E(-10);
        await checkBalancesAndSupply(
          ['85500', '90000'],
          ['3600', '0'],
          '3600',
          ['900', '0'],
          '900',
        );

        await execXCSend(
          'sat2',
          'sat1',
          userASatChain2Wallet,
          userASatChain1Wallet,
          toAmplFixedPt('500'),
        );
        await execXCRebaseE2E(-10);
        await checkBalancesAndSupply(
          ['76950', '81000'],
          ['3690', '0'],
          '3690',
          ['360', '0'],
          '360',
        );
      });
    });
  });
});
