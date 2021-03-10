const ethers = require('ethers');

const { task } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');

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

  depositKey(sourceChainID, e) {
    return `${sourceChainID}-${e.depositNonce.toNumber()}`;
  }

  recordDeposit(sourceChainID, e) {
    this.depositData[this.depositKey(sourceChainID, e)] = {
      sourceChainID,
      destinationChainID: e.destinationChainID.toString(),
      depositNonce: e.depositNonce.toString(),
      executionStatus: 0,
      votes: 0,
    };
  }

  recordProposal(e) {
    const d = this.depositData[this.depositKey(e.originChainID, e)];
    d.executionStatus = e.status;
  }

  recordVote(e) {
    const d = this.depositData[this.depositKey(e.originChainID, e)];
    d.votes++;
  }
}

task('info:chain_bridge', 'Prints AMPL token data from given networks')
  .addParam('networks', 'List of hardhat networks', [], types.json)
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

      const chainID = await bridge._chainID();
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

      console.log('ChainID:', chainID);
      console.log('RelayerThreshold:', relayerThreshold.toNumber());
      console.log('Fee:', ethers.utils.formatEther(fee));
      console.log('Expiry:', expiry.toNumber());
      console.log('Paused:', paused);
      console.log('Relayers:', relayers);

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

    bd.rollupData();

    console.log(
      '---------------------------------------------------------------',
    );
    console.table(bd.depositData);
    console.log(
      '---------------------------------------------------------------',
    );
  });
