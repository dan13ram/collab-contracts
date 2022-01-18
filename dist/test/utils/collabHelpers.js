'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.TYPES = exports.awaitCollabAddress = void 0;
const hardhat_1 = require('hardhat');
const awaitCollabAddress = async receipt => {
  if (!receipt || !receipt.logs) return '';
  const abi = new hardhat_1.ethers.utils.Interface([
    'event LogNewCollab(uint256 indexed id, address invoice)',
  ]);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
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
exports.awaitCollabAddress = awaitCollabAddress;
exports.TYPES = {
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
