const { ethers } = require('hardhat');

async function getBlockTime () {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function mineEmpty () {
  return ethers.provider.send('evm_mine');
}

async function increaseTime (seconds) {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await getBlockTime())
      .toNumber()
  ]);
}

module.exports = {
  getBlockTime,
  increaseTime,
  mineEmpty
};
