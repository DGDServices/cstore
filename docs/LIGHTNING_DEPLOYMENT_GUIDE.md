# Lightning Network Deployment Guide

**Version:** 2.2.0  
**Last Updated:** October 2025  
**Status:** ✅ Production Ready

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [LND Node Setup](#lnd-node-setup)
- [Application Configuration](#application-configuration)
- [Security Configuration](#security-configuration)
- [Feature Configuration](#feature-configuration)
- [Testing the Installation](#testing-the-installation)
- [Monitoring Setup](#monitoring-setup)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

---

## Overview

This guide walks you through deploying the Lightning Network integration for Cryptons.com, including:

- LND node setup and configuration
- Application integration
- Monitoring and analytics
- Webhook configuration
- Channel management and rebalancing
- Security best practices

**Important:** Lightning Network requires a fully synced Bitcoin node and significant operational overhead. Only deploy to production if you understand the risks and operational requirements.

---

## Prerequisites

### Hardware Requirements

**Minimum (Development/Testing):**
- 2 CPU cores
- 4 GB RAM
- 50 GB SSD storage
- 10 Mbps internet connection

**Recommended (Production):**
- 4+ CPU cores
- 8+ GB RAM
- 500 GB+ SSD storage (for Bitcoin Core)
- 100+ Mbps internet connection with low latency
- Uninterruptible power supply (UPS)

### Software Requirements

- **Operating System:** Linux (Ubuntu 22.04 LTS recommended)
- **Bitcoin Core:** v24.0 or later (fully synced)
- **LND:** v0.16.0 or later
- **Node.js:** v18 or later
- **MongoDB:** v6.0 or later
- **Docker** (optional but recommended)

### Knowledge Requirements

- Understanding of Bitcoin and Lightning Network concepts
- Linux system administration
- Network security fundamentals
- Backup and recovery procedures

---

## LND Node Setup

### Option 1: Docker Deployment (Recommended)

Create a `docker-compose.yml` for LND:

```yaml
version: '3.8'

services:
  bitcoind:
    image: btcpayserver/bitcoin:24.0
    container_name: bitcoind
    restart: unless-stopped
    volumes:
      - bitcoin_data:/data
    environment:
      BITCOIN_NETWORK: mainnet
      BITCOIN_EXTRA_ARGS: |
        server=1
        txindex=1
        zmqpubrawblock=tcp://0.0.0.0:28332
        zmqpubrawtx=tcp://0.0.0.0:28333
    ports:
      - "8333:8333"
      - "8332:8332"
    networks:
      - lightning

  lnd:
    image: btcpayserver/lnd:v0.16.4-beta
    container_name: lnd
    restart: unless-stopped
    depends_on:
      - bitcoind
    volumes:
      - lnd_data:/data
      - ./lnd.conf:/data/.lnd/lnd.conf:ro
    environment:
      LND_ENVIRONMENT: mainnet
    ports:
      - "9735:9735"  # P2P
      - "10009:10009" # gRPC
    networks:
      - lightning

volumes:
  bitcoin_data:
  lnd_data:

networks:
  lightning:
    driver: bridge
```

### LND Configuration

Create `lnd.conf`:

```ini
[Application Options]
# Network
bitcoin.active=1
bitcoin.mainnet=1
bitcoin.node=bitcoind

# RPC Configuration
rpclisten=0.0.0.0:10009
restlisten=0.0.0.0:8080

# Bitcoin Core Connection
bitcoind.rpchost=bitcoind:8332
bitcoind.rpcuser=bitcoin
bitcoind.rpcpass=your-secure-password
bitcoind.zmqpubrawblock=tcp://bitcoind:28332
bitcoind.zmqpubrawtx=tcp://bitcoind:28333

# Peers
maxpendingchannels=10
minchansize=100000

# Routing
routing.assumechanvalid=true

# Watchtower
wtclient.active=1

# Auto-pilot (optional for development)
autopilot.active=0
autopilot.maxchannels=5
autopilot.allocation=0.6

# Database
[bolt]
db.bolt.auto-compact=true
db.bolt.auto-compact-min-age=168h

# Logging
debuglevel=info

# Protocol
protocol.wumbo-channels=1
protocol.option-scid-alias=true
protocol.zero-conf=false
```

### Start LND

```bash
# Start Bitcoin Core and LND
docker-compose up -d

# Wait for Bitcoin to sync (can take several days)
docker logs -f bitcoind

# Create LND wallet
docker exec -it lnd lncli create

# Check LND status
docker exec -it lnd lncli getinfo
```

### Extract LND Credentials

```bash
# Get admin macaroon (hex format)
docker exec lnd xxd -p -c 10000 /data/.lnd/data/chain/bitcoin/mainnet/admin.macaroon

# Get TLS certificate (base64 format)
docker exec lnd base64 /data/.lnd/tls.cert | tr -d '\n'

# Get LND socket address
echo "lnd:10009"
```

---

## Application Configuration

### Environment Variables

Update your `.env` file:

```bash
# ============================================
# LIGHTNING NETWORK CONFIGURATION
# ============================================

# LND Connection
LND_SOCKET=lnd:10009
LND_MACAROON=your-admin-macaroon-hex
LND_CERT=your-tls-cert-base64

# Lightning Network Webhooks
LIGHTNING_WEBHOOK_ENABLED=true
LIGHTNING_WEBHOOK_SECRET=your-webhook-secret-generate-with-openssl

# Lightning Network Channel Rebalancing
LIGHTNING_REBALANCING_ENABLED=true
MIN_BALANCE_RATIO=0.2
MAX_BALANCE_RATIO=0.8
OPTIMAL_BALANCE_RATIO=0.5
MAX_REBALANCING_FEE_RATE=0.0001
```

### Generate Secrets

```bash
# Generate webhook secret
openssl rand -hex 32

# Set in .env
LIGHTNING_WEBHOOK_SECRET=<generated-secret>
```

### Validate Configuration

```bash
# Test LND connection
curl -X GET http://localhost:3000/api/lightning/info

# Expected response:
{
  "success": true,
  "data": {
    "available": true,
    "info": {
      "publicKey": "03...",
      "alias": "your-node",
      ...
    }
  }
}
```

---

## Security Configuration

### Firewall Rules

```bash
# Allow LND P2P (9735)
sudo ufw allow 9735/tcp

# Restrict gRPC to localhost/internal network only
sudo ufw deny 10009/tcp

# If using remote LND, use VPN or SSH tunnel
ssh -L 10009:localhost:10009 user@lnd-server
```

### Macaroon Permissions

For production, create a restricted macaroon instead of using admin:

```bash
# On LND server, create invoice-only macaroon
docker exec lnd lncli bakemacaroon \
  invoices:read invoices:write \
  info:read \
  onchain:read \
  address:read \
  --save_to=/data/.lnd/invoice.macaroon

# Get hex value
docker exec lnd xxd -p -c 10000 /data/.lnd/invoice.macaroon
```

### Secrets Management

**Development:**
```bash
# Store in .env file (gitignored)
cp .env.example .env
```

**Production (HashiCorp Vault):**
```bash
# Store in Vault
vault kv put cryptons/lightning \
  socket="lnd:10009" \
  macaroon="your-macaroon" \
  cert="your-cert" \
  webhook_secret="your-webhook-secret"

# Configure application
SECRETS_PROVIDER=vault
VAULT_ENABLED=true
VAULT_ADDR=https://vault.your-domain.com:8200
```

---

## Feature Configuration

### 1. Payment Monitoring

Monitoring is automatically enabled when Lightning Network is available.

**Dashboard Access:**
```bash
GET /api/lightning/monitoring/dashboard
Authorization: Bearer <admin-token>
```

**Configure Metrics Collection:**
```javascript
// Metrics are collected automatically
// Access via API endpoints
```

### 2. Webhook Notifications

**Register a Webhook:**
```bash
curl -X POST http://localhost:3000/api/lightning/webhooks \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/lightning",
    "events": [
      "payment.confirmed",
      "payment.failed",
      "invoice.expired",
      "channel.opened",
      "channel.closed"
    ],
    "secret": "your-webhook-secret"
  }'
```

**Webhook Payload Example:**
```json
{
  "event": "payment.confirmed",
  "data": {
    "paymentHash": "abc123...",
    "amount": 10000,
    "amountUSD": 10.00,
    "orderId": "507f1f77bcf86cd799439011",
    "paidAt": "2025-10-14T12:00:00.000Z",
    "preimage": "def456..."
  },
  "timestamp": "2025-10-14T12:00:00.000Z",
  "id": "webhook-id-123"
}
```

**Webhook Signature Verification:**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// In your webhook handler
app.post('/webhooks/lightning', (req, res) => {
  const signature = req.headers['x-lightning-signature'];
  const payload = req.body;
  
  if (!verifyWebhook(payload, signature, process.env.LIGHTNING_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Received event:', payload.event);
  res.status(200).send('OK');
});
```

### 3. Channel Rebalancing

**Get Recommendations:**
```bash
GET /api/lightning/rebalancing/recommendations
Authorization: Bearer <admin-token>
```

**Execute Manual Rebalancing:**
```bash
curl -X POST http://localhost:3000/api/lightning/rebalancing/execute \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "channel-id-123",
    "amount": 100000,
    "direction": "inbound"
  }'
```

**Start Automatic Rebalancing:**
```bash
curl -X POST http://localhost:3000/api/lightning/rebalancing/scheduler/start \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "intervalMs": 3600000
  }'
```

---

## Testing the Installation

### 1. Test LND Connection

```bash
curl http://localhost:3000/api/lightning/info
```

### 2. Create Test Invoice

```bash
# Create an order first (if not already existing)
ORDER_ID="your-order-id"

curl -X POST http://localhost:3000/api/lightning/invoices \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"expireSeconds\": 3600
  }"
```

### 3. Check Invoice Status

```bash
PAYMENT_HASH="invoice-payment-hash"

curl http://localhost:3000/api/lightning/invoices/$PAYMENT_HASH
```

### 4. Test Monitoring Endpoints

```bash
# Dashboard
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/lightning/monitoring/dashboard

# Payment stats
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/lightning/monitoring/payments

# Channel stats
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/lightning/monitoring/channels
```

### 5. Run Automated Tests

```bash
npm test -- tests/lightning.test.js tests/lightningMonitoring.test.js
```

---

## Monitoring Setup

### Prometheus Metrics

Lightning metrics are automatically exported via the monitoring service:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cryptons-lightning'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import the Lightning Network dashboard template (create one based on these metrics):

```json
{
  "dashboard": {
    "title": "Lightning Network Monitoring",
    "panels": [
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "lightning_payment_success_rate"
          }
        ]
      },
      {
        "title": "Channel Capacity",
        "targets": [
          {
            "expr": "lightning_channel_capacity_total"
          }
        ]
      },
      {
        "title": "Transaction Volume",
        "targets": [
          {
            "expr": "rate(lightning_payment_volume_sats[1h])"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
# alerts/lightning.yml
groups:
  - name: lightning
    interval: 60s
    rules:
      - alert: LightningNodeDown
        expr: lightning_node_up == 0
        for: 5m
        annotations:
          summary: "Lightning node is down"
          
      - alert: HighPaymentFailureRate
        expr: lightning_payment_failure_rate > 10
        for: 15m
        annotations:
          summary: "High payment failure rate: {{ $value }}%"
          
      - alert: ChannelUnbalanced
        expr: lightning_channel_balance_ratio < 0.2 OR lightning_channel_balance_ratio > 0.8
        for: 1h
        annotations:
          summary: "Channel needs rebalancing"
```

---

## Production Deployment

### Pre-Production Checklist

- [ ] Bitcoin Core fully synced
- [ ] LND fully synced and operational
- [ ] At least 3 well-connected channels opened
- [ ] Backup system configured and tested
- [ ] Monitoring and alerting configured
- [ ] Webhook endpoints secured and tested
- [ ] Rate limiting configured
- [ ] Secrets rotated from defaults
- [ ] TLS/SSL certificates configured
- [ ] Firewall rules configured
- [ ] Disaster recovery plan documented
- [ ] Team trained on Lightning operations

### Channel Opening Strategy

**Initial Channels (Minimum 3):**

1. **Large routing node** (e.g., ACINQ, Wallet of Satoshi)
   - Capacity: 1,000,000 - 5,000,000 sats
   - High uptime and liquidity
   
2. **Regional routing node**
   - Capacity: 500,000 - 2,000,000 sats
   - Low latency to your region
   
3. **Merchant-focused node**
   - Capacity: 500,000 - 1,000,000 sats
   - Good for receiving payments

```bash
# Open channel via API
curl -X POST http://localhost:3000/api/lightning/channels \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "03node-public-key...",
    "localAmount": 1000000,
    "isPrivate": false
  }'
```

### Backup Procedures

**Critical Files to Backup:**
- LND wallet seed (static channel backups)
- channel.backup file
- Application database
- Configuration files

```bash
# Automated backup script
#!/bin/bash

# Backup LND data
docker exec lnd lncli exportchanbackup --all \
  > /backups/lnd-channels-$(date +%Y%m%d).backup

# Backup to S3
aws s3 sync /backups s3://your-backup-bucket/lightning/

# Retain 30 days
find /backups -mtime +30 -delete
```

### Disaster Recovery

**Scenario: Server Failure**

1. Restore Bitcoin Core blockchain (or sync new node)
2. Restore LND wallet from seed
3. Restore channel backups
4. Force close channels if necessary
5. Wait for on-chain settlement (1-2016 blocks)

**Scenario: Channel Force Closure**

1. Monitor for force close transactions
2. Ensure channel backup is recent
3. Wait for CSV timelock expiration
4. Sweep funds back to wallet

---

## Troubleshooting

### Common Issues

#### LND Connection Failed

```bash
# Check LND is running
docker ps | grep lnd

# Check logs
docker logs lnd --tail 100

# Test gRPC connection
grpcurl -d '{}' localhost:10009 lnrpc.Lightning.GetInfo
```

#### Invoice Not Updating

```bash
# Check invoice monitoring
# Verify LND subscription is active
docker logs app | grep "Lightning invoice monitoring started"

# Manually check invoice
docker exec lnd lncli lookupinvoice <payment-hash>
```

#### Payment Routing Failures

```bash
# Check channel status
docker exec lnd lncli listchannels

# Check routing fees
docker exec lnd lncli feereport

# Update channel fees if needed
docker exec lnd lncli updatechanpolicy --base_fee_msat 1000 --fee_rate 0.000001 --time_lock_delta 40
```

#### Channel Rebalancing Not Working

```bash
# Check rebalancing configuration
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/lightning/rebalancing/config

# Get recommendations
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/lightning/rebalancing/recommendations

# Check logs
docker logs app | grep rebalancing
```

### Debug Mode

Enable debug logging:

```bash
# In .env
LOG_LEVEL=debug

# Restart application
docker-compose restart app

# View logs
docker logs -f app | grep lightning
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor payment success rate
- Check channel balances
- Review error logs

**Weekly:**
- Review and rebalance channels
- Check disk space
- Backup channel state
- Update fee policies if needed

**Monthly:**
- Review routing performance
- Evaluate new channel opportunities
- Close underperforming channels
- Update software (after testing)
- Rotate secrets

### Performance Optimization

**Fee Optimization:**
```bash
# Adjust fees based on routing volume
docker exec lnd lncli updatechanpolicy \
  --base_fee_msat 500 \
  --fee_rate 0.000002 \
  --time_lock_delta 40 \
  --chan_point <channel-point>
```

**Channel Rebalancing:**
```bash
# Use circular rebalancing tools
# Or use automated rebalancing service

curl -X POST http://localhost:3000/api/lightning/rebalancing/auto \
  -H "Authorization: Bearer <admin-token>"
```

### Upgrade Procedures

```bash
# 1. Backup everything
./backup-lightning.sh

# 2. Stop services gracefully
docker-compose down

# 3. Update Docker images
docker pull btcpayserver/lnd:latest
docker-compose pull

# 4. Start services
docker-compose up -d

# 5. Verify operation
curl http://localhost:3000/api/lightning/info

# 6. Monitor for issues
docker logs -f app
```

---

## Support Resources

- **LND Documentation:** https://docs.lightning.engineering/
- **Lightning Network RFC:** https://github.com/lightning/bolts
- **Community:** Lightning Network Slack, Bitcoin Stack Exchange
- **Application Logs:** `logs/combined.log`, `logs/error.log`
- **LND Logs:** `docker logs lnd`

---

## Security Best Practices

1. **Never expose LND gRPC port to the internet**
2. **Use restricted macaroons for the application**
3. **Rotate secrets every 90 days**
4. **Enable 2FA for admin accounts**
5. **Monitor for suspicious activity**
6. **Keep software updated**
7. **Use hardware security modules (HSM) if possible**
8. **Implement proper access controls**
9. **Regular security audits**
10. **Incident response plan in place**

---

**Last Updated:** October 2025  
**Version:** 2.2.0  
**Status:** ✅ Production Ready
