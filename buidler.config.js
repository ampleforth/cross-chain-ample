const { usePlugin } = require('@nomiclabs/buidler/config');

usePlugin('@nomiclabs/buidler-ethers');
usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@openzeppelin/buidler-upgrades');
usePlugin('@nomiclabs/buidler-ganache');

module.exports = {
  solc: {
    version: '0.6.4'
  },
  mocha: {
    timeout: 100000
  }
};
