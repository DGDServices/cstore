# Multi-Signature Wallet Usage Examples

This document provides practical examples for using the multi-signature wallet functionality in CStore.

## Prerequisites

- Three registered users (owner, signer1, signer2)
- Authentication tokens for all users
- A cryptocurrency wallet address

## Example 1: Setting Up a 2-of-3 Multi-Sig Wallet

### Step 1: Create the Wallet

As the wallet owner:

```bash
curl -X POST http://localhost:3000/api/multisig/wallets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Operations Wallet",
    "cryptocurrency": "BTC",
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "signers": [
      { "email": "cfo@company.com" },
      { "email": "cto@company.com" },
      { "email": "ceo@company.com" }
    ],
    "requiredSignatures": 2,
    "description": "Requires 2 out of 3 executives to approve transactions"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "wallet123",
    "name": "Company Operations Wallet",
    "cryptocurrency": "BTC",
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "signers": [
      {
        "user": "user1",
        "email": "cfo@company.com",
        "name": "Jane CFO"
      },
      {
        "user": "user2",
        "email": "cto@company.com",
        "name": "John CTO"
      },
      {
        "user": "user3",
        "email": "ceo@company.com",
        "name": "Alice CEO"
      }
    ],
    "requiredSignatures": 2,
    "isActive": true
  }
}
```

### Step 2: Verify All Signers Can See the Wallet

Each signer can verify they have access:

```bash
curl -X GET http://localhost:3000/api/multisig/wallets \
  -H "Authorization: Bearer SIGNER_TOKEN"
```

## Example 2: Processing a Payment

### Step 1: Create a Transaction Approval Request

After an order is created, initiate a transaction approval:

```bash
curl -X POST http://localhost:3000/api/multisig/transactions \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "wallet123",
    "orderId": "order456",
    "amount": 0.05,
    "toAddress": "1BitcoinEaterAddressDontSendf59kuE",
    "description": "Payment for Order #456 - Hardware Purchase"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction789",
    "wallet": {
      "_id": "wallet123",
      "name": "Company Operations Wallet"
    },
    "amount": 0.05,
    "toAddress": "1BitcoinEaterAddressDontSendf59kuE",
    "status": "pending",
    "requiredApprovals": 2,
    "approvals": [],
    "metadata": {
      "expiresAt": "2024-01-08T00:00:00.000Z"
    }
  }
}
```

### Step 2: First Signer Approves

CFO reviews and approves:

```bash
curl -X POST http://localhost:3000/api/multisig/transactions/transaction789/approve \
  -H "Authorization: Bearer CFO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "comment": "Reviewed invoice and budget allocation. Approved."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction789",
    "status": "pending",
    "approvals": [
      {
        "signer": {
          "name": "Jane CFO",
          "email": "cfo@company.com"
        },
        "approved": true,
        "comment": "Reviewed invoice and budget allocation. Approved.",
        "approvedAt": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

### Step 3: Second Signer Approves

CTO reviews and approves:

```bash
curl -X POST http://localhost:3000/api/multisig/transactions/transaction789/approve \
  -H "Authorization: Bearer CTO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "comment": "Technical specifications verified. Approved."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction789",
    "status": "approved",
    "approvals": [
      {
        "signer": { "name": "Jane CFO" },
        "approved": true,
        "approvedAt": "2024-01-01T10:00:00.000Z"
      },
      {
        "signer": { "name": "John CTO" },
        "approved": true,
        "approvedAt": "2024-01-01T11:00:00.000Z"
      }
    ]
  }
}
```

### Step 4: Execute the Transaction

Once approved, broadcast the transaction and register the hash:

```bash
curl -X POST http://localhost:3000/api/multisig/transactions/transaction789/execute \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionHash": "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction789",
    "status": "executed",
    "transactionHash": "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
    "metadata": {
      "executedAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

## Example 3: Rejecting a Transaction

### Signer Rejects

If a signer finds an issue:

```bash
curl -X POST http://localhost:3000/api/multisig/transactions/transaction789/approve \
  -H "Authorization: Bearer SIGNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "comment": "Invoice amount does not match quote. Please verify."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction789",
    "status": "rejected",
    "approvals": [
      {
        "signer": { "name": "Jane CFO" },
        "approved": false,
        "comment": "Invoice amount does not match quote. Please verify.",
        "approvedAt": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

## Example 4: Managing Signers

### Adding a New Signer

```bash
curl -X POST http://localhost:3000/api/multisig/wallets/wallet123/signers \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newexec@company.com",
    "publicKey": "optional-public-key"
  }'
```

### Removing a Signer

```bash
curl -X DELETE http://localhost:3000/api/multisig/wallets/wallet123/signers/user1 \
  -H "Authorization: Bearer OWNER_TOKEN"
```

**Note:** Cannot remove a signer if it would result in fewer signers than required signatures.

## Example 5: Canceling a Pending Transaction

### Cancel by Initiator or Owner

```bash
curl -X DELETE http://localhost:3000/api/multisig/transactions/transaction789 \
  -H "Authorization: Bearer OWNER_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction cancelled successfully"
}
```

## Example 6: Querying Transactions

### Get All Pending Transactions

```bash
curl -X GET "http://localhost:3000/api/multisig/transactions?status=pending" \
  -H "Authorization: Bearer SIGNER_TOKEN"
```

### Get Transactions for Specific Wallet

```bash
curl -X GET "http://localhost:3000/api/multisig/transactions?walletId=wallet123" \
  -H "Authorization: Bearer OWNER_TOKEN"
```

### Get Transaction Details

```bash
curl -X GET http://localhost:3000/api/multisig/transactions/transaction789 \
  -H "Authorization: Bearer SIGNER_TOKEN"
```

## Example 7: Update Wallet Settings

### Update Wallet Name and Description

```bash
curl -X PUT http://localhost:3000/api/multisig/wallets/wallet123 \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Treasury Wallet",
    "description": "Primary operations wallet - updated policy",
    "isActive": true
  }'
```

## Example 8: Deactivating a Wallet

### Soft Delete (Deactivate)

```bash
curl -X DELETE http://localhost:3000/api/multisig/wallets/wallet123 \
  -H "Authorization: Bearer OWNER_TOKEN"
```

This sets `isActive` to `false`. The wallet and its transaction history are preserved but it cannot be used for new transactions.

## Common Workflows

### Workflow 1: Daily Operations Payment

1. Finance team member creates transaction approval request
2. CFO approves
3. CEO approves
4. Finance team executes transaction with blockchain hash
5. Order automatically marked as paid

### Workflow 2: Emergency Transaction

1. Any signer can create urgent transaction
2. Notify other signers via external communication
3. Collect required approvals quickly
4. Execute as soon as threshold reached

### Workflow 3: Monthly Reconciliation

1. Query all executed transactions for the period
2. Export transaction hashes for blockchain verification
3. Match with accounting records
4. Identify any pending/expired transactions

## Error Handling

### Common Errors

**Insufficient Permissions:**
```json
{
  "success": false,
  "message": "You do not have access to this wallet",
  "statusCode": 403
}
```

**Already Approved:**
```json
{
  "success": false,
  "message": "You have already provided approval for this transaction",
  "statusCode": 400
}
```

**Insufficient Signers:**
```json
{
  "success": false,
  "message": "At least 2 signers are required for multi-signature wallet",
  "statusCode": 400
}
```

**Transaction Not Ready:**
```json
{
  "success": false,
  "message": "Transaction must be fully approved before execution",
  "statusCode": 400
}
```

## Best Practices

1. **Always Review**: Check transaction details carefully before approving
2. **Use Comments**: Add meaningful comments explaining your approval decision
3. **Monitor Status**: Regularly check pending transactions to avoid expiration
4. **Secure Tokens**: Keep authentication tokens secure, especially for wallet owners
5. **Audit Trail**: Use transaction logs for compliance and auditing
6. **Test First**: Use test wallets with small amounts before production
7. **Document Policies**: Maintain clear policies for when approvals are required

## Security Notes

- All endpoints require JWT authentication
- Wallet operations are logged for audit trail
- Only authorized signers can approve transactions
- Transaction hashes are unique and validated
- Blockchain verification can be enabled in production
- Expired transactions cannot be executed

## Support

For additional examples or questions:
- Review the [Multi-Sig Wallet Documentation](MULTI_SIG_WALLET.md)
- Check the [API Endpoints](API_ENDPOINTS.md)
- Run the test suite for more examples: `npm test -- multiSigWallet.test.js`
