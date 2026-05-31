const Client = require('bitcoin-core');
const logger = require('../utils/logger');

/**
 * Bitcoin Core RPC Service
 * Provides direct integration with Bitcoin Core node for wallet operations,
 * transaction broadcasting, and blockchain queries
 */

// Initialize Bitcoin Core client
let btcClient = null;

/**
 * Initialize Bitcoin Core RPC client
 * @param {Object} config - Bitcoin Core configuration
 * @returns {Client} - Bitcoin Core client instance
 */
function initializeBitcoinRpcClient(config = {}) {
  try {
    const {
      network = process.env.BTC_NETWORK || 'mainnet',
      host = process.env.BTC_RPC_HOST || 'localhost',
      port = process.env.BTC_RPC_PORT || 8332,
      username = process.env.BTC_RPC_USER,
      password = process.env.BTC_RPC_PASSWORD,
      timeout = 30000
    } = config;

    if (!username || !password) {
      logger.warn('Bitcoin Core RPC credentials not configured. RPC functionality will be disabled.');
      return null;
    }

    btcClient = new Client({
      network,
      host,
      port,
      username,
      password,
      timeout
    });

    logger.info(`Bitcoin Core RPC client initialized: ${host}:${port}`);
    return btcClient;
  } catch (error) {
    logger.error('Failed to initialize Bitcoin Core RPC client:', error);
    return null;
  }
}

/**
 * Get Bitcoin Core client instance
 * @returns {Client} - Bitcoin Core client instance
 */
function getClient() {
  if (!btcClient) {
    btcClient = initializeBitcoinRpcClient();
  }
  return btcClient;
}

/**
 * Check if RPC is available
 * @returns {boolean} - True if RPC is configured and available
 */
function isRpcAvailable() {
  return btcClient !== null;
}

/**
 * Get blockchain info
 * @returns {Promise<Object>} - Blockchain information
 */
async function getBlockchainInfo() {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const info = await client.getBlockchainInfo();
    logger.info('Retrieved blockchain info from Bitcoin Core');
    return {
      success: true,
      data: info
    };
  } catch (error) {
    logger.error('Error getting blockchain info:', error);
    throw error;
  }
}

/**
 * Get transaction details from Bitcoin Core
 * @param {string} txid - Transaction ID
 * @returns {Promise<Object>} - Transaction details
 */
async function getTransaction(txid) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const tx = await client.getRawTransaction(txid, true);
    logger.info(`Retrieved transaction ${txid} from Bitcoin Core`);
    return {
      success: true,
      data: tx
    };
  } catch (error) {
    logger.error(`Error getting transaction ${txid}:`, error);
    throw error;
  }
}

/**
 * Verify Bitcoin transaction using RPC
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in BTC
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyBitcoinTransactionRpc(txHash, expectedAddress, expectedAmount) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    logger.info(`Verifying Bitcoin transaction via RPC: ${txHash}`);

    // Get transaction details
    const tx = await client.getRawTransaction(txHash, true);

    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Find output matching our address
    const output = tx.vout.find(out => 
      out.scriptPubKey.addresses && 
      out.scriptPubKey.addresses.includes(expectedAddress)
    );

    if (!output) {
      return {
        verified: false,
        error: 'Address not found in transaction outputs'
      };
    }

    // Verify amount (Bitcoin Core returns in BTC)
    const actualAmount = output.value;
    const amountMatches = Math.abs(actualAmount - expectedAmount) < 0.00000001; // Allow for small rounding errors

    // Get confirmations
    const confirmations = tx.confirmations || 0;

    return {
      verified: amountMatches,
      amount: actualAmount,
      confirmations,
      timestamp: tx.time,
      blockHash: tx.blockhash || null,
      error: amountMatches ? null : 'Amount mismatch'
    };
  } catch (error) {
    logger.error('Bitcoin RPC transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify Bitcoin transaction via RPC'
    };
  }
}

/**
 * Create a new wallet
 * @param {string} walletName - Name of the wallet to create
 * @param {Object} options - Wallet creation options
 * @returns {Promise<Object>} - Wallet creation result
 */
async function createWallet(walletName, options = {}) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const {
      disablePrivateKeys = false,
      blank = false,
      passphrase = '',
      avoidReuse = false,
      descriptors = true
    } = options;

    const result = await client.createWallet(
      walletName,
      disablePrivateKeys,
      blank,
      passphrase,
      avoidReuse,
      descriptors
    );

    logger.info(`Created wallet: ${walletName}`);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    logger.error(`Error creating wallet ${walletName}:`, error);
    throw error;
  }
}

/**
 * Load an existing wallet
 * @param {string} walletName - Name of the wallet to load
 * @returns {Promise<Object>} - Wallet load result
 */
async function loadWallet(walletName) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const result = await client.loadWallet(walletName);
    logger.info(`Loaded wallet: ${walletName}`);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    logger.error(`Error loading wallet ${walletName}:`, error);
    throw error;
  }
}

/**
 * Get new address from wallet
 * @param {string} walletName - Name of the wallet
 * @param {string} addressType - Address type (legacy, p2sh-segwit, bech32)
 * @returns {Promise<Object>} - New address
 */
async function getNewAddress(walletName, addressType = 'bech32') {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const address = await client.command([
      { method: 'getnewaddress', parameters: ['', addressType] }
    ], { wallet: walletName });

    logger.info(`Generated new address for wallet ${walletName}`);
    return {
      success: true,
      address: address[0]
    };
  } catch (error) {
    logger.error(`Error getting new address for wallet ${walletName}:`, error);
    throw error;
  }
}

/**
 * Broadcast a transaction to the network
 * @param {string} rawTx - Raw transaction hex
 * @returns {Promise<Object>} - Transaction ID
 */
async function broadcastTransaction(rawTx) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const txid = await client.sendRawTransaction(rawTx);
    logger.info(`Broadcasted transaction: ${txid}`);
    return {
      success: true,
      txid
    };
  } catch (error) {
    logger.error('Error broadcasting transaction:', error);
    throw error;
  }
}

/**
 * Get wallet balance
 * @param {string} walletName - Name of the wallet
 * @returns {Promise<Object>} - Wallet balance
 */
async function getWalletBalance(walletName) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const balance = await client.command([
      { method: 'getbalance' }
    ], { wallet: walletName });

    logger.info(`Retrieved balance for wallet ${walletName}`);
    return {
      success: true,
      balance: balance[0]
    };
  } catch (error) {
    logger.error(`Error getting balance for wallet ${walletName}:`, error);
    throw error;
  }
}

/**
 * List wallet transactions
 * @param {string} walletName - Name of the wallet
 * @param {number} count - Number of transactions to return
 * @returns {Promise<Object>} - List of transactions
 */
async function listTransactions(walletName, count = 10) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const transactions = await client.command([
      { method: 'listtransactions', parameters: ['*', count] }
    ], { wallet: walletName });

    logger.info(`Retrieved ${transactions[0].length} transactions for wallet ${walletName}`);
    return {
      success: true,
      transactions: transactions[0]
    };
  } catch (error) {
    logger.error(`Error listing transactions for wallet ${walletName}:`, error);
    throw error;
  }
}

/**
 * Estimate transaction fee
 * @param {number} confirmationTarget - Target number of blocks for confirmation
 * @returns {Promise<Object>} - Estimated fee rate
 */
async function estimateFee(confirmationTarget = 6) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('Bitcoin Core RPC not configured');
    }

    const feeRate = await client.estimateSmartFee(confirmationTarget);
    logger.info(`Estimated fee rate for ${confirmationTarget} blocks: ${feeRate.feerate}`);
    return {
      success: true,
      feeRate: feeRate.feerate,
      blocks: feeRate.blocks
    };
  } catch (error) {
    logger.error('Error estimating fee:', error);
    throw error;
  }
}

module.exports = {
  initializeBitcoinRpcClient,
  getClient,
  isRpcAvailable,
  getBlockchainInfo,
  getTransaction,
  verifyBitcoinTransactionRpc,
  createWallet,
  loadWallet,
  getNewAddress,
  broadcastTransaction,
  getWalletBalance,
  listTransactions,
  estimateFee
};
