const Category = require('../models/Category');
const Product = require('../models/Product');
const logger = require('../utils/logger');

/**
 * Get all categories
 * GET /api/categories
 * @access Public
 */
exports.getCategories = async (req, res, next) => {
  try {
    const { isActive, sort = 'displayOrder name' } = req.query;
    
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const categories = await Category.find(query)
      .sort(sort)
      .lean();

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ 
          category: category._id,
          isActive: true 
        });
        return { ...category, productCount };
      })
    );

    res.json({
      success: true,
      count: categoriesWithCount.length,
      data: categoriesWithCount
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    next(error);
  }
};

/**
 * Get single category
 * GET /api/categories/:id
 * @access Public
 */
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get product count
    const productCount = await Product.countDocuments({ 
      category: category._id,
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        productCount
      }
    });
  } catch (error) {
    logger.error('Get category error:', error);
    next(error);
  }
};

/**
 * Get category by slug
 * GET /api/categories/slug/:slug
 * @access Public
 */
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get product count
    const productCount = await Product.countDocuments({ 
      category: category._id,
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        productCount
      }
    });
  } catch (error) {
    logger.error('Get category by slug error:', error);
    next(error);
  }
};

/**
 * Create category
 * POST /api/categories
 * @access Private (Admin)
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, image, displayOrder } = req.body;

    // Check if category name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const category = await Category.create({
      name,
      description,
      image,
      displayOrder
    });

    logger.info(`Category created: ${category._id}`);

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error('Create category error:', error);
    next(error);
  }
};

/**
 * Update category
 * PUT /api/categories/:id
 * @access Private (Admin)
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description, image, isActive, displayOrder } = req.body;

    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if name is being changed and already exists
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (isActive !== undefined) category.isActive = isActive;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;

    await category.save();

    logger.info(`Category updated: ${category._id}`);

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error('Update category error:', error);
    next(error);
  }
};

/**
 * Delete category
 * DELETE /api/categories/:id
 * @access Private (Admin)
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} product(s). Remove products first or reassign them to another category.`
      });
    }

    await category.deleteOne();

    logger.info(`Category deleted: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    next(error);
  }
};

/**
 * Get products by category
 * GET /api/categories/:id/products
 * @access Public
 */
exports.getCategoryProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 12, 
      sort = '-createdAt',
      minPrice,
      maxPrice 
    } = req.query;

    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Build query
    const query = { 
      category: id,
      isActive: true 
    };

    // Price filter
    if (minPrice || maxPrice) {
      query.priceUSD = {};
      if (minPrice) query.priceUSD.$gte = parseFloat(minPrice);
      if (maxPrice) query.priceUSD.$lte = parseFloat(maxPrice);
    }

    // Execute query with pagination
    const products = await Product.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      },
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug
      }
    });
  } catch (error) {
    logger.error('Get category products error:', error);
    next(error);
  }
};
