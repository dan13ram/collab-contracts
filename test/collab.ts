import { MockContract } from '@ethereum-waffle/mock-contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ContractFactory } from 'ethers';
import { ethers, waffle } from 'hardhat';

import { MetaCollab } from '../types/MetaCollab';
import { MetaCollabFactory } from '../types/MetaCollabFactory';
import {
  awaitCollabAddress,
  createTestGig,
  getGig,
  Gig,
  GigStatus,
  startTestGig,
  TYPES,
} from './utils/collabHelpers';
import {
  currentTimestamp,
  increaseTimestamp,
  deploy,
  deploySignatureDecoder,
  erc20ABI,
  getContractAt,
  multisig,
} from './utils/ethersHelpers';

const { deployMockContract, provider } = waffle;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('MetaCollab', () => {
  let collab: MetaCollab;
  let collabFactory: MetaCollabFactory;
  let signers: SignerWithAddress[];
  let collabAddress: string;
  let firstToken: MockContract;
  let secondToken: MockContract;

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const signatureDecoder = await deploySignatureDecoder();
    firstToken = await deployMockContract(signers[0], erc20ABI());
    secondToken = await deployMockContract(signers[0], erc20ABI());

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

    await collabFactory.connect(signers[2]).updateFlatFee(10, EMPTY_BYTES32);

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
          [firstToken.address],
          [10, 20],
          [10, 10, 20],
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
      expect(gig.tokens).to.deep.equal([firstToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.resolver).to.equal(ZERO_ADDRESS);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(0));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });

    it('Should create a new gig with two tokens', async () => {
      const data = {
        types: TYPES.createNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address, secondToken.address],
          [10, 20],
          [10, 10, 20],
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
      expect(gig.tokens).to.deep.equal([
        firstToken.address,
        secondToken.address,
      ]);
      expect(gig.amounts).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
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
          [firstToken.address],
          [10],
          [10, 10, 20],
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
      expect(gig.tokens).to.deep.equal([firstToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.resolver).to.equal(signers[2].address);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(10));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });
  });

  describe('startNewGig', () => {
    it('Should revert start gig if invalid tokens or amounts', async () => {
      const data = {
        types: TYPES.startNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address],
          [10, 20],
          [10, 10, 20],
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

      const tx = collab.startNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert start gig if invalid fee ratio', async () => {
      const data = {
        types: TYPES.startNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address],
          [10],
          [10, 10, 20],
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

      const tx = collab.startNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert start gig if invalid collab address', async () => {
      const data = {
        types: TYPES.startNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address],
          [10],
          [10, 10, 20],
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

      const tx = collab.startNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert start gig if invalid collab count', async () => {
      const data = {
        types: TYPES.startNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address],
          [10],
          [10, 10, 20],
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

      const tx = collab.startNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid data');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should revert start gig if invalid signatures', async () => {
      const data = {
        types: TYPES.startNewGig,
        values: [
          EMPTY_BYTES32,
          [firstToken.address],
          [10],
          [10, 10, 20],
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

      const tx = collab.startNewGig(encodedData, signatures);

      await expect(tx).to.be.revertedWith('invalid signatures');
      expect(await collab.gigCount()).to.equal(0);
    });

    it('Should create and start a new gig', async () => {
      const tx = await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        ZERO_ADDRESS,
      );

      await expect(tx).to.emit(collab, 'GigInit').withArgs(0, EMPTY_BYTES32);
      expect(await collab.gigCount()).to.equal(1);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.active);
      expect(gig.tokens).to.deep.equal([firstToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.resolver).to.equal(ZERO_ADDRESS);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(0));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });

    it('Should create and start a new gig with two tokens', async () => {
      const tx = await startTestGig(
        collab,
        signers,
        [firstToken, secondToken],
        [10, 20],
        ZERO_ADDRESS,
      );

      await expect(tx).to.emit(collab, 'GigInit').withArgs(0, EMPTY_BYTES32);
      expect(await collab.gigCount()).to.equal(1);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.active);
      expect(gig.tokens).to.deep.equal([
        firstToken.address,
        secondToken.address,
      ]);
      expect(gig.amounts).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.resolver).to.equal(ZERO_ADDRESS);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(0));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });

    it('Should create and start a new gig with resolver flat fee', async () => {
      const tx = await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );

      await expect(tx).to.emit(collab, 'GigInit').withArgs(0, EMPTY_BYTES32);
      expect(await collab.gigCount()).to.equal(1);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.active);
      expect(gig.tokens).to.deep.equal([firstToken.address]);
      expect(gig.amounts).to.deep.equal([BigNumber.from(10)]);
      expect(gig.startTimestamp.toNumber()).to.equal(await currentTimestamp());
      expect(gig.countdownTimestamp).to.equal(BigNumber.from(0));
      expect(gig.durations).to.deep.equal([
        BigNumber.from(10),
        BigNumber.from(10),
        BigNumber.from(20),
      ]);
      expect(gig.resolver).to.equal(signers[2].address);
      expect(gig.flatResolverFee).to.equal(BigNumber.from(10));
      expect(gig.feeRewardRatio).to.deep.equal([0, 1]);
      expect(gig.thirdParties).to.deep.equal([ZERO_ADDRESS, ZERO_ADDRESS]);
    });
  });

  describe('startGig', () => {
    it('Should revert start if not funder', async () => {
      const tx = collab.connect(signers[1]).startGig(0);
      await expect(tx).to.be.revertedWith('only funder');
    });

    it('Should revert start if gig does not exist', async () => {
      const tx = collab.startGig(0);
      await expect(tx).to.be.revertedWith('invalid gig');
    });

    it('Should revert start if already started', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      expect(await collab.gigCount()).to.equal(1);

      await expect(collab.startGig(0)).to.be.revertedWith('invalid gig');
    });

    it('Should start an existing gig', async () => {
      await createTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      await firstToken.mock.transferFrom
        .withArgs(signers[0].address, collab.address, 10)
        .returns(true);

      const tx = await collab.startGig(0);

      await tx.wait();

      await expect(tx).to.emit(collab, 'GigActive').withArgs(0);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.active);
    });

    it('Should start an existing gig with two tokens', async () => {
      await createTestGig(
        collab,
        signers,
        [firstToken, secondToken],
        [10, 20],
        ZERO_ADDRESS,
      );

      await firstToken.mock.transferFrom
        .withArgs(signers[0].address, collab.address, 10)
        .returns(true);
      await secondToken.mock.transferFrom
        .withArgs(signers[0].address, collab.address, 20)
        .returns(true);

      const tx = await collab.startGig(0);

      await tx.wait();

      await expect(tx).to.emit(collab, 'GigActive').withArgs(0);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.active);
    });
  });

  describe('cancelGig', () => {
    it('Should revert cancel if not funder', async () => {
      const tx = collab.connect(signers[1]).cancelGig(0);
      await expect(tx).to.be.revertedWith('only funder');
    });

    it('Should revert cancel if gig does not exist', async () => {
      const tx = collab.cancelGig(0);
      await expect(tx).to.be.revertedWith('invalid gig');
    });

    it('Should cancel gig if not started', async () => {
      await createTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      expect(await collab.gigCount()).to.equal(1);

      const tx = await collab.cancelGig(0);

      await expect(tx).to.emit(collab, 'GigCancelled').withArgs(0);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.cancelled);
    });

    it('Should revert cancel gig if after cancellation and before expiration', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      expect(await collab.gigCount()).to.equal(1);

      await increaseTimestamp(11);

      await expect(collab.cancelGig(0)).to.be.revertedWith('invalid timestamp');
    });

    it('Should cancel gig if within cancellation duration', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);
      expect(await collab.gigCount()).to.equal(1);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[0].address, 10)
        .returns(true);
      const tx = await collab.cancelGig(0);

      await expect(tx).to.emit(collab, 'GigCancelled').withArgs(0);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.cancelled);
    });

    it('Should cancel gig if after expiration', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      expect(await collab.gigCount()).to.equal(1);

      await increaseTimestamp(21);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[0].address, 10)
        .returns(true);
      const tx = await collab.cancelGig(0);

      await expect(tx).to.emit(collab, 'GigCancelled').withArgs(0);

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.cancelled);
    });
  });

  describe('lockGig', () => {
    it('Should revert lock if invalid resolver', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);
      const tx = collab.lockGig(0);
      await expect(tx).to.be.revertedWith('invalid resolver');
    });

    it('Should revert lock if not party', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      const tx = collab.connect(signers[3]).lockGig(0);
      await expect(tx).to.be.revertedWith('only party');
    });

    it('Should revert lock if gig not started', async () => {
      await createTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      const tx = collab.lockGig(0);
      await expect(tx).to.be.revertedWith('invalid gig');
    });

    it('Should start countdown on lock', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      const tx = await collab.lockGig(0);
      await expect(tx).to.emit(collab, 'GigLockCountdownStarted').withArgs(0);
      await tx.wait();

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.countdown);
      expect(gig.countdownTimestamp).to.equal(await currentTimestamp());
    });

    it('Should revert if still counting on lock', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);

      await expect(collab.lockGig(0)).to.be.revertedWith('still counting');
    });

    it('Should revert if still counting on lock', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);
      await increaseTimestamp(11);

      await expect(collab.lockGig(0)).to.be.revertedWith('invalid value');
    });

    it('Should lock after countdown', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);
      await increaseTimestamp(11);

      const balance = await provider.getBalance(signers[2].address);
      const tx = await collab.lockGig(0, { value: 10 });
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigLockedForDispute').withArgs(0);
      expect(await provider.getBalance(signers[2].address)).to.equal(
        balance.add(10),
      );

      const gig: Gig = await getGig(collab, 0);

      expect(gig.status).to.equal(GigStatus.locked);
    });
  });

  describe('completeGig', () => {
    it('Should revert complete if invalid signatures', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[2],
      ]);

      const tx = collab.completeGig(encodedData, signatures);
      await expect(tx).to.be.revertedWith('invalid signatures');
    });

    it('Should revert complete if invalid data', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [ZERO_ADDRESS, 0, [0, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.completeGig(encodedData, signatures);
      await expect(tx).to.be.revertedWith('invalid data');
    });

    it('Should revert complete if invalid gig', async () => {
      await createTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.completeGig(encodedData, signatures);
      await expect(tx).to.be.revertedWith('invalid gig');
    });

    it('Should revert complete if invalid ratio', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 0]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.completeGig(encodedData, signatures);
      await expect(tx).to.be.revertedWith('invalid ratio');
    });

    it('Should revert complete if locked', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);
      await increaseTimestamp(11);
      await collab.lockGig(0, { value: 10 });

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 0]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      const tx = collab.completeGig(encodedData, signatures);
      await expect(tx).to.be.revertedWith('invalid gig');
    });

    it('Should complete gig', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[1].address, 10)
        .returns(true);

      const tx = await collab.completeGig(encodedData, signatures);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigDone').withArgs(0, [0, 1]);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.status).to.equal(GigStatus.done);
    });

    it('Should complete gig in countdown', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );

      await collab.lockGig(0);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [0, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[1].address, 10)
        .returns(true);

      const tx = await collab.completeGig(encodedData, signatures);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigDone').withArgs(0, [0, 1]);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.status).to.equal(GigStatus.done);
    });

    it('Should complete gig with reward ratio', async () => {
      await startTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const data = {
        types: TYPES.completeGig,
        values: [collab.address, 0, [1, 1]],
      };
      const [encodedData, signatures] = await multisig(data, [
        signers[0],
        signers[1],
      ]);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[0].address, 5)
        .returns(true);

      await firstToken.mock.transferFrom
        .withArgs(collab.address, signers[1].address, 5)
        .returns(true);

      const tx = await collab.completeGig(encodedData, signatures);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigDone').withArgs(0, [1, 1]);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.status).to.equal(GigStatus.done);
    });
  });

  describe('updateThirdParty', () => {
    it('Should revert updateThirdParty if not party', async () => {
      await createTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const tx = collab.connect(signers[2]).updateThirdParty(0, ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith('only party');
    });

    it('Should revert updateThirdParty if invalid address', async () => {
      await createTestGig(collab, signers, [firstToken], [10], ZERO_ADDRESS);

      const tx = collab.updateThirdParty(0, ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith('invalid thirdParty');
    });

    it('Should revert updateThirdParty if locked', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);
      await increaseTimestamp(11);
      await collab.lockGig(0, { value: 10 });

      const tx = collab.updateThirdParty(0, signers[3].address);
      await expect(tx).to.be.revertedWith('invalid gig');
    });
    it('Should updateThirdParty', async () => {
      await createTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );

      const tx = await collab.updateThirdParty(0, signers[3].address);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigThirdPartyUpdated').withArgs(0);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.thirdParties).to.deep.equal([
        signers[3].address,
        ZERO_ADDRESS,
      ]);
    });

    it('Should updateThirdParty after start', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );

      const tx = await collab.updateThirdParty(0, signers[3].address);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigThirdPartyUpdated').withArgs(0);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.thirdParties).to.deep.equal([
        signers[3].address,
        ZERO_ADDRESS,
      ]);
    });

    it('Should updateThirdParty in countdown', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);

      const tx = await collab.updateThirdParty(0, signers[3].address);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigThirdPartyUpdated').withArgs(0);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.thirdParties).to.deep.equal([
        signers[3].address,
        ZERO_ADDRESS,
      ]);
    });

    it('Should updateThirdParty for both parties', async () => {
      await startTestGig(
        collab,
        signers,
        [firstToken],
        [10],
        signers[2].address,
      );
      await collab.lockGig(0);

      let tx = await collab.updateThirdParty(0, signers[3].address);
      await tx.wait();
      tx = await collab
        .connect(signers[1])
        .updateThirdParty(0, signers[4].address);
      await tx.wait();

      await expect(tx).to.emit(collab, 'GigThirdPartyUpdated').withArgs(0);

      const gig: Gig = await getGig(collab, 0);
      expect(gig.thirdParties).to.deep.equal([
        signers[3].address,
        signers[4].address,
      ]);
    });
  });
});
