const ethers = require('ethers');
const _ = require('underscore');

const { task } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  readDeploymentData,
  getDeployedContractInstance,
  filterContractEvents,
} = require('../../helpers/contracts');

const { XC_TRANSFER_RESOURCE_ID } = require('../../sdk/chain_bridge');

task(
  'info:cb_ampl_tx',
  'Generates csv with the ampl cross chain transfer history',
)
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam('outputCsvPath', 'The path to the final csv files')
  .setAction(async (args, hre) => {
    let allTransferOuts = [];
    let allTransferDeposits = [];
    let allTransferIns = [];
    let allTransferProposals = [];

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

      const queryTimeFrame = network.toLowerCase().includes('bsc')
        ? 12 * 3600
        : 7 * 24 * 3600;
      const endBlock = await provider.getBlockNumber();

      const bridge = await getDeployedContractInstance(
        network,
        'chainBridge/bridge',
        provider,
      );

      const chainID = await bridge._chainID();

      const handler = await getDeployedContractInstance(
        network,
        'chainBridge/genericHandler',
        provider,
      );

      const gateway = await getDeployedContractInstance(
        network,
        'chainBridge/transferGateway',
        provider,
      );

      const transferOuts = await filterContractEvents(
        ethers,
        provider,
        gateway.address,
        gateway.interface.format(),
        'XCTransferOut',
        chainAddresses['chainBridge/transferGateway'].blockNumber,
        endBlock,
        queryTimeFrame,
      );
      console.log('TransferOuts', transferOuts.length);

      const transferIns = await filterContractEvents(
        ethers,
        provider,
        gateway.address,
        gateway.interface.format(),
        'XCTransferIn',
        chainAddresses['chainBridge/transferGateway'].blockNumber,
        endBlock,
        queryTimeFrame,
      );
      console.log('TransferIns', transferIns.length);

      let deposits = await filterContractEvents(
        ethers,
        provider,
        bridge.address,
        bridge.interface.format(),
        'Deposit',
        chainAddresses['chainBridge/bridge'].blockNumber,
        endBlock,
        queryTimeFrame,
      );
      deposits = _.map(deposits, (d) => {
        d.originChainID = chainID;
        return d;
      });
      console.log('Deposits', deposits.length);

      let proposals = await filterContractEvents(
        ethers,
        provider,
        bridge.address,
        bridge.interface.format(),
        'ProposalEvent',
        chainAddresses['chainBridge/bridge'].blockNumber,
        endBlock,
        queryTimeFrame,
      );
      proposals = _.map(proposals, (d) => {
        d.destinationChainID = chainID;
        return d;
      });
      console.log('Proposals', proposals.length);

      allTransferOuts = allTransferOuts.concat(transferOuts);
      allTransferIns = allTransferIns.concat(transferIns);
      allTransferDeposits = allTransferDeposits.concat(deposits);
      allTransferProposals = allTransferProposals.concat(proposals);
    }

    // Filter
    allTransferDeposits = allTransferDeposits.filter((d) => {
      return d.parsed.args.resourceID == XC_TRANSFER_RESOURCE_ID;
    });
    allTransferProposals = allTransferProposals.filter((d) => {
      return d.parsed.args.resourceID == XC_TRANSFER_RESOURCE_ID;
    });

    const fs = require('fs');
    fs.writeFileSync(
      'allTransferOuts.json',
      JSON.stringify(allTransferOuts, null, 2),
    );
    fs.writeFileSync(
      'allTransferIns.json',
      JSON.stringify(allTransferIns, null, 2),
    );
    fs.writeFileSync(
      'allTransferDeposits.json',
      JSON.stringify(allTransferDeposits, null, 2),
    );
    fs.writeFileSync(
      'allTransferProposals.json',
      JSON.stringify(allTransferProposals, null, 2),
    );

    const xcDepositTxHashesLookup = _.reduce(
      allTransferOuts,
      (m, v) => {
        m[v.transactionHash] = true;
        return m;
      },
      {},
    );

    const transferPhase1 = _.chain(allTransferOuts)
      .concat(allTransferDeposits)
      .groupBy((d) => d.transactionHash)
      .pick((v, k) => xcDepositTxHashesLookup[k])
      .map((v, k) => {
        return {
          transactionHash: k,
          ..._.pick(
            v[0].parsed.args,
            'sender',
            'amount',
            'recordedGlobalAMPLSupply',
          ),
          ..._.pick(
            v[1].parsed.args,
            'destinationChainID',
            'resourceID',
            'depositNonce',
          ),
          originChainID: v[1].originChainID,
        };
      })
      .reduce((m, v) => {
        m[`${v.originChainID}-${v.destinationChainID}-${v.depositNonce}`] = v;
        return m;
      }, {})
      .value();

    const xcProposalTxHashesLookup = _.reduce(
      allTransferIns,
      (m, v) => {
        m[v.transactionHash] = true;
        return m;
      },
      {},
    );

    const transferPhase2 = _.chain(allTransferIns)
      .concat(allTransferProposals)
      .groupBy((d) => d.transactionHash)
      .pick((v, k) => xcProposalTxHashesLookup[k])
      .map((v, k) => {
        return {
          transactionHash: k,
          ..._.pick(
            v[0].parsed.args,
            'recipient',
            'globalAMPLSupply',
            'amount',
            'recordedGlobalAMPLSupply',
          ),
          ..._.pick(
            v[v.length - 1].parsed.args,
            'originChainID',
            'resourceID',
            'depositNonce',
          ),
          destinationChainID: v[v.length - 1].destinationChainID,
        };
      })
      .reduce((m, v) => {
        m[`${v.originChainID}-${v.destinationChainID}-${v.depositNonce}`] = v;
        return m;
      }, {})
      .value();

    const dt = _.chain(transferPhase1)
      .mapObject((v, k) => {
        const p = transferPhase2[k] || {};
        return {
          index: k,
          depositTransactionHash: v.transactionHash,
          sender: v.sender,
          depositAmount: v.amount.toString(),
          totalSupplyAtDeposit: v.recordedGlobalAMPLSupply.toString(),

          recipient: p.recipient,
          proposalTransactionHash: p.transactionHash,
          recievedAmount: p.amount ? p.amount.toString() : '0',
          totalSupplyOnSource: p.recordedGlobalAMPLSupply
            ? p.recordedGlobalAMPLSupply.toString()
            : '0',
          totalSupplyOnTarget: p.globalAMPLSupply
            ? p.globalAMPLSupply.toString()
            : '0',
        };
      })
      .values()
      .value();

    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const csvWriter = createCsvWriter({
      path: args.outputCsvPath,
      header: [
        { id: 'index', title: 'index' },
        { id: 'depositTransactionHash', title: 'depositTransactionHash' },
        { id: 'sender', title: 'sender' },
        { id: 'depositAmount', title: 'depositAmount' },
        { id: 'totalSupplyAtDeposit', title: 'totalSupplyAtDeposit' },
        { id: 'recipient', title: 'recipient' },
        { id: 'proposalTransactionHash', title: 'proposalTransactionHash' },
        { id: 'recievedAmount', title: 'recievedAmount' },
        { id: 'totalSupplyOnSource', title: 'totalSupplyOnSource' },
        { id: 'totalSupplyOnTarget', title: 'totalSupplyOnTarget' },
      ],
    });
    await csvWriter.writeRecords(dt);
    console.log('Output written to :', args.outputCsvPath);
  });
