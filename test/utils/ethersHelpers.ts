import { AbiCoder } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Libraries } from '@nomiclabs/hardhat-ethers/types';
import { ethers } from 'hardhat';

import { SignatureDecoder } from '../../types/SignatureDecoder';

export const abiCoder = new AbiCoder();

export const erc20ABI = (): any[] =>
  require(`../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json`)
    .abi;

export const currentTimestamp = async (): Promise<number> => {
  const block = await ethers.provider.getBlock('latest');
  return +block.timestamp;
};

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
export const encodeData = (data: { types: any; values: any }): string => {
  return abiCoder.encode(data.types, data.values);
};

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
export const multisig = async (
  data: any,
  signers: SignerWithAddress[],
): Promise<string[]> => {
  const encodedData = encodeData(data);
  const encodedMsgHash = ethers.utils.keccak256(encodedData);
  const encodedMsgBinary = ethers.utils.arrayify(encodedMsgHash);
  let signature = '0x';
  for (let signer of signers)
    signature =
      signature + (await signer.signMessage(encodedMsgBinary)).slice(2);
  return [encodedData, signature];
};

const strip0x = (input: string): string => input.replace(/^0x/, '');

export const signatureToVRS = (
  rawSignature: string,
): { v: string; r: string; s: string } => {
  const signature = strip0x(rawSignature);
  const v = signature.slice(32 * 4);
  const r = signature.slice(0, 32 * 2);
  const s = signature.slice(32 * 2, 32 * 4);
  return { v, r, s };
};

export const deploySignatureDecoder = async (): Promise<SignatureDecoder> => {
  const ctrFactory = await ethers.getContractFactory('SignatureDecoder');

  const ctr = (await ctrFactory.deploy()) as unknown as SignatureDecoder;
  await (ctr as unknown as Contract).deployed();
  return ctr;
};

export const deploy = async <Type>(
  typeName: string,
  libraries?: Libraries,
  ...args: any[]
): Promise<Type> => {
  const ctrFactory = await ethers.getContractFactory(typeName, { libraries });

  const ctr = (await ctrFactory.deploy(...args)) as unknown as Type;
  await (ctr as unknown as Contract).deployed();
  return ctr;
};

export const getContractAt = async <Type>(
  typeName: string,
  address: string,
): Promise<Type> => {
  const ctr = (await ethers.getContractAt(
    typeName,
    address,
  )) as unknown as Type;
  return ctr;
};
