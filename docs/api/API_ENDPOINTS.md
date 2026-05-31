# API Endpoints Documentation

Complete API endpoint reference for CStore cryptocurrency marketplace.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "data": {},
  "message": "Optional message",
  "pagination": {} // For paginated endpoints
}
```

---

## Authentication Endpoints

### Register User
- **POST** `/auth/register`
- **Auth Required:** No
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

### Login
- **POST** `/auth/login`
- **Auth Required:** No
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

### Get Current User
- **GET** `/auth/me`
- **Auth Required:** Yes

### Update Password
- **PUT** `/auth/password`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  ```

---

## Product Endpoints

### Get All Products
- **GET** `/products`
- **Auth Required:** No
- **Query Parameters:**
  - `page` - Page number (default: 1)
  - `limit` - Items per page (default: 12)
  - `category` - Filter by category ID
  - `minPrice` - Minimum price in USD
  - `maxPrice` - Maximum price in USD
  - `featured` - Filter featured products (true/false)
  - `minRating` - Minimum average rating (0-5)
  - `search` - Search term (uses Elasticsearch if enabled, otherwise MongoDB text search)
  - `sort` - Sort field (e.g., 'price', '-createdAt', 'rating', 'name')
- **Response:**
  - Returns products with pagination info
  - Includes `searchEngine` field: 'elasticsearch' or 'mongodb'
  - When using Elasticsearch, products include relevance `_score`

**Enhanced Search Features (when Elasticsearch is enabled):**
- Fuzzy matching for typo tolerance
- Multi-field search across name, description, and category
- Better relevance ranking
- Advanced filtering combinations

### Get Single Product
- **GET** `/products/:id`
- **Auth Required:** No

### Create Product (Admin)
- **POST** `/products`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "name": "Product Name",
    "description": "Product description",
    "price": 0.001,
    "priceUSD": 50,
    "currency": "BTC",
    "category": "category_id",
    "stock": 100,
    "image": "/images/product.jpg"
  }
  ```

### Update Product (Admin)
- **PUT** `/products/:id`
- **Auth Required:** Yes (Admin)

### Delete Product (Admin)
- **DELETE** `/products/:id`
- **Auth Required:** Yes (Admin)

- **Response:**
  ```json
  {
    "success": true,
    "data": {
- **Response:**
  ```json
  {
    "success": true,

---

## Order Endpoints

### Create Order
- **POST** `/orders`
- **Auth Required:** Optional (Guest checkout supported)
- **Body:**
  ```json
  {
    "productId": "product_id",
    "quantity": 1,
    "customerEmail": "customer@example.com",
    "cryptocurrency": "BTC",
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    }
  }
  ```

### Get Order
- **GET** `/orders/:id`
- **Auth Required:** Optional

### Get My Orders
- **GET** `/orders/my-orders`
- **Auth Required:** Yes

### Get All Orders (Admin)
- **GET** `/orders`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `page` - Page number
  - `limit` - Items per page
  - `status` - Filter by status

### Update Order Status (Admin)
- **PUT** `/orders/:id/status`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "status": "confirmed|processing|shipped|delivered|cancelled"
  }
  ```

---

## Payment Endpoints

### Confirm Payment
- **POST** `/payments/confirm`
- **Auth Required:** No
- **Body:**
  ```json
  {
    "orderId": "order_id",
    "transactionHash": "0x..."
  }
  ```

### Get Payment by Order
- **GET** `/payments/order/:orderId`
- **Auth Required:** No

### Get All Payments (Admin)
- **GET** `/payments`
- **Auth Required:** Yes (Admin)

### Verify Payment (Admin)
- **POST** `/payments/:id/verify`
- **Auth Required:** Yes (Admin)

---

## Review Endpoints

### Create Review
- **POST** `/reviews`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "productId": "product_id",
    "orderId": "order_id",
    "rating": 5,
    "title": "Great product!",
    "comment": "Really enjoyed this product. Highly recommend!"
  }
  ```

### Get Product Reviews
- **GET** `/reviews/product/:productId`
- **Auth Required:** No
- **Query Parameters:**
  - `page` - Page number
  - `limit` - Items per page
  - `sort` - Sort order (e.g., '-createdAt', 'rating')

### Get Review Stats
- **GET** `/reviews/product/:productId/stats`
- **Auth Required:** No
- **Returns:** Total reviews, average rating, rating distribution

### Get Single Review
- **GET** `/reviews/:id`
- **Auth Required:** No

### Get My Reviews
- **GET** `/reviews/my-reviews`
- **Auth Required:** Yes

### Update Review
- **PUT** `/reviews/:id`
- **Auth Required:** Yes (Owner only)
- **Body:**
  ```json
  {
    "rating": 4,
    "title": "Updated title",
    "comment": "Updated comment"
  }
  ```

### Delete Review
- **DELETE** `/reviews/:id`
- **Auth Required:** Yes (Owner or Admin)

### Mark Review as Helpful
- **PUT** `/reviews/:id/helpful`
- **Auth Required:** No

### Approve Review (Admin)
- **PUT** `/reviews/:id/approve`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "isApproved": true
  }
  ```

---

## Category Endpoints

### Get All Categories
- **GET** `/categories`
- **Auth Required:** No
- **Query Parameters:**
  - `isActive` - Filter by active status
  - `sort` - Sort order

### Get Single Category
- **GET** `/categories/:id`
- **Auth Required:** No

### Get Category by Slug
- **GET** `/categories/slug/:slug`
- **Auth Required:** No

### Get Category Products
- **GET** `/categories/:id/products`
- **Auth Required:** No
- **Query Parameters:**
  - `page` - Page number
  - `limit` - Items per page
  - `sort` - Sort order
  - `minPrice` - Minimum price
  - `maxPrice` - Maximum price

### Create Category (Admin)
- **POST** `/categories`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "name": "Electronics",
    "description": "Electronic products",
    "image": "/images/category.jpg",
    "displayOrder": 1
  }
  ```

### Update Category (Admin)
- **PUT** `/categories/:id`
- **Auth Required:** Yes (Admin)

### Delete Category (Admin)
- **DELETE** `/categories/:id`
- **Auth Required:** Yes (Admin)

---

## Shopping Cart Endpoints

### Get Cart
- **GET** `/cart`
- **Auth Required:** Yes

### Add to Cart
- **POST** `/cart/items`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "productId": "product_id",
    "quantity": 1
  }
  ```

### Update Cart Item
- **PUT** `/cart/items/:productId`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "quantity": 2
  }
  ```

### Remove from Cart
- **DELETE** `/cart/items/:productId`
- **Auth Required:** Yes

### Clear Cart
- **DELETE** `/cart`
- **Auth Required:** Yes

### Validate Cart
- **POST** `/cart/validate`
- **Auth Required:** Yes
- **Returns:** Cart validation status, stock availability, price changes

---

## Wishlist Endpoints

### Get Wishlist
- **GET** `/wishlist`
- **Auth Required:** Yes
- **Returns:** User's wishlist with populated product details

### Add to Wishlist
- **POST** `/wishlist/items`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "productId": "product_id"
  }
  ```

### Remove from Wishlist
- **DELETE** `/wishlist/items/:productId`
- **Auth Required:** Yes

### Clear Wishlist
- **DELETE** `/wishlist`
- **Auth Required:** Yes

---

## Admin Dashboard Endpoints

All admin endpoints require Admin role authentication.

### Dashboard Statistics
- **GET** `/admin/dashboard/stats`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `startDate` - Filter start date
  - `endDate` - Filter end date
- **Returns:** Overview stats, recent orders, top products

### User Management

#### Get All Users
- **GET** `/admin/users`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `page` - Page number
  - `limit` - Items per page
  - `role` - Filter by role
  - `search` - Search term

#### Get User Details
- **GET** `/admin/users/:id`
- **Auth Required:** Yes (Admin)

#### Update User Role
- **PUT** `/admin/users/:id/role`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "role": "admin|user"
  }
  ```

#### Delete User
- **DELETE** `/admin/users/:id`
- **Auth Required:** Yes (Admin)

### Analytics

#### Sales Analytics
- **GET** `/admin/analytics/sales`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `period` - Time period (7d, 30d, 90d, 1y)
- **Returns:** Sales by date, sales by cryptocurrency, average order value

#### Product Analytics
- **GET** `/admin/analytics/products`
- **Auth Required:** Yes (Admin)
- **Returns:** Low stock products, out of stock products, most reviewed products

### Reviews Moderation

#### Get Pending Reviews
- **GET** `/admin/reviews/pending`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `page` - Page number
  - `limit` - Items per page

### System

#### System Health
- **GET** `/admin/system/health`
- **Auth Required:** Yes (Admin)
- **Returns:** Database status, email service status, memory usage, uptime

#### Activity Log
- **GET** `/admin/activity`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `limit` - Number of activities to return
- **Returns:** Recent orders, reviews, and user registrations

### Product Management

#### Reorder Products
- **PUT** `/admin/products/reorder`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "productOrders": [
      {
        "productId": "product_id",
        "sortOrder": 0
      }
    ]
  }
  ```
- **Description:** Bulk update product sort orders for drag-and-drop reordering

### Export Endpoints

#### Export Products to CSV
- **GET** `/admin/products/export/csv`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `search` - Search filter (optional)
  - `category` - Category filter (optional)
- **Returns:** CSV file download

#### Export Products to PDF
- **GET** `/admin/products/export/pdf`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `search` - Search filter (optional)
  - `category` - Category filter (optional)
- **Returns:** PDF file download

#### Export Orders to CSV
- **GET** `/admin/orders/export/csv`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `status` - Order status filter (optional)
  - `startDate` - Start date filter (optional)
  - `endDate` - End date filter (optional)
- **Returns:** CSV file download

#### Export Orders to PDF
- **GET** `/admin/orders/export/pdf`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `status` - Order status filter (optional)
  - `startDate` - Start date filter (optional)
  - `endDate` - End date filter (optional)
- **Returns:** PDF file download

#### Export Users to CSV
- **GET** `/admin/users/export/csv`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `role` - Role filter (optional)
  - `search` - Search filter (optional)
- **Returns:** CSV file download

---

## Utility Endpoints

### Get Cryptocurrencies
- **GET** `/cryptocurrencies`
- **Auth Required:** No
- **Returns:** List of supported cryptocurrencies and wallet addresses

### Health Check
- **GET** `/health`
- **Auth Required:** No
- **Returns:** Server status and timestamp

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes

---

## Multi-Signature Wallet Endpoints

### Create Multi-Sig Wallet
- **POST** `/multisig/wallets`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "name": "Company Treasury",
    "cryptocurrency": "BTC",
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "signers": [
      { "email": "signer1@example.com", "publicKey": "optional" },
      { "email": "signer2@example.com" }
    ],
    "requiredSignatures": 2,
    "description": "Main company treasury"
  }
  ```

### Get All Multi-Sig Wallets
- **GET** `/multisig/wallets?cryptocurrency=BTC&isActive=true`
- **Auth Required:** Yes
- **Query Params:**
  - `cryptocurrency` (optional): Filter by cryptocurrency (BTC, ETH, USDT)
  - `isActive` (optional): Filter by active status (true/false)

### Get Multi-Sig Wallet by ID
- **GET** `/multisig/wallets/:id`
- **Auth Required:** Yes

### Update Multi-Sig Wallet
- **PUT** `/multisig/wallets/:id`
- **Auth Required:** Yes (Owner only)
- **Body:**
  ```json
  {
    "name": "Updated Name",
    "description": "Updated description",
    "isActive": true
  }
  ```

### Add Signer to Wallet
- **POST** `/multisig/wallets/:id/signers`
- **Auth Required:** Yes (Owner only)
- **Body:**
  ```json
  {
    "email": "newsigner@example.com",
    "publicKey": "optional"
  }
  ```

### Remove Signer from Wallet
- **DELETE** `/multisig/wallets/:id/signers/:signerId`
- **Auth Required:** Yes (Owner only)

### Deactivate Wallet
- **DELETE** `/multisig/wallets/:id`
- **Auth Required:** Yes (Owner only)

---

## Transaction Approval Endpoints

### Create Transaction Approval Request
- **POST** `/multisig/transactions`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "walletId": "wallet-id",
    "orderId": "order-id",
    "amount": 0.5,
    "toAddress": "1BitcoinEaterAddressDontSendf59kuE",
    "description": "Payment for Order #12345"
  }
  ```

### Get All Transaction Approvals
- **GET** `/multisig/transactions?status=pending&walletId=wallet-id`
- **Auth Required:** Yes
- **Query Params:**
  - `status` (optional): Filter by status (pending, approved, rejected, executed, expired)
  - `walletId` (optional): Filter by wallet ID

### Get Transaction Approval by ID
- **GET** `/multisig/transactions/:id`
- **Auth Required:** Yes

### Approve or Reject Transaction
- **POST** `/multisig/transactions/:id/approve`
- **Auth Required:** Yes (Signer only)
- **Body:**
  ```json
  {
    "approved": true,
    "signature": "optional-signature",
    "comment": "Approved after review"
  }
  ```

### Execute Transaction
- **POST** `/multisig/transactions/:id/execute`
- **Auth Required:** Yes
- **Body:**
  ```json
  {
    "transactionHash": "0x1234567890abcdef..."
  }
  ```

### Cancel Transaction
- **DELETE** `/multisig/transactions/:id`
- **Auth Required:** Yes (Initiator or Owner only)

---

## Admin Multi-Sig Management Endpoints

All admin multi-sig endpoints require Admin role authentication.

### Get Multi-Sig Statistics
- **GET** `/admin/multi-sig/stats`
- **Auth Required:** Yes (Admin)
- **Returns:** Comprehensive statistics about wallets and transactions
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "wallets": { "total": 50, "active": 45, "inactive": 5 },
      "transactions": {
        "total": 250,
        "pending": 10,
        "approved": 5,
        "executed": 230,
        "rejected": 5
      },
      "byCryptocurrency": [...],
      "recentPending": [...]
    }
  }
  ```

### List All Multi-Sig Wallets
- **GET** `/admin/multi-sig/wallets`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `isActive` (boolean): Filter by active status
  - `cryptocurrency` (string): Filter by cryptocurrency type
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 20)
- **Returns:** Paginated list of all multi-sig wallets with owner and signer details

### Get Wallet Details (Admin)
- **GET** `/admin/multi-sig/wallets/:id`
- **Auth Required:** Yes (Admin)
- **Returns:** Detailed wallet information including all associated transactions

### Update Wallet Status
- **PUT** `/admin/multi-sig/wallets/:id/status`
- **Auth Required:** Yes (Admin)
- **Body:**
  ```json
  {
    "isActive": true
  }
  ```
- **Returns:** Updated wallet with new status

### List All Transactions (Admin)
- **GET** `/admin/multi-sig/transactions`
- **Auth Required:** Yes (Admin)
- **Query Parameters:**
  - `status` (string): Filter by transaction status
  - `cryptocurrency` (string): Filter by cryptocurrency
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 20)
- **Returns:** Paginated list of all multi-sig transactions with full details

### Get Transaction Details (Admin)
- **GET** `/admin/multi-sig/transactions/:id`
- **Auth Required:** Yes (Admin)
- **Returns:** Detailed transaction information including wallet details and all approvals

---

## Pagination

Paginated endpoints return the following pagination object:

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```
