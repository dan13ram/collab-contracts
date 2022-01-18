import { Log, TransactionReceipt } from '@ethersproject/abstract-provider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MockContract } from 'ethereum-waffle';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';

import { MetaCollab } from '../../types/MetaCollab';
import { multisig } from './ethersHelpers';

const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const awaitCollabAddress = async (receipt: TransactionReceipt) => {
  if (!receipt || !receipt.logs) return '';
  const abi = new ethers.utils.Interface([
    'event LogNewCollab(uint256 indexed id, address invoice)',
  ]);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find((e: Log) => e.topics[0] === eventTopic);
  if (event) {
    const decodedLog = abi.decodeEventLog(
      eventFragment,
      event.data,
      event.topics,
    );
    return decodedLog.invoice;
  }
  return '';
};

export enum GigStatus {
  init,
  active,
  countdown,
  locked,
  resolved,
  cancelled,
  done,
}

export type Gig = {
  status: GigStatus;
  tokens: string[];
  amounts: BigNumber[];
  startTimestamp: BigNumber;
  countdownTimestamp: BigNumber;
  durations: BigNumber[];
  resolver: string;
  flatResolverFee: BigNumber;
  feeRewardRatio: number[];
  thirdParties: string[];
};

export const getGig = async (
  collab: MetaCollab,
  gigId: number,
): Promise<Gig> => {
  const gig = await collab.getGig(gigId);

  return {
    status: gig[0] as GigStatus,
    tokens: gig[1],
    amounts: gig[2],
    startTimestamp: gig[3],
    countdownTimestamp: gig[4],
    durations: gig[5],
    resolver: gig[6],
    flatResolverFee: gig[7],
    feeRewardRatio: gig[8],
    thirdParties: gig[9],
  };
};

export const TYPES: { [any: string]: string[] } = {
  createNewGig: [
    'bytes',
    'address[]',
    'uint256[]',
    'uint256[3]',
    'address',
    'uint8[2]',
    'address',
    'uint256',
  ],
  startNewGig: [
    'bytes',
    'address[]',
    'uint256[]',
    'uint256[3]',
    'address',
    'uint8[2]',
    'address',
    'uint256',
  ],
  completeGig: ['address', 'uint256', 'uint8[2]'],
  updateGigHash: ['address', 'uint256', 'bytes'],
  updateGigResolver: ['address', 'uint256', 'address', 'uint8[2]'],
};

export const createTestGig = async (
  collab: MetaCollab,
  signers: SignerWithAddress[],
  tokens: MockContract[],
  amounts: number[],
  resolver: string,
  feeRewardRatio: number[] = [0, 1],
): Promise<ContractTransaction> => {
  const data = {
    types: TYPES.createNewGig,
    values: [
      EMPTY_BYTES32,
      tokens.map(t => t.address),
      amounts,
      [10, 10, 20],
      resolver,
      feeRewardRatio,
      collab.address,
      0,
    ],
  };

  const [encodedData, signatures] = await multisig(data, [
    signers[0],
    signers[1],
  ]);

  const tx = await collab.createNewGig(encodedData, signatures);

  await tx.wait();

  return tx;
};

export const startTestGig = async (
  collab: MetaCollab,
  signers: SignerWithAddress[],
  tokens: MockContract[],
  amounts: number[],
  resolver: string,
  feeRewardRatio: number[] = [0, 1],
): Promise<ContractTransaction> => {
  const data = {
    types: TYPES.startNewGig,
    values: [
      EMPTY_BYTES32,
      tokens.map(t => t.address),
      amounts,
      [10, 10, 20],
      resolver,
      feeRewardRatio,
      collab.address,
      0,
    ],
  };

  const [encodedData, signatures] = await multisig(data, [
    signers[0],
    signers[1],
  ]);

  await Promise.all(
    tokens.map((t, i) =>
      t.mock.transferFrom
        .withArgs(signers[0].address, collab.address, amounts[i])
        .returns(true),
    ),
  );
  const tx = await collab.startNewGig(encodedData, signatures);

  await tx.wait();

  return tx;
};
