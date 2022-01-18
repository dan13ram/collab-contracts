import { AbiCoder } from '@ethersproject/abi';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Libraries } from '@nomiclabs/hardhat-ethers/types';

import { SignatureDecoder } from '../../types/SignatureDecoder';
export declare const abiCoder: AbiCoder;
export declare const erc20ABI: () => any[];
export declare const currentTimestamp: () => Promise<number>;
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
export declare const encodeData: (data: { types: any; values: any }) => string;
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
export declare const multisig: (
  data: any,
  signers: SignerWithAddress[],
) => Promise<string[]>;
export declare const signatureToVRS: (rawSignature: string) => {
  v: string;
  r: string;
  s: string;
};
export declare const deploySignatureDecoder: () => Promise<SignatureDecoder>;
export declare const deploy: <Type>(
  typeName: string,
  libraries?: Libraries | undefined,
  ...args: any[]
) => Promise<Type>;
export declare const getContractAt: <Type>(
  typeName: string,
  address: string,
) => Promise<Type>;
