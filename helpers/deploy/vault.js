const { deployContract } = require('../contracts');

async function deployTokenVault (
  ethers,
  deployer,
  txParams = {},
  waitBlocks = 0,
) {
  const tokenVault = await deployContract(
    ethers,
    'TokenVault',
    deployer,
    [],
    txParams,
    waitBlocks,
  );

  return tokenVault;
}

module.exports = {
  deployTokenVault
};
