# Multi-Currency & Regional Payments Usage Examples

This document provides practical examples of using the multi-currency pricing and regional payment methods features in Cryptons.com.

## Table of Contents
- [Quick Start](#quick-start)
- [Customer Workflows](#customer-workflows)
- [Admin Workflows](#admin-workflows)
- [Integration Examples](#integration-examples)

## Quick Start

### Starting the Server
The application automatically initializes currency rates and regional payment methods on startup:

```bash
npm start
```

You should see in the logs:
```
Starting application initialization...
Initializing currency rates...
Currency rates initialized successfully
Seeded 15 regional payment methods
Application initialization completed
```

## Customer Workflows

### 1. International Customer from Germany

#### Step 1: View Available Payment Methods
```bash
curl "http://localhost:3000/api/payments/regional?country=DE&currency=EUR"
```

Response shows German payment options:
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      {
        "name": "SEPA Bank Transfer",
        "code": "SEPA",
        "processingTime": "1-3 business days",
        "fees": { "fixed": 0, "percentage": 0 }
      },
      {
        "name": "Sofort",
        "code": "SOFORT",
        "processingTime": "Instant",
        "fees": { "fixed": 0.29, "percentage": 1.4 }
      }
    ]
  }
}
```

#### Step 2: Register Account
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hans Mueller",
    "email": "hans@example.de",
    "password": "SecurePass123!"
  }'
```

Save the returned JWT token for subsequent requests.

#### Step 3: Set Currency Preference
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

#### Step 4: Browse Products
```bash
curl "http://localhost:3000/api/products"
```

Products are returned with USD prices. Convert to EUR:
```bash
curl -X POST http://localhost:3000/api/currencies/convert \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 99.99,
    "from": "USD",
    "to": "EUR"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "originalAmount": 99.99,
    "originalCurrency": "USD",
    "convertedAmount": 85.67,
    "targetCurrency": "EUR",
    "exchangeRate": 0.8567
  }
}
```

#### Step 5: Add to Cart and View in EUR
```bash
# Add product to cart
curl -X POST http://localhost:3000/api/cart/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 1
  }'

# View cart in EUR
curl "http://localhost:3000/api/cart?currency=EUR" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response shows converted prices:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "totalPriceUSD": 99.99,
    "displayCurrency": "EUR",
    "displayPrice": 85.67,
    "exchangeRate": 0.8567
  }
}
```

#### Step 6: Create Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 1,
    "customerEmail": "hans@example.de",
    "cryptocurrency": "BTC",
    "displayCurrency": "EUR",
    "shippingAddress": {
      "street": "Alexanderplatz 1",
      "city": "Berlin",
      "state": "Berlin",
      "postalCode": "10178",
      "country": "Germany"
    }
  }'
```

Order is created with both USD and EUR prices stored.

### 2. Customer from Japan

#### Get JPY Conversion (No Decimals)
```bash
curl -X POST http://localhost:3000/api/currencies/convert \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "from": "USD",
    "to": "JPY"
  }'
```

Response (note integer amount for JPY):
```json
{
  "success": true,
  "data": {
    "originalAmount": 100,
    "originalCurrency": "USD",
    "convertedAmount": 11058,
    "targetCurrency": "JPY",
    "exchangeRate": 110.58
  }
}
```

### 3. Customer from Brazil

#### Find Brazilian Payment Methods
```bash
curl "http://localhost:3000/api/payments/regional?country=BR"
```

Response:
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      {
        "name": "PIX",
        "code": "PIX",
        "description": "Brazilian instant payment system",
        "processingTime": "Instant",
        "fees": { "fixed": 0, "percentage": 0 }
      }
    ]
  }
}
```

## Admin Workflows

### 1. Currency Management

#### Update All Exchange Rates
```bash
curl -X POST http://localhost:3000/api/currencies/rates/update \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base": "USD"}'
```

#### Set Manual Rate Override
Useful when automatic rates are incorrect or for special pricing:
```bash
curl -X POST http://localhost:3000/api/currencies/rates/manual \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "USD",
    "to": "EUR",
    "rate": 0.85
  }'
```

#### Check Rate History
```bash
curl "http://localhost:3000/api/currencies/rates/history?from=USD&to=EUR&days=30" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 2. Payment Method Management

#### Add New Payment Method
```bash
curl -X POST http://localhost:3000/api/payments/regional \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Apple Pay",
    "code": "APPLEPAY",
    "description": "Apple Pay mobile payment",
    "regions": ["NA", "EU", "APAC"],
    "countries": ["US", "CA", "GB", "DE", "FR", "JP", "AU"],
    "currencies": ["USD", "EUR", "GBP", "JPY", "AUD"],
    "type": "digital_wallet",
    "processingTime": "Instant",
    "fees": {
      "fixed": 0,
      "percentage": 2.5
    },
    "provider": "Apple"
  }'
```

#### Update Payment Method
```bash
curl -X PUT http://localhost:3000/api/payments/regional/PAYMENT_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fees": {
      "fixed": 0,
      "percentage": 2.0
    }
  }'
```

#### Deactivate Payment Method
```bash
curl -X PUT http://localhost:3000/api/payments/regional/PAYMENT_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

#### View All Payment Methods
```bash
curl "http://localhost:3000/api/payments/regional/all?page=1&limit=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Integration Examples

### Frontend Integration

#### Currency Selector Component
```javascript
// Fetch supported currencies
const response = await fetch('http://localhost:3000/api/currencies');
const { data } = await response.json();

// Display currency selector
data.currencies.forEach(currency => {
  console.log(`${currency.code} (${currency.symbol}) - ${currency.name}`);
});
```

#### Dynamic Price Display
```javascript
async function displayPrice(amountUSD, targetCurrency) {
  const response = await fetch('http://localhost:3000/api/currencies/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountUSD,
      from: 'USD',
      to: targetCurrency
    })
  });
  
  const { data } = await response.json();
  
  return {
    amount: data.convertedAmount,
    symbol: getCurrencySymbol(targetCurrency),
    formatted: `${getCurrencySymbol(targetCurrency)}${data.convertedAmount.toFixed(2)}`
  };
}
```

#### Detect User Location
```javascript
async function detectUserLocation() {
  // Use IP geolocation service
  const ipResponse = await fetch('https://ipapi.co/json/');
  const ipData = await ipResponse.json();
  
  // Get payment methods for user's country
  const paymentResponse = await fetch(
    `http://localhost:3000/api/payments/regional?country=${ipData.country_code}`
  );
  const { data } = await paymentResponse.json();
  
  return {
    country: ipData.country_code,
    currency: ipData.currency,
    paymentMethods: data.paymentMethods
  };
}
```

### Backend Integration

#### Scheduled Rate Updates
Create a cron job to update rates daily:

```javascript
// cron-jobs.js
const cron = require('node-cron');
const axios = require('axios');

// Update rates every day at 1 AM
cron.schedule('0 1 * * *', async () => {
  try {
    await axios.post('http://localhost:3000/api/currencies/rates/update', 
      { base: 'USD' },
      { headers: { 'Authorization': `Bearer ${process.env.ADMIN_TOKEN}` } }
    );
    console.log('Exchange rates updated successfully');
  } catch (error) {
    console.error('Failed to update exchange rates:', error.message);
  }
});
```

#### Email with Localized Currency
```javascript
const currencyService = require('./services/currencyService');

async function sendOrderConfirmationEmail(order, userCurrency) {
  const conversion = await currencyService.convertCurrency(
    order.totalPriceUSD,
    'USD',
    userCurrency
  );
  
  const emailContent = `
    Order Total: ${conversion.convertedAmount} ${userCurrency}
    (${order.totalPriceUSD} USD at rate ${conversion.exchangeRate})
  `;
  
  // Send email...
}
```

## Testing Examples

### Test Currency Conversion Accuracy
```javascript
const currencyService = require('../src/services/currencyService');

async function testConversion() {
  // Test USD to EUR
  const result = await currencyService.convertCurrency(100, 'USD', 'EUR');
  console.log(`100 USD = ${result.convertedAmount} EUR`);
  
  // Test rounding for JPY
  const jpyResult = await currencyService.convertCurrency(100, 'USD', 'JPY');
  console.log(`100 USD = ${jpyResult.convertedAmount} JPY (no decimals)`);
  
  // Test same currency
  const sameResult = await currencyService.convertCurrency(100, 'USD', 'USD');
  console.log(`100 USD = ${sameResult.convertedAmount} USD (should be 100)`);
}
```

### Test Regional Payment Filtering
```javascript
const RegionalPaymentMethod = require('../src/models/RegionalPaymentMethod');

async function testPaymentFiltering() {
  // Find European payment methods
  const euMethods = await RegionalPaymentMethod.find({
    regions: 'EU',
    isActive: true
  });
  console.log(`Found ${euMethods.length} EU payment methods`);
  
  // Find methods supporting EUR
  const eurMethods = await RegionalPaymentMethod.find({
    currencies: 'EUR',
    isActive: true
  });
  console.log(`Found ${eurMethods.length} EUR payment methods`);
}
```

## Common Use Cases

### 1. Multi-Currency Checkout Flow
1. User selects preferred currency in profile
2. Cart displays prices in selected currency
3. Order creation stores both USD and display currency
4. Payment processed in cryptocurrency (BTC/ETH/USDT)
5. Invoice shows original and display currencies

### 2. Regional Payment Selection
1. Detect user's country from IP or profile
2. Filter payment methods by country
3. Show only relevant payment options
4. Include processing time and fees in display
5. Handle region-specific payment flows

### 3. Admin Currency Management
1. Monitor exchange rates daily
2. Set alerts for significant rate changes
3. Override rates for specific markets
4. Track historical rates for reporting
5. Analyze sales by currency/region

## Best Practices

1. **Always handle conversion failures gracefully**
   - Fall back to USD if conversion fails
   - Log errors for monitoring
   - Don't block order creation

2. **Cache exchange rates appropriately**
   - Rates are cached for 24 hours
   - Manual updates override cache
   - Consider user experience vs. accuracy trade-off

3. **Display both original and converted prices**
   - Build trust by showing conversion
   - Include exchange rate in display
   - Update timestamp for transparency

4. **Test rounding for all currencies**
   - JPY, KRW, VND: No decimals
   - Most others: 2 decimals
   - Validate totals match expectations

5. **Keep payment methods up to date**
   - Regular review of fees and processing times
   - Remove deprecated methods promptly
   - Add new methods based on user requests

## Troubleshooting

### Exchange Rate API Failures
If external APIs fail, the system:
1. Tries fallback API automatically
2. Uses cached rates if available (up to 24 hours old)
3. Logs errors for admin review
4. Allows manual rate override

### Missing Payment Methods
If no payment methods match filters:
1. Check country code is correct (ISO 3166-1 alpha-2)
2. Verify payment methods are active
3. Consider adding generic "bank transfer" option
4. Fall back to global methods (PayPal, cards)

### Currency Conversion Errors
Common issues:
1. Invalid currency codes (use ISO 4217 codes)
2. Stale exchange rates (trigger manual update)
3. Network timeouts (increase timeout, use cache)
4. Rate not found (ensure rate exists in database)

## Additional Resources

- [MULTI_CURRENCY_IMPLEMENTATION.md](../MULTI_CURRENCY_IMPLEMENTATION.md) - Technical details
- [CURRENCY_API.md](../docs/CURRENCY_API.md) - Complete API reference
- [Currency Service Tests](../tests/currency.test.js) - Test examples
- [Regional Payment Tests](../tests/regionalPayments.test.js) - Payment filtering tests
