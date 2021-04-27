// https://github.com/albertocuestacanada/ERC20Permit/blob/master/utils/signatures.ts
const {
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack
} = require('ethers/lib/utils');
const { ecsign } = require('ethereumjs-util');

const EIP712_DOMAIN_TYPEHASH = keccak256(
  toUtf8Bytes(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
  ),
);

const EIP712_DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' }
];

const EIP2612_PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes(
    'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
  ),
);

const EIP2612_PERMIT_TYPE = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }
];

// Gets the EIP712 domain separator
function getDomainSeparator (version, name, contractAddress, chainId) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes(version)),
        chainId,
        contractAddress
      ],
    ),
  );
}

// Returns the EIP712 hash which should be signed by the user
// in order to make a call to `permit`
function getPermitDigest (
  version,
  name,
  address,
  chainId,
  owner,
  spender,
  value,
  nonce,
  deadline,
) {
  const DOMAIN_SEPARATOR = getDomainSeparator(version, name, address, chainId);
  const permitHash = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
      [EIP2612_PERMIT_TYPEHASH, owner, spender, value, nonce, deadline],
    ),
  );
  const hash = keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      ['0x19', '0x01', DOMAIN_SEPARATOR, permitHash],
    ),
  );
  return hash;
}

const signEIP712Permission = async (
  version,
  name,
  verifyingContract,
  chainId,
  signer,
  owner,
  spender,
  value,
  nonce,
  deadline,
) => {
  const digest = getPermitDigest(
    version,
    name,
    verifyingContract,
    chainId,
    owner,
    spender,
    value,
    nonce,
    deadline,
  );
  return ecsign(
    Buffer.from(digest.slice(2), 'hex'),
    Buffer.from(signer.privateKey.slice(2), 'hex'),
  );
};

module.exports = {
  EIP712_DOMAIN_TYPEHASH,
  EIP712_DOMAIN_TYPE,
  EIP2612_PERMIT_TYPEHASH,
  EIP2612_PERMIT_TYPE,
  getDomainSeparator,
  getPermitDigest,
  signEIP712Permission
};
