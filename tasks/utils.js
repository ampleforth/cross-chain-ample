const ethers = require('ethers');
const fs = require('fs');
const AbiCoder = ethers.utils.defaultAbiCoder;

const toHex = (covertThis, padding) => {
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};

const createResourceID = fnRef => {
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(fnRef));
  return toHex(hash, 32);
};

const getFunctionSignature = (contractInstance, functionName) => {
  const functions = contractInstance.interface.functions;
  const selected = Object.keys(functions).filter(
    f => functions[f].name === functionName,
  )[0];
  return contractInstance.interface.getSighash(functions[selected]);
};

const readAddresses = (path, chain) => {
  const addressFile = `${path}/${chain}.json`;
  return JSON.parse(fs.readFileSync(addressFile));
}

const writeAddresses = (path, chain, dt) => {
  const addressFile = `${path}/${chain}.json`;
  const chainAddresses = fs.existsSync(addressFile) ? JSON.parse(fs.readFileSync(addressFile)) : { };
  const updatedAddresses = Object.assign(chainAddresses , dt);
  fs.writeFileSync(addressFile, JSON.stringify(updatedAddresses, null, 2));
  console.log('Output written to', addressFile);
}

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


module.exports = {
  toHex,
  createResourceID,
  getFunctionSignature,
  readAddresses,
  writeAddresses,
  packXCRebaseData,
}
