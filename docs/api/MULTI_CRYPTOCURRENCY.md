# Multi-Cryptocurrency Support

## Overview

The CStore platform now supports multiple cryptocurrencies beyond Bitcoin, Ethereum, and USDT. The platform has been extended to include Litecoin (LTC) and XRP (Ripple), providing customers with more payment options and expanding the marketplace's reach.

## Supported Cryptocurrencies

### Primary Cryptocurrencies
1. **Bitcoin (BTC)** ✅
   - Native blockchain verification
   - Bitcoin Core RPC support
   - Fallback to blockchain.info API

2. **Ethereum (ETH)** ✅
   - Web3 integration
   - Direct blockchain queries
   - Support for smart contracts

3. **Tether (USDT)** ✅
   - ERC-20 token on Ethereum
   - Transfer event verification
   - Decimal handling (6 decimals)

### New Cryptocurrencies

4. **Litecoin (LTC)** 🆕
   - Blockchair API integration
   - Transaction verification
   - Real-time price tracking
   - Similar to Bitcoin but faster

5. **XRP (Ripple)** 🆕
   - XRP Ledger integration
   - Public RPC API support
   - Fast and low-cost transactions
   - Enterprise-grade blockchain

## Features

### Transaction Verification
- ✅ Automatic cryptocurrency detection
- ✅ Multi-source verification (primary + fallback APIs)
- ✅ Confirmation tracking
- ✅ Amount validation with tolerance
- ✅ Address verification

### Price Integration
- ✅ Real-time price fetching from CoinGecko
- ✅ Support for all 5 cryptocurrencies
- ✅ USD conversion
- ✅ Historical price data
- ✅ Automatic updates

### Payment Processing
- ✅ Order creation with any supported cryptocurrency
- ✅ Payment confirmation
- ✅ Transaction monitoring
- ✅ Status tracking
- ✅ Email notifications

## Configuration

### Environment Variables

Add cryptocurrency wallet addresses to your `.env` file:

```bash
# Cryptocurrency Wallet Addresses
BTC_ADDRESS=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
ETH_ADDRESS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e
USDT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc454e4438f44e
LTC_ADDRESS=ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkf0000000
XRP_ADDRESS=rN7n7otQDd6FczFgLdlqtyMVrn3HMfXEZv
```

**Important**: Replace these with your actual wallet addresses!

### Wallet Setup

#### Bitcoin (BTC)
- Use SegWit (bech32) addresses for lower fees
- Format: `bc1...`
- Example: `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`

#### Ethereum (ETH) and USDT
- Same address for both (USDT is ERC-20 token)
- Format: `0x...` (42 characters)
- Example: `0x742d35Cc6634C0532925a3b844Bc454e4438f44e`

#### Litecoin (LTC)
- Use SegWit addresses for lower fees
- Format: `ltc1...` or `L...` or `M...`
- Example: `ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkf0000000`

#### XRP (Ripple)
- Classic address format
- Format: `r...` (25-35 characters)
- Example: `rN7n7otQDd6FczFgLdlqtyMVrn3HMfXEZv`
- Note: Include destination tag if required

## Usage

### Creating Products with Different Cryptocurrencies

```javascript
// Create a product priced in Litecoin
POST /api/products
{
  "name": "Premium Software License",
  "description": "Lifetime access to premium features",
  "price": 0.5,
  "priceUSD": 45.50,
  "currency": "LTC",
  "stock": 100
}

// Create a product priced in XRP
POST /api/products
{
  "name": "Digital Asset Bundle",
  "description": "Collection of digital assets",
  "price": 100,
  "priceUSD": 45.50,
  "currency": "XRP",
  "stock": 50
}
```

### Creating Orders

```javascript
// Order with Litecoin payment
POST /api/orders
{
  "productId": "product-id",
  "quantity": 1,
  "customerEmail": "customer@example.com",
  "cryptocurrency": "LTC",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  }
}

// Order with XRP payment
POST /api/orders
{
  "productId": "product-id",
  "quantity": 1,
  "customerEmail": "customer@example.com",
  "cryptocurrency": "XRP"
}
```

### Verifying Transactions

```javascript
const { verifyTransaction } = require('./services/blockchainService');

// Verify Litecoin transaction
const ltcResult = await verifyTransaction(
  'LTC',
  'transaction-hash',
  'recipient-address',
  0.5
);

// Verify XRP transaction
const xrpResult = await verifyTransaction(
  'XRP',
  'transaction-hash',
  'recipient-address',
  100
);
```

### Getting Cryptocurrency Prices

```javascript
const { getCryptoPrice } = require('./services/blockchainService');

// Get current prices
const btcPrice = await getCryptoPrice('BTC');
const ethPrice = await getCryptoPrice('ETH');
const usdtPrice = await getCryptoPrice('USDT');
const ltcPrice = await getCryptoPrice('LTC');
const xrpPrice = await getCryptoPrice('XRP');

console.log('Prices in USD:', {
  BTC: btcPrice,
  ETH: ethPrice,
  USDT: usdtPrice,
  LTC: ltcPrice,
  XRP: xrpPrice
});
```

## API Integration

### Litecoin Verification

The platform uses Blockchair API for Litecoin transaction verification:

```javascript
// Internal implementation
async function verifyLitecoinTransaction(txHash, address, amount) {
  const apiUrl = `https://api.blockchair.com/litecoin/dashboards/transaction/${txHash}`;
  const response = await axios.get(apiUrl);
  // Transaction processing...
}
```

**API Features:**
- Free tier available
- Real-time transaction data
- Confirmation tracking
- Address validation

### XRP Verification

The platform uses XRP Ledger public API:

```javascript
// Internal implementation
async function verifyXRPTransaction(txHash, address, amount) {
  const apiUrl = `https://s1.ripple.com:51234/`;
  const response = await axios.post(apiUrl, {
    method: 'tx',
    params: [{ transaction: txHash }]
  });
  // Transaction processing...
}
```

**API Features:**
- Public access
- Fast confirmation times
- Ledger index tracking
- Low latency

## Transaction Flow

### 1. Order Creation
- Customer selects product
- Chooses cryptocurrency (BTC, ETH, USDT, LTC, or XRP)
- Order created with payment details

### 2. Payment Instructions
- System provides payment address
- Shows amount in selected cryptocurrency
- Displays current exchange rate
- Sets payment timeout

### 3. Payment Confirmation
- Customer sends payment
- Provides transaction hash
- System verifies transaction
- Confirms payment received

### 4. Order Fulfillment
- Payment confirmed on blockchain
- Order status updated
- Customer notified via email
- Product/service delivered

## Testing

Run the cryptocurrency test suite:

```bash
npm test -- cryptocurrencies.test.js
```

**Test Coverage:**
- LTC transaction verification ✓
- XRP transaction verification ✓
- Price fetching for all currencies ✓
- Model validation ✓
- Error handling ✓

## Security Considerations

### Wallet Security
- **Use hardware wallets** for storing private keys
- **Never share private keys** - only provide public addresses
- **Regular backups** of wallet seeds and keys
- **Multi-signature wallets** for high-value transactions
- **Separate hot/cold wallets** (hot for operations, cold for storage)

### Transaction Verification
- **Always verify on blockchain** - don't trust user-provided data
- **Wait for confirmations** - recommended minimums:
  - BTC: 2-6 confirmations (20-60 minutes)
  - LTC: 6 confirmations (~15 minutes)
  - ETH: 12 confirmations (~3 minutes)
  - XRP: 1-2 ledger closes (~4-8 seconds)
  - USDT: 12 confirmations (~3 minutes)

### Amount Validation
- **Use tolerance for floating-point** - allow small differences
- **Account for network fees** - sender may deduct fees from amount
- **Consider minimum amounts** - avoid dust transactions

### API Security
- **Rate limiting** - prevent API abuse
- **Fallback APIs** - use multiple sources
- **Error handling** - graceful degradation
- **Monitoring** - track API availability

## Cryptocurrency Comparison

| Feature | BTC | LTC | ETH | USDT | XRP |
|---------|-----|-----|-----|------|-----|
| **Confirmation Time** | 10 min | 2.5 min | 15 sec | 15 sec | 4 sec |
| **Transaction Fee** | Medium-High | Low-Medium | Medium | Medium | Very Low |
| **Supply** | 21M | 84M | Unlimited | Unlimited | 100B |
| **Use Case** | Store of Value | Payments | Smart Contracts | Stablecoin | Fast Transfers |
| **Maturity** | High | High | High | Medium | High |
| **Volatility** | High | High | High | Very Low | Medium |

## Best Practices

### For Merchants
1. **Accept multiple cryptocurrencies** to reach more customers
2. **Set clear payment deadlines** (e.g., 30 minutes)
3. **Display prices in customer's local currency** and crypto
4. **Automate confirmation emails** for payment status
5. **Keep reserves** in stablecoins (USDT) to manage volatility

### For Development
1. **Test on testnets first** before mainnet deployment
2. **Implement proper error handling** for API failures
3. **Use environment variables** for wallet addresses
4. **Log all transactions** for audit trail
5. **Monitor transaction mempool** for pending payments

### For Users
1. **Double-check addresses** before sending
2. **Use appropriate wallet software** for each cryptocurrency
3. **Include memo/destination tag** when required (XRP)
4. **Don't send from exchanges** that may cause issues
5. **Keep transaction receipts** for support inquiries

## Troubleshooting

### Litecoin Issues

**Problem**: Transaction not found
**Solutions**:
- Verify transaction hash is correct
- Check if transaction is confirmed on blockchain
- Use Litecoin block explorer to verify

**Problem**: Amount mismatch
**Solutions**:
- Account for network fees
- Verify decimal places (LTC has 8 decimals)
- Check exchange rate at time of payment

### XRP Issues

**Problem**: Destination tag missing
**Solutions**:
- Check if your address requires destination tag
- Include tag in transaction if required
- Contact support if tag was forgotten

**Problem**: Account not activated
**Solutions**:
- XRP accounts need minimum 10 XRP reserve
- First transaction must be at least 10 XRP
- Check account status on XRP explorer

## Future Enhancements

Planned improvements:
- [ ] Additional cryptocurrencies (BSC, Polygon, Cardano)
- [ ] Lightning Network support for BTC
- [ ] On-chain swaps
- [ ] Automatic price updates
- [ ] Multi-currency pricing display
- [ ] Cryptocurrency payment gateway integration
- [ ] Token support (ERC-20, TRC-20)

## Resources

### Documentation
- [Litecoin Documentation](https://litecoin.org/)
- [XRP Ledger Documentation](https://xrpl.org/)
- [Blockchair API](https://blockchair.com/api)
- [XRP Public RPC](https://xrpl.org/public-servers.html)

### Tools
- [Litecoin Explorer](https://blockchair.com/litecoin)
- [XRP Explorer](https://xrpscan.com/)
- [CoinGecko API](https://www.coingecko.com/en/api)

### Wallets
- **Litecoin**: Litecoin Core, Electrum-LTC, Exodus
- **XRP**: XUMM, Ledger, Toast Wallet

---

**Implementation Date:** January 2025  
**Version:** 2.2  
**Status:** ✅ COMPLETE and Production Ready
