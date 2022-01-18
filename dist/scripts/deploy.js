'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = __importDefault(require('fs'));
const hardhat_1 = require('hardhat');
const networkName = {
  1: 'Ethereum Mainnet',
  4: 'Rinkeby Testnet',
};
const networkCurrency = {
  1: 'ETH',
  4: 'ETH',
};
async function main() {
  const [deployer] = await hardhat_1.ethers.getSigners();
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
    hardhat_1.ethers.utils.formatEther(
      await deployer.provider.getBalance(address),
    ),
    networkCurrency[chainId],
  );
  const SignatureDecoderFactory = await hardhat_1.ethers.getContractFactory(
    'SignatureDecoder',
  );
  const signatureDecoderLibrary = await SignatureDecoderFactory.deploy();
  await signatureDecoderLibrary.deployed();
  console.log('SignatureDecoder Address:', signatureDecoderLibrary.address);
  const MetaCollab = await hardhat_1.ethers.getContractFactory('MetaCollab', {
    libraries: { SignatureDecoder: signatureDecoderLibrary.address },
  });
  const metaCollab = await MetaCollab.deploy();
  await metaCollab.deployed();
  console.log('Implementation Address:', metaCollab.address);
  const MetaCollabFactory = await hardhat_1.ethers.getContractFactory(
    'MetaCollabFactory',
  );
  const metaCollabFactory = await MetaCollabFactory.deploy(metaCollab.address);
  await metaCollabFactory.deployed();
  console.log('Factory Address:', metaCollabFactory.address);
  const txHash = metaCollabFactory.deployTransaction.hash;
  const receipt = await deployer.provider.getTransactionReceipt(txHash);
  console.log('Block Number:', receipt.blockNumber);
  const deploymentInfo = {
    network: hardhat_1.network.name,
    factory: metaCollabFactory.address,
    implemention: metaCollab.address,
    libraries: {
      SignatureDecoder: signatureDecoderLibrary.address,
    },
    txHash,
    blockNumber: receipt.blockNumber.toString(),
  };
  fs_1.default.writeFileSync(
    `deployments/${hardhat_1.network.name}.json`,
    JSON.stringify(deploymentInfo, undefined, 2),
  );
  try {
    console.log('Verifying Contracts...');
    metaCollabFactory.deployTransaction.wait(5);
    const TASK_VERIFY = 'verify:verify';
    await (0, hardhat_1.run)(TASK_VERIFY, {
      address: signatureDecoderLibrary.address,
      constructorArguments: [],
    });
    console.log('Verified Library');
    await (0, hardhat_1.run)(TASK_VERIFY, {
      address: metaCollab.address,
      constructorArguments: [],
    });
    console.log('Verified Implementation');
    await (0, hardhat_1.run)(TASK_VERIFY, {
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
