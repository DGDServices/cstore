# Lightning Network Setup Guide

## Quick Start

This guide will help you set up and configure Lightning Network payments for your CStore application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Testing](#testing)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. Lightning Network Node

You need access to a Lightning Network Daemon (LND). Choose one option:

**Option A: Local LND Node (Recommended for Production)**
- Install LND from https://github.com/lightningnetwork/lnd/releases
- Requires Bitcoin Core or btcd
- Full control and no third-party dependencies

**Option B: Hosted LND Service (Easiest for Development)**
- Voltage Cloud: https://voltage.cloud
- Umbrel: https://umbrel.com
- BTCPay Server: https://btcpayserver.org

**Option C: Docker (Good for Development)**
```bash
docker pull lightninglabs/lnd:latest
docker run -d --name lnd \
  -p 9735:9735 \
  -p 10009:10009 \
  -v ~/.lnd:/root/.lnd \
  lightninglabs/lnd:latest
```

### 2. System Requirements

- Node.js 14+
- MongoDB 4.4+
- Bitcoin testnet/mainnet node (if running own LND)
- Minimum 2GB RAM for LND
- Sufficient disk space for blockchain data

## Installation

### Step 1: Install LND (Local Setup)

For Ubuntu/Debian:

```bash
# Download LND
wget https://github.com/lightningnetwork/lnd/releases/download/v0.17.0-beta/lnd-linux-amd64-v0.17.0-beta.tar.gz

# Extract
tar -xzf lnd-linux-amd64-v0.17.0-beta.tar.gz

# Install
sudo install -m 0755 -o root -g root -t /usr/local/bin lnd-linux-amd64-v0.17.0-beta/*

# Verify
lnd --version
```

For macOS (using Homebrew):

```bash
brew install lnd
```

### Step 2: Configure LND

Create `~/.lnd/lnd.conf`:

**For Development (Testnet):**

```ini
[Application Options]
debuglevel=info
maxpendingchannels=10
alias=CStore-Dev
color=#FF6600

[Bitcoin]
bitcoin.active=1
bitcoin.testnet=1
bitcoin.node=neutrino

[Neutrino]
neutrino.connect=testnet1-btcd.zaphq.io
neutrino.connect=testnet2-btcd.zaphq.io
```

**For Production (Mainnet):**

```ini
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

### Step 3: Start LND and Create Wallet

```bash
# Start LND
lnd --configfile=~/.lnd/lnd.conf

# In another terminal, create wallet
lncli create

# Follow prompts to set password and save seed phrase
# ⚠️ IMPORTANT: Save your seed phrase securely!
```

### Step 4: Extract Credentials

Get the admin macaroon (hex format):

```bash
# Linux/Mac
xxd -ps -u -c 1000 ~/.lnd/data/chain/bitcoin/testnet/admin.macaroon

# Or use base64
base64 ~/.lnd/data/chain/bitcoin/testnet/admin.macaroon
```

For mainnet, use:
```bash
xxd -ps -u -c 1000 ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
```

Get TLS certificate (optional for localhost):

```bash
base64 ~/.lnd/tls.cert
```

## Configuration

### Step 1: Update .env File

Add these variables to your `.env` file:

```env
# Lightning Network Configuration
LND_SOCKET=localhost:10009
LND_MACAROON=your_admin_macaroon_hex_here
LND_CERT=your_tls_cert_base64_here  # Optional for localhost
```

**For Remote LND Node:**

```env
LND_SOCKET=your-remote-node.com:10009
LND_MACAROON=your_admin_macaroon_hex_here
LND_CERT=your_tls_cert_base64_here  # Required for remote connections
```

**Example (testnet):**

```env
LND_SOCKET=localhost:10009
LND_MACAROON=0201036c6e6402f801030a10...
# LND_CERT= (not needed for localhost)
```

### Step 2: Verify Configuration

Start your CStore application:

```bash
npm start
```

Check the logs for:

```
info: Lightning Network connected successfully. Node public key: 03abc123...
info: Lightning invoice monitoring started
```

If you see:

```
info: Lightning Network not configured - skipping initialization
```

Your LND credentials are missing or incorrect.

## Testing

### Step 1: Check Lightning Network Status

```bash
curl http://localhost:3000/api/lightning/info
```

Expected response (when configured):

```json
{
  "success": true,
  "data": {
    "available": true,
    "info": {
      "publicKey": "03abc123...",
      "alias": "CStore-Dev",
      "numActiveChannels": 2,
      "synced": true
    },
    "balance": {
      "chainBalance": 1000000,
      "channelBalance": 500000,
      "totalBalance": 1500000
    }
  }
}
```

### Step 2: Create Test Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "your-product-id",
    "quantity": 1,
    "customerEmail": "customer@example.com",
    "cryptocurrency": "BTC-LN"
  }'
```

### Step 3: Generate Lightning Invoice

```bash
curl -X POST http://localhost:3000/api/lightning/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-id-from-step-2",
    "expireSeconds": 3600
  }'
```

### Step 4: Run Example Script

```bash
# Check Lightning status
node examples/lightning-payment-example.js status

# Test complete payment flow
node examples/lightning-payment-example.js full
```

### Step 5: Run Automated Tests

```bash
npm test -- tests/lightning.test.js
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] LND running on mainnet with sufficient liquidity
- [ ] At least 2-3 active channels with well-connected nodes
- [ ] Backup of LND wallet seed phrase stored securely (offline)
- [ ] TLS certificate properly configured for remote connections
- [ ] Firewall configured to allow port 9735 (P2P) and 10009 (gRPC)
- [ ] Monitoring and alerting set up for LND node
- [ ] Regular backups of channel state (`channel.backup`)

### Security Best Practices

1. **Macaroon Security**
   - Never commit macaroons to version control
   - Use environment variables or secrets management
   - Rotate macaroons periodically
   - Use least-privilege macaroons when possible

2. **TLS Configuration**
   - Always use TLS for remote connections
   - Keep TLS certificates up to date
   - Use certificate pinning in production

3. **Node Security**
   - Keep LND updated to latest stable version
   - Run LND on isolated server/container
   - Implement rate limiting on API endpoints
   - Monitor for suspicious activity

4. **Backup Strategy**
   - Automatic backups of `channel.backup` file
   - Store backups in multiple secure locations
   - Test backup restoration regularly
   - Keep wallet seed phrase in cold storage

### Channel Management

1. **Initial Liquidity**
   - Open channels with at least 1,000,000 sats each
   - Connect to well-known, reliable nodes
   - Aim for 3-5 channels minimum

2. **Recommended Peers**
   ```
   # Well-connected routing nodes (testnet)
   testnet1-btcd.zaphq.io
   test.lnolymp.us
   
   # Well-connected routing nodes (mainnet)
   ACINQ (03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f)
   Kraken (02f1a8c87607f415c8f22c00593002775941dea48869ce23096af27b0cfdcc0b69)
   ```

3. **Monitoring**
   - Monitor channel balance ratios
   - Set up alerts for low balances
   - Implement automatic rebalancing if needed
   - Track routing fees and adjust as needed

### Production Environment Variables

```env
# Production Lightning Configuration
NODE_ENV=production
LND_SOCKET=your-production-node.com:10009
LND_MACAROON=production_macaroon_hex
LND_CERT=production_tls_cert_base64

# Additional production settings
LOG_LEVEL=info
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Monitoring

Set up monitoring for:

- LND node uptime and health
- Channel states and balances
- Payment success/failure rates
- Invoice expiration rates
- API endpoint response times
- Failed payment attempts

### Backup Configuration

Create automated backup script:

```bash
#!/bin/bash
# backup-lnd.sh

BACKUP_DIR="/path/to/secure/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup channel state
cp ~/.lnd/data/chain/bitcoin/mainnet/channel.backup \
   $BACKUP_DIR/channel-$DATE.backup

# Backup LND database (optional)
lncli stop
tar -czf $BACKUP_DIR/lnd-data-$DATE.tar.gz ~/.lnd/data
lnd --configfile=~/.lnd/lnd.conf &

# Upload to secure cloud storage
# aws s3 cp $BACKUP_DIR/channel-$DATE.backup s3://your-bucket/
```

## Troubleshooting

### Common Issues

#### 1. "Lightning Network not available"

**Cause:** LND credentials not configured or incorrect

**Solution:**
- Check `.env` file has correct `LND_SOCKET` and `LND_MACAROON`
- Verify LND is running: `lncli getinfo`
- Check macaroon format (should be hex string without spaces)
- Verify network connectivity to LND

#### 2. "Failed to initialize Lightning Network"

**Cause:** Cannot connect to LND

**Solution:**
- Ensure LND is running and synced
- Check firewall rules: `sudo ufw allow 10009/tcp`
- Verify LND gRPC is enabled
- Check LND logs: `tail -f ~/.lnd/logs/bitcoin/testnet/lnd.log`

#### 3. Invoice creation fails

**Cause:** LND wallet locked or insufficient balance

**Solution:**
```bash
# Unlock wallet
lncli unlock

# Check balance
lncli walletbalance
lncli channelbalance

# Fund wallet if needed (testnet)
# Get address: lncli newaddress p2wkh
# Use testnet faucet: https://testnet-faucet.com/btc-testnet/
```

#### 4. Payments not confirming

**Cause:** No route to destination or insufficient channel capacity

**Solution:**
- Check channel status: `lncli listchannels`
- Ensure channels are active and have balance
- Open more channels for better routing
- Check if invoice amount exceeds channel capacity

#### 5. Database connection errors

**Cause:** MongoDB not running or credentials incorrect

**Solution:**
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Start MongoDB if needed
sudo systemctl start mongodb

# Verify connection string in .env
MONGODB_URI=mongodb://localhost:27017/cryptons
```

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

Check application logs:

```bash
tail -f logs/combined.log
tail -f logs/error.log
```

Check LND logs:

```bash
# Testnet
tail -f ~/.lnd/logs/bitcoin/testnet/lnd.log

# Mainnet
tail -f ~/.lnd/logs/bitcoin/mainnet/lnd.log
```

### Getting Help

1. **Documentation**
   - Full API docs: `docs/api/LIGHTNING_NETWORK.md`
   - Example usage: `examples/lightning-payment-example.js`

2. **LND Resources**
   - LND Documentation: https://docs.lightning.engineering/
   - LND GitHub: https://github.com/lightningnetwork/lnd
   - LND Community: https://lightning.engineering/slack.html

3. **Support Channels**
   - GitHub Issues: https://github.com/thewriterben/cstore/issues
   - Discord Community: [Add your Discord link]

## Next Steps

Once Lightning Network is set up:

1. Test with small amounts on testnet
2. Monitor payment success rates
3. Optimize channel management
4. Implement webhook notifications for payments
5. Set up monitoring and alerting
6. Plan scaling strategy for production

## Additional Resources

- [Lightning Network Documentation](https://docs.lightning.engineering/)
- [BOLT Specifications](https://github.com/lightning/bolts)
- [ln-service API](https://github.com/alexbosworth/ln-service)
- [Lightning Network Explorer](https://1ml.com/)
- [Testnet Faucet](https://testnet-faucet.com/btc-testnet/)

## FAQ

**Q: How much Bitcoin do I need to get started?**
A: For testnet, use free testnet coins. For mainnet, start with at least 0.01 BTC for channel funding.

**Q: What are the transaction fees?**
A: Lightning fees are typically less than 1 satoshi per transaction, making micro-payments feasible.

**Q: How do I get testnet Bitcoin?**
A: Use a testnet faucet like https://testnet-faucet.com/btc-testnet/

**Q: Can I accept Lightning payments without running a node?**
A: Yes, you can use hosted services like BTCPay Server, but running your own node gives you full control.

**Q: What happens if my node goes offline?**
A: Pending invoices will expire. Your channels remain safe if you have recent backups. Always maintain up-to-date channel backups.

**Q: How do I monitor my Lightning node?**
A: Use tools like ThunderHub, RTL (Ride The Lightning), or LNDg for monitoring and management.
