const fetch = require('node-fetch');
const yaml = require('js-yaml');
const ethers = require('ethers');

const HARDHAT_CONFIG_PATH = __dirname + '/../hardhat.config.js';

const sleep = (timeSec) => {
  console.log('Sleeping', timeSec);
  return new Promise((r) => setTimeout(r, timeSec * 1000));
};

const fetchAndParseYAML = async (url) => {
  const r = await fetch(url);
  return yaml.load(await r.text());
};

const getEthersProvider = (network) => {
  const hhConfig = require(HARDHAT_CONFIG_PATH);
  return new ethers.providers.JsonRpcProvider(hhConfig.networks[network].url);
};

module.exports = {
  sleep,
  fetchAndParseYAML,
  getEthersProvider,
};
