# Lightning Network Integration Guide

## Overview

The Lightning Network integration enables fast, low-cost Bitcoin transactions for the CStore marketplace. This feature allows customers to pay instantly with minimal fees using the Lightning Network, while merchants can receive payments immediately.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Features

### Payment Operations
- ✅ Create Lightning invoices for orders
- ✅ Real-time payment status monitoring
- ✅ Automatic payment confirmation
- ✅ Invoice expiration handling
- ✅ QR code compatible payment requests (BOLT11)
- ✅ Payment request decoding

### Channel Management
- ✅ Open new payment channels
- ✅ Close existing channels (cooperative & force close)
- ✅ Monitor channel status and balances
- ✅ List all active channels
- ✅ Channel balance rebalancing support

### Wallet Operations
- ✅ Lightning wallet info
- ✅ Balance queries (on-chain & channel)
- ✅ Pay Lightning invoices
- ✅ Invoice monitoring and webhooks

### Integration Features
- ✅ Seamless integration with existing order system
- ✅ Support for both on-chain and Lightning payments
- ✅ Automatic stock management
- ✅ Order status updates
- ✅ Payment history tracking

## Prerequisites

### LND (Lightning Network Daemon)

You need a running LND node. You can either:

1. **Run your own LND node** (Recommended for production)
2. **Use a Lightning node service** (e.g., Voltage, Umbrel, BTCPay Server)
3. **Use testnet/regtest for development**

#### Option 1: Install LND Locally

```bash
# Download LND
wget https://github.com/lightningnetwork/lnd/releases/download/v0.17.0-beta/lnd-linux-amd64-v0.17.0-beta.tar.gz

# Extract
tar -xzf lnd-linux-amd64-v0.17.0-beta.tar.gz

# Move to /usr/local/bin
sudo mv lnd-linux-amd64-v0.17.0-beta/lnd /usr/local/bin/
sudo mv lnd-linux-amd64-v0.17.0-beta/lncli /usr/local/bin/

# Verify installation
lnd --version
```

#### Option 2: Use Docker

```bash
# Pull LND Docker image
docker pull lightninglabs/lnd:latest

# Run LND
docker run -d \
  --name lnd \
  -p 9735:9735 \
  -p 10009:10009 \
  -v ~/.lnd:/root/.lnd \
  lightninglabs/lnd:latest
```

#### Option 3: Use BTCPay Server

BTCPay Server includes LND and provides an easy setup interface.

## Installation & Setup

### Step 1: Install Dependencies

The `ln-service` package is already included in the project dependencies:

```bash
npm install
```

### Step 2: Start LND

#### For Development (Testnet)

Create `lnd.conf`:

```conf
[Application Options]
debuglevel=info
maxpendingchannels=10
alias=CStore-LND
color=#FF6600

[Bitcoin]
bitcoin.active=1
bitcoin.testnet=1
bitcoin.node=neutrino

[Neutrino]
neutrino.connect=testnet1-btcd.zaphq.io
neutrino.connect=testnet2-btcd.zaphq.io
```

Start LND:

```bash
lnd --configfile=lnd.conf
```

Create wallet:

```bash
lncli create
```

#### For Production (Mainnet)

```conf
[Application Options]
debuglevel=info
maxpendingchannels=50
alias=CStore-Production
color=#FF6600

[Bitcoin]
bitcoin.active=1
bitcoin.mainnet=1
bitcoin.node=bitcoind

[Bitcoind]
bitcoind.rpchost=localhost:8332
bitcoind.rpcuser=your-rpc-user
bitcoind.rpcpass=your-rpc-password
bitcoind.zmqpubrawblock=tcp://127.0.0.1:28332
bitcoind.zmqpubrawtx=tcp://127.0.0.1:28333
```

### Step 3: Extract Credentials

Get the admin macaroon (hex format):

```bash
# Linux/Mac
xxd -ps -u -c 1000 ~/.lnd/data/chain/bitcoin/testnet/admin.macaroon

# Or use base64
base64 ~/.lnd/data/chain/bitcoin/testnet/admin.macaroon
```

Get the TLS certificate (optional, for remote connections):

```bash
base64 ~/.lnd/tls.cert
```

### Step 4: Configure Environment Variables

Add to your `.env` file:

```env
# Lightning Network Configuration
LND_SOCKET=localhost:10009
LND_MACAROON=your_admin_macaroon_hex
LND_CERT=your_tls_cert_base64  # Optional for localhost
```

For remote LND nodes:

```env
LND_SOCKET=remote.node.com:10009
LND_MACAROON=your_admin_macaroon_hex
LND_CERT=your_tls_cert_base64  # Required for remote
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `LND_SOCKET` | LND gRPC endpoint | Yes | - |
| `LND_MACAROON` | Admin macaroon (hex) | Yes | - |
| `LND_CERT` | TLS certificate (base64) | No* | - |

*Required for remote connections or custom certificates

### Database Models

The integration creates two new database models:

1. **LightningInvoice** - Stores Lightning invoice details
2. **LightningChannel** - Tracks payment channel information

These are automatically created when you start the application.

## API Endpoints

### Public Endpoints

#### Get Lightning Network Info

```http
GET /api/lightning/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "info": {
      "publicKey": "03abc...",
      "alias": "CStore-LND",
      "version": "0.17.0-beta",
      "numActiveChannels": 5,
      "numPeers": 8,
      "synced": true
    },
    "balance": {
      "chainBalance": 1000000,
      "channelBalance": 5000000,
      "totalBalance": 6000000
    }
  }
}
```

#### Create Lightning Invoice

```http
POST /api/lightning/invoices
Content-Type: application/json

{
  "orderId": "65abc123...",
  "expireSeconds": 3600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "paymentRequest": "lnbc10u1p3...",
      "paymentHash": "abc123...",
      "amount": 1000,
      "amountMsat": 1000000,
      "description": "Order #65abc123 - 2 item(s)",
      "expiresAt": "2025-01-15T12:00:00.000Z",
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  }
}
```

#### Check Invoice Status

```http
GET /api/lightning/invoices/:paymentHash
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "status": "paid",
      "paymentHash": "abc123...",
      "amount": 1000,
      "paidAt": "2025-01-15T11:30:00.000Z",
      "preimage": "def456..."
    }
  }
}
```

#### Confirm Payment

```http
POST /api/lightning/payments/confirm
Content-Type: application/json

{
  "paymentHash": "abc123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "payment": {
      "id": "65payment...",
      "order": "65order...",
      "transactionHash": "abc123...",
      "cryptocurrency": "BTC-LN",
      "amount": 0.00001,
      "amountUSD": 10.00,
      "status": "confirmed"
    },
    "order": {
      "id": "65order...",
      "status": "paid",
      "paymentMethod": "Lightning Network"
    }
  }
}
```

#### Decode Payment Request

```http
POST /api/lightning/decode
Content-Type: application/json

{
  "paymentRequest": "lnbc10u1p3..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": {
      "destination": "03abc...",
      "paymentHash": "abc123...",
      "amount": 1000,
      "description": "Order #65abc123",
      "expiresAt": "2025-01-15T12:00:00.000Z"
    }
  }
}
```

### Admin Endpoints (Protected)

All admin endpoints require authentication with admin role.

#### Get Balance

```http
GET /api/lightning/balance
Authorization: Bearer <admin_token>
```

#### List Channels

```http
GET /api/lightning/channels
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "channelId": "12345678...",
        "remotePubkey": "03def...",
        "capacity": 1000000,
        "localBalance": 500000,
        "remoteBalance": 500000,
        "isActive": true,
        "isPrivate": false
      }
    ],
    "count": 1
  }
}
```

#### Open Channel

```http
POST /api/lightning/channels
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "publicKey": "03def456...",
  "localAmount": 1000000,
  "isPrivate": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Channel opening initiated",
  "data": {
    "transactionId": "abc123...",
    "channelId": "abc123..."
  }
}
```

#### Close Channel

```http
DELETE /api/lightning/channels/:channelId?force=false
Authorization: Bearer <admin_token>
```

#### Pay Invoice

```http
POST /api/lightning/pay
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "paymentRequest": "lnbc10u1p3...",
  "maxFee": 100
}
```

## Usage Examples

### Customer Payment Flow

1. **Customer creates order:**

```javascript
// Create order with BTC-LN cryptocurrency
const order = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: '65abc123...',
    quantity: 1,
    customerEmail: 'customer@example.com',
    cryptocurrency: 'BTC-LN'
  })
});
```

2. **Generate Lightning invoice:**

```javascript
const invoiceResponse = await fetch('/api/lightning/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,
    expireSeconds: 3600
  })
});

const { invoice } = await invoiceResponse.json();
// Display invoice.paymentRequest as QR code
```

3. **Customer pays using Lightning wallet**

4. **Check payment status:**

```javascript
const statusResponse = await fetch(`/api/lightning/invoices/${invoice.paymentHash}`);
const { status } = await statusResponse.json();

if (status.status === 'paid') {
  // Confirm payment
  await fetch('/api/lightning/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentHash: invoice.paymentHash
    })
  });
}
```

### Admin Operations

#### Monitor Channels

```javascript
const channelsResponse = await fetch('/api/lightning/channels', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

const { channels } = await channelsResponse.json();
channels.forEach(channel => {
  console.log(`Channel ${channel.channelId}:`);
  console.log(`  Local: ${channel.localBalance} sats`);
  console.log(`  Remote: ${channel.remoteBalance} sats`);
  console.log(`  Active: ${channel.isActive}`);
});
```

#### Open New Channel

```javascript
const openResponse = await fetch('/api/lightning/channels', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    publicKey: '03abc123...',
    localAmount: 1000000,  // 0.01 BTC
    isPrivate: false
  })
});
```

## Testing

### Unit Tests

Run Lightning Network tests:

```bash
npm test -- lightning.test.js
```

### Manual Testing (Testnet)

1. **Create test order:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "test-product-id",
    "quantity": 1,
    "customerEmail": "test@example.com",
    "cryptocurrency": "BTC-LN"
  }'
```

2. **Generate invoice:**
```bash
curl -X POST http://localhost:3000/api/lightning/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-id-from-step-1",
    "expireSeconds": 3600
  }'
```

3. **Pay with testnet Lightning wallet (e.g., Phoenix, Breez)**

4. **Check status:**
```bash
curl http://localhost:3000/api/lightning/invoices/payment-hash
```

### Integration with BTCPay Server

If using BTCPay Server, you can test the integration:

1. Create a BTCPay Server store
2. Enable Lightning Network
3. Get connection string from BTCPay
4. Configure CStore with BTCPay LND credentials

## Troubleshooting

### Common Issues

#### 1. "Lightning Network not available"

**Cause:** LND not configured or not reachable

**Solution:**
- Check LND is running: `lncli getinfo`
- Verify environment variables are set correctly
- Check network connectivity to LND
- Ensure macaroon has correct permissions

#### 2. "Insufficient balance"

**Cause:** Not enough funds in Lightning channels

**Solution:**
- Check balance: `lncli channelbalance`
- Open new channels or receive payments
- Rebalance existing channels

#### 3. "Invoice creation failed"

**Cause:** LND communication error

**Solution:**
- Check LND logs: `tail -f ~/.lnd/logs/bitcoin/mainnet/lnd.log`
- Verify macaroon is valid
- Ensure LND is fully synced

#### 4. "Channel creation failed"

**Cause:** Insufficient on-chain balance or peer unreachable

**Solution:**
- Check on-chain balance: `lncli walletbalance`
- Verify peer is online: `lncli listpeers`
- Connect to peer first: `lncli connect pubkey@host`

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

Check application logs:

```bash
tail -f logs/app.log
```

## Security Considerations

### Best Practices

1. **Macaroon Security**
   - Never commit macaroons to version control
   - Use environment variables for credentials
   - Rotate macaroons periodically
   - Use read-only macaroons when possible

2. **Network Security**
   - Use TLS for remote LND connections
   - Restrict LND RPC access with firewall rules
   - Use VPN for remote node access
   - Enable Tor for privacy (optional)

3. **Channel Management**
   - Start with small channel amounts
   - Monitor channel balances regularly
   - Keep some funds on-chain for closing channels
   - Use cooperative closes when possible

4. **Payment Monitoring**
   - Set appropriate invoice expiration times
   - Monitor for stuck payments
   - Implement payment timeout handling
   - Keep detailed payment logs

### Production Checklist

- [ ] LND running on mainnet
- [ ] Macaroons stored securely
- [ ] TLS enabled for remote connections
- [ ] Firewall rules configured
- [ ] Regular backups of channel state
- [ ] Monitoring and alerting set up
- [ ] Test payment flow thoroughly
- [ ] Document recovery procedures
- [ ] Set up channel backup system
- [ ] Configure watchtower (optional)

## Additional Resources

### Documentation
- [LND Documentation](https://docs.lightning.engineering/)
- [BOLT Specifications](https://github.com/lightning/bolts)
- [ln-service API](https://github.com/alexbosworth/ln-service)

### Tools
- [Lightning Terminal](https://terminal.lightning.engineering/) - GUI for LND
- [ThunderHub](https://www.thunderhub.io/) - Channel management
- [RTL (Ride The Lightning)](https://github.com/Ride-The-Lightning/RTL) - Web UI

### Community
- [Lightning Network Discord](https://discord.gg/lightningnetwork)
- [LND Slack](https://lightningcommunity.slack.com/)
- [Bitcoin StackExchange](https://bitcoin.stackexchange.com/)

## Support

For issues or questions:
1. Check this documentation
2. Review LND logs
3. Check application logs
4. Consult Lightning Network community resources
5. Open an issue on the repository

---

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Status:** Production Ready
