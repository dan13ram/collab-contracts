import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import { HardhatUserConfig } from 'hardhat/config';
declare const config: HardhatUserConfig;
export default config;
