const ethers = require('ethers');
const {
  getAdminAddress,
  getImplementationAddress,
} = require('@openzeppelin/upgrades-core');

const { task } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');

const { toAmplFloatingPt } = require('../../sdk/ampleforth');

task('info:ampl', 'Prints AMPL token data from given networks')
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam('bridge', 'Name of the bridge')
  .setAction(async (args, hre) => {
    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);

      console.log('---------------------------------------------------------');
      console.log(
        chainAddresses.isBaseChain ? 'BaseChain' : 'SatelliteChain',
        network,
        '\tBridge:' + args.bridge,
      );

      if (chainAddresses.isBaseChain) {
        const ampl = await getDeployedContractInstance(
          network,
          'ampl',
          provider,
        );
        const policy = await getDeployedContractInstance(
          network,
          'policy',
          provider,
        );
        const tokenVault = await getDeployedContractInstance(
          network,
          `${args.bridge}/tokenVault`,
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await policy.globalAmpleforthEpochAndAMPLSupply();
        const circulatingSupply = await ampl.totalSupply();
        const totalLocked = await tokenVault.totalLocked(ampl.address);
        console.log('Global epoch:', globalAmpleforthEpoch.toString());
        console.log('Global supply:', toAmplFloatingPt(globalAMPLSupply));
        console.log(
          'Network circulating supply:',
          toAmplFloatingPt(circulatingSupply),
        );
        console.log('Total locked in bridge:', toAmplFloatingPt(totalLocked));
      } else {
        const xcAmple = await getDeployedContractInstance(
          network,
          'xcAmple',
          provider,
        );
        const xcAmpleController = await getDeployedContractInstance(
          network,
          'xcAmpleController',
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await xcAmpleController.globalAmpleforthEpochAndAMPLSupply();
        const circulatingSupply = await xcAmple.totalSupply();
        console.log('Global epoch:', globalAmpleforthEpoch.toString());
        console.log('Global supply:', toAmplFloatingPt(globalAMPLSupply));
        console.log(
          'Network circulating supply:',
          toAmplFloatingPt(circulatingSupply),
        );
      }
    }
    console.log('---------------------------------------------------------');
  });

task('info:ampl:balance', 'Prints AMPL token balance from given networks')
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam('wallet', 'The wallet to check')
  .setAction(async (args, hre) => {
    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);

      console.log('---------------------------------------------------------');
      console.log(
        chainAddresses.isBaseChain ? 'BaseChain' : 'SatelliteChain',
        network,
      );

      if (chainAddresses.isBaseChain) {
        const ampl = await getDeployedContractInstance(
          network,
          'ampl',
          provider,
        );
        const policy = await getDeployedContractInstance(
          network,
          'policy',
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await policy.globalAmpleforthEpochAndAMPLSupply();
        const balance = await ampl.balanceOf(args.wallet);
        console.log('Global supply:', toAmplFloatingPt(globalAMPLSupply));
        console.log(`Balance(${args.wallet}):`, toAmplFloatingPt(balance));
      } else {
        const xcAmple = await getDeployedContractInstance(
          network,
          'xcAmple',
          provider,
        );
        const xcAmpleController = await getDeployedContractInstance(
          network,
          'xcAmpleController',
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await xcAmpleController.globalAmpleforthEpochAndAMPLSupply();
        const balance = await xcAmple.balanceOf(args.wallet);
        console.log('Global supply:', toAmplFloatingPt(globalAMPLSupply));
        console.log(`Balance(${args.wallet}):`, toAmplFloatingPt(balance));
      }
      console.log('---------------------------------------------------------');
    }
  });

task(
  'info:ampl:setup',
  'Prints AMPL configuration paramters from given networks',
)
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .setAction(async (args, hre) => {
    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);

      console.log('---------------------------------------------------------');
      console.log(
        chainAddresses.isBaseChain ? 'BaseChain' : 'SatelliteChain',
        network,
      );

      if (chainAddresses.isBaseChain) {
        const ampl = await getDeployedContractInstance(
          network,
          'ampl',
          provider,
        );
        const policy = await getDeployedContractInstance(
          network,
          'policy',
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await policy.globalAmpleforthEpochAndAMPLSupply();
        console.log('AMPL:', ampl.address);
        console.log('AMPL:policy:', await ampl.monetaryPolicy());
        console.log(
          'AMPL:totalSupply:',
          toAmplFloatingPt(await ampl.totalSupply()),
        );
        console.log('Policy:', policy.address);
        console.log('Policy:epoch:', globalAmpleforthEpoch.toString());
        console.log('Policy:globalSupply:', toAmplFloatingPt(globalAMPLSupply));
      } else {
        const proxyAdmin = await getDeployedContractInstance(
          network,
          'proxyAdmin',
          provider,
        );
        const xcAmple = await getDeployedContractInstance(
          network,
          'xcAmple',
          provider,
        );
        const xcAmpleController = await getDeployedContractInstance(
          network,
          'xcAmpleController',
          provider,
        );
        const rebaseRelayer = await getDeployedContractInstance(
          network,
          'rebaseRelayer',
          provider,
        );
        const [
          globalAmpleforthEpoch,
          globalAMPLSupply,
        ] = await xcAmpleController.globalAmpleforthEpochAndAMPLSupply();

        let gatewayWhitelist = {};
        try {
          // This fails for BSC
          const whitelistEvents = await xcAmpleController.queryFilter(
            await xcAmpleController.filters.GatewayWhitelistUpdated(),
            chainAddresses['xcAmple'].blockNumber,
          );
          gatewayWhitelist = whitelistEvents.reduce((m, e) => {
            m[e.args.bridgeGateway] = e.args.active;
            return m;
          }, {});
        } catch (e) {
          console.error('Failed to fetch whitelist, verify manually!');
          console.log(e.message)
        }

        console.log('ProxyAdmin:', proxyAdmin.address);
        console.log('ProxyAdmin:onwer', await proxyAdmin.owner());
        console.log('XCAmple:', xcAmple.address);
        console.log(
          'XCAmple:proxyAdmin',
          await getAdminAddress(provider, xcAmple.address),
        );
        console.log(
          'XCAmple:implementation',
          await getImplementationAddress(provider, xcAmple.address),
        );

        console.log('XCAmple:owner:', await xcAmple.owner());
        console.log('XCAmple:controller:', await xcAmple.controller());
        console.log(
          'XCAmple:totalSupply:',
          toAmplFloatingPt(await xcAmple.totalSupply()),
        );

        console.log('XCAmpleController:', xcAmpleController.address);
        console.log(
          'XCAmpleController:proxyAdmin',
          await getAdminAddress(provider, xcAmpleController.address),
        );
        console.log(
          'XCAmpleController:implementation',
          await getImplementationAddress(provider, xcAmpleController.address),
        );

        console.log('XCAmpleController:owner', await xcAmpleController.owner());
        console.log(
          'XCAmpleController:xcAmple',
          await xcAmpleController.xcAmple(),
        );
        console.log(
          'XCAmpleController:epoch',
          globalAmpleforthEpoch.toString(),
        );
        console.log(
          'XCAmpleController:totalSupply',
          toAmplFloatingPt(globalAMPLSupply),
        );
        console.log('XCAmpleController:gatewayWhitelist', gatewayWhitelist);
        console.log(
          'XCAmpleController:rebaseRelayer',
          await xcAmpleController.rebaseRelayer(),
        );

        console.log('RebaseRelayer:', rebaseRelayer.address);
        console.log('RebaseRelayer:owner', await rebaseRelayer.owner());
        const transactionsSize = (
          await rebaseRelayer.transactionsSize()
        ).toNumber();
        console.log('RebaseRelayer:transactionsSize', transactionsSize);
        for (let i = 0; i < transactionsSize; i++) {
          const tx = await rebaseRelayer.transactions(i);
          console.log(`RebaseRelayer:transaction(${i}):`);
          console.log('\tdestination:', tx.destination);
          console.log('\tdata:', tx.data);
          console.log('\tenabled:', tx.enabled);
        }
      }
      console.log('---------------------------------------------------------');
    }
  });
