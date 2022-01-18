'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getContractAt =
  exports.deploy =
  exports.deploySignatureDecoder =
  exports.signatureToVRS =
  exports.multisig =
  exports.encodeData =
  exports.currentTimestamp =
  exports.erc20ABI =
  exports.abiCoder =
    void 0;
const abi_1 = require('@ethersproject/abi');
const hardhat_1 = require('hardhat');
exports.abiCoder = new abi_1.AbiCoder();
const erc20ABI = () =>
  require(`../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json`)
    .abi;
exports.erc20ABI = erc20ABI;
const currentTimestamp = async () => {
  const block = await hardhat_1.ethers.provider.getBlock('latest');
  return +block.timestamp;
};
exports.currentTimestamp = currentTimestamp;
/**
 * Abi Encode data given typed data
 *
 * @param {Object} data - typed data to sign
 * @notice example: {
 *   types: ['uint256', 'address'],
 *   values: [0, 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE]
 * }
 * @return data encoded by abi encoder
 */
const encodeData = data => {
  return exports.abiCoder.encode(data.types, data.values);
};
exports.encodeData = encodeData;
/**
 * Sign data from one or more ethers wallets
 *
 * @param {Object} data - typed data to sign
 * @notice example: {
 *   types: ['uint256', 'address'],
 *   values: [0, 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE]
 * }
 * @param {Array} signers - array of wallets to collect signatures for
 * @return
 *   - encodedData - data encoded by abi encoder
 *   - signature {String} - the signed hashes of the data
 * @notice if multiple signers concatonates signatures together in single string
 */
const multisig = async (data, signers) => {
  const encodedData = (0, exports.encodeData)(data);
  const encodedMsgHash = hardhat_1.ethers.utils.keccak256(encodedData);
  const encodedMsgBinary = hardhat_1.ethers.utils.arrayify(encodedMsgHash);
  let signature = '0x';
  for (let signer of signers)
    signature =
      signature + (await signer.signMessage(encodedMsgBinary)).slice(2);
  return [encodedData, signature];
};
exports.multisig = multisig;
const strip0x = input => input.replace(/^0x/, '');
const signatureToVRS = rawSignature => {
  const signature = strip0x(rawSignature);
  const v = signature.slice(32 * 4);
  const r = signature.slice(0, 32 * 2);
  const s = signature.slice(32 * 2, 32 * 4);
  return { v, r, s };
};
exports.signatureToVRS = signatureToVRS;
const deploySignatureDecoder = async () => {
  const ctrFactory = await hardhat_1.ethers.getContractFactory(
    'SignatureDecoder',
  );
  const ctr = await ctrFactory.deploy();
  await ctr.deployed();
  return ctr;
};
exports.deploySignatureDecoder = deploySignatureDecoder;
const deploy = async (typeName, libraries, ...args) => {
  const ctrFactory = await hardhat_1.ethers.getContractFactory(typeName, {
    libraries,
  });
  const ctr = await ctrFactory.deploy(...args);
  await ctr.deployed();
  return ctr;
};
exports.deploy = deploy;
const getContractAt = async (typeName, address) => {
  const ctr = await hardhat_1.ethers.getContractAt(typeName, address);
  return ctr;
};
exports.getContractAt = getContractAt;
