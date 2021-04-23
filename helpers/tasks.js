const fs = require('fs');
const { types } = require('hardhat/config');
const { task } = require('hardhat/config');

function txTask(name, desc) {
  return task(name, desc)
    .addParam(
      'gasPrice',
      'Gas price for the transaction',
      25000000000,
      types.int,
    )
    .addParam('gasLimit', 'Gas limit for the transaction', 7000000, types.int)
    .addParam('txSleepSec', 'Time to wait between transactions', 2, types.int)
    .addParam('keyfile', 'The path to signer keyfile')
    .addParam('passphrase', 'The passphrase to unlock keyfile');
}

function cbDeployTask(name, desc) {
  return txTask(name, desc)
    .addOptionalParam('chainId', 'Chain ID for the instance', 100, types.int)
    .addOptionalParam(
      'relayers',
      'Array of initial relayer address strings',
      [],
      types.json,
    )
    .addOptionalParam(
      'relayerThreshold',
      'Number of votes required for a proposal to pass',
      1,
      types.int,
    )
    .addOptionalParam(
      'fee',
      'Fee to be taken when making a deposit',
      0,
      types.int,
    )
    .addOptionalParam(
      'expiry',
      'Number of blocks after which a proposal is considered canceled',
      100,
      types.int,
    );
}

function loadSignerSync(args, provider) {
  return ethers.Wallet.fromEncryptedJsonSync(
    fs.readFileSync(args.keyfile),
    args.passphrase,
  ).connect(provider);
}

async function etherscanVerify(hre, address, constructorArguments = []) {
  try {
    await hre.run('verify:verify', { address, constructorArguments });
  } catch (e) {
    console.log('Verification failed', e.message);
  }
}

module.exports = {
  types,
  task,
  txTask,
  cbDeployTask,
  loadSignerSync,
  etherscanVerify,
};
