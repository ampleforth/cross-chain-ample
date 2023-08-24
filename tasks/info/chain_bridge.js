const ethers = require('ethers');

const { task } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');
const {
  XC_REBASE_RESOURCE_ID,
  XC_TRANSFER_RESOURCE_ID,
} = require('../../sdk/chain_bridge');

class BridgeData {
  constructor() {
    this.depositData = {};
    this.deposits = {};
    this.proposals = {};
    this.votes = {};
  }

  load(chainID, deposits, proposals, votes) {
    this.deposits[chainID] = deposits;
    this.proposals[chainID] = proposals;
    this.votes[chainID] = votes;
  }

  rollupData() {
    const chains = Object.keys(this.deposits);
    for (const c in chains) {
      const chainID = chains[c];
      this.deposits[chainID].map((d) => this.recordDeposit(chainID, d));
    }
    for (const c in chains) {
      const chainID = chains[c];
      this.proposals[chainID].map((d) => this.recordProposal(d));
    }
    for (const c in chains) {
      const chainID = chains[c];
      this.votes[chainID].map((d) => this.recordVote(d));
    }
  }

  depositKey(originDomainID, e) {
    return `${originDomainID}-${e.depositNonce.toNumber()}`;
  }

  recordDeposit(originDomainID, e) {
    this.depositData[this.depositKey(originDomainID, e)] = {
      originDomainID,
      destinationDomainID: `${e.destinationDomainID}`,
      depositNonce: e.depositNonce.toString(),
      executionStatus: 0,
      votes: 0,
    };
  }

  recordProposal(e) {
    const k = this.depositKey(e.originDomainID, e);
    let d = this.depositData[k];
    if (!d) {
      d = this.depositData[k] = {
        originDomainID: `${e.originDomainID}`,
        depositNonce: e.depositNonce.toString(),
        executionStatus: 0,
        votes: 0,
      };
    }
    d.executionStatus = e.status;
  }

  recordVote(e) {
    const k = this.depositKey(e.originDomainID, e);
    const d = this.depositData[k];
    d.votes++;
  }
}

task('info:chain_bridge', 'Prints AMPL token data from given networks')
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam(
    'getHistory',
    'List history of cross-chain transactions',
    false,
    types.boolean,
  )
  .setAction(async (args, hre) => {
    const bridgeData = {};
    const bd = new BridgeData();

    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);

      console.log(
        '---------------------------------------------------------------',
      );
      console.log(
        chainAddresses.isBaseChain ? 'BaseChain' : 'SatelliteChain',
        network,
      );

      const bridge = await getDeployedContractInstance(
        network,
        'chainBridge/bridge',
        provider,
      );
      const genericHandler = await getDeployedContractInstance(
        network,
        'chainBridge/genericHandler',
        provider,
      );
      const rebaseGateway = await getDeployedContractInstance(
        network,
        'chainBridge/rebaseGateway',
        provider,
      );
      const transferGateway = await getDeployedContractInstance(
        network,
        'chainBridge/transferGateway',
        provider,
      );

      const chainID = await bridge._domainID();
      const relayerThreshold = await bridge._relayerThreshold();
      const fee = await bridge._fee();
      const expiry = await bridge._expiry();
      const paused = await bridge.paused();
      const relayerCount = await bridge._totalRelayers();
      const relayerRole = await bridge.RELAYER_ROLE();
      const relayers = [];
      for (let i = 0; i < relayerCount.toNumber(); i++) {
        relayers.push(await bridge.getRoleMember(relayerRole, i));
      }

      console.log('Bridge:', bridge.address);
      console.log('ChainID:', chainID);
      console.log('RelayerThreshold:', relayerThreshold);
      console.log('Fee:', ethers.utils.formatEther(fee));
      console.log('Expiry:', expiry);
      console.log('Paused:', paused);
      console.log('Relayers:', relayers);

      console.log(
        'genericHandler:bridge',
        await genericHandler._bridgeAddress(),
      );
      console.log(
        'genericHandler:rebaseContractRef',
        await genericHandler._resourceIDToContractAddress(
          XC_REBASE_RESOURCE_ID,
        ),
      );
      console.log(
        'genericHandler:rebaseResourceId',
        await genericHandler._contractAddressToResourceID(
          rebaseGateway.address,
        ),
      );
      console.log(
        'genericHandler:rebaseDepositFunctionSignature',
        await genericHandler._contractAddressToDepositFunctionSignature(
          rebaseGateway.address,
        ),
      );
      console.log(
        'genericHandler:rebaseExecutionFunctionSignature',
        await genericHandler._contractAddressToExecuteFunctionSignature(
          rebaseGateway.address,
        ),
      );
      console.log(
        'genericHandler:rebaseOffset',
        (
          await genericHandler._contractAddressToDepositFunctionDepositorOffset(
            rebaseGateway.address,
          )
        ).toNumber(),
      );
      console.log(
        'genericHandler:transferContractRef',
        await genericHandler._resourceIDToContractAddress(
          XC_TRANSFER_RESOURCE_ID,
        ),
      );
      console.log(
        'genericHandler:transferResourceId',
        await genericHandler._contractAddressToResourceID(
          transferGateway.address,
        ),
      );
      console.log(
        'genericHandler:transferDepositFunctionSignature',
        await genericHandler._contractAddressToDepositFunctionSignature(
          transferGateway.address,
        ),
      );
      console.log(
        'genericHandler:transferExecutionFunctionSignature',
        await genericHandler._contractAddressToExecuteFunctionSignature(
          transferGateway.address,
        ),
      );
      console.log(
        'genericHandler:transferOffset',
        (
          await genericHandler._contractAddressToDepositFunctionDepositorOffset(
            transferGateway.address,
          )
        ).toNumber(),
      );

      if (args.getHistory) {
        const startBlock = ethers.utils.hexlify(
          chainAddresses['chainBridge/bridge'].blockNumber,
        );
        const depositLogs = await bridge.queryFilter('Deposit', startBlock);
        const deposits = depositLogs.map((d) => d.args);
        const proposalLogs = await bridge.queryFilter(
          'ProposalEvent',
          startBlock,
        );
        const proposals = proposalLogs.map((d) => d.args);
        const voteLogs = await bridge.queryFilter('ProposalVote', startBlock);
        const votes = voteLogs.map((d) => d.args);
        bd.load(chainID, deposits, proposals, votes);
      }
    }

    bd.rollupData();

    console.log(
      '---------------------------------------------------------------',
    );
    console.table(bd.depositData);
    console.log(
      '---------------------------------------------------------------',
    );
  });
