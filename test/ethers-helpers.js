async function parseEventFromLogs (contract, tx, event) {
  const txR = await contract.provider.getTransactionReceipt(tx.hash);
  for (const l in txR.logs) {
    try {
      const parsed = await contract.interface.parseLog(txR.logs[l]);
      if (parsed.name === event) {
        return parsed;
      }
    } catch (e) {}
  }
  return {};
}

module.exports = {
  parseEventFromLogs
};
