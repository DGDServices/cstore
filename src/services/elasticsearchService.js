const { Client } = require('@elastic/elasticsearch');
const logger = require('../utils/logger');

/**
 * Elasticsearch Service for advanced product search
 * Provides fuzzy search, typo tolerance, and better relevance ranking
 */

let esClient = null;
let isEnabled = false;

/**
 * Initialize Elasticsearch client
 */
function initializeClient() {
  if (esClient) {
    return esClient;
  }

  // Check if Elasticsearch is enabled
  if (process.env.ELASTICSEARCH_ENABLED !== 'true') {
    logger.info('Elasticsearch is disabled. Using MongoDB for search.');
    isEnabled = false;
    return null;
  }

  try {
    const config = {
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
    };

    // Add auth if credentials are provided
    if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
      config.auth = {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      };
    }

    esClient = new Client(config);
    isEnabled = true;
    logger.info('Elasticsearch client initialized');
    return esClient;
  } catch (error) {
    logger.error('Failed to initialize Elasticsearch client:', error.message);
    isEnabled = false;
    return null;
  }
}

/**
 * Check if Elasticsearch is enabled and available
 */
async function isAvailable() {
  if (!isEnabled || !esClient) {
    return false;
  }

  try {
    await esClient.ping();
    return true;
  } catch (error) {
    logger.warn('Elasticsearch is not available:', error.message);
    return false;
  }
}

/**
 * Create products index with appropriate mappings
 */
async function createProductsIndex() {
  const client = initializeClient();
  if (!client) return false;

  try {
    const indexExists = await client.indices.exists({ index: 'products' });
    
    if (indexExists) {
      logger.info('Products index already exists');
      return true;
    }

    await client.indices.create({
      index: 'products',
      body: {
        settings: {
          analysis: {
            analyzer: {
              product_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding']
              }
            }
          }
        },
        mappings: {
          properties: {
            name: {
              type: 'text',
              analyzer: 'product_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            description: {
              type: 'text',
              analyzer: 'product_analyzer'
            },
            category: {
              type: 'keyword'
            },
            categoryName: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            price: {
              type: 'float'
            },
            priceUSD: {
              type: 'float'
            },
            stock: {
              type: 'integer'
            },
            isActive: {
              type: 'boolean'
            },
            featured: {
              type: 'boolean'
            },
            averageRating: {
              type: 'float'
            },
            numReviews: {
              type: 'integer'
            },
            createdAt: {
              type: 'date'
            },
            updatedAt: {
              type: 'date'
            }
          }
        }
      }
    });

    logger.info('Products index created successfully');
    return true;
  } catch (error) {
    logger.error('Failed to create products index:', error.message);
    return false;
  }
}

/**
 * Index a product document
 * @param {Object} product - Product document from MongoDB
 */
async function indexProduct(product) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return false;
  }

  try {
    const doc = {
      name: product.name,
      description: product.description,
      category: product.category?.toString() || null,
      categoryName: product.category?.name || null,
      price: product.price,
      priceUSD: product.priceUSD,
      stock: product.stock,
      isActive: product.isActive,
      featured: product.featured,
      averageRating: product.averageRating || 0,
      numReviews: product.numReviews || 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    await client.index({
      index: 'products',
      id: product._id.toString(),
      document: doc,
      refresh: true
    });

    logger.debug(`Product indexed: ${product._id}`);
    return true;
  } catch (error) {
    logger.error(`Failed to index product ${product._id}:`, error.message);
    return false;
  }
}

/**
 * Update a product document
 * @param {string} productId - Product ID
 * @param {Object} updates - Fields to update
 */
async function updateProduct(productId, updates) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return false;
  }

  try {
    await client.update({
      index: 'products',
      id: productId,
      doc: updates,
      refresh: true
    });

    logger.debug(`Product updated in Elasticsearch: ${productId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to update product ${productId}:`, error.message);
    return false;
  }
}

/**
 * Delete a product document
 * @param {string} productId - Product ID
 */
async function deleteProduct(productId) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return false;
  }

  try {
    await client.delete({
      index: 'products',
      id: productId,
      refresh: true
    });

    logger.debug(`Product deleted from Elasticsearch: ${productId}`);
    return true;
  } catch (error) {
    if (error.meta?.statusCode === 404) {
      logger.debug(`Product not found in Elasticsearch: ${productId}`);
      return true;
    }
    logger.error(`Failed to delete product ${productId}:`, error.message);
    return false;
  }
}

/**
 * Search products with advanced filtering
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with pagination
 */
async function searchProducts(params) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return null;
  }

  const {
    search,
    category,
    minPrice,
    maxPrice,
    featured,
    minRating,
    sort = '-createdAt',
    page = 1,
    limit = 10
  } = params;

  try {
    const must = [];
    const filter = [];

    // Always filter for active products
    filter.push({ term: { isActive: true } });

    // Search query with fuzzy matching
    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: ['name^3', 'description', 'categoryName'],
          fuzziness: 'AUTO',
          prefix_length: 2
        }
      });
    }

    // Category filter
    if (category) {
      filter.push({ term: { category } });
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceRange = {};
      if (minPrice) priceRange.gte = Number(minPrice);
      if (maxPrice) priceRange.lte = Number(maxPrice);
      filter.push({ range: { priceUSD: priceRange } });
    }

    // Featured filter
    if (featured === 'true' || featured === true) {
      filter.push({ term: { featured: true } });
    }

    // Rating filter
    if (minRating) {
      filter.push({ 
        range: { 
          averageRating: { gte: Number(minRating) } 
        } 
      });
    }

    // Build sort array
    const sortArray = [];
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? 'desc' : 'asc';

    if (search) {
      // If searching, sort by relevance first
      sortArray.push('_score');
    }

    // Map sort field to Elasticsearch field
    const sortFieldMap = {
      createdAt: 'createdAt',
      price: 'priceUSD',
      priceUSD: 'priceUSD',
      rating: 'averageRating',
      averageRating: 'averageRating',
      name: 'name.keyword'
    };

    const esSortField = sortFieldMap[sortField] || 'createdAt';
    sortArray.push({ [esSortField]: sortOrder });

    // Calculate pagination
    const from = (page - 1) * limit;

    // Execute search
    const response = await client.search({
      index: 'products',
      body: {
        query: {
          bool: {
            must: must.length > 0 ? must : { match_all: {} },
            filter
          }
        },
        sort: sortArray,
        from,
        size: Number(limit)
      }
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'object' 
      ? response.hits.total.value 
      : response.hits.total;

    const products = hits.map(hit => ({
      _id: hit._id,
      ...hit._source,
      _score: hit._score
    }));

    return {
      products,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Elasticsearch search failed:', error.message);
    return null;
  }
}

/**
 * Get search suggestions (autocomplete)
 * @param {string} query - Search query
 * @param {number} limit - Number of suggestions to return
 * @returns {Promise<Array>} - Array of suggestions
 */
async function getSuggestions(query, limit = 5) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return [];
  }

  try {
    const response = await client.search({
      index: 'products',
      body: {
        suggest: {
          product_suggest: {
            prefix: query,
            completion: {
              field: 'name.suggest',
              size: limit,
              skip_duplicates: true
            }
          }
        }
      }
    });

    const suggestions = response.suggest.product_suggest[0].options;
    return suggestions.map(s => s.text);
  } catch (error) {
    logger.error('Failed to get suggestions:', error.message);
    return [];
  }
}

/**
 * Bulk index products (used for initial sync)
 * @param {Array} products - Array of product documents
 */
async function bulkIndexProducts(products) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    return false;
  }

  try {
    const operations = products.flatMap(product => [
      { index: { _index: 'products', _id: product._id.toString() } },
      {
        name: product.name,
        description: product.description,
        category: product.category?.toString() || null,
        categoryName: product.category?.name || null,
        price: product.price,
        priceUSD: product.priceUSD,
        stock: product.stock,
        isActive: product.isActive,
        featured: product.featured,
        averageRating: product.averageRating || 0,
        numReviews: product.numReviews || 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    ]);

    const response = await client.bulk({
      operations,
      refresh: true
    });

    if (response.errors) {
      logger.warn('Some products failed to index during bulk operation');
    } else {
      logger.info(`Successfully bulk indexed ${products.length} products`);
    }

    return !response.errors;
  } catch (error) {
    logger.error('Bulk indexing failed:', error.message);
    return false;
  }
}

/**
 * Sync all products from MongoDB to Elasticsearch
 * @param {Object} Product - Mongoose Product model
 */
async function syncAllProducts(Product) {
  const client = initializeClient();
  if (!client || !(await isAvailable())) {
    logger.warn('Cannot sync products: Elasticsearch not available');
    return false;
  }

  try {
    logger.info('Starting product sync to Elasticsearch...');

    // Create index if it doesn't exist
    await createProductsIndex();

    // Get all products from MongoDB
    const products = await Product.find({}).populate('category', 'name').lean();
    
    if (products.length === 0) {
      logger.info('No products to sync');
      return true;
    }

    // Bulk index all products
    const success = await bulkIndexProducts(products);
    
    if (success) {
      logger.info(`Successfully synced ${products.length} products to Elasticsearch`);
    }

    return success;
  } catch (error) {
    logger.error('Product sync failed:', error.message);
    return false;
  }
}

module.exports = {
  initializeClient,
  isAvailable,
  isEnabled: () => isEnabled,
  createProductsIndex,
  indexProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getSuggestions,
  bulkIndexProducts,
  syncAllProducts
};
