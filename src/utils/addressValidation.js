const bitcoin = require('bitcoinjs-lib');

/**
 * Validate Bitcoin address using bitcoinjs-lib
 * Supports mainnet and testnet addresses (P2PKH, P2SH, Bech32)
 * @param {string} address - Bitcoin address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidBitcoinAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Try mainnet first
  try {
    bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
    return true;
  } catch (error) {
    // If mainnet fails, try testnet
    try {
      bitcoin.address.toOutputScript(address, bitcoin.networks.testnet);
      return true;
    } catch (testnetError) {
      // If both fail, the address is invalid
      return false;
    }
  }
}

module.exports = {
  isValidBitcoinAddress
};
