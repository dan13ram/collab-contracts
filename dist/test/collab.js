'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const chai_1 = require('chai');
const hardhat_1 = require('hardhat');
const collabHelpers_1 = require('./utils/collabHelpers');
const ethersHelpers_1 = require('./utils/ethersHelpers');
const { deployMockContract } = hardhat_1.waffle;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
describe('MetaCollab', () => {
  let collab;
  let collabFactory;
  let signers;
  let collabAddress;
  let funder;
  let doer;
  let mockToken;
  beforeEach(async () => {
    signers = await hardhat_1.ethers.getSigners();
    const signatureDecoder = await (0,
    ethersHelpers_1.deploySignatureDecoder)();
    mockToken = await deployMockContract(
      signers[0],
      (0, ethersHelpers_1.erc20ABI)(),
    );
    const metaCollabImpl = await (0, ethersHelpers_1.deploy)('MetaCollab', {
      SignatureDecoder: signatureDecoder.address,
    });
    const MetaCollabFactory = await hardhat_1.ethers.getContractFactory(
      'MetaCollabFactory',
    );
    collabFactory = await MetaCollabFactory.deploy(metaCollabImpl.address);
    await collabFactory.deployed();
    funder = signers[0].address;
    doer = signers[1].address;
    const tx = await collabFactory.create(funder, doer);
    collabAddress = await (0, collabHelpers_1.awaitCollabAddress)(
      await tx.wait(),
    );
    await (0, chai_1.expect)(tx)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);
    collab = await (0, ethersHelpers_1.getContractAt)(
      'MetaCollab',
      collabAddress,
    );
  });
  it('Should initialize correctly', async () => {
    (0, chai_1.expect)(await collab.funder()).to.equal(funder);
    (0, chai_1.expect)(await collab.doer()).to.equal(doer);
    (0, chai_1.expect)(await collab.feeStore()).to.equal(collabFactory.address);
  });
  it('Should create a new gig', async () => {
    const data = {
      types: collabHelpers_1.TYPES.createNewGig,
      values: [
        EMPTY_BYTES32,
        [mockToken.address],
        [10],
        [1000, 1000, 10000],
        ZERO_ADDRESS,
        [0, 1],
        collab.address,
        0,
      ],
    };
    const [encodedData, signatures] = await (0, ethersHelpers_1.multisig)(
      data,
      [signers[0], signers[1]],
    );
    const tx = await collab.createNewGig(encodedData, signatures);
    await tx.wait();
    await (0, chai_1.expect)(tx)
      .to.emit(collab, 'GigInit')
      .withArgs(1, EMPTY_BYTES32);
    (0, chai_1.expect)(await collab.gigCount()).to.equal(1);
  });
});
