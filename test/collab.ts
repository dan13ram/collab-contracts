import { MockContract } from '@ethereum-waffle/mock-contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ContractFactory } from 'ethers';
import { ethers, waffle } from 'hardhat';

import { MetaCollab } from '../types/MetaCollab';
import { MetaCollabFactory } from '../types/MetaCollabFactory';
import {
  awaitCollabAddress,
  getGig,
  Gig,
  GigStatus,
  TYPES,
} from './utils/collabHelpers';
import {
  currentTimestamp,
  deploy,
  deploySignatureDecoder,
  erc20ABI,
  getContractAt,
  multisig,
} from './utils/ethersHelpers';

const { deployMockContract } = waffle;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('MetaCollab', () => {
  let collab: MetaCollab;
  let collabFactory: MetaCollabFactory;
  let signers: SignerWithAddress[];
  let collabAddress: string;
  let mockToken: MockContract;

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const signatureDecoder = await deploySignatureDecoder();
    mockToken = await deployMockContract(signers[0], erc20ABI());

    const metaCollabImpl = await deploy<MetaCollab>('MetaCollab', {
      SignatureDecoder: signatureDecoder.address,
    });

    const MetaCollabFactory: ContractFactory = await ethers.getContractFactory(
      'MetaCollabFactory',
    );

    collabFactory = (await MetaCollabFactory.deploy(
      metaCollabImpl.address,
    )) as MetaCollabFactory;

    await collabFactory.deployed();

    await collabFactory.connect(signers[2]).updateFlatFee(1000, EMPTY_BYTES32);

    const tx = await collabFactory.create(
      signers[0].address,
      signers[1].address,
    );
    collabAddress = await awaitCollabAddress(await tx.wait());
    await expect(tx)
      .to.emit(collabFactory, 'LogNewCollab')
      .withArgs(0, collabAddress);

    collab = await getContractAt<MetaCollab>('MetaCollab', collabAddress);
  });

  it('Should initialize correctly', async () => {
    expect(await collab.funder()).to.equal(signers[0].address);
    expect(await collab.doer()).to.equal(signers[1].address);
    expect(await collab.feeStore()).to.equal(collabFactory.address);
  });

  describe('createNewGig', () => {
    it('Should revert create gig if invalid tokens or amounts', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [mockToken.address],
          [10, 20],
          [1000, 1000, 10000],
          ZERO_ADDRESS,
          [0, 1],
          collab.address,
          0,
        ],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.createNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert create gig if invalid fee ratio', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [mockToken.address],
          [10],
          [1000, 1000, 10000],
          ZERO_ADDRESS,
          [0, 0],
          collab.address,
          0,
        ],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.createNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert create gig if invalid collab address', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [mockToken.address],
          [10],
          [1000, 1000, 10000],
          ZERO_ADDRESS,
          [0, 1],
          ZERO_ADDRESS,
          0,
        ],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.createNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert create gig if invalid collab count', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [mockToken.address],
          [10],
          [1000, 1000, 10000],
          ZERO_ADDRESS,
          [0, 1],
          collab.address,
          1,
        ],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.createNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert create gig if invalid signatures', async () => {
      const data = {
        types: TYPES.createNewGig,
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
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[2],
      ]);

      const tx = collab.createNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid signatures');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should create a new gig', async () => {
      const data = {
        types: TYPES.createNewGig,
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
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = await collab.createNewGig(encodedData, signatures);

      await tx.wait();

      await expect(tx).to.emit(collab, 'GigInit').withArgs(0, EMPTY_BYTES32);
      expect(await collab.gigCount()).to.equal(1);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.init);
      expect(gig.tokens).to.deep.equal([mockToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(1000),
        BigNumber.from(1000),
        BigNumber.from(10000),
      ]);
      expect(gig.resolver).to.equal(ZERO_ADDRESS);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(0));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });

    it('Should create a new gig with resolver flat fee', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [mockToken.address],
          [10],
          [1000, 1000, 10000],
          signers[2].address,
          [0, 1],
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

      await expect(tx).to.emit(collab, 'GigInit').withArgs(0, EMPTY_BYTES32);
      expect(await collab.gigCount()).to.equal(1);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.init);
      expect(gig.tokens).to.deep.equal([mockToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(1000),
        BigNumber.from(1000),
        BigNumber.from(10000),
      ]);
      expect(gig.resolver).to.equal(signers[2].address);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(1000));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });
  });
});
