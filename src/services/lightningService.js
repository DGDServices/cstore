const lnService = require('ln-service');
const logger = require('../utils/logger');
const LightningInvoice = require('../models/LightningInvoice');
const LightningChannel = require('../models/LightningChannel');
const lightningWebhook = require('./lightningWebhook');
const lightningMonitoring = require('./lightningMonitoring');

/**
 * Lightning Network Service
 * Provides Lightning Network functionality for fast, low-cost Bitcoin transactions
 */

let lnd = null;
let isLightningAvailable = false;

/**
 * Initialize Lightning Network Daemon connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function initializeLightning() {
  try {
    // Check if Lightning is configured
    const lndSocket = process.env.LND_SOCKET || process.env.LND_HOST;
    const lndMacaroon = process.env.LND_MACAROON;
    const lndCert = process.env.LND_CERT;

    if (!lndSocket || !lndMacaroon) {
      logger.info('Lightning Network not configured - skipping initialization');
      isLightningAvailable = false;
      return false;
    }

    // Initialize LND connection
    const lndConfig = {
      socket: lndSocket,
      macaroon: lndMacaroon
    };

    // Add cert if provided
    if (lndCert) {
      lndConfig.cert = lndCert;
    }

    // Authenticate with LND
    lnd = lnService.authenticatedLndGrpc(lndConfig);

    // Test connection by getting wallet info
    const { public_key } = await lnService.getWalletInfo({ lnd: lnd.lnd });
    
    logger.info(`Lightning Network connected successfully. Node public key: ${public_key}`);
    isLightningAvailable = true;
    
    // Start invoice monitoring
    startInvoiceMonitoring();
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Lightning Network:', error);
    isLightningAvailable = false;
    return false;
  }
}

/**
 * Check if Lightning Network is available
 * @returns {boolean}
 */
function isLndAvailable() {
  return isLightningAvailable && lnd !== null;
}

/**
 * Get Lightning wallet info
 * @returns {Promise<Object>}
 */
async function getWalletInfo() {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const info = await lnService.getWalletInfo({ lnd: lnd.lnd });
    return {
      publicKey: info.public_key,
      alias: info.alias,
      version: info.version,
      chains: info.chains,
      numPendingChannels: info.pending_channels_count,
      numActiveChannels: info.active_channels_count,
      numPeers: info.peers_count,
      blockHeight: info.current_block_height,
      blockHash: info.current_block_hash,
      synced: info.is_synced_to_chain,
      syncedToGraph: info.is_synced_to_graph
    };
  } catch (error) {
    logger.error('Error getting Lightning wallet info:', error);
    throw error;
  }
}

/**
 * Get Lightning wallet balance
 * @returns {Promise<Object>}
 */
async function getBalance() {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const chainBalance = await lnService.getChainBalance({ lnd: lnd.lnd });
    const channelBalance = await lnService.getChannelBalance({ lnd: lnd.lnd });
    
    return {
      chainBalance: chainBalance.chain_balance,
      pendingChainBalance: chainBalance.pending_chain_balance,
      channelBalance: channelBalance.channel_balance,
      pendingChannelBalance: channelBalance.pending_balance,
      unsettledBalance: channelBalance.unsettled_balance,
      totalBalance: chainBalance.chain_balance + channelBalance.channel_balance
    };
  } catch (error) {
    logger.error('Error getting Lightning balance:', error);
    throw error;
  }
}

/**
 * Create a Lightning invoice
 * @param {Object} params - Invoice parameters
 * @param {number} params.amount - Amount in satoshis
 * @param {string} params.description - Invoice description
 * @param {number} params.expireSeconds - Expiration time in seconds (default: 3600)
 * @param {string} params.orderId - Associated order ID
 * @returns {Promise<Object>} - Invoice details
 */
async function createInvoice({ amount, description, expireSeconds = 3600, orderId, amountUSD }) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    // Convert satoshis to millisatoshis
    const tokens = Math.floor(amount);
    
    // Create invoice with LND
    const invoice = await lnService.createInvoice({
      lnd: lnd.lnd,
      tokens: tokens,
      description: description,
      expires_at: new Date(Date.now() + expireSeconds * 1000).toISOString()
    });

    // Save invoice to database
    const lightningInvoice = new LightningInvoice({
      order: orderId,
      paymentRequest: invoice.request,
      paymentHash: invoice.id,
      amount: tokens,
      amountMsat: tokens * 1000,
      amountUSD: amountUSD,
      description: description,
      status: 'pending',
      expiresAt: new Date(Date.now() + expireSeconds * 1000),
      secret: invoice.secret
    });

    await lightningInvoice.save();

    logger.info(`Lightning invoice created: ${invoice.id}`);

    return {
      paymentRequest: invoice.request,
      paymentHash: invoice.id,
      amount: tokens,
      amountMsat: tokens * 1000,
      description: description,
      expiresAt: lightningInvoice.expiresAt,
      createdAt: lightningInvoice.createdAt
    };
  } catch (error) {
    logger.error('Error creating Lightning invoice:', error);
    throw error;
  }
}

/**
 * Get invoice status
 * @param {string} paymentHash - Payment hash
 * @returns {Promise<Object>}
 */
async function getInvoiceStatus(paymentHash) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    // Get from database first
    const dbInvoice = await LightningInvoice.findOne({ paymentHash });
    
    if (!dbInvoice) {
      throw new Error('Invoice not found');
    }

    // Check expiration
    if (dbInvoice.checkExpiration()) {
      await dbInvoice.save();
    }

    // If already settled, return cached status
    if (dbInvoice.status === 'paid') {
      return {
        status: 'paid',
        paymentHash: dbInvoice.paymentHash,
        amount: dbInvoice.amount,
        paidAt: dbInvoice.paidAt,
        preimage: dbInvoice.preimage
      };
    }

    // Check with LND for latest status
    try {
      const invoice = await lnService.getInvoice({
        lnd: lnd.lnd,
        id: paymentHash
      });

      // Update database if status changed
      if (invoice.is_confirmed && dbInvoice.status !== 'paid') {
        dbInvoice.status = 'paid';
        dbInvoice.paidAt = new Date(invoice.confirmed_at);
        dbInvoice.preimage = invoice.secret;
        dbInvoice.settledIndex = invoice.confirmed_index;
        await dbInvoice.save();
      }

      return {
        status: invoice.is_confirmed ? 'paid' : invoice.is_canceled ? 'cancelled' : 'pending',
        paymentHash: invoice.id,
        amount: invoice.tokens,
        paidAt: invoice.confirmed_at ? new Date(invoice.confirmed_at) : null,
        preimage: invoice.secret,
        expiresAt: dbInvoice.expiresAt
      };
    } catch (lndError) {
      // If LND query fails, return database status
      logger.warn('Could not fetch invoice from LND, using database status:', lndError.message);
      return {
        status: dbInvoice.status,
        paymentHash: dbInvoice.paymentHash,
        amount: dbInvoice.amount,
        paidAt: dbInvoice.paidAt,
        preimage: dbInvoice.preimage,
        expiresAt: dbInvoice.expiresAt
      };
    }
  } catch (error) {
    logger.error('Error getting invoice status:', error);
    throw error;
  }
}

/**
 * Pay a Lightning invoice
 * @param {string} paymentRequest - BOLT11 payment request
 * @param {number} maxFee - Maximum fee in satoshis (optional)
 * @returns {Promise<Object>}
 */
async function payInvoice(paymentRequest, maxFee = null) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const paymentParams = {
      lnd: lnd.lnd,
      request: paymentRequest
    };

    if (maxFee !== null) {
      paymentParams.max_fee = maxFee;
    }

    const payment = await lnService.pay(paymentParams);

    logger.info(`Lightning payment sent: ${payment.id}`);

    return {
      paymentHash: payment.id,
      fee: payment.fee,
      feeMtokens: payment.fee_mtokens,
      hops: payment.hops,
      secret: payment.secret,
      tokens: payment.tokens
    };
  } catch (error) {
    logger.error('Error paying Lightning invoice:', error);
    throw error;
  }
}

/**
 * Decode a Lightning payment request
 * @param {string} paymentRequest - BOLT11 payment request
 * @returns {Promise<Object>}
 */
async function decodePaymentRequest(paymentRequest) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const decoded = await lnService.decodePaymentRequest({
      lnd: lnd.lnd,
      request: paymentRequest
    });

    return {
      destination: decoded.destination,
      paymentHash: decoded.id,
      amount: decoded.tokens,
      description: decoded.description,
      expiresAt: new Date(decoded.expires_at),
      createdAt: new Date(decoded.created_at)
    };
  } catch (error) {
    logger.error('Error decoding payment request:', error);
    throw error;
  }
}

/**
 * List all Lightning channels
 * @returns {Promise<Array>}
 */
async function listChannels() {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const { channels } = await lnService.getChannels({ lnd: lnd.lnd });
    
    // Sync with database
    for (const channel of channels) {
      await syncChannelToDatabase(channel);
    }

    return channels.map(ch => ({
      channelId: ch.id,
      remotePubkey: ch.partner_public_key,
      capacity: ch.capacity,
      localBalance: ch.local_balance,
      remoteBalance: ch.remote_balance,
      isActive: ch.is_active,
      isPrivate: ch.is_private,
      unsettledBalance: ch.unsettled_balance,
      totalSent: ch.sent,
      totalReceived: ch.received
    }));
  } catch (error) {
    logger.error('Error listing Lightning channels:', error);
    throw error;
  }
}

/**
 * Open a new Lightning channel
 * @param {Object} params - Channel parameters
 * @param {string} params.publicKey - Remote node public key
 * @param {number} params.localAmount - Local amount in satoshis
 * @param {boolean} params.isPrivate - Whether channel should be private
 * @returns {Promise<Object>}
 */
async function openChannel({ publicKey, localAmount, isPrivate = false }) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const result = await lnService.openChannel({
      lnd: lnd.lnd,
      partner_public_key: publicKey,
      local_tokens: localAmount,
      is_private: isPrivate
    });

    logger.info(`Lightning channel opened: ${result.transaction_id}`);

    // Create channel record in database
    const channel = new LightningChannel({
      channelId: result.transaction_id,
      remotePubkey: publicKey,
      capacity: localAmount,
      localBalance: localAmount,
      remoteBalance: 0,
      status: 'pending',
      isActive: false,
      isPrivate: isPrivate,
      fundingTxId: result.transaction_id
    });

    await channel.save();

    return {
      transactionId: result.transaction_id,
      transactionVout: result.transaction_vout,
      channelId: result.transaction_id
    };
  } catch (error) {
    logger.error('Error opening Lightning channel:', error);
    throw error;
  }
}

/**
 * Close a Lightning channel
 * @param {string} channelId - Channel ID
 * @param {boolean} force - Force close (default: false)
 * @returns {Promise<Object>}
 */
async function closeChannel(channelId, force = false) {
  if (!isLndAvailable()) {
    throw new Error('Lightning Network not available');
  }

  try {
    const closeParams = {
      lnd: lnd.lnd,
      id: channelId
    };

    const result = force 
      ? await lnService.closeChannel(closeParams)
      : await lnService.closeChannel(closeParams);

    // Update database
    const channel = await LightningChannel.findOne({ channelId });
    if (channel) {
      channel.status = force ? 'force-closing' : 'closing';
      channel.closingTxId = result.transaction_id;
      await channel.save();
    }

    logger.info(`Lightning channel ${force ? 'force ' : ''}closed: ${channelId}`);

    return {
      transactionId: result.transaction_id,
      transactionVout: result.transaction_vout
    };
  } catch (error) {
    logger.error('Error closing Lightning channel:', error);
    throw error;
  }
}

/**
 * Sync channel data from LND to database
 * @param {Object} channelData - Channel data from LND
 */
async function syncChannelToDatabase(channelData) {
  try {
    const channel = await LightningChannel.findOne({ channelId: channelData.id });
    
    if (channel) {
      channel.updateBalances(channelData.local_balance, channelData.remote_balance);
      channel.isActive = channelData.is_active;
      channel.status = channelData.is_active ? 'active' : 'inactive';
      channel.unsettledBalance = channelData.unsettled_balance;
      channel.totalSatoshisSent = channelData.sent;
      channel.totalSatoshisReceived = channelData.received;
      channel.numUpdates = channelData.commit_transaction_fee;
      await channel.save();
    } else {
      // Create new channel record
      const newChannel = new LightningChannel({
        channelId: channelData.id,
        remotePubkey: channelData.partner_public_key,
        capacity: channelData.capacity,
        localBalance: channelData.local_balance,
        remoteBalance: channelData.remote_balance,
        status: channelData.is_active ? 'active' : 'inactive',
        isActive: channelData.is_active,
        isPrivate: channelData.is_private,
        unsettledBalance: channelData.unsettled_balance,
        totalSatoshisSent: channelData.sent,
        totalSatoshisReceived: channelData.received
      });
      await newChannel.save();
    }
  } catch (error) {
    logger.error('Error syncing channel to database:', error);
  }
}

/**
 * Start monitoring incoming invoices
 */
function startInvoiceMonitoring() {
  if (!isLndAvailable()) {
    return;
  }

  try {
    const sub = lnService.subscribeToInvoices({ lnd: lnd.lnd });

    sub.on('invoice_updated', async (invoice) => {
      try {
        if (invoice.is_confirmed) {
          const dbInvoice = await LightningInvoice.findOne({ paymentHash: invoice.id });
          
          if (dbInvoice && dbInvoice.status !== 'paid') {
            dbInvoice.status = 'paid';
            dbInvoice.paidAt = new Date(invoice.confirmed_at);
            dbInvoice.preimage = invoice.secret;
            dbInvoice.settledIndex = invoice.confirmed_index;
            await dbInvoice.save();
            
            logger.info(`Lightning invoice paid: ${invoice.id}`);
            
            // Record in monitoring
            lightningMonitoring.recordPayment({
              status: 'paid',
              amount: dbInvoice.amount,
              amountUSD: dbInvoice.amountUSD
            });
            
            // Send webhook notification
            try {
              await lightningWebhook.notifyPaymentConfirmed(dbInvoice, {
                _id: invoice.id,
                transactionHash: invoice.id,
                status: 'confirmed'
              });
            } catch (webhookError) {
              logger.error('Error sending webhook notification:', webhookError);
            }
          }
        } else if (invoice.is_canceled) {
          const dbInvoice = await LightningInvoice.findOne({ paymentHash: invoice.id });
          
          if (dbInvoice && dbInvoice.status !== 'cancelled') {
            dbInvoice.status = 'cancelled';
            await dbInvoice.save();
            
            logger.info(`Lightning invoice cancelled: ${invoice.id}`);
            
            // Record in monitoring
            lightningMonitoring.recordPayment({
              status: 'cancelled',
              amount: dbInvoice.amount,
              amountUSD: dbInvoice.amountUSD
            });
          }
        }
      } catch (error) {
        logger.error('Error processing invoice update:', error);
      }
    });

    logger.info('Lightning invoice monitoring started');
  } catch (error) {
    logger.error('Error starting invoice monitoring:', error);
  }
}

module.exports = {
  initializeLightning,
  isLndAvailable,
  getWalletInfo,
  getBalance,
  createInvoice,
  getInvoiceStatus,
  payInvoice,
  decodePaymentRequest,
  listChannels,
  openChannel,
  closeChannel
};
