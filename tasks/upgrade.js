const { types } = require('hardhat/config');
const { txTask, loadSignerSync, etherscanVerify } = require('../helpers/tasks');
const {
  getDeployedContractInstance,
  upgradeProxyContract,
} = require('../helpers/contracts');

txTask(
  'upgrade:xc_ample',
  'Uprades the implementation of the xc-ample ERC-20 contract',
)
  .addParam('force', 'Skip storage layout verification', false, types.boolean)
  .setAction(async (args, hre) => {
    const txParams = { gasPrice: args.gasPrice, gasLimit: args.gasLimit };
    if (txParams.gasPrice == 0) {
      txParams.gasPrice = await hre.ethers.provider.getGasPrice();
    }

    const deployer = await loadSignerSync(args, hre.ethers.provider);
    const deployerAddress = await deployer.getAddress();

    console.log('------------------------------------------------------------');
    console.log('Deployer:', deployerAddress);
    console.log(txParams);

    console.log('------------------------------------------------------------');
    console.log('Upgrading xc-ample contract');
    const newImpl = await upgradeProxyContract(
      hre.ethers,
      hre.network.name,
      'XCAmple',
      'xcAmple',
      deployer,
      txParams,
      args.force,
    );

    console.log('------------------------------------------------------------');
    console.log('Verify on etherscan');
    await etherscanVerify(hre, newImpl.address);
  });
