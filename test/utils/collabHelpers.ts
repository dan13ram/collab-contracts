import { Log, TransactionReceipt } from '@ethersproject/abstract-provider';
import { ethers } from 'hardhat';

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
