# Crypto-to-Fiat Conversion System Documentation

## Overview

The crypto-to-fiat conversion system automatically converts cryptocurrency payments to fiat currency and places orders with Printify print-on-demand service. This system integrates seamlessly with the existing crypto payment infrastructure.

## Architecture Components

### 1. Models

#### ConversionTransaction
Tracks cryptocurrency to fiat currency conversions.

**Key Fields:**
- `order`: Reference to the original Order
- `cryptoAmount`, `cryptocurrency`: Crypto payment details
- `fiatAmount`, `fiatCurrency`: Fiat conversion details
- `exchangeRate`: Rate used for conversion
- `exchange`: Exchange used (coinbase, kraken, binance)
- `status`: pending, converting, completed, failed, cancelled
- `fees`: Exchange, network, and processing fees
- `riskLevel`: low, medium, high
- `requiresApproval`: Boolean flag for approval workflow

**Methods:**
- `updateStatus(status, note)`: Update conversion status
- `setError(message, details)`: Record conversion error
- `incrementRetry()`: Increment retry counter
- `canRetry()`: Check if conversion can be retried

#### PrintifyOrder
Links original crypto orders to Printify orders after conversion.

**Key Fields:**
- `originalOrder`: Reference to original Order
- `conversion`: Reference to ConversionTransaction
- `printifyOrderId`: Printify's order ID
- `products`: Array of products to order
- `shippingInfo`: Shipping address details
- `status`: pending, ready, placed, processing, shipped, delivered
- `totalCost`: Total cost in fiat currency
- `paymentMethod`: stripe, paypal, ach, virtual_card

**Methods:**
- `updateStatus(status, note)`: Update order status
- `recordWebhookEvent(event, data)`: Log Printify webhooks
- `markPaid(paymentRef)`: Mark payment as completed

#### ExchangeBalance
Tracks cryptocurrency and fiat balances across exchanges.

**Key Fields:**
- `exchange`: Exchange name (coinbase, kraken, binance)
- `currency`: Currency code (BTC, ETH, USD, etc.)
- `currencyType`: crypto or fiat
- `available`, `reserved`, `total`: Balance amounts
- `lastSync`: Last synchronization timestamp

**Methods:**
- `updateBalance(available, reserved, total)`: Update balance
- `reserve(amount)`: Reserve amount for conversion
- `release(amount)`: Release reserved amount
- `deduct(amount)`: Deduct from reserved balance

### 2. Services

#### ExchangeService
Manages cryptocurrency exchange interactions and balance tracking.

**Key Functions:**
- `getExchangeRate(exchange, crypto, fiat)`: Get current rate
- `getAllExchangeRates(crypto, fiat)`: Get rates from all exchanges
- `getBestExchangeRate(crypto, fiat)`: Find best available rate
- `selectBestExchange(crypto, fiat, amount)`: Auto-select exchange
- `syncExchangeBalances(exchange)`: Sync balances from exchange
- `executeConversion(exchange, crypto, fiat, amount)`: Execute trade
- `testConnection(exchange)`: Test exchange API connection

#### ConversionService
Manages crypto-to-fiat conversion workflow.

**Key Functions:**
- `initiateConversion(orderId, options)`: Start new conversion
- `executeConversion(conversionId)`: Execute conversion on exchange
- `approveConversion(conversionId, userId, comment)`: Approve conversion
- `rejectConversion(conversionId, userId, reason)`: Reject conversion
- `getConversionStatus(conversionId)`: Get conversion details
- `getConversionHistory(filters, options)`: Get conversion history
- `getConversionStats(startDate, endDate)`: Get statistics
- `getPendingApprovals()`: Get conversions awaiting approval

#### RiskService
Manages risk assessment and monitoring for conversions.

**Key Functions:**
- `assessConversionRisk(conversionData)`: Calculate risk score
- `monitorSuccessRate(timeWindow)`: Track success rate
- `monitorAverageTime(timeWindow)`: Track processing time
- `checkConsecutiveFailures(exchange)`: Check for failures
- `monitorExchangeReliability()`: Monitor exchange health
- `checkDailyLimits(userId)`: Check daily conversion limits
- `getRiskDashboard()`: Get comprehensive risk metrics

### 3. Utilities

#### exchangeClient.js
Generic client for interacting with cryptocurrency exchanges.

**ExchangeClient Class:**
- Supports Coinbase, Kraken, and Binance
- Handles authentication for each exchange
- Provides unified interface for all exchanges
- Includes rate limiting and error handling

#### rateCalculator.js
Handles exchange rate calculations with spread protection and fee estimation.

**Key Functions:**
- `calculateRateWithSpread(rate, spread)`: Add spread to rate
- `calculateFiatAmount(crypto, rate)`: Convert to fiat
- `calculateExchangeFee(amount, exchange)`: Calculate exchange fee
- `calculateProcessingFee(amount)`: Calculate processing fee
- `calculateSlippage(expected, actual)`: Calculate price slippage
- `estimateConversion(crypto, rate, exchange)`: Full estimate
- `validateAmount(amount)`: Validate against limits

#### riskCalculator.js
Calculates risk scores and determines approval requirements.

**Key Functions:**
- `calculateRiskScore(data)`: Calculate overall risk (0-100)
- `determineRiskLevel(score)`: Determine low/medium/high
- `requiresApproval(amount, risk)`: Check if approval needed
- `validateConversion(data)`: Validate conversion parameters
- `checkDailyLimits(userId, amount)`: Check limits
- `generateRiskReport(data)`: Generate detailed report

### 4. API Endpoints

#### Conversion Routes (`/api/conversions`)

```
POST   /initiate              - Initiate new conversion
GET    /:id/status            - Get conversion status
POST   /:id/approve           - Approve conversion (admin)
POST   /:id/reject            - Reject conversion (admin)
GET    /history               - Get conversion history
GET    /stats                 - Get conversion statistics (admin)
GET    /pending-approvals     - Get pending approvals (admin)
POST   /assess-risk           - Assess conversion risk
```

#### Exchange Routes (`/api/exchanges`)

```
GET    /rates                 - Get exchange rates
GET    /best-rate             - Get best exchange rate
GET    /available             - Get available exchanges
GET    /balances              - Get exchange balances (admin)
POST   /sync-balances         - Sync balances (admin)
POST   /test-connection       - Test exchange connection (admin)
GET    /low-balance-alerts    - Get low balance alerts (admin)
GET    /reliability           - Get exchange reliability (admin)
POST   /clear-cache           - Clear rate cache (admin)
```

#### Printify Routes (`/api/printify`)

```
POST   /place-order           - Place order with Printify
GET    /orders/:id            - Get Printify order details
GET    /ready-orders          - Get orders ready for placement (admin)
POST   /sync-order/:id        - Sync order status from Printify
GET    /products              - Get Printify products
POST   /sync-catalog          - Sync product catalog (admin)
POST   /calculate-shipping    - Calculate shipping cost
```

## Workflow

### Standard Conversion Flow

1. **Payment Received**
   - Customer pays with cryptocurrency
   - Order is created with status 'paid'

2. **Initiate Conversion**
   - `POST /api/conversions/initiate`
   - System calculates conversion details
   - Risk assessment is performed
   - ConversionTransaction is created

3. **Approval Check**
   - If amount > auto-approval limit OR risk = high
   - Conversion status: 'pending' (awaits approval)
   - Admin approves via `POST /api/conversions/:id/approve`
   - Otherwise, proceeds automatically

4. **Execute Conversion**
   - Select best exchange
   - Get current rate and check slippage
   - Execute trade on exchange
   - Update conversion status to 'completed'

5. **Create Printify Order**
   - PrintifyOrder record created
   - Status: 'ready'
   - Awaits order placement

6. **Place with Printify**
   - `POST /api/printify/place-order`
   - Order submitted to Printify
   - PodOrder created for tracking
   - Status updates via webhooks

7. **Fulfillment**
   - Printify processes order
   - Webhooks update order status
   - Customer receives tracking info
   - Order status: 'shipped' → 'delivered'

## Configuration

### Environment Variables

```bash
# Exchange APIs
COINBASE_ENABLED=false
COINBASE_API_KEY=
COINBASE_API_SECRET=

KRAKEN_ENABLED=false
KRAKEN_API_KEY=
KRAKEN_API_SECRET=

BINANCE_ENABLED=false
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Payment Gateways
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=

PAYPAL_ENABLED=false
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# Conversion Limits
MIN_CONVERSION_AMOUNT=10
MAX_CONVERSION_AMOUNT=10000
AUTO_APPROVAL_LIMIT=1000
DAILY_USER_CONVERSION_LIMIT=50000
DAILY_TOTAL_CONVERSION_LIMIT=500000

# Risk Management
VOLATILITY_THRESHOLD=5
MAX_CONVERSION_SLIPPAGE=2

# Printify
PRINTIFY_ENABLED=false
PRINTIFY_API_TOKEN=
PRINTIFY_SHOP_ID=
PRINTIFY_WEBHOOK_SECRET=
PRINTIFY_AUTO_SUBMIT=false
PRINTIFY_PAYMENT_METHOD=stripe
```

### Configuration Files

- `config/exchanges.js`: Exchange-specific settings
- `config/conversion.js`: Conversion system settings
- `config/printify.js`: Printify integration settings

## Security Considerations

### API Key Security
- Store exchange API keys encrypted
- Use environment variables
- Never commit keys to version control
- Implement key rotation policy

### Rate Limiting
- Implement rate limits on conversion endpoints
- Prevent API abuse
- Monitor unusual patterns

### Audit Logging
- Log all conversion operations
- Track approval decisions
- Monitor failed transactions
- Alert on suspicious activity

### Approval Workflows
- Require approval for high-value conversions
- Multi-signature for large amounts
- Time-based approval expiration
- Admin activity logging

### Webhook Verification
- Verify all webhook signatures
- Log all webhook events
- Implement replay protection
- Rate limit webhook endpoints

## Monitoring & Alerts

### Key Metrics
- Conversion success rate (target: >95%)
- Average conversion time (target: <5 minutes)
- Exchange rate spreads
- Fee percentages
- Balance levels
- Failed transaction count

### Alert Conditions
- Large conversion requests (>$5000)
- Exchange API failures
- High volatility periods (>5%)
- Low exchange balances
- Failed Printify orders
- Consecutive conversion failures (>3)
- Success rate drops below 95%
- Average time exceeds 5 minutes

### Dashboard Metrics
Access via Risk Service:
```javascript
const dashboard = await riskService.getRiskDashboard();
```

Returns:
- Success rate statistics
- Average processing time
- Exchange reliability scores
- Daily limit usage
- High-risk conversion count
- Recent alerts

## Testing

### Running Tests
```bash
npm test tests/conversion.test.js
```

### Test Coverage
- ConversionTransaction model CRUD
- PrintifyOrder model operations
- ExchangeBalance management
- RateCalculator functions
- RiskCalculator scoring
- Service integration tests

## Troubleshooting

### Common Issues

**1. Conversion Stuck in Pending**
- Check if approval is required
- Verify exchange API connectivity
- Check exchange balances
- Review risk assessment

**2. High Slippage Errors**
- Market volatility is high
- Wait for stable rates
- Adjust MAX_CONVERSION_SLIPPAGE
- Use limit orders if supported

**3. Exchange Connection Failures**
- Verify API credentials
- Check API key permissions
- Test connection: `POST /api/exchanges/test-connection`
- Review rate limits

**4. Printify Order Placement Fails**
- Verify Printify API token
- Check product IDs are valid
- Ensure shipping address is complete
- Review Printify API logs

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## Best Practices

1. **Always Test in Sandbox**
   - Use testnet/sandbox APIs first
   - Test with small amounts
   - Verify all workflows

2. **Monitor Exchange Rates**
   - Set up rate monitoring
   - Alert on unusual spreads
   - Track historical rates

3. **Maintain Adequate Balances**
   - Monitor exchange balances
   - Set up low-balance alerts
   - Maintain buffer for conversions

4. **Regular Audits**
   - Review conversion logs
   - Audit approval decisions
   - Check fee calculations
   - Verify balance reconciliation

5. **Disaster Recovery**
   - Backup conversion records
   - Document manual procedures
   - Test failover scenarios
   - Maintain support contacts

## Support

For issues or questions:
1. Check logs: `/var/log/app/conversion.log`
2. Review risk dashboard metrics
3. Test exchange connectivity
4. Contact exchange support if needed
5. Review Printify API documentation

## Future Enhancements

- Support for additional exchanges (Gemini, Bitstamp)
- Advanced trading strategies (limit orders)
- Automated rebalancing
- Enhanced analytics dashboard
- Machine learning for risk prediction
- Multi-currency support expansion
- Automated hedging strategies
