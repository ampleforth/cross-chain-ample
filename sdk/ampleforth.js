const ethers = require('ethers');
const BigNumber = require('bignumber.js');

const AMPL_DECIMALS = 9;

const toAmplFloatingPt = (ample) =>
  ethers.utils.formatUnits(
    `${ample.toFixed ? ample.toFixed(AMPL_DECIMALS) : ample}`,
    AMPL_DECIMALS,
  );

const toAmplFixedPt = (ample) =>
  ethers.utils.parseUnits(
    `${ample.toFixed ? ample.toFixed(AMPL_DECIMALS) : ample}`,
    AMPL_DECIMALS,
  );

const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + AMPL_DECIMALS);
const AMPL_ORACLE_DECIMALS = 18;
const AMPL_BASE_RATE = ethers.utils.parseUnits('1', AMPL_ORACLE_DECIMALS);
const AMPL_BASE_CPI = ethers.utils.parseUnits('100', AMPL_ORACLE_DECIMALS);

const printRebaseInfo = async function (policy) {
  const r = await policy.globalAmpleforthEpochAndAMPLSupply();
  console.log('Epoch', r[0].toString(), '\tTotalSupply', r[1].toString());
};

const execRebase = async (
  percChange,
  rateOracle,
  orchestrator,
  policy,
  signer,
  txParams = {},
) => {
  // Casting percChange to Bignumber.js instance to handle floating points
  const rateDiff = BigNumber(AMPL_BASE_RATE.toString())
    .times(percChange)
    .div(100)
    .toString(10);
  const newRate = AMPL_BASE_RATE.add(rateDiff);

  const rateTx = await rateOracle.connect(signer).pushReport(newRate, txParams);
  await rateTx.wait();

  const rebaseTx = await orchestrator.connect(signer).rebase(txParams);
  return rebaseTx.wait();
};

module.exports = {
  AMPL_DECIMALS,
  toAmplFloatingPt,
  toAmplFixedPt,

  INITIAL_SUPPLY,
  AMPL_ORACLE_DECIMALS,
  AMPL_BASE_RATE,
  AMPL_BASE_CPI,

  printRebaseInfo,
  execRebase,
};
