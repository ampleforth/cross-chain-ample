const { ethers } = require('@nomiclabs/buidler');
const AbiCoder = ethers.utils.defaultAbiCoder;
const { parseEventFromLogs } = require('./ethers_helpers');

const ETH_CHAIN_ID = '1';
const TRON_CHAIN_ID = '2';
const ACALA_CHAIN_ID = '3';

const RELAYER_TRESHOLD = 2;
const BLANK_FUNCTION_SIG = '0x00000000';

const getFunctionSignature = (contractInstance, functionName) => {
  const functions = contractInstance.interface.functions;
  const selected = Object.keys(functions).filter(
    f => functions[f].name === functionName,
  )[0];
  return contractInstance.interface.getSighash(functions[selected]);
};

const toHex = (covertThis, padding) => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

const createResourceID = fnRef => {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(fnRef));
  return toHex(hash, 32);
};

const rebaseResource = createResourceID('AmpleforthPolicy::rebaseReport');
const transferResource = createResourceID('Ampleforth::transfer');

const createGenericDepositData = hexMetaData => {
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

async function setupMasterBridgeContracts (
  deployer,
  relayer,
  amplContracts,
  chainID,
) {
  const deployerAddress = await deployer.getAddress();
  const relayerAddress = await relayer.getAddress();

  const { ampl, policy } = amplContracts;
  const amplVault = await (await ethers.getContractFactory('TokenVault'))
    .connect(deployer)
    .deploy();
  const bridge = await (await ethers.getContractFactory('Bridge'))
    .connect(deployer)
    .deploy(chainID, [], RELAYER_TRESHOLD, 0, 100);
  await bridge.adminAddRelayer(deployerAddress);
  await bridge.adminAddRelayer(relayerAddress);

  const bridgeHandler = await (
    await ethers.getContractFactory('GenericHandler')
  )
    .connect(deployer)
    .deploy(bridge.address, [], [], [], [], []);

  const rebaseGateway = await (
    await ethers.getContractFactory('AMPLChainBridgeGateway')
  )
    .connect(deployer)
    .deploy(
      bridgeHandler.address,
      ampl.address,
      policy.address,
      amplVault.address,
    );

  await bridge
    .connect(deployer)
    .adminSetGenericResource(
      bridgeHandler.address,
      rebaseResource,
      rebaseGateway.address,
      getFunctionSignature(rebaseGateway, 'validateRebaseReport'),
      0,
      BLANK_FUNCTION_SIG,
    );

  const transferGateway = await (
    await ethers.getContractFactory('AMPLChainBridgeGateway')
  )
    .connect(deployer)
    .deploy(
      bridgeHandler.address,
      ampl.address,
      amplVault.address,
      amplVault.address,
    );

  await amplVault.connect(deployer).addBridgeGateway(transferGateway.address);

  await bridge.connect(deployer).adminSetGenericResource(
    bridgeHandler.address,
    transferResource,
    transferGateway.address,
    getFunctionSignature(transferGateway, 'validateAndLock'),
    // https://github.com/ChainSafe/chainbridge-solidity/blob/master/contracts/handlers/GenericHandler.sol#L170
    12, // Padding for the depositor address validation
    getFunctionSignature(transferGateway, 'unlock'),
  );

  return {
    chainID,
    bridge,
    bridgeHandler,
    rebaseGateway,
    transferGateway,
    amplVault
  };
}

async function setupOtherBridgeContracts (
  deployer,
  relayer,
  xcAmplContracts,
  chainID,
) {
  const deployerAddress = await deployer.getAddress();
  const relayerAddress = await relayer.getAddress();

  const { xcAmpl, xcController } = xcAmplContracts;

  const bridge = await (await ethers.getContractFactory('Bridge'))
    .connect(deployer)
    .deploy(chainID, [], RELAYER_TRESHOLD, 0, 100);
  await bridge.adminAddRelayer(deployerAddress);
  await bridge.adminAddRelayer(relayerAddress);

  const bridgeHandler = await (
    await ethers.getContractFactory('GenericHandler')
  )
    .connect(deployer)
    .deploy(bridge.address, [], [], [], [], []);

  const rebaseGateway = await (
    await ethers.getContractFactory('ChainBridgeXCAmpleGateway')
  )
    .connect(deployer)
    .deploy(bridgeHandler.address, xcAmpl.address, xcController.address);

  await xcController.connect(deployer).addBridgeGateway(rebaseGateway.address);

  await bridge
    .connect(deployer)
    .adminSetGenericResource(
      bridgeHandler.address,
      rebaseResource,
      rebaseGateway.address,
      BLANK_FUNCTION_SIG,
      0,
      getFunctionSignature(rebaseGateway, 'reportRebase'),
    );

  const transferGateway = await (
    await ethers.getContractFactory('ChainBridgeXCAmpleGateway')
  )
    .connect(deployer)
    .deploy(bridgeHandler.address, xcAmpl.address, xcController.address);

  await xcController
    .connect(deployer)
    .addBridgeGateway(transferGateway.address);

  await bridge.connect(deployer).adminSetGenericResource(
    bridgeHandler.address,
    transferResource,
    transferGateway.address,
    getFunctionSignature(transferGateway, 'validateAndBurn'),
    12, // Padding for the depositor address validation
    getFunctionSignature(transferGateway, 'mint'),
  );

  return { chainID, bridge, bridgeHandler, rebaseGateway, transferGateway };
}

const executeBridgeTx = async (
  sender,
  relayer1,
  relayer2,
  from,
  to,
  resource,
  data,
) => {
  const dataHash = ethers.utils.keccak256(
    to.bridgeHandler.address + data.substr(2),
  );

  const txOutFrom = await from.bridge
    .connect(sender)
    .deposit(to.chainID, resource, data);
  const depositEvent = await parseEventFromLogs(
    from.bridge,
    txOutFrom,
    'Deposit',
  );
  const depositNonce = depositEvent.args.depositNonce;

  await to.bridge
    .connect(relayer1)
    .voteProposal(from.chainID, depositNonce, resource, dataHash);
  await to.bridge
    .connect(relayer2)
    .voteProposal(from.chainID, depositNonce, resource, dataHash);

  const txInTo = await to.bridge
    .connect(relayer1)
    .executeProposal(from.chainID, depositNonce, data, resource);

  return { txOutFrom, txInTo };
};

const propagateXCRebase = async (sender, relayer1, relayer2, st, from, to) => {
  const { txOutFrom, txInTo } = await executeBridgeTx(
    sender,
    relayer1,
    relayer2,
    from,
    to,
    rebaseResource,
    packXCRebaseData(st.epoch, st.totalSupply),
  );

  return { txOutFrom, txInTo };
};

const propagateXCTransfer = async (
  sender,
  relayer1,
  relayer2,
  from,
  to,
  st,
  depositorAddress,
  recipientAddress,
  amount,
) => {
  const { txOutFrom, txInTo } = await executeBridgeTx(
    sender,
    relayer1,
    relayer2,
    from,
    to,
    transferResource,
    packXCTransferData(
      depositorAddress,
      recipientAddress,
      amount,
      st.totalSupply,
    ),
  );
  return { txOutFrom, txInTo };
};

module.exports = {
  ETH_CHAIN_ID,
  TRON_CHAIN_ID,
  ACALA_CHAIN_ID,
  rebaseResource,
  transferResource,
  setupMasterBridgeContracts,
  setupOtherBridgeContracts,
  propagateXCRebase,
  propagateXCTransfer,
  packXCTransferData,
  executeBridgeTx
};
