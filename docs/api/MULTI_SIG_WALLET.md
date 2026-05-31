# Multi-Signature Wallet Support

## Overview

The CStore platform now supports multi-signature (multi-sig) wallets to enhance security for cryptocurrency transactions. Multi-sig wallets require multiple parties to approve transactions before they are executed, providing an additional layer of security and governance.

## Features

- **Configurable Signature Requirements**: Set up wallets with N-of-M signature requirements (e.g., 2-of-3, 3-of-5)
- **Multiple Signers**: Add multiple authorized signers to a wallet
- **Transaction Approval Workflow**: Transactions require approval from the specified number of signers before execution
- **Role-Based Permissions**: 
  - Wallet owners can manage wallet settings and signers
  - Signers can approve or reject transactions
- **Support for Multiple Cryptocurrencies**: BTC, ETH, and USDT
- **Transaction Status Tracking**: Monitor transaction status through the approval process
- **Integration with Orders**: Associate transactions with orders for seamless payment processing
- **Expiration Support**: Transactions can expire if not approved within the specified timeframe

## Architecture

### Models

#### MultiSigWallet
Represents a multi-signature wallet with its configuration and authorized signers.

**Key Fields:**
- `name`: Descriptive name for the wallet
- `owner`: User who owns and manages the wallet
- `cryptocurrency`: Type of cryptocurrency (BTC, ETH, USDT)
- `address`: Blockchain address of the wallet
- `signers`: Array of authorized signers with their details
- `requiredSignatures`: Number of signatures required to approve a transaction
- `isActive`: Whether the wallet is currently active

#### TransactionApproval
Tracks the approval status of a transaction requiring multiple signatures.

**Key Fields:**
- `wallet`: Reference to the multi-sig wallet
- `order`: Optional reference to an associated order
- `amount`: Transaction amount
- `toAddress`: Destination address
- `status`: Current status (pending, approved, rejected, executed, expired)
- `approvals`: Array of approvals from signers
- `requiredApprovals`: Number of approvals needed

## API Endpoints

### Wallet Management

#### Create Multi-Sig Wallet
```http
POST /api/multisig/wallets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Company Treasury",
  "cryptocurrency": "BTC",
  "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "signers": [
    { "email": "signer1@example.com", "publicKey": "optional-public-key" },
    { "email": "signer2@example.com" },
    { "email": "signer3@example.com" }
  ],
  "requiredSignatures": 2,
  "description": "Main company treasury wallet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "wallet-id",
    "name": "Company Treasury",
    "owner": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "cryptocurrency": "BTC",
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "signers": [
      {
        "user": "user-id-1",
        "email": "signer1@example.com",
        "name": "Signer One",
        "addedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "user": "user-id-2",
        "email": "signer2@example.com",
        "name": "Signer Two",
        "addedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "requiredSignatures": 2,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get All Wallets
```http
GET /api/multisig/wallets?cryptocurrency=BTC&isActive=true
Authorization: Bearer <token>
```

Returns all wallets where the user is either the owner or a signer.

#### Get Wallet by ID
```http
GET /api/multisig/wallets/:id
Authorization: Bearer <token>
```

#### Update Wallet
```http
PUT /api/multisig/wallets/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Treasury Name",
  "description": "Updated description",
  "isActive": true
}
```

**Note:** Only the wallet owner can update wallet settings.

#### Add Signer
```http
POST /api/multisig/wallets/:id/signers
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newsigner@example.com",
  "publicKey": "optional-public-key"
}
```

**Note:** Only the wallet owner can add signers.

#### Remove Signer
```http
DELETE /api/multisig/wallets/:id/signers/:signerId
Authorization: Bearer <token>
```

**Note:** 
- Only the wallet owner can remove signers
- Cannot remove a signer if it would result in fewer signers than required signatures

#### Deactivate Wallet
```http
DELETE /api/multisig/wallets/:id
Authorization: Bearer <token>
```

Soft-deletes the wallet by setting `isActive` to false.

### Transaction Approval

#### Create Transaction Approval Request
```http
POST /api/multisig/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "walletId": "wallet-id",
  "orderId": "order-id",
  "amount": 0.5,
  "toAddress": "1BitcoinEaterAddressDontSendf59kuE",
  "description": "Payment for Order #12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction-id",
    "wallet": {
      "_id": "wallet-id",
      "name": "Company Treasury",
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "cryptocurrency": "BTC"
    },
    "order": "order-id",
    "cryptocurrency": "BTC",
    "amount": 0.5,
    "toAddress": "1BitcoinEaterAddressDontSendf59kuE",
    "fromAddress": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "status": "pending",
    "requiredApprovals": 2,
    "approvals": [],
    "metadata": {
      "initiatedBy": {
        "_id": "user-id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "expiresAt": "2024-01-08T00:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get All Transaction Approvals
```http
GET /api/multisig/transactions?status=pending&walletId=wallet-id
Authorization: Bearer <token>
```

Returns all transactions for wallets where the user has access.

#### Get Transaction Approval by ID
```http
GET /api/multisig/transactions/:id
Authorization: Bearer <token>
```

#### Approve or Reject Transaction
```http
POST /api/multisig/transactions/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "signature": "optional-signature",
  "comment": "Approved after review"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "transaction-id",
    "status": "approved",
    "approvals": [
      {
        "signer": {
          "_id": "user-id-1",
          "name": "Signer One",
          "email": "signer1@example.com"
        },
        "approved": true,
        "comment": "Looks good",
        "approvedAt": "2024-01-01T10:00:00.000Z"
      },
      {
        "signer": {
          "_id": "user-id-2",
          "name": "Signer Two",
          "email": "signer2@example.com"
        },
        "approved": true,
        "comment": "Approved after review",
        "approvedAt": "2024-01-01T11:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**
- Only authorized signers can approve transactions
- Once a signer approves/rejects, they cannot change their decision
- If any signer rejects, the transaction status changes to "rejected"
- When enough approvals are collected, status changes to "approved"

#### Execute Transaction
```http
POST /api/multisig/transactions/:id/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionHash": "0x1234567890abcdef..."
}
```

**Notes:**
- Transaction must be in "approved" status
- Requires blockchain transaction hash from the executed transaction
- If blockchain verification is enabled, the transaction will be verified
- If associated with an order, the order status will be updated to "paid"
- A payment record will be created in the system

#### Cancel Transaction
```http
DELETE /api/multisig/transactions/:id
Authorization: Bearer <token>
```

**Notes:**
- Only the transaction initiator or wallet owner can cancel
- Can only cancel transactions with "pending" status

## Workflow Examples

### Example 1: Setting Up a Multi-Sig Wallet

1. **Create Users**: Ensure all signers have accounts in the system
2. **Create Wallet**: Owner creates a multi-sig wallet with required signers
3. **Verify Setup**: All signers should verify they can see the wallet in their account

### Example 2: Processing a Payment with Multi-Sig

1. **Create Order**: Customer creates an order as usual
2. **Initiate Transaction**: Owner or signer creates a transaction approval request linked to the order
3. **Collect Approvals**: Required number of signers approve the transaction
4. **Execute Payment**: Once approved, any authorized party broadcasts the transaction to the blockchain
5. **Confirm Payment**: Execute the transaction with the blockchain transaction hash
6. **Order Processing**: Order status automatically updates to "paid"

### Example 3: Rejecting a Transaction

1. **Review Transaction**: Signers review the pending transaction
2. **Reject**: If a signer finds an issue, they reject with a comment
3. **Status Update**: Transaction immediately moves to "rejected" status
4. **Notification**: System logs the rejection for audit trail

## Admin Endpoints

Administrators have access to specialized endpoints for monitoring and managing multi-sig wallets across the platform.

### Get Multi-Sig Statistics

**GET** `/api/admin/multi-sig/stats`

Get comprehensive statistics about multi-sig wallets and transactions.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallets": {
      "total": 50,
      "active": 45,
      "inactive": 5
    },
    "transactions": {
      "total": 250,
      "pending": 10,
      "approved": 5,
      "executed": 230,
      "rejected": 5
    },
    "byCryptocurrency": [
      { "_id": "BTC", "count": 100, "totalAmount": 5.5 },
      { "_id": "ETH", "count": 120, "totalAmount": 45.2 },
      { "_id": "USDT", "count": 30, "totalAmount": 15000 }
    ],
    "recentPending": [...]
  }
}
```

### List All Multi-Sig Wallets

**GET** `/api/admin/multi-sig/wallets`

List all multi-sig wallets with pagination and filtering.

**Query Parameters:**
- `isActive` (boolean): Filter by active status
- `cryptocurrency` (string): Filter by cryptocurrency type
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 20,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

### Get Wallet Details

**GET** `/api/admin/multi-sig/wallets/:id`

Get detailed information about a specific wallet including all associated transactions.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {...},
    "transactions": [...]
  }
}
```

### Update Wallet Status

**PUT** `/api/admin/multi-sig/wallets/:id/status`

Activate or deactivate a wallet.

**Request Body:**
```json
{
  "isActive": true
}
```

### List All Transactions

**GET** `/api/admin/multi-sig/transactions`

List all multi-sig transactions with pagination and filtering.

**Query Parameters:**
- `status` (string): Filter by transaction status
- `cryptocurrency` (string): Filter by cryptocurrency
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

### Get Transaction Details

**GET** `/api/admin/multi-sig/transactions/:id`

Get detailed information about a specific transaction including all approvals.

## Security Features

### Authorization

- **Wallet Access**: Users can only access wallets they own or are signers for
- **Transaction Approval**: Only authorized signers can approve transactions
- **Wallet Management**: Only wallet owners can modify settings and manage signers
- **Transaction Cancellation**: Only initiator or owner can cancel pending transactions

### Validation

- **Minimum Signers**: At least 2 signers required for multi-sig wallet
- **Signature Requirements**: Required signatures must be ≥ 2 and ≤ number of signers
- **Duplicate Prevention**: Signers cannot approve the same transaction twice
- **Status Checks**: Operations validated against current transaction status
- **Expiration**: Transactions can expire if not approved in time

### Rate Limiting

Enhanced rate limiting specifically for multi-sig approval operations:
- **Approval Requests**: Limited to 50 requests per hour per IP address
- **Protection**: Prevents approval request flooding and potential abuse
- **Bypass**: Rate limiting is skipped for unauthenticated requests

### Security Logging

Comprehensive audit trail for all multi-sig operations:

**Dedicated Security Log File** (`logs/security.log`)
- Separate from main application logs
- 10 file rotation with 5MB each
- Structured JSON format for easy parsing

**Logged Operations:**
1. **Wallet Creation**
   - Wallet ID, owner ID and email
   - Wallet configuration (name, address, cryptocurrency)
   - Number of signers and required signatures
   - List of signer emails

2. **Transaction Creation**
   - Transaction ID, wallet ID, user ID and email
   - Amount, cryptocurrency, and addresses
   - Order ID (if linked)
   - Required approvals count

3. **Transaction Approval**
   - Transaction ID, wallet ID, user ID and email
   - Approval decision (approved/rejected)
   - Comment and signature presence
   - Current vs required approvals
   - New transaction status

4. **Transaction Execution**
   - Transaction ID, wallet ID, executor ID and email
   - Blockchain transaction hash
   - Amount, cryptocurrency, and addresses
   - Order ID (if linked)
   - Verification status

**Log Entry Example:**
```json
{
  "level": "info",
  "message": "Multi-sig transaction_approval",
  "operation": "transaction_approval",
  "timestamp": "2024-10-01T10:30:00.000Z",
  "transactionId": "507f1f77bcf86cd799439011",
  "walletId": "507f191e810c19729de860ea",
  "userId": "507f1f77bcf86cd799439012",
  "userEmail": "signer@example.com",
  "approved": true,
  "currentApprovals": 2,
  "requiredApprovals": 2,
  "newStatus": "approved",
  "service": "cstore-security",
  "category": "multi-sig"
}
```

### Blockchain Verification

When `VERIFY_BLOCKCHAIN=true` in environment:
- Transaction hash is verified on the blockchain
- Amount and recipient address are validated
- Confirmations are tracked
- Failed verifications prevent payment confirmation

## Integration with Existing System

The multi-sig wallet system integrates seamlessly with:

- **User System**: Leverages existing user authentication and management
- **Order System**: Transactions can be linked to orders
- **Payment System**: Creates payment records upon transaction execution
- **Blockchain Service**: Uses existing blockchain verification infrastructure

## Configuration

### Environment Variables

No additional environment variables required. Uses existing configuration:
- `VERIFY_BLOCKCHAIN`: Enable/disable blockchain verification
- `ETH_RPC_URL`: Ethereum RPC endpoint
- Other blockchain service configurations

## Best Practices

### For Wallet Owners

1. Choose trusted signers carefully
2. Set appropriate signature requirements (e.g., 2-of-3 for small teams, 3-of-5 for larger)
3. Regularly review and update signer list
4. Keep wallet descriptions up to date
5. Monitor pending transactions regularly

### For Signers

1. Review transaction details carefully before approving
2. Verify the destination address matches the intended recipient
3. Check the amount is correct
4. Add meaningful comments when approving/rejecting
5. Respond promptly to approval requests to avoid expiration

### For Developers

1. Always check transaction status before operations
2. Handle expired transactions gracefully
3. Provide clear feedback to users about approval progress
4. Log all approval actions for audit trail
5. Test multi-sig workflows thoroughly

## Testing

Comprehensive test suite available in `tests/multiSigWallet.test.js`:

```bash
npm test -- multiSigWallet.test.js
```

Tests cover:
- Wallet creation and management
- Signer management
- Transaction approval workflow
- Authorization and permissions
- Edge cases and error handling

## API Error Responses

Common error responses:

```json
// Unauthorized access
{
  "success": false,
  "message": "You do not have access to this wallet",
  "statusCode": 403
}

// Insufficient signers
{
  "success": false,
  "message": "At least 2 signers are required for multi-signature wallet",
  "statusCode": 400
}

// Duplicate approval
{
  "success": false,
  "message": "You have already provided approval for this transaction",
  "statusCode": 400
}

// Transaction not ready for execution
{
  "success": false,
  "message": "Transaction must be fully approved before execution",
  "statusCode": 400
}
```

## Future Enhancements

Potential future improvements:

- [ ] Email notifications for approval requests
- [ ] Webhook support for transaction status updates
- [ ] Advanced permission levels (initiator, approver, executor)
- [ ] Time-locked transactions
- [ ] Spending limits per signer
- [ ] Transaction templates for common operations
- [ ] Integration with hardware wallets
- [ ] Multi-chain support expansion
- [ ] Analytics dashboard for wallet activity

## Support

For questions or issues:
- Review the API documentation
- Check test files for usage examples
- Refer to the main README for general setup
- Contact support for wallet-specific issues

---

**Version**: 1.0  
**Last Updated**: 2024-10-01
