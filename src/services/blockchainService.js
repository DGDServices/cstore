const { Web3 } = require('web3');
const axios = require('axios');
const logger = require('../utils/logger');
const bitcoinRpcService = require('./bitcoinRpcService');

// Initialize Web3 for Ethereum
const web3 = new Web3(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com');

/**
 * Blockchain Service for verifying cryptocurrency transactions
 * This service provides methods to verify transactions on different blockchains
 */

/**
 * Verify Bitcoin transaction
 * Uses Bitcoin Core RPC if available, otherwise falls back to blockchain.info API
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in BTC
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyBitcoinTransaction(txHash, expectedAddress, expectedAmount) {
  try {
    logger.info(`Verifying Bitcoin transaction: ${txHash}`);

    // Try Bitcoin Core RPC first if available
    if (bitcoinRpcService.isRpcAvailable()) {
      logger.info('Using Bitcoin Core RPC for verification');
      return await bitcoinRpcService.verifyBitcoinTransactionRpc(txHash, expectedAddress, expectedAmount);
    }

    // Fall back to blockchain.info API
    logger.info('Using blockchain.info API for verification');
    const apiUrl = `https://blockchain.info/rawtx/${txHash}`;
    const response = await axios.get(apiUrl);
    const tx = response.data;

    // Check if transaction exists
    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Find output matching our address
    const output = tx.out.find(out => 
      out.addr === expectedAddress
    );

    if (!output) {
      return {
        verified: false,
        error: 'Address not found in transaction outputs'
      };
    }

    // Convert satoshi to BTC
    const receivedAmount = output.value / 100000000;

    // Verify amount (allow small tolerance for fees)
    const tolerance = 0.0001; // 0.01% tolerance
    const amountVerified = Math.abs(receivedAmount - expectedAmount) < tolerance;

    return {
      verified: amountVerified,
      transactionHash: txHash,
      fromAddress: tx.inputs[0]?.prev_out?.addr || 'Unknown',
      toAddress: expectedAddress,
      amount: receivedAmount,
      expectedAmount: expectedAmount,
      confirmations: tx.block_height ? await getBitcoinConfirmations(tx.block_height) : 0,
      timestamp: tx.time,
      blockHash: tx.block_hash || null,
      error: amountVerified ? null : 'Amount mismatch'
    };

  } catch (error) {
    logger.error('Bitcoin transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify Bitcoin transaction'
    };
  }
}

/**
 * Get Bitcoin confirmations
 * @param {number} blockHeight - Block height of transaction
 * @returns {Promise<number>} - Number of confirmations
 */
async function getBitcoinConfirmations(blockHeight) {
  try {
    const response = await axios.get('https://blockchain.info/latestblock');
    const latestBlock = response.data.height;
    return latestBlock - blockHeight + 1;
  } catch (error) {
    logger.error('Error getting Bitcoin confirmations:', error);
    return 0;
  }
}

/**
 * Verify Ethereum transaction
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in ETH
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyEthereumTransaction(txHash, expectedAddress, expectedAmount) {
  try {
    logger.info(`Verifying Ethereum transaction: ${txHash}`);

    // Get transaction receipt
    const tx = await web3.eth.getTransaction(txHash);
    const receipt = await web3.eth.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return {
        verified: false,
        error: 'Transaction not found or not confirmed'
      };
    }

    // Check if transaction was successful
    if (!receipt.status) {
      return {
        verified: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Normalize addresses for comparison
    const normalizedExpected = expectedAddress.toLowerCase();
    const normalizedTo = tx.to.toLowerCase();

    // Verify recipient address
    if (normalizedTo !== normalizedExpected) {
      return {
        verified: false,
        error: 'Address mismatch'
      };
    }

    // Convert Wei to ETH
    const receivedAmount = parseFloat(web3.utils.fromWei(tx.value, 'ether'));

    // Verify amount
    const tolerance = 0.0001; // Small tolerance
    const amountVerified = Math.abs(receivedAmount - expectedAmount) < tolerance;

    // Get current block number for confirmations
    const currentBlock = await web3.eth.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    return {
      verified: amountVerified && receipt.status,
      transactionHash: txHash,
      fromAddress: tx.from,
      toAddress: tx.to,
      amount: receivedAmount,
      expectedAmount: expectedAmount,
      confirmations: confirmations,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed.toString(),
      timestamp: tx.blockNumber ? (await web3.eth.getBlock(tx.blockNumber)).timestamp : null,
      error: amountVerified ? null : 'Amount mismatch'
    };

  } catch (error) {
    logger.error('Ethereum transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify Ethereum transaction'
    };
  }
}

/**
 * Verify USDT (ERC-20) transaction on Ethereum
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in USDT
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyUSDTTransaction(txHash, expectedAddress, expectedAmount) {
  try {
    logger.info(`Verifying USDT transaction: ${txHash}`);

    // USDT contract address on Ethereum mainnet
    const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    // Get transaction receipt
    const tx = await web3.eth.getTransaction(txHash);
    const receipt = await web3.eth.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return {
        verified: false,
        error: 'Transaction not found or not confirmed'
      };
    }

    // Check if transaction was successful
    if (!receipt.status) {
      return {
        verified: false,
        error: 'Transaction failed on blockchain'
      };
    }

    // Verify it's a USDT transaction
    if (tx.to.toLowerCase() !== USDT_CONTRACT.toLowerCase()) {
      return {
        verified: false,
        error: 'Not a USDT transaction'
      };
    }

    // Parse transfer event from logs
    const transferEvent = receipt.logs.find(log => 
      log.topics[0] === web3.utils.sha3('Transfer(address,address,uint256)')
    );

    if (!transferEvent) {
      return {
        verified: false,
        error: 'Transfer event not found'
      };
    }

    // Decode transfer event
    const toAddress = '0x' + transferEvent.topics[2].slice(26);
    const amount = web3.utils.hexToNumber(transferEvent.data);
    const receivedAmount = amount / 1000000; // USDT has 6 decimals

    // Verify recipient address
    if (toAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      return {
        verified: false,
        error: 'Address mismatch'
      };
    }

    // Verify amount
    const tolerance = 0.01; // Small tolerance for USDT
    const amountVerified = Math.abs(receivedAmount - expectedAmount) < tolerance;

    // Get confirmations
    const currentBlock = await web3.eth.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    return {
      verified: amountVerified && receipt.status,
      transactionHash: txHash,
      fromAddress: tx.from,
      toAddress: toAddress,
      amount: receivedAmount,
      expectedAmount: expectedAmount,
      confirmations: confirmations,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      timestamp: tx.blockNumber ? (await web3.eth.getBlock(tx.blockNumber)).timestamp : null,
      error: amountVerified ? null : 'Amount mismatch'
    };

  } catch (error) {
    logger.error('USDT transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify USDT transaction'
    };
  }
}

/**
 * Verify Litecoin transaction
 * Uses blockchair.com API for LTC verification
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in LTC
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyLitecoinTransaction(txHash, expectedAddress, expectedAmount) {
  try {
    logger.info(`Verifying Litecoin transaction: ${txHash}`);

    // Use blockchair.com API for LTC verification
    const apiUrl = `https://api.blockchair.com/litecoin/dashboards/transaction/${txHash}`;
    const response = await axios.get(apiUrl);
    const tx = response.data.data[txHash];

    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Find output matching our address
    const output = tx.outputs.find(out => 
      out.recipient === expectedAddress
    );

    if (!output) {
      return {
        verified: false,
        error: 'Address not found in transaction outputs'
      };
    }

    // Convert from litoshis to LTC
    const receivedAmount = output.value / 100000000;

    // Verify amount
    const tolerance = 0.0001;
    const amountVerified = Math.abs(receivedAmount - expectedAmount) < tolerance;

    // Get confirmations
    const confirmations = tx.transaction.block_id ? (response.data.context.state - tx.transaction.block_id + 1) : 0;

    return {
      verified: amountVerified,
      transactionHash: txHash,
      fromAddress: tx.inputs[0]?.recipient || 'Unknown',
      toAddress: expectedAddress,
      amount: receivedAmount,
      expectedAmount: expectedAmount,
      confirmations: confirmations,
      timestamp: tx.transaction.time,
      blockHash: tx.transaction.block_id || null,
      error: amountVerified ? null : 'Amount mismatch'
    };
  } catch (error) {
    logger.error('Litecoin transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify Litecoin transaction'
    };
  }
}

/**
 * Verify XRP (Ripple) transaction
 * Uses xrpl library to verify XRP transactions
 * @param {string} txHash - Transaction hash
 * @param {string} expectedAddress - Expected recipient address
 * @param {number} expectedAmount - Expected amount in XRP
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyXRPTransaction(txHash, expectedAddress, expectedAmount) {
  try {
    logger.info(`Verifying XRP transaction: ${txHash}`);

    // Use public XRP API
    const apiUrl = `https://s1.ripple.com:51234/`;
    const response = await axios.post(apiUrl, {
      method: 'tx',
      params: [{
        transaction: txHash,
        binary: false
      }]
    });

    const tx = response.data.result;

    if (!tx || tx.status !== 'success') {
      return {
        verified: false,
        error: 'Transaction not found or failed'
      };
    }

    // Verify recipient
    if (tx.Destination !== expectedAddress) {
      return {
        verified: false,
        error: 'Address mismatch'
      };
    }

    // XRP amounts are in drops (1 XRP = 1,000,000 drops)
    const receivedAmount = parseFloat(tx.Amount) / 1000000;

    // Verify amount
    const tolerance = 0.0001;
    const amountVerified = Math.abs(receivedAmount - expectedAmount) < tolerance;

    // Get ledger info for confirmations
    let confirmations = 0;
    try {
      const ledgerResponse = await axios.post(apiUrl, {
        method: 'ledger',
        params: [{ ledger_index: 'validated' }]
      });
      const currentLedger = ledgerResponse.data.result.ledger_index;
      confirmations = currentLedger - (tx.ledger_index || 0);
    } catch (err) {
      logger.warn('Could not get XRP confirmations:', err);
    }

    return {
      verified: amountVerified,
      transactionHash: txHash,
      fromAddress: tx.Account,
      toAddress: tx.Destination,
      amount: receivedAmount,
      expectedAmount: expectedAmount,
      confirmations: confirmations,
      timestamp: tx.date ? (tx.date + 946684800) : null, // Ripple epoch to Unix epoch
      ledgerIndex: tx.ledger_index,
      error: amountVerified ? null : 'Amount mismatch'
    };
  } catch (error) {
    logger.error('XRP transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Failed to verify XRP transaction'
    };
  }
}

/**
 * Verify cryptocurrency transaction based on currency type
 * @param {string} cryptocurrency - Currency type (BTC, ETH, USDT, LTC, XRP)
 * @param {string} txHash - Transaction hash
 * @param {string} address - Expected recipient address
 * @param {number} amount - Expected amount
 * @returns {Promise<Object>} - Transaction verification result
 */
async function verifyTransaction(cryptocurrency, txHash, address, amount) {
  try {
    let result;

    switch (cryptocurrency.toUpperCase()) {
      case 'BTC':
        result = await verifyBitcoinTransaction(txHash, address, amount);
        break;
      case 'ETH':
        result = await verifyEthereumTransaction(txHash, address, amount);
        break;
      case 'USDT':
        result = await verifyUSDTTransaction(txHash, address, amount);
        break;
      case 'LTC':
        result = await verifyLitecoinTransaction(txHash, address, amount);
        break;
      case 'XRP':
        result = await verifyXRPTransaction(txHash, address, amount);
        break;
      default:
        result = {
          verified: false,
          error: `Unsupported cryptocurrency: ${cryptocurrency}`
        };
    }

    return result;
  } catch (error) {
    logger.error('Transaction verification error:', error);
    return {
      verified: false,
      error: error.message || 'Transaction verification failed'
    };
  }
}

/**
 * Get current cryptocurrency price in USD
 * @param {string} symbol - Cryptocurrency symbol (BTC, ETH, USDT, LTC, XRP)
 * @returns {Promise<number>} - Price in USD
 */
async function getCryptoPrice(symbol) {
  try {
    // Map symbols to CoinGecko IDs
    const coinIdMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'LTC': 'litecoin',
      'XRP': 'ripple'
    };
    
    const coinId = coinIdMap[symbol.toUpperCase()] || symbol.toLowerCase();
    
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    return response.data[coinId]?.usd || 0;
  } catch (error) {
    logger.error('Error fetching crypto price:', error);
    return 0;
  }
}

/**
 * Monitor pending payment for confirmation
 * This would typically be called by a background job
 * @param {string} paymentId - Payment document ID
 * @param {number} maxAttempts - Maximum verification attempts
 * @param {number} intervalMs - Interval between checks in milliseconds
 * @returns {Promise<Object>} - Monitoring result
 */
async function monitorPayment(paymentId, maxAttempts = 10, intervalMs = 60000) {
  try {
    const Payment = require('../models/Payment');
    const Order = require('../models/Order');
    const { sendPaymentConfirmationEmail } = require('./emailService');

    logger.info(`Starting payment monitoring for ${paymentId}`);
    
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Fetch payment details
      const payment = await Payment.findById(paymentId).populate('order');
      
      if (!payment) {
        logger.error(`Payment not found: ${paymentId}`);
        return {
          success: false,
          error: 'Payment not found'
        };
      }

      // Skip if already confirmed
      if (payment.status === 'confirmed') {
        logger.info(`Payment already confirmed: ${paymentId}`);
        return {
          success: true,
          status: 'confirmed',
          attempts
        };
      }

      // Verify transaction
      const verification = await verifyTransaction(
        payment.cryptocurrency,
        payment.transactionHash,
        payment.address,
        payment.amount
      );

      if (verification.verified && verification.confirmations >= 1) {
        // Update payment status
        payment.status = 'confirmed';
        payment.verificationResult = verification;
        await payment.save();

        // Update order status
        if (payment.order) {
          const order = await Order.findById(payment.order);
          if (order) {
            order.status = 'confirmed';
            order.paymentStatus = 'confirmed';
            await order.save();

            // Send confirmation email
            try {
              await sendPaymentConfirmationEmail(
                order.customerEmail,
                order,
                payment
              );
            } catch (emailError) {
              logger.error('Failed to send payment confirmation email:', emailError);
            }
          }
        }

        logger.info(`Payment confirmed: ${paymentId} after ${attempts} attempts`);
        
        // Trigger webhook if configured
        await triggerPaymentWebhook(payment, 'payment.confirmed');

        return {
          success: true,
          status: 'confirmed',
          attempts,
          verification
        };
      }

      // Wait before next attempt
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    logger.warn(`Payment monitoring timeout: ${paymentId} after ${maxAttempts} attempts`);
    
    return {
      success: false,
      status: 'pending',
      attempts,
      message: 'Max monitoring attempts reached'
    };
  } catch (error) {
    logger.error('Payment monitoring error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Trigger webhook for payment events
 * @param {Object} payment - Payment object
 * @param {string} event - Event type
 * @returns {Promise<Object>} - Webhook result
 */
async function triggerPaymentWebhook(payment, event) {
  try {
    const webhookUrl = process.env.PAYMENT_WEBHOOK_URL;
    
    if (!webhookUrl) {
      logger.debug('No webhook URL configured');
      return { success: false, message: 'Webhook not configured' };
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      payment: {
        id: payment._id,
        orderId: payment.order,
        cryptocurrency: payment.cryptocurrency,
        amount: payment.amount,
        transactionHash: payment.transactionHash,
        status: payment.status,
        confirmations: payment.verificationResult?.confirmations || 0
      }
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET || ''
      },
      timeout: 10000
    });

    logger.info(`Webhook triggered for ${event}: ${payment._id}`);
    
    return {
      success: true,
      status: response.status
    };
  } catch (error) {
    logger.error('Webhook trigger error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enhanced transaction verification with retry logic
 * @param {string} cryptocurrency - Currency type
 * @param {string} txHash - Transaction hash
 * @param {string} address - Expected recipient address
 * @param {number} amount - Expected amount
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} - Verification result
 */
async function verifyTransactionWithRetry(cryptocurrency, txHash, address, amount, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Transaction verification attempt ${attempt}/${maxRetries} for ${txHash}`);
      
      const result = await verifyTransaction(cryptocurrency, txHash, address, amount);
      
      if (result.verified || !result.error) {
        return result;
      }
      
      lastError = result.error;
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error.message;
      logger.error(`Verification attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return {
    verified: false,
    error: lastError || 'Verification failed after all retry attempts'
  };
}

/**
 * Get transaction status and details
 * @param {string} cryptocurrency - Currency type
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} - Transaction status
 */
async function getTransactionStatus(cryptocurrency, txHash) {
  try {
    const result = await verifyTransaction(cryptocurrency, txHash, '', 0);
    
    return {
      success: true,
      exists: result.verified !== undefined,
      confirmations: result.confirmations || 0,
      timestamp: result.timestamp,
      blockHash: result.blockHash,
      status: result.confirmations >= 1 ? 'confirmed' : 'pending'
    };
  } catch (error) {
    logger.error('Get transaction status error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  verifyTransaction,
  verifyBitcoinTransaction,
  verifyEthereumTransaction,
  verifyUSDTTransaction,
  verifyLitecoinTransaction,
  verifyXRPTransaction,
  getCryptoPrice,
  monitorPayment,
  triggerPaymentWebhook,
  verifyTransactionWithRetry,
  getTransactionStatus
};
