# Escrow API Documentation

## Overview

The Escrow API provides secure transaction management between buyers and sellers with automated release conditions, milestone-based payments, and dispute resolution mechanisms.

## Features

- **Smart Escrow Contracts**: Create secure escrow agreements between parties
- **Multiple Release Types**: Support for manual, automatic, time-based, and milestone-based releases
- **Dispute Resolution**: Built-in dispute filing and resolution system
- **Multi-Signature Support**: Enhanced security for high-value transactions (≥$10,000 USD)
- **Milestone Payments**: Break down large projects into multiple payment milestones
- **Automated Conditions**: Time-based and delivery-based automatic releases
- **Comprehensive Audit Trail**: Complete history of all escrow operations

## Endpoints

### Create Escrow

Create a new escrow contract between buyer and seller.

**Endpoint:** `POST /api/escrow`

**Authentication:** Required

**Request Body:**
```json
{
  "buyer": "507f1f77bcf86cd799439011",
  "seller": "507f191e810c19729de860ea",
  "orderId": "507f1f77bcf86cd799439012",
  "title": "Website Development Project",
  "description": "Full-stack web application development",
  "amount": 2.5,
  "cryptocurrency": "ETH",
  "amountUSD": 7500,
  "depositAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "releaseAddress": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  "refundAddress": "0x9f8e51A20a91e4A47c85d8E5e7c4F1eF8e7D2c8f",
  "releaseType": "milestone_based",
  "milestones": [
    {
      "title": "Design Phase",
      "description": "UI/UX design and mockups",
      "amount": 0.8
    },
    {
      "title": "Development Phase",
      "description": "Backend and frontend development",
      "amount": 1.2
    },
    {
      "title": "Testing & Deployment",
      "description": "Testing and production deployment",
      "amount": 0.5
    }
  ],
  "metadata": {
    "terms": "Payment upon completion of each milestone",
    "inspectionPeriodDays": 3,
    "autoReleaseAfterDays": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "buyer": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "buyer@example.com"
    },
    "seller": {
      "_id": "507f191e810c19729de860ea",
      "name": "Jane Smith",
      "email": "seller@example.com"
    },
    "title": "Website Development Project",
    "status": "created",
    "amount": 2.5,
    "cryptocurrency": "ETH",
    "amountUSD": 7500,
    "requiresMultiSig": false,
    "fees": [
      {
        "type": "platform",
        "amount": 0.05,
        "percentage": 2,
        "paidBy": "seller"
      },
      {
        "type": "blockchain",
        "amount": 0.001,
        "paidBy": "buyer"
      }
    ],
    "totalFees": 0.051,
    "milestones": [...],
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### Get All Escrows

Retrieve all escrows for the authenticated user.

**Endpoint:** `GET /api/escrow?status=funded&role=buyer`

**Authentication:** Required

**Query Parameters:**
- `status` (optional): Filter by status (created, funded, active, completed, disputed, refunded, cancelled, expired)
- `role` (optional): Filter by user role (buyer, seller)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "title": "Website Development Project",
      "status": "funded",
      "amount": 2.5,
      "cryptocurrency": "ETH",
      "buyer": {...},
      "seller": {...},
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### Get Single Escrow

Get detailed information about a specific escrow.

**Endpoint:** `GET /api/escrow/:id`

**Authentication:** Required (must be buyer, seller, or admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "buyer": {...},
    "seller": {...},
    "title": "Website Development Project",
    "status": "funded",
    "amount": 2.5,
    "cryptocurrency": "ETH",
    "milestones": [...],
    "disputes": [],
    "history": [
      {
        "action": "created",
        "performedBy": {...},
        "timestamp": "2025-01-15T10:00:00.000Z"
      },
      {
        "action": "funded",
        "performedBy": {...},
        "timestamp": "2025-01-15T11:00:00.000Z"
      }
    ]
  }
}
```

---

### Fund Escrow

Fund an escrow contract with cryptocurrency.

**Endpoint:** `POST /api/escrow/:id/fund`

**Authentication:** Required (buyer only)

**Request Body:**
```json
{
  "transactionHash": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow funded successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "funded",
    "depositTransactionHash": "0x1a2b3c4d...",
    "fundedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

### Release Escrow

Release escrow funds to the seller.

**Endpoint:** `POST /api/escrow/:id/release`

**Authentication:** Required (buyer or authorized party)

**Request Body:**
```json
{
  "signature": "0xabcdef..." // Optional, required for multi-sig
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow released successfully",
  "status": "released",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "completed",
    "releasedAt": "2025-01-20T15:30:00.000Z"
  }
}
```

**Multi-Sig Response (pending approval):**
```json
{
  "success": true,
  "message": "Release approval recorded, waiting for additional approvals",
  "status": "pending_approval",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "funded",
    "multiSigApprovals": [
      {
        "user": {...},
        "action": "release",
        "approved": true,
        "approvedAt": "2025-01-20T15:30:00.000Z"
      }
    ]
  }
}
```

---

### Refund Escrow

Refund escrow funds to the buyer.

**Endpoint:** `POST /api/escrow/:id/refund`

**Authentication:** Required (buyer or seller)

**Request Body:**
```json
{
  "reason": "Product not delivered as agreed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow refunded successfully",
  "status": "refunded",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "refunded",
    "refundedAt": "2025-01-18T12:00:00.000Z"
  }
}
```

---

### File Dispute

File a dispute for an escrow transaction.

**Endpoint:** `POST /api/escrow/:id/dispute`

**Authentication:** Required (buyer or seller)

**Request Body:**
```json
{
  "reason": "Product not as described",
  "description": "The delivered website does not match the specifications outlined in the agreement. Several key features are missing.",
  "evidence": [
    {
      "url": "https://storage.example.com/evidence/screenshot1.png",
      "uploadedAt": "2025-01-18T10:00:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispute filed successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "disputed",
    "disputes": [
      {
        "_id": "507f1f77bcf86cd799439014",
        "filedBy": {...},
        "reason": "Product not as described",
        "status": "open",
        "createdAt": "2025-01-18T10:00:00.000Z"
      }
    ]
  }
}
```

---

### Resolve Dispute (Admin Only)

Resolve an escrow dispute.

**Endpoint:** `POST /api/escrow/:id/dispute/:disputeId/resolve`

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "type": "buyer_favor",
  "details": "After reviewing the evidence, the product does not meet the agreed specifications. Full refund approved."
}
```

**Resolution Types:**
- `buyer_favor`: Full refund to buyer
- `seller_favor`: Full release to seller
- `partial_refund`: Partial refund (custom split)
- `custom`: Custom resolution

**Response:**
```json
{
  "success": true,
  "message": "Dispute resolved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "refunded",
    "disputes": [
      {
        "_id": "507f1f77bcf86cd799439014",
        "status": "resolved",
        "resolution": "buyer_favor",
        "resolvedBy": {...},
        "resolvedAt": "2025-01-19T14:00:00.000Z"
      }
    ]
  }
}
```

---

### Complete Milestone

Mark a milestone as completed (seller action).

**Endpoint:** `POST /api/escrow/:id/milestone/:milestoneId/complete`

**Authentication:** Required (seller only)

**Response:**
```json
{
  "success": true,
  "message": "Milestone completed successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "milestones": [
      {
        "_id": "507f1f77bcf86cd799439015",
        "title": "Design Phase",
        "status": "completed",
        "completedAt": "2025-01-17T16:00:00.000Z"
      }
    ]
  }
}
```

---

### Release Milestone

Release milestone funds (buyer action).

**Endpoint:** `POST /api/escrow/:id/milestone/:milestoneId/release`

**Authentication:** Required (buyer only)

**Response:**
```json
{
  "success": true,
  "message": "Milestone funds released successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "milestones": [
      {
        "_id": "507f1f77bcf86cd799439015",
        "title": "Design Phase",
        "status": "released",
        "releasedAt": "2025-01-18T10:00:00.000Z"
      }
    ]
  }
}
```

---

### Cancel Escrow

Cancel an unfunded escrow.

**Endpoint:** `POST /api/escrow/:id/cancel`

**Authentication:** Required (buyer or seller)

**Request Body:**
```json
{
  "reason": "Project cancelled by mutual agreement"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow cancelled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "status": "cancelled"
  }
}
```

---

### Get Escrow Statistics (Admin Only)

Get comprehensive escrow statistics.

**Endpoint:** `GET /api/escrow/stats`

**Authentication:** Required (admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "_id": "funded", "count": 15, "totalAmount": 25.5, "totalAmountUSD": 127500 },
      { "_id": "completed", "count": 50, "totalAmount": 100.2, "totalAmountUSD": 501000 }
    ],
    "byCryptocurrency": [
      { "_id": "BTC", "count": 30, "totalAmount": 15.5 },
      { "_id": "ETH", "count": 35, "totalAmount": 110.2 }
    ],
    "total": [
      { "count": 100, "totalAmountUSD": 2500000, "avgAmountUSD": 25000 }
    ],
    "disputes": [
      { "count": 3 }
    ],
    "activeEscrows": [
      { "count": 20 }
    ]
  }
}
```

---

## Escrow Statuses

| Status | Description |
|--------|-------------|
| `created` | Escrow contract created, awaiting funding |
| `funded` | Funds deposited, escrow active |
| `active` | Escrow in progress (alias for funded) |
| `completed` | Funds released to seller |
| `disputed` | Dispute filed, pending resolution |
| `refunded` | Funds returned to buyer |
| `cancelled` | Escrow cancelled before funding |
| `expired` | Escrow expired without completion |

---

## Release Types

| Type | Description |
|------|-------------|
| `manual` | Requires manual release by buyer |
| `automatic` | Auto-releases when all conditions met |
| `milestone_based` | Release funds per milestone completion |
| `time_based` | Auto-releases after specified time |
| `mutual` | Requires agreement from both parties |

---

## Security Features

### Multi-Signature Support

High-value transactions (≥$10,000 USD) automatically require multi-signature approval:
- Default requirement: 2 approvals
- Prevents unauthorized fund releases
- Enhanced security for large transactions

### Audit Trail

Every escrow operation is logged:
- Action performed
- User who performed the action
- Timestamp
- Additional details

### Access Control

- **Buyers**: Can fund, release, dispute, and cancel
- **Sellers**: Can refund (with buyer approval), dispute, and cancel
- **Admins**: Can resolve disputes and view all escrows

---

## Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid input or validation error |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Not authorized to perform action |
| 404 | Not Found | Escrow not found |
| 500 | Server Error | Internal server error |

---

## Integration Examples

### Basic Escrow Flow

```javascript
// 1. Create escrow
const escrow = await fetch('/api/escrow', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    buyer: buyerId,
    seller: sellerId,
    title: 'Product Purchase',
    amount: 0.5,
    cryptocurrency: 'BTC',
    amountUSD: 25000,
    depositAddress: 'address',
    releaseType: 'manual'
  })
});

// 2. Fund escrow
await fetch(`/api/escrow/${escrow._id}/fund`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transactionHash: 'txhash'
  })
});

// 3. Release funds (after delivery)
await fetch(`/api/escrow/${escrow._id}/release`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN'
  }
});
```

### Milestone-Based Escrow

```javascript
const escrow = await fetch('/api/escrow', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    buyer: buyerId,
    seller: sellerId,
    title: 'Project Development',
    amount: 3.0,
    cryptocurrency: 'ETH',
    amountUSD: 9000,
    depositAddress: 'address',
    releaseType: 'milestone_based',
    milestones: [
      { title: 'Phase 1', amount: 1.0 },
      { title: 'Phase 2', amount: 1.0 },
      { title: 'Phase 3', amount: 1.0 }
    ]
  })
});

// Seller completes milestone
await fetch(`/api/escrow/${escrow._id}/milestone/${milestoneId}/complete`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' }
});

// Buyer releases milestone funds
await fetch(`/api/escrow/${escrow._id}/milestone/${milestoneId}/release`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' }
});
```

---

## Best Practices

1. **Always verify transaction hashes** before funding escrow
2. **Use milestone-based escrow** for large projects
3. **Set reasonable inspection periods** for buyers
4. **Provide detailed dispute evidence** when filing disputes
5. **Use multi-sig wallets** for high-value transactions
6. **Document terms clearly** in escrow metadata
7. **Monitor escrow status** through webhooks or polling

---

## Webhooks (Future Enhancement)

Escrow events can trigger webhooks for:
- Escrow funded
- Milestone completed
- Dispute filed
- Escrow released/refunded
- Escrow expired

---

## Support

For questions or issues, contact support@cryptons.com or refer to the main API documentation.
