'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k];
          },
        });
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('@typechain/hardhat');
require('hardhat-gas-reporter');
require('solidity-coverage');
const dotenv = __importStar(require('dotenv'));
const config_1 = require('hardhat/config');
dotenv.config();
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
(0, config_1.task)(
  'accounts',
  'Prints the list of accounts',
  async (_args, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
      console.log(account.address);
    }
  },
);
// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config = {
  solidity: '0.8.11',
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: 'types',
  },
};
exports.default = config;
