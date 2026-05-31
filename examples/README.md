# Cryptons.com Examples

This directory contains working examples demonstrating how to use various features of the Cryptons.com cryptocurrency trading platform.

## Lightning Network Examples

### 1. Lightning Payment Flow (JavaScript)

**File:** `lightning-payment-example.js`

A complete Node.js example demonstrating how to integrate Lightning Network payments.

**Usage:**

```bash
# Check Lightning Network status
node examples/lightning-payment-example.js status

# Create an order with Lightning payment
node examples/lightning-payment-example.js order

# Run the complete payment flow
node examples/lightning-payment-example.js full
```

**Features Demonstrated:**
- Creating orders with Lightning payment
- Generating Lightning invoices
- Checking payment status
- Confirming payments
- Decoding payment requests
- Admin channel management

### 2. Lightning Payment UI (HTML)

**File:** `lightning-payment.html`

A beautiful, responsive web interface for Lightning Network payments.

**Usage:**

```bash
# Start the Cryptons server
npm start

# Open in browser
http://localhost:3000/examples/lightning-payment.html?orderId=YOUR_ORDER_ID
```

**Features:**
- 📱 QR code display for easy mobile payments
- ⏱️ Real-time countdown timer
- 🔄 Automatic payment status checking
- 📋 One-click payment request copying
- 💳 Direct wallet opening support
- ✨ Beautiful, modern UI

**Screenshots:**

The payment page includes:
- Lightning bolt icon and branding
- Large QR code for scanning
- Payment details (amount, order ID)
- Countdown timer showing expiration
- Step-by-step instructions
- Copy button for payment request
- Status indicator (pending/paid/expired)

## API Integration Examples

### Creating a Lightning Invoice

```javascript
const axios = require('axios');

async function createInvoice(orderId) {
  const response = await axios.post('http://localhost:3000/api/lightning/invoices', {
    orderId: orderId,
    expireSeconds: 3600 // 1 hour
  });
  
  const invoice = response.data.data.invoice;
  console.log('Payment Request:', invoice.paymentRequest);
  console.log('QR Code:', invoice.qrCode); // Data URL for QR code
  
  return invoice;
}
```

### Checking Payment Status

```javascript
async function checkPayment(paymentHash) {
  const response = await axios.get(
    `http://localhost:3000/api/lightning/invoices/${paymentHash}`
  );
  
  const status = response.data.data.status;
  
  if (status.status === 'paid') {
    console.log('✅ Payment received!');
    console.log('Paid at:', status.paidAt);
  } else {
    console.log('⏳ Still pending...');
  }
  
  return status;
}
```

### Confirming and Processing Payment

```javascript
async function confirmPayment(paymentHash) {
  const response = await axios.post(
    'http://localhost:3000/api/lightning/payments/confirm',
    { paymentHash }
  );
  
  if (response.data.success) {
    const order = response.data.data.order;
    console.log('Order processed:', order._id);
    console.log('Status:', order.status); // 'paid'
  }
  
  return response.data;
}
```

## Frontend Integration

### React Example

```jsx
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

function LightningPayment({ orderId }) {
  const [invoice, setInvoice] = useState(null);
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    // Create invoice
    fetch(`/api/lightning/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, expireSeconds: 3600 })
    })
      .then(res => res.json())
      .then(data => setInvoice(data.data.invoice));

    // Poll for payment status
    const interval = setInterval(async () => {
      if (invoice) {
        const res = await fetch(`/api/lightning/invoices/${invoice.paymentHash}`);
        const data = await res.json();
        setStatus(data.data.status.status);
        
        if (data.data.status.status === 'paid') {
          // Confirm payment
          await fetch('/api/lightning/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentHash: invoice.paymentHash })
          });
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId, invoice]);

  if (!invoice) return <div>Loading...</div>;

  return (
    <div>
      <h2>Lightning Payment</h2>
      <QRCode value={invoice.paymentRequest} size={300} />
      <p>Amount: {invoice.amount} sats</p>
      <p>Status: {status}</p>
      <button onClick={() => navigator.clipboard.writeText(invoice.paymentRequest)}>
        Copy Payment Request
      </button>
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div class="lightning-payment">
    <h2>Lightning Payment</h2>
    <div v-if="invoice">
      <img :src="invoice.qrCode" alt="QR Code" />
      <p>Amount: {{ invoice.amount }} sats</p>
      <p>Status: {{ status }}</p>
      <button @click="copyPaymentRequest">Copy Payment Request</button>
    </div>
    <div v-else>Loading...</div>
  </div>
</template>

<script>
export default {
  props: ['orderId'],
  data() {
    return {
      invoice: null,
      status: 'pending',
      pollInterval: null
    };
  },
  async mounted() {
    // Create invoice
    const response = await fetch('/api/lightning/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        orderId: this.orderId,
        expireSeconds: 3600
      })
    });
    
    const data = await response.json();
    this.invoice = data.data.invoice;
    
    // Start polling
    this.pollInterval = setInterval(this.checkStatus, 3000);
  },
  methods: {
    async checkStatus() {
      const response = await fetch(
        `/api/lightning/invoices/${this.invoice.paymentHash}`
      );
      const data = await response.json();
      this.status = data.data.status.status;
      
      if (this.status === 'paid') {
        await this.confirmPayment();
        clearInterval(this.pollInterval);
      }
    },
    async confirmPayment() {
      await fetch('/api/lightning/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentHash: this.invoice.paymentHash 
        })
      });
    },
    copyPaymentRequest() {
      navigator.clipboard.writeText(this.invoice.paymentRequest);
    }
  },
  beforeUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
};
</script>
```

## Admin Examples

### Listing Lightning Channels

```javascript
async function listChannels(adminToken) {
  const response = await axios.get(
    'http://localhost:3000/api/lightning/channels',
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  
  const channels = response.data.data.channels;
  console.log(`Found ${channels.length} channels`);
  
  channels.forEach(channel => {
    console.log(`Channel ${channel.channelId}:`);
    console.log(`  Capacity: ${channel.capacity} sats`);
    console.log(`  Local: ${channel.localBalance} sats`);
    console.log(`  Remote: ${channel.remoteBalance} sats`);
  });
}
```

### Opening a New Channel

```javascript
async function openChannel(adminToken, nodePublicKey, amount) {
  const response = await axios.post(
    'http://localhost:3000/api/lightning/channels',
    {
      publicKey: nodePublicKey,
      localAmount: amount, // in satoshis
      isPrivate: false
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  
  console.log('Channel opening initiated');
  console.log('Transaction ID:', response.data.data.transactionId);
}
```

## Testing

All examples can be tested with the Lightning Network testnet:

1. Set up a testnet LND node (see `docs/LIGHTNING_NETWORK.md`)
2. Configure testnet credentials in `.env`
3. Run the examples with testnet invoices
4. Use testnet Lightning wallets (Phoenix, Breez testnet mode)

## Common Integration Patterns

### Pattern 1: Polling for Payment

Most common approach - periodically check payment status:

```javascript
const pollInterval = setInterval(async () => {
  const status = await checkPaymentStatus(paymentHash);
  if (status.status === 'paid') {
    await confirmPayment(paymentHash);
    clearInterval(pollInterval);
    // Redirect to success page
  }
}, 3000); // Check every 3 seconds
```

### Pattern 2: Webhook Integration

For production use, implement webhook endpoint:

```javascript
// Server-side webhook handler
app.post('/webhooks/lightning', async (req, res) => {
  const { paymentHash, status } = req.body;
  
  if (status === 'paid') {
    await confirmPayment(paymentHash);
    // Process order
    // Send confirmation email
  }
  
  res.json({ success: true });
});
```

### Pattern 3: WebSocket Updates

Real-time payment updates via WebSocket:

```javascript
const socket = io();

socket.on('lightning-payment', (data) => {
  if (data.paymentHash === currentInvoice.paymentHash) {
    updatePaymentStatus(data.status);
    if (data.status === 'paid') {
      redirectToSuccess();
    }
  }
});
```

## Best Practices

1. **Always set expiration times** - Don't create invoices without expiration
2. **Check for existing invoices** - Avoid creating duplicate invoices for same order
3. **Handle timeouts gracefully** - Show user-friendly messages when invoices expire
4. **Validate payments** - Always confirm payment before processing orders
5. **Show QR codes** - Mobile users prefer scanning over copying
6. **Provide copy button** - Desktop users prefer copying payment requests
7. **Display countdown** - Show users how much time they have
8. **Auto-refresh status** - Poll for status updates automatically
9. **Handle errors** - Lightning Network issues should fail gracefully
10. **Test thoroughly** - Use testnet before going to mainnet

## Troubleshooting

### Invoice not creating

- Check that LND is running and configured
- Verify environment variables are set correctly
- Ensure LND is synced to the blockchain

### Payment not confirming

- Check Lightning wallet is connected
- Verify invoice hasn't expired
- Ensure sufficient channel capacity

### QR code not scanning

- Check QR code size (should be at least 300x300)
- Ensure good contrast and lighting
- Try different wallet apps

## Additional Resources

- [Lightning Network Documentation](../docs/LIGHTNING_NETWORK.md)
- [API Endpoints Documentation](../docs/API_ENDPOINTS.md)
- [Setup Guide](../docs/LIGHTNING_NETWORK.md#installation--setup)
- [LND Documentation](https://docs.lightning.engineering/)
- [BOLT Specifications](https://github.com/lightning/bolts)

## Contributing

Have a useful example? Submit a PR with:
- Clear documentation
- Working code
- Error handling
- Comments explaining the logic

---

**Need Help?** Check the main documentation or open an issue on GitHub.
