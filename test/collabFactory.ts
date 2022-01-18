import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { awaitCollabAddress } from './utils/collabHelpers';
import { MetaCollab } from '../types/MetaCollab';
import { MetaCollabFactory } from '../types/MetaCollabFactory';
import {
  deploy,
  deploySignatureDecoder,
  getContractAt,
} from './utils/ethersHelpers';
import { ContractFactory } from 'ethers';

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('MetaCollabFactory', function () {
  let metaCollab: MetaCollab;
  let collabFactory: MetaCollabFactory;
  let MetaCollabFactory: ContractFactory;
  let signers: SignerWithAddress[];
  let collabAddress: string;
  let funder: string;
  let doer: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const signatureDecoder = await deploySignatureDecoder();

    metaCollab = await deploy<MetaCollab>('MetaCollab', {
      SignatureDecoder: signatureDecoder.address,
    });

    MetaCollabFactory = await ethers.getContractFactory('MetaCollabFactory');

    collabFactory = (await MetaCollabFactory.deploy(
      metaCollab.address,
    )) as MetaCollabFactory;

    await collabFactory.deployed();
  });

  it('Should deploy with 0 collabCount', async function () {
    const collabCount = await collabFactory.collabCount();
    expect(collabCount).to.equal(0);
  });

  it('Should revert deploy if zero implementation', async function () {
    const receipt = MetaCollabFactory.deploy(ADDRESS_ZERO);
    await expect(receipt).to.revertedWith('invalid implementation');
  });

  it('Should deploy a MetaCollab', async function () {
    funder = signers[0].address;
    doer = signers[1].address;
    const receipt = await collabFactory.create(funder, doer);
    collabAddress = await awaitCollabAddress(await receipt.wait());
    await expect(receipt)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);

    const collab = await getContractAt<MetaCollab>('MetaCollab', collabAddress);

    expect(await collab.funder()).to.equal(funder);
    expect(await collab.doer()).to.equal(doer);

    expect(await collabFactory.getCollabAddress(0)).to.equal(collabAddress);
  });

  it('Should predict MetaCollab address', async function () {
    funder = signers[0].address;
    doer = signers[1].address;

    const predictedAddress = await collabFactory.predictDeterministicAddress(
      EMPTY_BYTES32,
    );

    const receipt = await collabFactory.createDeterministic(
      funder,
      doer,
      EMPTY_BYTES32,
    );

    collabAddress = await awaitCollabAddress(await receipt.wait());
    await expect(receipt)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);

    expect(collabAddress).to.equal(predictedAddress);
    expect(await collabFactory.getCollabAddress(0)).to.equal(collabAddress);
  });

  it('Should update collabCount', async function () {
    expect(await collabFactory.collabCount()).to.equal(0);
    let receipt = await collabFactory.create(funder, doer);
    const collab0 = await awaitCollabAddress(await receipt.wait());
    expect(await collabFactory.collabCount()).to.equal(1);
    receipt = await collabFactory.create(funder, doer);
    const collab1 = await awaitCollabAddress(await receipt.wait());
    expect(await collabFactory.collabCount()).to.equal(2);

    expect(await collabFactory.getCollabAddress(0)).to.equal(collab0);
    expect(await collabFactory.getCollabAddress(1)).to.equal(collab1);
  });

  it('Should update flatFee', async function () {
    let flatFee = await collabFactory.flatFees(signers[2].address);
    expect(flatFee).to.equal(0);
    const receipt = await collabFactory
      .connect(signers[2])
      .updateFlatFee(10, EMPTY_BYTES32);
    await expect(receipt)
      .to.emit(collabFactory, 'UpdateFlatFee')
      .withArgs(signers[2].address, 10, EMPTY_BYTES32);

    flatFee = await collabFactory.flatFees(signers[2].address);
    expect(flatFee).to.equal(10);
  });
});
