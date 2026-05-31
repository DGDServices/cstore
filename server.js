const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory data storage (in production, use a database)
const products = [
  {
    id: '1',
    name: 'Laptop Pro 15"',
    description: 'High-performance laptop with 16GB RAM and 512GB SSD',
    price: 0.025,
    currency: 'BTC',
    priceUSD: 1200,
    image: '/images/laptop.jpg',
    stock: 10
  },
  {
    id: '2',
    name: 'Wireless Headphones',
    description: 'Premium noise-cancelling wireless headphones',
    price: 0.006,
    currency: 'BTC',
    priceUSD: 299,
    image: '/images/headphones.jpg',
    stock: 25
  },
  {
    id: '3',
    name: 'Smart Watch',
    description: 'Fitness tracking smart watch with heart rate monitor',
    price: 0.004,
    currency: 'BTC',
    priceUSD: 199,
    image: '/images/watch.jpg',
    stock: 15
  },
  {
    id: '4',
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical gaming keyboard with custom switches',
    price: 0.003,
    currency: 'BTC',
    priceUSD: 149,
    image: '/images/keyboard.jpg',
    stock: 30
  },
  {
    id: '5',
    name: '4K Monitor',
    description: '27-inch 4K UHD monitor with HDR support',
    price: 0.01,
    currency: 'BTC',
    priceUSD: 499,
    image: '/images/monitor.jpg',
    stock: 12
  }
];

const orders = [];
const payments = [];

// Supported cryptocurrencies
const supportedCryptos = [
  { symbol: 'BTC', name: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { symbol: 'ETH', name: 'Ethereum', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
  { symbol: 'USDT', name: 'Tether', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' }
];

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    products: products
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }
  res.json({
    success: true,
    product: product
  });
});

// Get supported cryptocurrencies
app.get('/api/cryptocurrencies', (req, res) => {
  res.json({
    success: true,
    cryptocurrencies: supportedCryptos
  });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { productId, quantity, customerEmail, cryptocurrency } = req.body;

  // Validation
  if (!productId || !quantity || !customerEmail || !cryptocurrency) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: 'Insufficient stock'
    });
  }

  const crypto = supportedCryptos.find(c => c.symbol === cryptocurrency);
  if (!crypto) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported cryptocurrency'
    });
  }

  // Create order
  const order = {
    id: uuidv4(),
    productId: product.id,
    productName: product.name,
    quantity: quantity,
    customerEmail: customerEmail,
    cryptocurrency: cryptocurrency,
    totalPrice: product.price * quantity,
    totalPriceUSD: product.priceUSD * quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
    paymentAddress: crypto.address
  };

  orders.push(order);

  res.json({
    success: true,
    order: order
  });
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }
  res.json({
    success: true,
    order: order
  });
});

// Confirm payment (simulated)
app.post('/api/payments/confirm', (req, res) => {
  const { orderId, transactionHash } = req.body;

  if (!orderId || !transactionHash) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  if (order.status === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'Order already paid'
    });
  }

  // In a real implementation, you would verify the transaction on the blockchain
  // For this demo, we'll simulate it
  const payment = {
    id: uuidv4(),
    orderId: orderId,
    transactionHash: transactionHash,
    status: 'confirmed',
    confirmedAt: new Date().toISOString()
  };

  payments.push(payment);
  order.status = 'paid';
  order.transactionHash = transactionHash;

  // Update product stock
  const product = products.find(p => p.id === order.productId);
  if (product) {
    product.stock -= order.quantity;
  }

  res.json({
    success: true,
    payment: payment,
    order: order
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Cryptocurrency Marketplace running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
