const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorHandler');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const elasticsearchService = require('../services/elasticsearchService');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res, next) => {
  const { 
    category, 
    search, 
    minPrice, 
    maxPrice, 
    featured,
    minRating,
    sort = '-createdAt',
    page = 1,
    limit = 10 
  } = req.query;

  // Try Elasticsearch first if enabled and available
  if (elasticsearchService.isEnabled() && await elasticsearchService.isAvailable()) {
    const esResults = await elasticsearchService.searchProducts({
      search,
      category,
      minPrice,
      maxPrice,
      featured,
      minRating,
      sort,
      page,
      limit
    });

    if (esResults) {
      // Fetch full product details from MongoDB using IDs from Elasticsearch
      const productIds = esResults.products.map(p => p._id);
      const products = await Product.find({ _id: { $in: productIds } })
        .populate('category', 'name slug')
        .lean();

      // Maintain Elasticsearch order and merge scores
      const productMap = new Map(products.map(p => [p._id.toString(), p]));
      const orderedProducts = esResults.products
        .map(esProduct => {
          const product = productMap.get(esProduct._id);
          if (product) {
            product._score = esProduct._score;
            return product;
          }
          return null;
        })
        .filter(p => p !== null);

      return res.json({
        success: true,
        data: {
          products: orderedProducts,
          pagination: {
            page: esResults.page,
            limit: esResults.limit,
            total: esResults.total,
            pages: esResults.pages
          },
          searchEngine: 'elasticsearch'
        }
      });
    }
  }

  // Fallback to MongoDB text search
  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (minPrice || maxPrice) {
    query.priceUSD = {};
    if (minPrice) query.priceUSD.$gte = Number(minPrice);
    if (maxPrice) query.priceUSD.$lte = Number(maxPrice);
  }

  if (featured === 'true' || featured === true) {
    query.featured = true;
  }

  if (minRating) {
    query.averageRating = { $gte: Number(minRating) };
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const products = await Product.find(query)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const total = await Product.countDocuments(query);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      searchEngine: 'mongodb'
    }
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug');

  if (!product || !product.isActive) {
    return next(new AppError('Product not found', 404));
  }

  res.json({
    success: true,
    data: { product }
  });
});

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.create(req.body);

  logger.info(`Product created: ${product.name} by admin ${req.user.email}`);

  // Index in Elasticsearch if enabled
  if (elasticsearchService.isEnabled()) {
    await elasticsearchService.indexProduct(product);
  }

  res.status(201).json({
    success: true,
    data: { product }
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  logger.info(`Product updated: ${product.name} by admin ${req.user.email}`);

  // Update in Elasticsearch if enabled
  if (elasticsearchService.isEnabled()) {
    await elasticsearchService.updateProduct(req.params.id, {
      name: product.name,
      description: product.description,
      price: product.price,
      priceUSD: product.priceUSD,
      stock: product.stock,
      isActive: product.isActive,
      featured: product.featured,
      averageRating: product.averageRating,
      numReviews: product.numReviews,
      updatedAt: product.updatedAt
    });
  }

  res.json({
    success: true,
    data: { product }
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Soft delete - just mark as inactive
  product.isActive = false;
  await product.save();

  logger.info(`Product deleted: ${product.name} by admin ${req.user.email}`);

  // Update in Elasticsearch if enabled (mark as inactive)
  if (elasticsearchService.isEnabled()) {
    await elasticsearchService.updateProduct(req.params.id, {
      isActive: false
    });
  }

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
