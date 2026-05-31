# Printify Print-on-Demand API Documentation

## Overview

The Printify POD integration allows the Cryptons marketplace to offer print-on-demand products through Printify's fulfillment network. This documentation covers the API endpoints, authentication, and usage.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Enable Printify integration
PRINTIFY_ENABLED=true

# Printify API Token (from https://printify.com/app/account/api)
PRINTIFY_API_TOKEN=your_api_token_here

# Printify Shop ID
PRINTIFY_SHOP_ID=your_shop_id_here

# Webhook Secret for signature verification
PRINTIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

## Public API Endpoints

### Get POD Products

Get a list of available print-on-demand products.

```http
GET /api/printify/products
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `syncStatus` (string, optional): Filter by sync status (synced, pending, failed, out_of_sync)
- `isPublished` (boolean, optional): Filter by published status

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "...",
        "title": "Product Title",
        "printifyProductId": "...",
        "syncStatus": "synced",
        "isPublished": true,
        "variants": [...],
        "images": [...]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### Get Single POD Product

Get details of a specific POD product.

```http
GET /api/printify/products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "_id": "...",
      "title": "Product Title",
      "description": "Product description",
      "printifyProductId": "...",
      "variants": [...],
      "images": [...],
      "syncStatus": "synced",
      "isPublished": true
    }
  }
}
```

### Create POD Order

Create a new print-on-demand order (requires authentication).

```http
POST /api/printify/orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "orderId": "order_id",
  "items": [
    {
      "podProductId": "...",
      "printifyProductId": "...",
      "variantId": "...",
      "quantity": 1,
      "price": 19.99,
      "cost": 9.99
    }
  ],
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "country": "US",
    "address1": "123 Main St",
    "city": "New York",
    "zip": "10001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "POD order created successfully",
  "data": {
    "podOrder": {
      "_id": "...",
      "status": "draft",
      "items": [...],
      "totalPrice": 19.99
    }
  }
}
```

### Get POD Order

Get details of a POD order (requires authentication).

```http
GET /api/printify/orders/:id
Authorization: Bearer <token>
```

## Admin API Endpoints

All admin endpoints require admin authentication.

### Get POD Statistics

```http
GET /api/admin/pod/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": {
      "total": 50,
      "published": 45,
      "syncPending": 5
    },
    "orders": {
      "total": 100,
      "pending": 10,
      "inProduction": 20,
      "shipped": 60,
      "delivered": 10
    },
    "revenue": {
      "total": 5000,
      "cost": 2500,
      "profit": 2500
    }
  }
}
```

### Sync Products from Printify

```http
POST /api/printify/products/sync
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Product sync completed",
  "data": {
    "synced": 50,
    "failed": 0
  }
}
```

### Sync Single Product

```http
POST /api/admin/pod/products/:id/sync
Authorization: Bearer <admin_token>
```

### Publish Product

```http
POST /api/admin/pod/products/:id/publish
Authorization: Bearer <admin_token>
```

### Update POD Product

```http
PUT /api/admin/pod/products/:id
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "isActive": true,
  "isPublished": true,
  "tags": ["tshirt", "cotton"]
}
```

### Delete POD Product

```http
DELETE /api/admin/pod/products/:id
Authorization: Bearer <admin_token>
```

### List POD Orders

```http
GET /api/admin/pod/orders
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `status` (string, optional): Filter by status (draft, pending, in_production, shipped, delivered, cancelled)
- `startDate` (string, optional): Start date (ISO 8601)
- `endDate` (string, optional): End date (ISO 8601)

### Submit Order to Printify

```http
POST /api/printify/orders/:id/submit
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "autoSubmit": true
}
```

### Cancel POD Order

```http
POST /api/printify/orders/:id/cancel
Authorization: Bearer <admin_token>
```

### Get Printify Catalog

```http
GET /api/admin/pod/catalog/blueprints
Authorization: Bearer <admin_token>
```

### Get Print Providers

```http
GET /api/admin/pod/catalog/blueprints/:id/providers
Authorization: Bearer <admin_token>
```

## Webhooks

Printify sends webhooks for order status updates.

### Webhook Endpoint

```http
POST /api/printify/webhooks
```

**Headers:**
- `x-printify-signature`: HMAC-SHA256 signature for verification

### Webhook Events

- `order:created` - Order created in Printify
- `order:updated` - Order status updated
- `order:sent-to-production` - Order sent to production
- `order:shipment:created` - Shipment created with tracking info
- `order:shipment:delivered` - Order delivered
- `product:publish:started` - Product publish started
- `product:publish:succeeded` - Product published successfully
- `product:publish:failed` - Product publish failed

### Webhook Security

All webhooks must include a valid HMAC-SHA256 signature in the `x-printify-signature` header. The signature is calculated using:

```javascript
const signature = crypto
  .createHmac('sha256', PRINTIFY_WEBHOOK_SECRET)
  .update(JSON.stringify(requestBody))
  .digest('hex');
```

## Order Statuses

POD orders go through these statuses:

- **draft**: Order created but not submitted to Printify
- **pending**: Submitted to Printify, awaiting processing
- **in_production**: Being printed/manufactured
- **shipped**: Order shipped to customer
- **delivered**: Order delivered to customer
- **cancelled**: Order cancelled
- **failed**: Order processing failed

## Product Sync Statuses

- **synced**: Product successfully synced with Printify
- **pending**: Sync pending
- **failed**: Sync failed
- **out_of_sync**: Product data has changed in Printify

## Error Handling

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

API requests are subject to standard rate limiting:
- Public endpoints: 100 requests per 15 minutes
- Admin endpoints: 500 requests per 15 minutes
- Webhook endpoints: No rate limiting (but signature verified)

## Examples

### Complete Order Flow

1. **Customer browses POD products:**
   ```bash
   GET /api/printify/products
   ```

2. **Customer creates order:**
   ```bash
   POST /api/printify/orders
   ```

3. **Admin submits order to Printify:**
   ```bash
   POST /api/printify/orders/:id/submit
   ```

4. **Printify sends status updates via webhooks:**
   - `order:sent-to-production`
   - `order:shipment:created`
   - `order:shipment:delivered`

5. **Customer receives product!** 🎉

## Support

For issues or questions:
- Check the logs: `/var/log/cryptons/app.log`
- Review Printify API docs: https://developers.printify.com
- Contact support: admin@cryptons.com
