# Multi-Currency Pricing & Regional Payment Methods Implementation

## Overview
This document describes the implementation of multi-currency pricing and region-specific payment methods for the Cryptons.com cryptocurrency trading platform, enabling global expansion and localized customer experiences.

## Implementation Date
December 2024

## What Was Built

### 1. Database Models

#### CurrencyRate Model (`src/models/CurrencyRate.js`)
Stores exchange rates with historical tracking:
- **baseCurrency**: Base currency (default: USD)
- **targetCurrency**: Target currency for conversion
- **rate**: Exchange rate value
- **source**: Rate source ('api' or 'manual')
- **lastUpdated**: Timestamp of last update
- **isActive**: Active status flag
- Static method `getLatestRate()` for efficient rate queries

#### RegionalPaymentMethod Model (`src/models/RegionalPaymentMethod.js`)
Manages region-specific payment options:
- **name**: Payment method name
- **code**: Unique payment method code
- **description**: Method description
- **regions**: Supported regions (EU, NA, APAC, etc.)
- **countries**: Supported country codes
- **currencies**: Supported currencies
- **type**: Payment type (bank_transfer, card, digital_wallet, crypto)
- **processingTime**: Expected processing time
- **fees**: Fixed and percentage-based fees
- **provider**: Payment provider name
- **metadata**: Additional custom data

### 2. Updated Models

#### User Model Updates
Added user preferences:
- **preferredCurrency**: User's preferred display currency (default: USD)
- **preferredLanguage**: User's preferred language (default: en)
- **country**: User's country code

#### Order Model Updates
Added multi-currency support:
- **displayCurrency**: Currency shown to customer
- **displayPrice**: Price in display currency
- **exchangeRate**: Exchange rate used for conversion

### 3. Currency Service (`src/services/currencyService.js`)

Comprehensive currency management service with:

#### Exchange Rate Management
- **fetchExchangeRates()**: Fetches rates from ExchangeRate-API
- **updateExchangeRates()**: Updates database with latest rates
- **getExchangeRate()**: Retrieves rate between two currencies
- Fallback API support for reliability
- Automatic rate staleness detection (24-hour threshold)

#### Currency Conversion
- **convertCurrency()**: Converts amounts between currencies
- **roundCurrency()**: Smart rounding based on currency conventions
  - JPY, KRW, VND: No decimals
  - Most others: 2 decimals

#### Supported Currencies
- USD (US Dollar) - $
- EUR (Euro) - €
- GBP (British Pound) - £
- JPY (Japanese Yen) - ¥
- CAD (Canadian Dollar) - CA$
- AUD (Australian Dollar) - A$
- CHF (Swiss Franc) - CHF
- CNY (Chinese Yuan) - ¥
- INR (Indian Rupee) - ₹
- BRL (Brazilian Real) - R$

### 4. API Endpoints

#### Currency Endpoints (`/api/currencies`)

**Public Endpoints:**
```
GET /api/currencies
- Get all supported currencies with names, symbols, and decimal rules

GET /api/currencies/rates?base=USD
- Get current exchange rates for a base currency

POST /api/currencies/convert
Body: { amount: 100, from: "USD", to: "EUR" }
- Convert amount between currencies
```

**Admin Endpoints (Authentication Required):**
```
POST /api/currencies/rates/update
Body: { base: "USD" }
- Manually trigger exchange rate update

GET /api/currencies/rates/history?from=USD&to=EUR&days=30
- Get historical exchange rates

POST /api/currencies/rates/manual
Body: { from: "USD", to: "EUR", rate: 0.85 }
- Set manual exchange rate override
```

#### Regional Payment Endpoints (`/api/payments/regional`)

**Public Endpoints:**
```
GET /api/payments/regional?country=DE&region=EU&currency=EUR
- Get payment methods filtered by country, region, or currency

GET /api/payments/regional/code/:code
- Get specific payment method by code
```

**Admin Endpoints:**
```
GET /api/payments/regional/all
- Get all payment methods with pagination

POST /api/payments/regional
- Create new payment method

PUT /api/payments/regional/:id
- Update payment method

DELETE /api/payments/regional/:id
- Delete payment method
```

### 5. Regional Payment Methods

Pre-seeded with 15+ payment methods:

#### Europe
- **SEPA**: Bank transfers across EU countries
- **iDEAL**: Dutch online banking (Netherlands)
- **Bancontact**: Belgian online banking (Belgium)
- **Sofort**: European online banking

#### United Kingdom
- **Faster Payments**: UK instant bank transfers

#### North America
- **ACH**: US bank transfers
- **Interac**: Canadian e-transfers

#### South America
- **PIX**: Brazilian instant payments

#### Asia-Pacific
- **Alipay**: Chinese digital wallet
- **WeChat Pay**: Chinese mobile payment
- **UPI**: Indian unified payments
- **GrabPay**: Southeast Asian digital wallet

#### Global
- **PayPal**: Global digital payments
- **Credit/Debit Card**: Visa, Mastercard, Amex

### 6. Updated Controllers

#### Auth Controller (`src/controllers/authController.js`)
- Updated `updateProfile()` to support currency and language preferences
- Updated `getMe()` to return user preferences

#### Cart Controller (`src/controllers/cartController.js`)
- Added currency conversion support in `getCart()`
- Accepts `?currency=EUR` query parameter
- Returns cart with converted prices

#### Order Controller (`src/controllers/orderController.js`)
- Updated `createOrder()` to support display currency
- Accepts `displayCurrency` in request body
- Stores original and converted prices

## API Usage Examples

### Get Supported Currencies
```bash
curl http://localhost:3000/api/currencies
```

Response:
```json
{
  "success": true,
  "data": {
    "currencies": [
      {
        "code": "USD",
        "name": "US Dollar",
        "symbol": "$",
        "decimals": 2
      },
      {
        "code": "EUR",
        "name": "Euro",
        "symbol": "€",
        "decimals": 2
      }
    ]
  }
}
```

### Convert Currency
```bash
curl -X POST http://localhost:3000/api/currencies/convert \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "from": "USD",
    "to": "EUR"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "originalAmount": 100,
    "originalCurrency": "USD",
    "convertedAmount": 85.67,
    "targetCurrency": "EUR",
    "exchangeRate": 0.8567,
    "timestamp": "2024-12-01T10:00:00.000Z"
  }
}
```

### Get Regional Payment Methods
```bash
curl "http://localhost:3000/api/payments/regional?country=DE&currency=EUR"
```

Response:
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      {
        "_id": "...",
        "name": "SEPA Bank Transfer",
        "code": "SEPA",
        "description": "Single Euro Payments Area bank transfer",
        "regions": ["EU"],
        "countries": ["DE", "FR", "ES", "IT"],
        "currencies": ["EUR"],
        "type": "bank_transfer",
        "processingTime": "1-3 business days",
        "fees": {
          "fixed": 0,
          "percentage": 0
        },
        "provider": "Bank"
      }
    ],
    "filters": {
      "country": "DE",
      "currency": "EUR"
    }
  }
}
```

### Update User Currency Preference
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferredCurrency": "EUR",
    "preferredLanguage": "de",
    "country": "DE"
  }'
```

### Get Cart with Currency Conversion
```bash
curl "http://localhost:3000/api/cart?currency=EUR" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response includes converted prices:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "totalPriceUSD": 100.00,
    "displayCurrency": "EUR",
    "displayPrice": 85.67,
    "exchangeRate": 0.8567
  }
}
```

### Create Order with Display Currency
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "...",
    "quantity": 1,
    "customerEmail": "user@example.com",
    "cryptocurrency": "BTC",
    "displayCurrency": "EUR",
    "shippingAddress": {...}
  }'
```

## Features

### Smart Currency Rounding
- Automatically applies appropriate decimal places
- JPY, KRW, VND: No decimals (¥11,058)
- Most currencies: 2 decimals ($100.50, €85.67)

### Automatic Rate Updates
- Exchange rates auto-refresh when older than 24 hours
- Dual API support with automatic fallback
- Manual rate override capability for admins

### Historical Tracking
- All rate changes are stored
- Admin can query historical rates
- Audit trail for compliance

### Region-Based Filtering
- Query payment methods by country
- Filter by supported currency
- Filter by region (EU, NA, APAC, etc.)

### User Preferences
- Currency preference stored in user profile
- Persists across sessions
- Integrates with i18n language preferences

## Security Considerations

1. **Rate Manipulation Protection**
   - Rates stored in database, not calculated on-the-fly
   - Manual overrides require admin authentication
   - Audit trail for all rate changes

2. **Payment Method Validation**
   - Only active payment methods are shown to users
   - Region/country validation prevents misuse
   - Admin-only CRUD operations

3. **Currency Conversion**
   - Graceful fallback to USD if conversion fails
   - Never blocks order creation due to conversion errors
   - Logged warnings for troubleshooting

## Testing

### Test Coverage
- Currency conversion accuracy tests
- Rounding rules validation
- Regional payment filtering
- Model validation tests
- Edge case handling

### Test Files
- `tests/currency.test.js`: 15+ currency service tests
- `tests/regionalPayments.test.js`: 10+ payment method tests

## Integration Points

### Existing Systems
- **i18n**: Works with existing language system
- **Authentication**: Uses existing JWT middleware
- **Orders**: Seamlessly integrated with order creation
- **Cart**: Optional currency conversion in cart display
- **User Profile**: Extended with new preferences

### External APIs
- **Primary**: ExchangeRate-API (https://api.exchangerate-api.com)
- **Fallback**: Open Exchange Rates API (https://open.er-api.com)

## Performance Characteristics

- **Rate Caching**: Database caching reduces API calls
- **Batch Updates**: Single API call updates all rates
- **Indexed Queries**: Compound indexes on currency pairs
- **Lazy Loading**: Rates fetched only when needed

## Configuration

### Environment Variables
No additional environment variables required. The service uses free-tier APIs with no authentication.

### Rate Update Schedule
Recommended: Set up a cron job to update rates daily:
```bash
# Update exchange rates daily at 1 AM
0 1 * * * curl -X POST http://localhost:3000/api/currencies/rates/update \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Future Enhancements

Potential improvements:
- [ ] Automatic geolocation-based currency detection
- [ ] Dynamic pricing per region (price localization)
- [ ] Regional tax calculation integration
- [ ] Cryptocurrency price conversion (BTC/ETH to fiat)
- [ ] Multi-currency invoice generation
- [ ] Payment gateway integration for regional methods
- [ ] Currency trend analysis and reporting
- [ ] Seasonal exchange rate alerts

## Maintenance

### Monitoring
- Check exchange rate update success in logs
- Monitor API response times
- Track conversion error rates

### Database Cleanup
Old exchange rate records can be archived:
```javascript
// Keep last 90 days of rate history
CurrencyRate.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
})
```

## Conclusion

The multi-currency pricing and regional payment methods implementation successfully enables Cryptons.com to serve global customers with localized experiences. The system is:
- ✅ Extensible (easy to add currencies and payment methods)
- ✅ Reliable (fallback mechanisms and error handling)
- ✅ User-friendly (automatic detection and smart defaults)
- ✅ Admin-friendly (management interfaces and overrides)
- ✅ Well-tested (comprehensive test coverage)

## Resources

- Currency Service: `src/services/currencyService.js`
- Models: `src/models/CurrencyRate.js`, `src/models/RegionalPaymentMethod.js`
- Controllers: `src/controllers/currencyController.js`, `src/controllers/regionalPaymentController.js`
- Routes: `src/routes/currencyRoutes.js`, `src/routes/regionalPaymentRoutes.js`
- Tests: `tests/currency.test.js`, `tests/regionalPayments.test.js`
- Seed Data: `src/utils/seedRegionalPayments.js`
