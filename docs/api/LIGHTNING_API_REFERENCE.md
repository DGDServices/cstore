# Lightning Network API Reference

**Version:** 2.2.0  
**Last Updated:** October 2025  
**Status:** ✅ Production Ready

---

## Table of Contents

- [Authentication](#authentication)
- [Payment Endpoints](#payment-endpoints)
- [Channel Management](#channel-management)
- [Monitoring & Analytics](#monitoring--analytics)
- [Webhook Management](#webhook-management)
- [Channel Rebalancing](#channel-rebalancing)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

Most Lightning Network endpoints require authentication:

```http
Authorization: Bearer <your-jwt-token>
```

**Admin-only endpoints** require the user to have admin role.

---

## Payment Endpoints

### Get Lightning Network Info

Get Lightning Network status and node information.

**Endpoint:** `GET /api/lightning/info`  
**Auth Required:** No  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "info": {
      "publicKey": "03abc123...",
      "alias": "cryptons-node",
      "version": "0.16.4-beta",
      "numActiveChannels": 5,
      "numPeers": 8,
      "blockHeight": 800000,
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

---

### Create Lightning Invoice

Create a Lightning invoice for an order.

**Endpoint:** `POST /api/lightning/invoices`  
**Auth Required:** No  
**Rate Limit:** 100 requests/15 minutes

**Request Body:**
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "expireSeconds": 3600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "paymentRequest": "lnbc100u1p3...",
      "paymentHash": "abc123def456...",
      "amount": 10000,
      "amountMsat": 10000000,
      "description": "Order #507f1f77 - 2 item(s)",
      "expiresAt": "2025-10-14T13:00:00.000Z",
      "createdAt": "2025-10-14T12:00:00.000Z",
      "qrCode": "data:image/png;base64,..."
    }
  }
}
```

---

### Get Invoice Status

Get the current status of a Lightning invoice.

**Endpoint:** `GET /api/lightning/invoices/:paymentHash`  
**Auth Required:** No  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "status": "paid",
      "paymentHash": "abc123def456...",
      "amount": 10000,
      "paidAt": "2025-10-14T12:05:00.000Z",
      "preimage": "def456ghi789...",
      "expiresAt": "2025-10-14T13:00:00.000Z"
    }
  }
}
```

**Status Values:**
- `pending` - Invoice created, awaiting payment
- `paid` - Invoice paid successfully
- `expired` - Invoice expired without payment
- `cancelled` - Invoice cancelled

---

### Confirm Payment

Confirm a Lightning payment and update the order.

**Endpoint:** `POST /api/lightning/payments/confirm`  
**Auth Required:** No  
**Rate Limit:** 100 requests/15 minutes

**Request Body:**
```json
{
  "paymentHash": "abc123def456..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "payment": {
      "_id": "payment-id",
      "transactionHash": "abc123def456...",
      "cryptocurrency": "BTC-LN",
      "amount": 0.0001,
      "amountUSD": 10.00,
      "status": "confirmed"
    },
    "order": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "paid",
      "paidAt": "2025-10-14T12:05:00.000Z"
    }
  }
}
```

---

### Decode Payment Request

Decode a Lightning payment request (BOLT11 invoice).

**Endpoint:** `POST /api/lightning/decode`  
**Auth Required:** No  
**Rate Limit:** 100 requests/15 minutes

**Request Body:**
```json
{
  "paymentRequest": "lnbc100u1p3..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": {
      "destination": "03abc123...",
      "paymentHash": "def456ghi789...",
      "amount": 10000,
      "description": "Order payment",
      "expiresAt": "2025-10-14T13:00:00.000Z",
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  }
}
```

---

## Channel Management

### Get Wallet Balance

Get Lightning wallet balance.

**Endpoint:** `GET /api/lightning/balance`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": {
      "chainBalance": 1000000,
      "pendingChainBalance": 0,
      "channelBalance": 5000000,
      "pendingChannelBalance": 0,
      "unsettledBalance": 0,
      "totalBalance": 6000000
    }
  }
}
```

---

### List Channels

List all Lightning channels.

**Endpoint:** `GET /api/lightning/channels`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "channelId": "123456:1:0",
        "remotePubkey": "03abc123...",
        "capacity": 1000000,
        "localBalance": 600000,
        "remoteBalance": 400000,
        "isActive": true,
        "isPrivate": false,
        "unsettledBalance": 0,
        "totalSent": 1500000,
        "totalReceived": 500000
      }
    ],
    "count": 1
  }
}
```

---

### Open Channel

Open a new Lightning channel.

**Endpoint:** `POST /api/lightning/channels`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "publicKey": "03abc123def456...",
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
    "transactionId": "tx-hash-abc123...",
    "transactionVout": 0,
    "channelId": "tx-hash-abc123..."
  }
}
```

---

### Close Channel

Close a Lightning channel.

**Endpoint:** `DELETE /api/lightning/channels/:channelId?force=false`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Query Parameters:**
- `force` - Set to `true` for force close (default: `false`)

**Response:**
```json
{
  "success": true,
  "message": "Channel closing initiated",
  "data": {
    "transactionId": "closing-tx-hash...",
    "transactionVout": 0
  }
}
```

---

### Pay Invoice

Pay a Lightning invoice (admin operation).

**Endpoint:** `POST /api/lightning/pay`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Request Body:**
```json
{
  "paymentRequest": "lnbc100u1p3...",
  "maxFee": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice paid successfully",
  "data": {
    "paymentHash": "abc123def456...",
    "fee": 2,
    "feeMtokens": 2000,
    "hops": 3,
    "secret": "preimage-secret...",
    "tokens": 10000
  }
}
```

---

## Monitoring & Analytics

### Get Dashboard Metrics

Get comprehensive Lightning Network dashboard metrics.

**Endpoint:** `GET /api/lightning/monitoring/dashboard`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-14T12:00:00.000Z",
    "payments": {
      "last24Hours": {
        "total": 150,
        "paid": 145,
        "expired": 3,
        "pending": 2,
        "successRate": "96.67",
        "totalVolume": 1500000,
        "totalVolumeUSD": 1500.00
      },
      "last7Days": { ... },
      "last30Days": { ... }
    },
    "channels": {
      "total": 5,
      "active": 4,
      "inactive": 1,
      "totalCapacity": 5000000,
      "totalLocalBalance": 3000000,
      "totalRemoteBalance": 2000000,
      "channelUtilization": "100.00"
    },
    "fees": {
      "totalPayments": 145,
      "totalFees": 72.5,
      "avgFee": 0.5,
      "feeSavings": 144927.5,
      "savingsPercentage": "99.95"
    },
    "recentTransactions": [ ... ],
    "uptime": 86400
  }
}
```

---

### Get Payment Statistics

Get payment statistics with optional date filtering.

**Endpoint:** `GET /api/lightning/monitoring/payments?startDate=<date>&endDate=<date>`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Query Parameters:**
- `startDate` - ISO 8601 date (optional)
- `endDate` - ISO 8601 date (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "paid": 145,
    "expired": 3,
    "pending": 2,
    "cancelled": 0,
    "totalVolume": 1500000,
    "totalVolumeUSD": 1500.00,
    "avgAmount": 10344.83,
    "avgAmountUSD": 10.34,
    "successRate": "96.67",
    "expiryRate": "2.00"
  }
}
```

---

### Get Channel Statistics

Get channel statistics and metrics.

**Endpoint:** `GET /api/lightning/monitoring/channels`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "active": 4,
    "inactive": 1,
    "pending": 0,
    "closing": 0,
    "closed": 0,
    "totalCapacity": 5000000,
    "totalLocalBalance": 3000000,
    "totalRemoteBalance": 2000000,
    "totalAvailableBalance": 2950000,
    "avgCapacity": 1000000,
    "channelUtilization": "100.00"
  }
}
```

---

### Get Channel Performance

Get detailed channel performance metrics.

**Endpoint:** `GET /api/lightning/monitoring/channel-performance`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "channelId": "123456:1:0",
        "remotePubkey": "03abc123...",
        "capacity": 1000000,
        "localBalance": 600000,
        "remoteBalance": 400000,
        "availableBalance": 590000,
        "utilizationRate": "60.00",
        "balanceRatio": "60.00",
        "totalSent": 1000000,
        "totalReceived": 600000,
        "isBalanced": true,
        "needsRebalancing": false
      }
    ],
    "summary": {
      "total": 5,
      "needsRebalancing": 1,
      "balanced": 3,
      "avgUtilization": "82.50"
    }
  }
}
```

---

### Get Fee Analysis

Get Lightning Network fee analysis.

**Endpoint:** `GET /api/lightning/monitoring/fees?startDate=<date>&endDate=<date>`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPayments": 145,
    "totalFees": 72.5,
    "avgFee": 0.5,
    "minFee": 0,
    "maxFee": 0,
    "feeSavings": 144927.5,
    "savingsPercentage": "99.95",
    "avgFeeSats": 0.5
  }
}
```

---

### Get Transaction History

Get Lightning transaction history with filtering and pagination.

**Endpoint:** `GET /api/lightning/monitoring/transactions?status=<status>&limit=<limit>&skip=<skip>`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Query Parameters:**
- `status` - Filter by status (paid, pending, expired, cancelled)
- `startDate` - ISO 8601 date
- `endDate` - ISO 8601 date
- `limit` - Number of results (default: 50, max: 100)
- `skip` - Number of results to skip

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [ ... ],
    "total": 150,
    "limit": 50,
    "skip": 0,
    "hasMore": true
  }
}
```

---

### Generate Analytics Report

Generate a comprehensive analytics report for a specified period.

**Endpoint:** `GET /api/lightning/monitoring/report?period=<period>`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Query Parameters:**
- `period` - Time period (24h, 7d, 30d, 90d)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "startDate": "2025-09-14T00:00:00.000Z",
    "endDate": "2025-10-14T00:00:00.000Z",
    "payments": { ... },
    "channels": { ... },
    "fees": { ... },
    "performance": { ... },
    "generatedAt": "2025-10-14T12:00:00.000Z"
  }
}
```

---

## Webhook Management

### Register Webhook

Register a webhook URL for Lightning Network events.

**Endpoint:** `POST /api/lightning/webhooks`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/lightning",
  "events": [
    "payment.confirmed",
    "payment.failed",
    "invoice.expired",
    "channel.opened",
    "channel.closed"
  ],
  "secret": "your-webhook-secret"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook registered successfully",
  "data": {
    "url": "https://your-app.com/webhooks/lightning",
    "events": [ ... ],
    "active": true,
    "createdAt": "2025-10-14T12:00:00.000Z"
  }
}
```

---

### Unregister Webhook

Unregister a webhook URL.

**Endpoint:** `DELETE /api/lightning/webhooks`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/lightning"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook unregistered successfully"
}
```

---

### List Webhooks

List all registered webhooks.

**Endpoint:** `GET /api/lightning/webhooks`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "url": "https://your-app.com/webhooks/lightning",
        "events": [ ... ],
        "active": true,
        "createdAt": "2025-10-14T12:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### Test Webhook

Test webhook delivery.

**Endpoint:** `POST /api/lightning/webhooks/test`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/lightning"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test webhook delivered successfully"
}
```

---

### Toggle Webhooks

Enable or disable webhooks globally.

**Endpoint:** `PUT /api/lightning/webhooks/toggle`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhooks enabled"
}
```

---

## Channel Rebalancing

### Get Rebalancing Recommendations

Get channel rebalancing recommendations.

**Endpoint:** `GET /api/lightning/rebalancing/recommendations`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 2,
    "recommendations": [
      {
        "channelId": "123456:1:0",
        "remotePubkey": "03abc123...",
        "capacity": 1000000,
        "localBalance": 900000,
        "remoteBalance": 100000,
        "localRatio": "90.00",
        "direction": "outbound",
        "amount": 400000,
        "priority": 10,
        "estimatedFee": 40,
        "recommendation": "Critical: Decrease local balance by sending payments. Current local balance: 90.00%. Target: 50%. Amount to move: 400000 sats."
      }
    ],
    "summary": {
      "critical": 1,
      "high": 1,
      "medium": 0,
      "low": 0
    }
  }
}
```

---

### Execute Rebalancing

Execute manual rebalancing for a channel.

**Endpoint:** `POST /api/lightning/rebalancing/execute`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "channelId": "123456:1:0",
  "amount": 400000,
  "direction": "outbound"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rebalancing executed",
  "data": {
    "channelId": "123456:1:0",
    "amount": 400000,
    "direction": "outbound",
    "status": "simulated",
    "fee": 40,
    "timestamp": "2025-10-14T12:00:00.000Z"
  }
}
```

---

### Execute Auto-Rebalancing

Execute automatic rebalancing for all channels.

**Endpoint:** `POST /api/lightning/rebalancing/auto`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 5 requests/hour

**Response:**
```json
{
  "success": true,
  "message": "Auto-rebalancing completed",
  "data": {
    "success": true,
    "channelsRebalanced": 2,
    "totalChannels": 2,
    "results": [ ... ]
  }
}
```

---

### Get Rebalancing Configuration

Get current rebalancing configuration.

**Endpoint:** `GET /api/lightning/rebalancing/config`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 100 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "minBalanceRatio": 0.2,
    "maxBalanceRatio": 0.8,
    "optimalBalanceRatio": 0.5,
    "maxFeeRate": 0.0001,
    "isRunning": false
  }
}
```

---

### Update Rebalancing Configuration

Update rebalancing configuration.

**Endpoint:** `PUT /api/lightning/rebalancing/config`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "minBalanceRatio": 0.25,
  "maxBalanceRatio": 0.75,
  "optimalBalanceRatio": 0.6,
  "maxFeeRate": 0.0002
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated",
  "data": { ... }
}
```

---

### Start Rebalancing Scheduler

Start automatic rebalancing scheduler.

**Endpoint:** `POST /api/lightning/rebalancing/scheduler/start`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Request Body:**
```json
{
  "intervalMs": 3600000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-rebalancing scheduler started"
}
```

---

### Stop Rebalancing Scheduler

Stop automatic rebalancing scheduler.

**Endpoint:** `POST /api/lightning/rebalancing/scheduler/stop`  
**Auth Required:** Yes (Admin)  
**Rate Limit:** 10 requests/15 minutes

**Response:**
```json
{
  "success": true,
  "message": "Auto-rebalancing scheduler stopped"
}
```

---

## Error Handling

All API endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

**Common Error Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable (LND not available)

---

## Rate Limiting

Rate limits are applied per IP address:

- **General endpoints:** 100 requests per 15 minutes
- **Channel operations:** 10 requests per 15 minutes
- **Auto-rebalancing:** 5 requests per hour
- **Report generation:** 10 requests per 15 minutes

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1697280000
```

---

**Last Updated:** October 2025  
**Version:** 2.2.0  
**Status:** ✅ Production Ready
