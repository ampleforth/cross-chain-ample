const fs = require('fs');
const { types } = require('hardhat/config');
const { task } = require('hardhat/config');

function txTask(name, desc) {
  return task(name, desc)
    .addParam(
      'gasPrice',
      'Gas price for the transaction',
      100000000000,
      types.int,
    )
    .addParam('gasLimit', 'Gas limit for the transaction', 7000000, types.int)
    .addParam('txSleepSec', 'Time to wait between transactions', 2, types.int)
    .addParam('keyfile', 'The path to signer keyfile')
    .addParam('passphrase', 'The passphrase to unlock keyfile');
}

function cbDeployTask(name, desc) {
  return txTask(name, desc)
    .addParam('chainId', 'Chain ID for the instance', 100, types.int)
    .addParam(
      'relayers',
      'Array of initial relayer address strings',
      [],
      types.json,
    )
    .addParam(
      'relayerThreshold',
      'Number of votes required for a proposal to pass',
      1,
      types.int,
    )
    .addParam('fee', 'Fee to be taken when making a deposit', 0, types.int)
    .addParam(
      'expiry',
      'Number of blocks after which a proposal is considered canceled',
      1000,
      types.int,
    );
}

function loadSignerSync(args, provider) {
  return ethers.Wallet.fromEncryptedJsonSync(
    fs.readFileSync(args.keyfile),
    args.passphrase,
  ).connect(provider);
}

module.exports = {
  types,
  task,
  txTask,
  cbDeployTask,
  loadSignerSync,
};
