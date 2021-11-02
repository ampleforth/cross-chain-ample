const { ethers } = require('hardhat');

async function getBlockTime() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function mineEmpty() {
  return ethers.provider.send('evm_mine');
}

async function increaseTime(seconds) {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await getBlockTime())
      .toNumber(),
  ]);
}

async function parseEventFromLogs(contract, tx, event) {
  const txR = await contract.provider.getTransactionReceipt(tx.hash);
  for (const l in txR.logs) {
    if (txR.logs.hasOwnProperty(l)) {
      try {
        const parsed = await contract.interface.parseLog(txR.logs[l]);
        if (parsed.name === event) {
          return parsed;
        }
      } catch (e) {}
    }
  }
  return {};
}

module.exports = {
  getBlockTime,
  increaseTime,
  mineEmpty,
  parseEventFromLogs,
};
