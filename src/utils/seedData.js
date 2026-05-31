const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const logger = require('./logger');

// Seed initial data
const seedData = async () => {
  try {
    // Check if data already exists
    const productCount = await Product.countDocuments();
    if (productCount > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    logger.info('Seeding initial data...');

    // Create categories
    const categories = await Category.create([
      { name: 'Computers', description: 'Laptops, desktops and computer accessories' },
      { name: 'Electronics', description: 'Consumer electronics and gadgets' },
      { name: 'Accessories', description: 'Tech accessories and peripherals' }
    ]);

    logger.info(`Created ${categories.length} categories`);

    // Create products
    const products = await Product.create([
      {
        name: 'Laptop Pro 15"',
        description: 'High-performance laptop with 16GB RAM and 512GB SSD',
        price: 0.025,
        currency: 'BTC',
        priceUSD: 1200,
        image: '/images/laptop.jpg',
        stock: 10,
        category: categories[0]._id
      },
      {
        name: 'Wireless Headphones',
        description: 'Premium noise-cancelling wireless headphones',
        price: 0.006,
        currency: 'BTC',
        priceUSD: 299,
        image: '/images/headphones.jpg',
        stock: 25,
        category: categories[1]._id
      },
      {
        name: 'Smart Watch',
        description: 'Fitness tracking smart watch with heart rate monitor',
        price: 0.004,
        currency: 'BTC',
        priceUSD: 199,
        image: '/images/watch.jpg',
        stock: 15,
        category: categories[1]._id
      },
      {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical gaming keyboard with custom switches',
        price: 0.003,
        currency: 'BTC',
        priceUSD: 149,
        image: '/images/keyboard.jpg',
        stock: 30,
        category: categories[2]._id
      },
      {
        name: '4K Monitor',
        description: '27-inch 4K UHD monitor with HDR support',
        price: 0.01,
        currency: 'BTC',
        priceUSD: 499,
        image: '/images/monitor.jpg',
        stock: 12,
        category: categories[0]._id
      }
    ]);

    logger.info(`Created ${products.length} products`);

    // Create admin user
    const adminExists = await User.findOne({ email: 'admin@cryptons.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@cryptons.com',
        password: 'admin123',
        role: 'admin'
      });
      logger.info('Created admin user (email: admin@cryptons.com, password: admin123)');
    }

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding data:', error);
  }
};

module.exports = seedData;
