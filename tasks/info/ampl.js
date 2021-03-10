const ethers = require('ethers');

const { task } = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  readDeploymentData,
  getDeployedContractInstance,
} = require('../../helpers/contracts');

const { toAmplFloatingPt } = require('../../sdk/ampleforth');

task('info:ampl', 'Prints AMPL token data from given networks')
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
        '\tBridge: chainBridge',
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
          'chainBridge/tokenVault',
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
        '\tBridge: chainBridge',
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
