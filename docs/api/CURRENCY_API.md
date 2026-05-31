# Currency & Regional Payment API Documentation

## Overview
This document describes the API endpoints for multi-currency pricing and regional payment methods in the CStore marketplace.

## Base URL
```
http://localhost:3000/api
```

## Currency Endpoints

### Get Supported Currencies
Get a list of all supported currencies with their symbols and decimal rules.

**Endpoint:** `GET /currencies`  
**Access:** Public

**Response:**
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
      },
      {
        "code": "JPY",
        "name": "Japanese Yen",
        "symbol": "¥",
        "decimals": 0
      }
    ]
  }
}
```

### Get Exchange Rates
Get current exchange rates for a base currency.

**Endpoint:** `GET /currencies/rates`  
**Access:** Public  
**Query Parameters:**
- `base` (optional): Base currency code (default: USD)

**Example Request:**
```bash
curl "http://localhost:3000/api/currencies/rates?base=USD"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "base": "USD",
    "rates": [
      {
        "currency": "EUR",
        "rate": 0.8567,
        "lastUpdated": "2024-12-01T10:00:00.000Z"
      },
      {
        "currency": "GBP",
        "rate": 0.7523,
        "lastUpdated": "2024-12-01T10:00:00.000Z"
      }
    ],
    "timestamp": "2024-12-01T10:30:00.000Z"
  }
}
```

### Convert Currency
Convert an amount from one currency to another.

**Endpoint:** `POST /currencies/convert`  
**Access:** Public  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "amount": 100,
  "from": "USD",
  "to": "EUR"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/currencies/convert \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "from": "USD", "to": "EUR"}'
```

**Response:**
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

### Update Exchange Rates (Admin)
Manually trigger an exchange rate update from the external API.

**Endpoint:** `POST /currencies/rates/update`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "base": "USD"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/currencies/rates/update \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base": "USD"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Exchange rates updated successfully",
  "data": {
    "success": true,
    "base": "USD",
    "count": 10,
    "timestamp": "2024-12-01T10:00:00.000Z"
  }
}
```

### Get Exchange Rate History (Admin)
Get historical exchange rates between two currencies.

**Endpoint:** `GET /currencies/rates/history`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)  
**Query Parameters:**
- `from` (required): Source currency code
- `to` (required): Target currency code
- `days` (optional): Number of days of history (default: 30)

**Example Request:**
```bash
curl "http://localhost:3000/api/currencies/rates/history?from=USD&to=EUR&days=7" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "EUR",
    "period": "7 days",
    "history": [
      {
        "rate": 0.8567,
        "date": "2024-12-01T00:00:00.000Z",
        "source": "api"
      },
      {
        "rate": 0.8545,
        "date": "2024-11-30T00:00:00.000Z",
        "source": "api"
      }
    ]
  }
}
```

### Set Manual Exchange Rate (Admin)
Set a manual exchange rate override.

**Endpoint:** `POST /currencies/rates/manual`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "from": "USD",
  "to": "EUR",
  "rate": 0.85
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/currencies/rates/manual \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from": "USD", "to": "EUR", "rate": 0.85}'
```

**Response:**
```json
{
  "success": true,
  "message": "Manual exchange rate set successfully",
  "data": {
    "rate": {
      "_id": "...",
      "baseCurrency": "USD",
      "targetCurrency": "EUR",
      "rate": 0.85,
      "source": "manual",
      "lastUpdated": "2024-12-01T10:00:00.000Z"
    }
  }
}
```

## Regional Payment Endpoints

### Get Regional Payment Methods
Get payment methods filtered by country, region, or currency.

**Endpoint:** `GET /payments/regional`  
**Access:** Public  
**Query Parameters:**
- `country` (optional): Country code (e.g., DE, US, CN)
- `region` (optional): Region code (e.g., EU, NA, APAC)
- `currency` (optional): Currency code (e.g., EUR, USD)

**Example Request:**
```bash
curl "http://localhost:3000/api/payments/regional?country=DE&currency=EUR"
```

**Response:**
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
        "provider": "Bank",
        "isActive": true
      },
      {
        "_id": "...",
        "name": "Sofort",
        "code": "SOFORT",
        "description": "European online banking payment",
        "regions": ["EU"],
        "countries": ["DE", "AT", "CH"],
        "currencies": ["EUR", "CHF"],
        "type": "bank_transfer",
        "processingTime": "Instant",
        "fees": {
          "fixed": 0.29,
          "percentage": 1.4
        },
        "provider": "Sofort",
        "isActive": true
      }
    ],
    "filters": {
      "country": "DE",
      "currency": "EUR"
    }
  }
}
```

### Get Payment Method by Code
Get a specific payment method by its code.

**Endpoint:** `GET /payments/regional/code/:code`  
**Access:** Public

**Example Request:**
```bash
curl "http://localhost:3000/api/payments/regional/code/SEPA"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentMethod": {
      "_id": "...",
      "name": "SEPA Bank Transfer",
      "code": "SEPA",
      "description": "Single Euro Payments Area bank transfer",
      "regions": ["EU"],
      "countries": ["DE", "FR", "ES", "IT", "NL", "BE"],
      "currencies": ["EUR"],
      "type": "bank_transfer",
      "processingTime": "1-3 business days",
      "fees": {
        "fixed": 0,
        "percentage": 0
      },
      "provider": "Bank"
    }
  }
}
```

### Get All Payment Methods (Admin)
Get all payment methods with pagination.

**Endpoint:** `GET /payments/regional/all`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)  
**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Example Request:**
```bash
curl "http://localhost:3000/api/payments/regional/all?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentMethods": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    }
  }
}
```

### Create Payment Method (Admin)
Create a new regional payment method.

**Endpoint:** `POST /payments/regional`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "name": "Test Payment",
  "code": "TEST",
  "description": "Test payment method",
  "regions": ["EU"],
  "countries": ["DE", "FR"],
  "currencies": ["EUR"],
  "type": "bank_transfer",
  "processingTime": "1-2 days",
  "fees": {
    "fixed": 0,
    "percentage": 0
  },
  "provider": "Test Provider"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/payments/regional \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Payment", "code": "TEST", ...}'
```

**Response:**
```json
{
  "success": true,
  "message": "Payment method created successfully",
  "data": {
    "paymentMethod": {
      "_id": "...",
      "name": "Test Payment",
      "code": "TEST",
      ...
    }
  }
}
```

### Update Payment Method (Admin)
Update an existing payment method.

**Endpoint:** `PUT /payments/regional/:id`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)

**Request Body:** (partial update supported)
```json
{
  "name": "Updated Name",
  "isActive": false
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/payments/regional/PAYMENT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Payment method updated successfully",
  "data": {
    "paymentMethod": {...}
  }
}
```

### Delete Payment Method (Admin)
Delete a payment method.

**Endpoint:** `DELETE /payments/regional/:id`  
**Access:** Private/Admin  
**Authentication:** Required (Bearer token)

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/payments/regional/PAYMENT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Payment method deleted successfully"
}
```

## Updated Endpoints with Multi-Currency Support

### Get Cart with Currency Conversion
Get user's shopping cart with optional currency conversion.

**Endpoint:** `GET /cart`  
**Access:** Private  
**Authentication:** Required (Bearer token)  
**Query Parameters:**
- `currency` (optional): Target currency for display (e.g., EUR, GBP)

**Example Request:**
```bash
curl "http://localhost:3000/api/cart?currency=EUR" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "totalItems": 2,
    "totalPrice": 0.002,
    "totalPriceUSD": 100.00,
    "displayCurrency": "EUR",
    "displayPrice": 85.67,
    "exchangeRate": 0.8567
  }
}
```

### Create Order with Display Currency
Create an order with a specified display currency.

**Endpoint:** `POST /orders`  
**Access:** Public

**Request Body:**
```json
{
  "productId": "...",
  "quantity": 1,
  "customerEmail": "user@example.com",
  "cryptocurrency": "BTC",
  "displayCurrency": "EUR",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Berlin",
    "country": "Germany",
    "postalCode": "10115"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "...",
      "items": [...],
      "totalPriceUSD": 100.00,
      "displayCurrency": "EUR",
      "displayPrice": 85.67,
      "exchangeRate": 0.8567,
      "cryptocurrency": "BTC",
      ...
    }
  }
}
```

### Update User Preferences
Update user's currency and language preferences.

**Endpoint:** `PUT /auth/profile`  
**Access:** Private  
**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "preferredCurrency": "EUR",
  "preferredLanguage": "de",
  "country": "DE"
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preferredCurrency": "EUR", "preferredLanguage": "de"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "preferredCurrency": "EUR",
      "preferredLanguage": "de",
      "country": "DE"
    }
  }
}
```

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Additional error details (in development mode)"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

All API endpoints are subject to rate limiting:
- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes

## Examples

### Complete Workflow: International Customer Purchase

1. **Customer visits site and system detects location**
```bash
# Get available payment methods for Germany
curl "http://localhost:3000/api/payments/regional?country=DE&currency=EUR"
```

2. **Customer updates preferences**
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer TOKEN" \
  -d '{"preferredCurrency": "EUR", "country": "DE"}'
```

3. **Customer views cart in EUR**
```bash
curl "http://localhost:3000/api/cart?currency=EUR" \
  -H "Authorization: Bearer TOKEN"
```

4. **Customer creates order**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "...",
    "quantity": 1,
    "customerEmail": "user@example.de",
    "cryptocurrency": "BTC",
    "displayCurrency": "EUR",
    "shippingAddress": {...}
  }'
```

### Admin Workflow: Currency Management

1. **Update exchange rates**
```bash
curl -X POST http://localhost:3000/api/currencies/rates/update \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

2. **Check rate history**
```bash
curl "http://localhost:3000/api/currencies/rates/history?from=USD&to=EUR&days=30" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

3. **Set manual rate override**
```bash
curl -X POST http://localhost:3000/api/currencies/rates/manual \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"from": "USD", "to": "EUR", "rate": 0.85}'
```

## Additional Resources

- [MULTI_CURRENCY_IMPLEMENTATION.md](../MULTI_CURRENCY_IMPLEMENTATION.md) - Implementation details
- [API_ENDPOINTS.md](API_ENDPOINTS.md) - Full API documentation
- [README.md](../README.md) - Project overview
