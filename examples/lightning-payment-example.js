/**
 * Lightning Network Payment Example
 * 
 * This example demonstrates how to use the Lightning Network payment features
 * in the CStore application.
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

/**
 * Example 1: Create an order with Lightning Network payment
 */
async function createLightningOrder() {
  console.log('\n=== Creating Order with Lightning Network ===\n');
  
  try {
    // Step 1: Create order with BTC-LN cryptocurrency
    const orderResponse = await axios.post(`${API_URL}/orders`, {
      productId: 'your-product-id',
      quantity: 1,
      customerEmail: 'customer@example.com',
      cryptocurrency: 'BTC-LN'
    });
    
    const order = orderResponse.data.data.order;
    console.log(`✓ Order created: ${order._id}`);
    console.log(`  Total: $${order.totalPriceUSD}`);
    
    return order;
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 2: Generate Lightning invoice for order
 */
async function generateInvoice(orderId) {
  console.log('\n=== Generating Lightning Invoice ===\n');
  
  try {
    const response = await axios.post(`${API_URL}/lightning/invoices`, {
      orderId: orderId,
      expireSeconds: 3600 // 1 hour expiration
    });
    
    const invoice = response.data.data.invoice;
    console.log(`✓ Invoice generated successfully`);
    console.log(`  Payment Request: ${invoice.paymentRequest}`);
    console.log(`  Payment Hash: ${invoice.paymentHash}`);
    console.log(`  Amount: ${invoice.amount} satoshis`);
    console.log(`  Expires: ${invoice.expiresAt}`);
    console.log('\n  📱 Scan this with your Lightning wallet:');
    console.log(`     ${invoice.paymentRequest}`);
    
    return invoice;
  } catch (error) {
    console.error('Error generating invoice:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 3: Check invoice payment status
 */
async function checkPaymentStatus(paymentHash) {
  console.log('\n=== Checking Payment Status ===\n');
  
  try {
    const response = await axios.get(`${API_URL}/lightning/invoices/${paymentHash}`);
    const status = response.data.data.status;
    
    console.log(`✓ Status retrieved`);
    console.log(`  Payment Status: ${status.status}`);
    console.log(`  Amount: ${status.amount} satoshis`);
    
    if (status.status === 'paid') {
      console.log(`  ✅ Payment confirmed at: ${status.paidAt}`);
      console.log(`  Preimage: ${status.preimage}`);
    } else if (status.status === 'pending') {
      console.log(`  ⏳ Waiting for payment...`);
      console.log(`  Expires at: ${status.expiresAt}`);
    } else if (status.status === 'expired') {
      console.log(`  ⏰ Invoice expired`);
    }
    
    return status;
  } catch (error) {
    console.error('Error checking status:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 4: Confirm payment and update order
 */
async function confirmPayment(paymentHash) {
  console.log('\n=== Confirming Payment ===\n');
  
  try {
    const response = await axios.post(`${API_URL}/lightning/payments/confirm`, {
      paymentHash: paymentHash
    });
    
    if (response.data.success) {
      const payment = response.data.data.payment;
      const order = response.data.data.order;
      
      console.log(`✅ Payment confirmed successfully!`);
      console.log(`  Payment ID: ${payment._id}`);
      console.log(`  Order ID: ${order._id}`);
      console.log(`  Order Status: ${order.status}`);
      console.log(`  Payment Method: ${order.paymentMethod}`);
    } else {
      console.log(`❌ Payment not confirmed yet`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error confirming payment:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 5: Check Lightning Network status
 */
async function checkLightningStatus() {
  console.log('\n=== Checking Lightning Network Status ===\n');
  
  try {
    const response = await axios.get(`${API_URL}/lightning/info`);
    const data = response.data.data;
    
    if (data.available) {
      console.log(`✅ Lightning Network is available`);
      console.log(`  Node Alias: ${data.info.alias}`);
      console.log(`  Public Key: ${data.info.publicKey}`);
      console.log(`  Active Channels: ${data.info.numActiveChannels}`);
      console.log(`  Synced: ${data.info.synced}`);
      console.log('\n  Balance:`);
      console.log(`    Chain Balance: ${data.balance.chainBalance} sats`);
      console.log(`    Channel Balance: ${data.balance.channelBalance} sats`);
      console.log(`    Total Balance: ${data.balance.totalBalance} sats`);
    } else {
      console.log(`⚠️  Lightning Network is not configured`);
      console.log(`   ${data.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking status:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 6: Decode a Lightning payment request
 */
async function decodePaymentRequest(paymentRequest) {
  console.log('\n=== Decoding Payment Request ===\n');
  
  try {
    const response = await axios.post(`${API_URL}/lightning/decode`, {
      paymentRequest: paymentRequest
    });
    
    const decoded = response.data.data.decoded;
    console.log(`✓ Payment request decoded`);
    console.log(`  Destination: ${decoded.destination}`);
    console.log(`  Payment Hash: ${decoded.paymentHash}`);
    console.log(`  Amount: ${decoded.amount} satoshis`);
    console.log(`  Description: ${decoded.description}`);
    console.log(`  Expires: ${decoded.expiresAt}`);
    
    return decoded;
  } catch (error) {
    console.error('Error decoding payment request:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example 7: Complete payment flow
 */
async function completePaymentFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE LIGHTNING NETWORK PAYMENT FLOW');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Check if Lightning is available
    await checkLightningStatus();
    
    // Step 2: Create order
    const order = await createLightningOrder();
    
    // Step 3: Generate Lightning invoice
    const invoice = await generateInvoice(order._id);
    
    // Step 4: Customer pays the invoice with their Lightning wallet
    console.log('\n💡 Now the customer would pay this invoice using their Lightning wallet...');
    console.log('   (This is done outside the application using a Lightning wallet app)');
    
    // Step 5: Poll for payment status
    console.log('\n⏳ Polling for payment confirmation...');
    let status;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      status = await checkPaymentStatus(invoice.paymentHash);
      
      if (status.status === 'paid') {
        break;
      }
      
      attempts++;
      console.log(`   Attempt ${attempts}/${maxAttempts}...`);
    }
    
    // Step 6: Confirm payment if paid
    if (status && status.status === 'paid') {
      await confirmPayment(invoice.paymentHash);
      console.log('\n✅ Payment flow completed successfully!');
    } else {
      console.log('\n⏳ Payment not received yet. In a real application, you would:');
      console.log('   - Continue polling for payment');
      console.log('   - Use webhooks for automatic confirmation');
      console.log('   - Show QR code to customer');
    }
    
  } catch (error) {
    console.error('\n❌ Payment flow failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Admin Example: List Lightning channels
 */
async function listChannels(adminToken) {
  console.log('\n=== Listing Lightning Channels (Admin) ===\n');
  
  try {
    const response = await axios.get(`${API_URL}/lightning/channels`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    
    const channels = response.data.data.channels;
    console.log(`✓ Found ${channels.length} channels`);
    
    channels.forEach((channel, index) => {
      console.log(`\n  Channel ${index + 1}:`);
      console.log(`    ID: ${channel.channelId}`);
      console.log(`    Capacity: ${channel.capacity} sats`);
      console.log(`    Local Balance: ${channel.localBalance} sats`);
      console.log(`    Remote Balance: ${channel.remoteBalance} sats`);
      console.log(`    Active: ${channel.isActive}`);
      console.log(`    Private: ${channel.isPrivate}`);
    });
    
    return channels;
  } catch (error) {
    console.error('Error listing channels:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Admin Example: Open new Lightning channel
 */
async function openChannel(adminToken, publicKey, amount) {
  console.log('\n=== Opening Lightning Channel (Admin) ===\n');
  
  try {
    const response = await axios.post(`${API_URL}/lightning/channels`, {
      publicKey: publicKey,
      localAmount: amount,
      isPrivate: false
    }, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    
    const result = response.data.data;
    console.log(`✅ Channel opening initiated`);
    console.log(`  Transaction ID: ${result.transactionId}`);
    console.log(`  Channel ID: ${result.channelId}`);
    console.log('\n⏳ Channel will be active after confirmation on the blockchain');
    
    return result;
  } catch (error) {
    console.error('Error opening channel:', error.response?.data || error.message);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  console.log('\n🌩️  Lightning Network Payment Examples 🌩️\n');
  
  // Run example based on command line argument
  const example = process.argv[2] || 'status';
  
  switch (example) {
    case 'status':
      checkLightningStatus();
      break;
    case 'full':
      completePaymentFlow();
      break;
    case 'order':
      createLightningOrder();
      break;
    default:
      console.log('Available examples:');
      console.log('  node examples/lightning-payment-example.js status  - Check Lightning status');
      console.log('  node examples/lightning-payment-example.js order   - Create Lightning order');
      console.log('  node examples/lightning-payment-example.js full    - Full payment flow');
      break;
  }
}

module.exports = {
  createLightningOrder,
  generateInvoice,
  checkPaymentStatus,
  confirmPayment,
  checkLightningStatus,
  decodePaymentRequest,
  completePaymentFlow,
  listChannels,
  openChannel
};
