const bitcoin = require('bitcoinjs-lib');

/**
 * Validates a Bitcoin address using bitcoinjs-lib
 * Supports both legacy (P2PKH, P2SH) and SegWit (Bech32, Bech32m) address formats
 * 
 * @param {string} address - Bitcoin address to validate
 * @param {string} network - Network type: 'mainnet', 'testnet', or 'regtest' (default: 'mainnet')
 * @returns {boolean} - True if address is valid, false otherwise
 * 
 * @example
 * isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa') // true - Legacy P2PKH
 * isValidBitcoinAddress('3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX') // true - Legacy P2SH
 * isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4') // true - SegWit Bech32
 * isValidBitcoinAddress('invalid_address') // false
 */
const isValidBitcoinAddress = (address, network = 'mainnet') => {
  // Validate input
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Trim whitespace
  address = address.trim();

  // Empty string after trim is invalid
  if (address.length === 0) {
    return false;
  }

  // Map network string to bitcoinjs-lib network object
  let bitcoinNetwork;
  switch (network.toLowerCase()) {
    case 'mainnet':
      bitcoinNetwork = bitcoin.networks.bitcoin;
      break;
    case 'testnet':
      bitcoinNetwork = bitcoin.networks.testnet;
      break;
    case 'regtest':
      bitcoinNetwork = bitcoin.networks.regtest;
      break;
    default:
      bitcoinNetwork = bitcoin.networks.bitcoin;
  }

  try {
    // Try to convert address to output script
    // This validates the address format including checksums
    // Supports P2PKH, P2SH, P2WPKH (SegWit), and P2WSH (SegWit) addresses
    bitcoin.address.toOutputScript(address, bitcoinNetwork);
    return true;
  } catch (error) {
    // Address is invalid
    return false;
  }
};

module.exports = {
  isValidBitcoinAddress
};
