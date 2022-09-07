const ethers = require('ethers');
const AbiCoder = ethers.utils.defaultAbiCoder;

const getFunctionSignature = (contract, functionName) => {
  const functions = contract.interface.functions;
  const selected = Object.keys(functions).filter(
    (f) => functions[f].name === functionName,
  )[0];
  return contract.interface.getSighash(functions[selected]);
};

const toHex = (covertThis, padding) => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

const createResourceID = (d) => {
  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(['string'], [d]),
  );
  return toHex(hash, 32);
};

const XC_REBASE_RESOURCE_ID = createResourceID(
  'Ampleforth::ChainBridge::XCRebase',
);

const XC_TRANSFER_RESOURCE_ID = createResourceID(
  'Ampleforth::ChainBridge::XCTransfer',
);

const CB_BLANK_FUNCTION_SIG = '0x00000000';

const CB_FUNCTION_SIG_baseChainReportRebase = (gatewayContract) => {
  return [
    getFunctionSignature(gatewayContract, 'validateRebaseReport'),
    0,
    CB_BLANK_FUNCTION_SIG,
  ];
};

const CB_FUNCTION_SIG_satelliteChainReportRebase = (gatewayContract) => {
  return [
    getFunctionSignature(gatewayContract, 'validateRebaseReport'),
    0,
    getFunctionSignature(gatewayContract, 'reportRebase'),
  ];
};

const CB_FUNCTION_SIG_baseChainTransfer = (gatewayContract) => {
  return [
    getFunctionSignature(gatewayContract, 'validateAndLock'),
    12,
    getFunctionSignature(gatewayContract, 'unlock'),
  ];
};

const CB_FUNCTION_SIG_satelliteChainTransfer = (gatewayContract) => {
  return [
    getFunctionSignature(gatewayContract, 'validateAndBurn'),
    // https://github.com/ChainSafe/chainbridge-solidity/blob/master/contracts/handlers/GenericHandler.sol#L170
    12, // Padding for the depositor address validation
    getFunctionSignature(gatewayContract, 'mint'),
  ];
};

const createGenericDepositData = (hexMetaData) => {
  if (hexMetaData === null) {
    return '0x' + toHex(0, 32).substr(2);
  }
  const hexMetaDataLength = hexMetaData.substr(2).length / 2;
  return '0x' + toHex(hexMetaDataLength, 32).substr(2) + hexMetaData.substr(2);
};

const packXCRebaseData = (epoch, totalSupply) => {
  return createGenericDepositData(
    AbiCoder.encode(['uint256', 'uint256'], [epoch, totalSupply]),
  );
};

const packXCTransferData = (depositor, recipient, amount, totalSupply) => {
  return createGenericDepositData(
    AbiCoder.encode(
      ['address', 'address', 'uint256', 'uint256'],
      [depositor, recipient, amount, totalSupply],
    ),
  );
};

const executeXCRebase = async (
  sender,
  baseChainBridge,
  satelliteChainBridge,
  satelliteChainGenericHandler,
  policy,
  txParams = {},
) => {
  const r = await policy.connect(sender).globalAmpleforthEpochAndAMPLSupply();

  const data = packXCRebaseData(r[0], r[1]);
  const dataHash = ethers.utils.keccak256(
    satelliteChainGenericHandler.address + data.substr(2),
  );

  const tx = await baseChainBridge
    .connect(sender)
    .deposit(
      await satelliteChainBridge._domainID(),
      XC_REBASE_RESOURCE_ID,
      data,
      [],
      txParams,
    );
  const txR = await tx.wait();

  const depositEvent = txR.events.filter((e) => e.event == 'Deposit')[0];
  const depositNonce = depositEvent.args.depositNonce;
  const resourceID = depositEvent.args.resourceID;

  return { tx, txR, data, dataHash, depositNonce, resourceID };
};

const executeXCTransfer = async (
  sender,
  recipientAddress,
  transferAmt,
  policy,
  sourceChainBridge,
  targetChainBridge,
  targetChainGenericHandler,
  txParams = {},
) => {
  const senderAddress = await sender.getAddress();
  const r = await policy.connect(sender).globalAmpleforthEpochAndAMPLSupply();

  const data = packXCTransferData(
    senderAddress,
    recipientAddress,
    transferAmt,
    r[1],
  );
  const dataHash = ethers.utils.keccak256(
    targetChainGenericHandler.address + data.substr(2),
  );

  const tx = await sourceChainBridge
    .connect(sender)
    .deposit(
      await targetChainBridge._domainID(),
      XC_TRANSFER_RESOURCE_ID,
      data,
      [],
      txParams,
    );
  const txR = await tx.wait();

  const depositEvent = txR.events.filter((e) => e.event == 'Deposit')[0];
  const depositNonce = depositEvent.args.depositNonce;
  const resourceID = depositEvent.args.resourceID;

  return { tx, txR, data, dataHash, depositNonce, resourceID };
};

module.exports = {
  packXCRebaseData,
  packXCTransferData,

  XC_REBASE_RESOURCE_ID,
  XC_TRANSFER_RESOURCE_ID,

  CB_FUNCTION_SIG_baseChainReportRebase,
  CB_FUNCTION_SIG_satelliteChainReportRebase,
  CB_FUNCTION_SIG_baseChainTransfer,
  CB_FUNCTION_SIG_satelliteChainTransfer,

  executeXCRebase,
  executeXCTransfer,
};
