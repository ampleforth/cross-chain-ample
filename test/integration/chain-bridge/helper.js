const { ethers, upgrades } = require('@nomiclabs/buidler');
const AbiCoder = ethers.utils.defaultAbiCoder;

const { parseEventFromLogs } = require('../../ethers-helpers');

const AMPL_DECIMALS = 9;
const toAmplDenomination = ample =>
  ethers.utils.parseUnits(ample, AMPL_DECIMALS);
const INITIAL_SUPPLY = ethers.utils.parseUnits('50', 6 + AMPL_DECIMALS);
const DECIMALS = 18;
const BASE_RATE = ethers.utils.parseUnits('1', DECIMALS);
const BASE_CPI = ethers.utils.parseUnits('100', DECIMALS);

const ETH_CHAIN_ID = '1';
const TRON_CHAIN_ID = '2';
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

async function getBlockTime () {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function increaseTime (seconds) {
  await ethers.provider.send('evm_mine', [
    ethers.BigNumber.from(seconds)
      .add(await getBlockTime())
      .toNumber()
  ]);
}

async function setupAMPLContracts (deployer) {
  const deployerAddress = await deployer.getAddress();

  // setup token
  const ampl = await upgrades.deployProxy(
    (await ethers.getContractFactory('UFragments')).connect(deployer),
    [await deployer.getAddress()],
    {
      initializer: 'initialize(address)'
    },
  );

  // setup oracles
  const rateOracle = await (await ethers.getContractFactory('MedianOracle'))
    .connect(deployer)
    .deploy(3600 * 24 * 365, 0, 1);
  await rateOracle.connect(deployer).addProvider(deployerAddress);
  await rateOracle.connect(deployer).pushReport(BASE_RATE);
  const cpiOracle = await (await ethers.getContractFactory('MedianOracle'))
    .connect(deployer)
    .deploy(3600 * 24 * 365, 0, 1);
  await cpiOracle.addProvider(deployerAddress);
  await cpiOracle.connect(deployer).pushReport(BASE_CPI);

  // setup policy
  const policy = await upgrades.deployProxy(
    (await ethers.getContractFactory('UFragmentsPolicy')).connect(deployer),
    [await deployer.getAddress(), ampl.address, BASE_CPI.toString()],
    {
      initializer: 'initialize(address,address,uint256)'
    },
  );
  await policy.connect(deployer).setMarketOracle(rateOracle.address);
  await policy.connect(deployer).setCpiOracle(cpiOracle.address);
  await policy.connect(deployer).setRebaseLag(10);
  await policy.connect(deployer).setRebaseTimingParameters(1, 0, 3600);
  await ampl.connect(deployer).setMonetaryPolicy(policy.address);

  // setup orchestrator
  const orchestrator = await (await ethers.getContractFactory('Orchestrator'))
    .connect(deployer)
    .deploy(policy.address);
  await policy.setOrchestrator(orchestrator.address);

  // test rebase
  await orchestrator.rebase();

  const increaseTimeToNextRebase = async () => {
    const now = await getBlockTime();
    const lastRebaseTime = (await policy.lastRebaseTimestampSec()).toNumber();
    const minRebaseInterval = (
      await policy.minRebaseTimeIntervalSec()
    ).toNumber();
    const nextRebaseTime = lastRebaseTime + minRebaseInterval;
    const waitTime = nextRebaseTime - now;
    await increaseTime(waitTime);
  };

  return {
    ampl,
    rateOracle,
    cpiOracle,
    policy,
    orchestrator,
    increaseTimeToNextRebase
  };
}

async function setupXCAMPLContracts (deployer) {
  const xcAmpl = await upgrades.deployProxy(
    (await ethers.getContractFactory('XCAmpleforth')).connect(deployer),
    ['XCAmpleforth', 'xcAMPL', INITIAL_SUPPLY],
    {
      initializer: 'initialize(string,string,uint256)'
    },
  );

  const xcPolicy = await upgrades.deployProxy(
    (await ethers.getContractFactory('XCAmpleforthPolicy')).connect(deployer),
    [xcAmpl.address, 1],
    {
      initializer: 'initialize(address,uint256)'
    },
  );
  await xcPolicy.setRebaseReportDelay(0);
  await xcAmpl.setMonetaryPolicy(xcPolicy.address);

  const xcOrchestrator = await (await ethers.getContractFactory('Orchestrator'))
    .connect(deployer)
    .deploy(xcPolicy.address);
  await xcPolicy.setOrchestrator(xcOrchestrator.address);

  return { xcOrchestrator, xcPolicy, xcAmpl };
}

async function setupBridgeContracts (deployer, relayer) {
  const ethChainID = ETH_CHAIN_ID;
  const tronChainID = TRON_CHAIN_ID;
  const deployerAddress = await deployer.getAddress();
  const relayerAddress = await relayer.getAddress();

  // Setup Ethereum side bridge contracts
  // bridge contract
  const ethBridge = await (await ethers.getContractFactory('Bridge'))
    .connect(deployer)
    .deploy(ethChainID, [], RELAYER_TRESHOLD, 0, 100);
  await ethBridge.adminAddRelayer(deployerAddress);
  await ethBridge.adminAddRelayer(relayerAddress);

  // handler contract
  const ethBridgeHandler = await (
    await ethers.getContractFactory('GenericHandler')
  )
    .connect(deployer)
    .deploy(ethBridge.address, [], [], [], []);

  // Setup Tron side bridge contracts
  // bridge contract
  const tronBridge = await (await ethers.getContractFactory('Bridge'))
    .connect(deployer)
    .deploy(tronChainID, [], RELAYER_TRESHOLD, 0, 100);
  await tronBridge.adminAddRelayer(deployerAddress);
  await tronBridge.adminAddRelayer(relayerAddress);

  // handler contract
  const tronBridgeHandler = await (
    await ethers.getContractFactory('GenericHandler')
  )
    .connect(deployer)
    .deploy(tronBridge.address, [], [], [], []);

  const r = {
    ethChainID,
    tronChainID
  };
  r[ethChainID] = {
    bridge: ethBridge,
    handler: ethBridgeHandler
  };
  r[tronChainID] = {
    bridge: tronBridge,
    handler: tronBridgeHandler
  };
  return r;
}

async function setupBridgeGatewayContracts (
  deployer,
  amplContracts,
  xcAmplContracts,
  bridgeContracts,
) {
  const { ampl, policy } = amplContracts;
  const { xcAmpl, xcPolicy } = xcAmplContracts;
  const { ethChainID, tronChainID } = bridgeContracts;
  const ethBridge = bridgeContracts[ethChainID].bridge;
  const ethBridgeHandler = bridgeContracts[ethChainID].handler;
  const tronBridge = bridgeContracts[tronChainID].bridge;
  const tronBridgeHandler = bridgeContracts[tronChainID].handler;

  // ampl vault
  const amplVault = await upgrades.deployProxy(
    (await ethers.getContractFactory('TokenVault')).connect(deployer),
    [ampl.address],
    {
      initializer: 'initialize(address)'
    },
  );

  // ampl bridge gateway contract
  const amplBridgeRebaseGateway = await (
    await ethers.getContractFactory('AmplCBRebaseGateway')
  )
    .connect(deployer)
    .deploy(ethBridgeHandler.address, ampl.address, policy.address);

  const amplBridgeTransferGateway = await (
    await ethers.getContractFactory('AmplCBTransferGateway')
  )
    .connect(deployer)
    .deploy(ethBridgeHandler.address, ampl.address, amplVault.address);
  await amplVault
    .connect(deployer)
    .addBridgeGateway(amplBridgeTransferGateway.address);

  // xcampl bridge gateway contract
  const bridgeXcPolicyRebaseGateway = await (
    await ethers.getContractFactory('CBXCAmplRebaseGateway')
  )
    .connect(deployer)
    .deploy(tronBridgeHandler.address, xcAmpl.address, xcPolicy.address);

  await xcPolicy
    .connect(deployer)
    .addBridgeGateway(bridgeXcPolicyRebaseGateway.address);

  const bridgeXcPolicyTransferGateway = await (
    await ethers.getContractFactory('CBXCAmplTransferGateway')
  )
    .connect(deployer)
    .deploy(tronBridgeHandler.address, xcAmpl.address, xcPolicy.address);

  await xcPolicy
    .connect(deployer)
    .addBridgeGateway(bridgeXcPolicyTransferGateway.address);

  // hookup handlers with gateways
  const rebaseReportResource = createResourceID(
    'AmpleforthPolicy::rebaseReport',
  );

  await ethBridge
    .connect(deployer)
    .adminSetGenericResource(
      ethBridgeHandler.address,
      rebaseReportResource,
      amplBridgeRebaseGateway.address,
      getFunctionSignature(amplBridgeRebaseGateway, 'validateRebaseReport'),
      BLANK_FUNCTION_SIG,
    );

  await tronBridge
    .connect(deployer)
    .adminSetGenericResource(
      tronBridgeHandler.address,
      rebaseReportResource,
      bridgeXcPolicyRebaseGateway.address,
      BLANK_FUNCTION_SIG,
      getFunctionSignature(bridgeXcPolicyRebaseGateway, 'reportRebase'),
    );

  const transferResource = createResourceID('Ampleforth::transfer');

  await ethBridge
    .connect(deployer)
    .adminSetGenericResource(
      ethBridgeHandler.address,
      transferResource,
      amplBridgeTransferGateway.address,
      getFunctionSignature(amplBridgeTransferGateway, 'validateAndLock'),
      getFunctionSignature(amplBridgeTransferGateway, 'unlock'),
    );

  await tronBridge
    .connect(deployer)
    .adminSetGenericResource(
      tronBridgeHandler.address,
      transferResource,
      bridgeXcPolicyTransferGateway.address,
      getFunctionSignature(bridgeXcPolicyTransferGateway, 'validateAndBurn'),
      getFunctionSignature(bridgeXcPolicyTransferGateway, 'mint'),
    );

  return {
    amplVault,
    amplBridgeRebaseGateway,
    amplBridgeTransferGateway,
    bridgeXcPolicyRebaseGateway,
    bridgeXcPolicyTransferGateway,
    rebaseReportResource,
    transferResource
  };
}

const createGenericDepositData = hexMetaData => {
  if (hexMetaData === null) {
    return '0x' + toHex(0, 32).substr(2); // len(metaData) (32 bytes)
  }
  const hexMetaDataLength = hexMetaData.substr(2).length / 2;
  return '0x' + toHex(hexMetaDataLength, 32).substr(2) + hexMetaData.substr(2);
};

const packReportRebaseData = (epoch, totalSupply) => {
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

const executeBridgeTx = async (
  deployer,
  relayer,
  fromID,
  toID,
  bridgeContracts,
  resource,
  data,
) => {
  const bridgeFrom = bridgeContracts[fromID].bridge;
  const bridgeTo = bridgeContracts[toID].bridge;

  // const bridgeHandlerFrom = bridgeContracts[fromID].handler;
  const bridgeHandlerTo = bridgeContracts[toID].handler;

  const dataHash = ethers.utils.keccak256(
    bridgeHandlerTo.address + data.substr(2),
  );

  console.log('DEPOSIT');
  const txOutFrom = await bridgeFrom
    .connect(deployer)
    .deposit(toID, resource, data);
  const depositEvent = await parseEventFromLogs(
    bridgeFrom,
    txOutFrom,
    'Deposit',
  );
  const depositNonce = depositEvent.args.depositNonce;

  console.log('VOTE');
  await bridgeTo
    .connect(deployer)
    .voteProposal(fromID, depositNonce, resource, dataHash);
  await bridgeTo
    .connect(relayer)
    .voteProposal(fromID, depositNonce, resource, dataHash);

  console.log('EXECUTE');
  const txInTo = await bridgeTo.executeProposal(
    fromID,
    depositNonce,
    data,
    resource,
  );

  console.log('DONE');

  return { txOutFrom, txInTo };
};

const propagateAndExecuteXCRebase = async (
  deployer,
  relayer,
  amplContracts,
  xcAmplContracts,
  bridgeContracts,
  bridgeGatewayContracts,
) => {
  // Current epoch and total supply
  const epoch = await amplContracts.policy.epoch();
  const totalSupply = await amplContracts.ampl.totalSupply();
  const packed = packReportRebaseData(epoch, totalSupply);

  // execute tx across bridge
  const { txOutFrom, txInTo } = await executeBridgeTx(
    deployer,
    relayer,
    bridgeContracts.ethChainID,
    bridgeContracts.tronChainID,
    bridgeContracts,
    bridgeGatewayContracts.rebaseReportResource,
    packed,
  );

  // wait till delay is over
  await increaseTime(
    (await xcAmplContracts.xcPolicy.rebaseReportDelaySec()).add(1),
  );

  // execute cross-chain rebase
  await xcAmplContracts.xcOrchestrator.connect(deployer).rebase();

  return { txOutFrom, txInTo };
};

const propagateXCTransfer = async (
  deployer,
  relayer,
  fromID,
  toID,
  bridgeContracts,
  bridgeGatewayContracts,
  tokenFrom,
  depositorAddress,
  recipientAddress,
  amount,
) => {
  const totalSupply = await (tokenFrom.totalAMPLSupply
    ? tokenFrom.totalAMPLSupply()
    : tokenFrom.totalSupply());
  const packed = packXCTransferData(
    depositorAddress,
    recipientAddress,
    amount,
    totalSupply,
  );

  // execute tx across bridge
  const { txOutFrom, txInTo } = await executeBridgeTx(
    deployer,
    relayer,
    fromID,
    toID,
    bridgeContracts,
    bridgeGatewayContracts.transferResource,
    packed,
  );
  return { txOutFrom, txInTo };
};

module.exports = {
  setupAMPLContracts,
  setupXCAMPLContracts,
  setupBridgeContracts,
  setupBridgeGatewayContracts,
  propagateAndExecuteXCRebase,
  propagateXCTransfer,
  toAmplDenomination
};
