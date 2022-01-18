'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const chai_1 = require('chai');
const hardhat_1 = require('hardhat');
const collabHelpers_1 = require('./utils/collabHelpers');
const ethersHelpers_1 = require('./utils/ethersHelpers');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
describe('MetaCollabFactory', () => {
  let metaCollab;
  let collabFactory;
  let MetaCollabFactory;
  let signers;
  let collabAddress;
  let funder;
  let doer;
  beforeEach(async () => {
    signers = await hardhat_1.ethers.getSigners();
    const signatureDecoder = await (0,
    ethersHelpers_1.deploySignatureDecoder)();
    metaCollab = await (0, ethersHelpers_1.deploy)('MetaCollab', {
      SignatureDecoder: signatureDecoder.address,
    });
    MetaCollabFactory = await hardhat_1.ethers.getContractFactory(
      'MetaCollabFactory',
    );
    collabFactory = await MetaCollabFactory.deploy(metaCollab.address);
    await collabFactory.deployed();
  });
  it('Should deploy with 0 collabCount', async () => {
    const collabCount = await collabFactory.collabCount();
    (0, chai_1.expect)(collabCount).to.equal(0);
  });
  it('Should revert deploy if zero implementation', async () => {
    const tx = MetaCollabFactory.deploy(ZERO_ADDRESS);
    await (0, chai_1.expect)(tx).to.revertedWith('invalid implementation');
  });
  it('Should revert init for implementation', async () => {
    const tx = metaCollab.init(
      signers[0].address,
      signers[1].address,
      signers[2].address,
    );
    await (0, chai_1.expect)(tx).to.revertedWith(
      'Initializable: contract is already initialized',
    );
  });
  it('Should deploy a MetaCollab', async () => {
    funder = signers[0].address;
    doer = signers[1].address;
    const tx = await collabFactory.create(funder, doer);
    collabAddress = await (0, collabHelpers_1.awaitCollabAddress)(
      await tx.wait(),
    );
    await (0, chai_1.expect)(tx)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);
    const collab = await (0, ethersHelpers_1.getContractAt)(
      'MetaCollab',
      collabAddress,
    );
    (0, chai_1.expect)(await collab.funder()).to.equal(funder);
    (0, chai_1.expect)(await collab.doer()).to.equal(doer);
    (0, chai_1.expect)(await collab.feeStore()).to.equal(collabFactory.address);
    (0, chai_1.expect)(await collabFactory.getCollabAddress(0)).to.equal(
      collabAddress,
    );
  });
  it('Should predict MetaCollab address', async () => {
    funder = signers[0].address;
    doer = signers[1].address;
    const predictedAddress = await collabFactory.predictDeterministicAddress(
      EMPTY_BYTES32,
    );
    const tx = await collabFactory.createDeterministic(
      funder,
      doer,
      EMPTY_BYTES32,
    );
    collabAddress = await (0, collabHelpers_1.awaitCollabAddress)(
      await tx.wait(),
    );
    await (0, chai_1.expect)(tx)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);
    (0, chai_1.expect)(collabAddress).to.equal(predictedAddress);
    (0, chai_1.expect)(await collabFactory.getCollabAddress(0)).to.equal(
      collabAddress,
    );
  });
  it('Should update collabCount', async () => {
    (0, chai_1.expect)(await collabFactory.collabCount()).to.equal(0);
    let tx = await collabFactory.create(funder, doer);
    const collab0 = await (0, collabHelpers_1.awaitCollabAddress)(
      await tx.wait(),
    );
    (0, chai_1.expect)(await collabFactory.collabCount()).to.equal(1);
    tx = await collabFactory.create(funder, doer);
    const collab1 = await (0, collabHelpers_1.awaitCollabAddress)(
      await tx.wait(),
    );
    (0, chai_1.expect)(await collabFactory.collabCount()).to.equal(2);
    (0, chai_1.expect)(await collabFactory.getCollabAddress(0)).to.equal(
      collab0,
    );
    (0, chai_1.expect)(await collabFactory.getCollabAddress(1)).to.equal(
      collab1,
    );
  });
  it('Should update flatFee', async () => {
    let flatFee = await collabFactory.flatFees(signers[2].address);
    (0, chai_1.expect)(flatFee).to.equal(0);
    const tx = await collabFactory
      .connect(signers[2])
      .updateFlatFee(10, EMPTY_BYTES32);
    await (0, chai_1.expect)(tx)
      .to.emit(collabFactory, 'UpdateFlatFee')
      .withArgs(signers[2].address, 10, EMPTY_BYTES32);
    flatFee = await collabFactory.flatFees(signers[2].address);
    (0, chai_1.expect)(flatFee).to.equal(10);
  });
});
