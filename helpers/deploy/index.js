const ampl = require('./ampl');
const vault = require('./vault');
const chainBridge = require('./chain_bridge');
const matic = require('./matic');
const arbitrum = require('./arbitrum');

module.exports = {
  ...ampl,
  ...vault,
  ...chainBridge,
  ...matic,
  ...arbitrum,
};
