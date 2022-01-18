import fs from 'fs';
import { ethers, network, run } from 'hardhat';

const networkName: { [chain: number]: string } = {
  1: 'Ethereum Mainnet',
  4: 'Rinkeby Testnet',
};

const networkCurrency: { [chain: number]: string } = {
  1: 'ETH',
  4: 'ETH',
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = await deployer.getAddress();
  if (!deployer.provider) {
    console.error('Provider not found for network');
    return;
  }
  const { chainId } = await deployer.provider.getNetwork();
  console.log('Deploying MetaCollabFactory on network:', networkName[chainId]);
  console.log('Account address:', address);
  console.log(
    'Account balance:',
    ethers.utils.formatEther(await deployer.provider.getBalance(address)),
    networkCurrency[chainId],
  );

  const SignatureDecoderFactory = await ethers.getContractFactory(
    'SignatureDecoder',
  );
  const signatureDecoderLibrary = await SignatureDecoderFactory.deploy();
  await signatureDecoderLibrary.deployed();
  console.log('SignatureDecoder Address:', signatureDecoderLibrary.address);

  const MetaCollab = await ethers.getContractFactory('MetaCollab', {
    libraries: { SignatureDecoder: signatureDecoderLibrary.address },
  });
  const metaCollab = await MetaCollab.deploy();
  await metaCollab.deployed();
  console.log('Implementation Address:', metaCollab.address);

  const MetaCollabFactory = await ethers.getContractFactory(
    'MetaCollabFactory',
  );
  const metaCollabFactory = await MetaCollabFactory.deploy(metaCollab.address);
  await metaCollabFactory.deployed();
  console.log('Factory Address:', metaCollabFactory.address);

  const txHash = metaCollabFactory.deployTransaction.hash;
  const receipt = await deployer.provider.getTransactionReceipt(txHash);
  console.log('Block Number:', receipt.blockNumber);

  const deploymentInfo = {
    network: network.name,
    factory: metaCollabFactory.address,
    implemention: metaCollab.address,
    libraries: {
      SignatureDecoder: signatureDecoderLibrary.address,
    },
    txHash,
    blockNumber: receipt.blockNumber.toString(),
  };

  fs.writeFileSync(
    `deployments/${network.name}.json`,
    JSON.stringify(deploymentInfo, undefined, 2),
  );

  try {
    console.log('Verifying Contracts...');
    metaCollabFactory.deployTransaction.wait(5);
    const TASK_VERIFY = 'verify:verify';

    await run(TASK_VERIFY, {
      address: signatureDecoderLibrary.address,
      constructorArguments: [],
    });
    console.log('Verified Library');

    await run(TASK_VERIFY, {
      address: metaCollab.address,
      constructorArguments: [],
    });
    console.log('Verified Implementation');

    await run(TASK_VERIFY, {
      address: metaCollabFactory.address,
      constructorArguments: [metaCollab.address],
    });
    console.log('Verified Factory');
  } catch (err) {
    console.error('Error verifying contracts:', err);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
