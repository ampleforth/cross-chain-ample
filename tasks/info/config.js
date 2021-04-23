const {
  types,
  task,
  txTask,
  cbDeployTask,
  loadSignerSync,
} = require('../../helpers/tasks');
const { getEthersProvider } = require('../../helpers/utils');
const {
  deployContract,
  getDeployedContractInstance,
  readDeploymentData,
  writeDeploymentData,
} = require('../../helpers/contracts');

task('config:chain_bridge', 'Generates chian_bridge config file')
  .addParam('networks', 'List of hardhat networks', [], types.json)
  .addParam('relayerAddress', 'Address of the relayer')
  .setAction(async (args, hre) => {
    const chains = [];
    for (let n in args.networks) {
      const network = args.networks[n];
      const chainAddresses = await readDeploymentData(network);
      const provider = getEthersProvider(network);
      const bridge = await getDeployedContractInstance(
        network,
        'chainBridge/bridge',
        provider,
      );
      const chainID = await bridge._chainID();
      chains.push({
        name: network,
        type: 'ethereum',
        id: `${chainID}`,
        endpoint: '[INSERT LIGHT NODE ENDPOINT]',
        from: args.relayerAddress,
        opts: {
          bridge: chainAddresses['chainBridge/bridge'].address,
          genericHandler: chainAddresses['chainBridge/genericHandler'].address,
          erc20Handler: chainAddresses['chainBridge/erc20Handler'].address,
          erc721Handler: chainAddresses['chainBridge/erc721Handler'].address,
          startBlock: `${(
            chainAddresses['chainBridge/bridge'].blockNumber || 0
          ).toString()}`,
          http: 'true',
        },
      });
    }
    const chainBridgeConfig = { chains };
    console.log(JSON.stringify(chainBridgeConfig, null, 2));
  });
