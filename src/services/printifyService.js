const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Printify API Service
 * Handles all interactions with Printify API for print-on-demand products
 */
class PrintifyService {
  constructor() {
    this.apiToken = process.env.PRINTIFY_API_TOKEN;
    this.shopId = process.env.PRINTIFY_SHOP_ID;
    this.enabled = process.env.PRINTIFY_ENABLED === 'true';
    this.baseURL = 'https://api.printify.com/v1';
    
    if (this.enabled && (!this.apiToken || !this.shopId)) {
      logger.warn('Printify is enabled but API token or Shop ID is missing');
      this.enabled = false;
    }
    
    if (this.enabled) {
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      // Add response interceptor for error handling
      this.client.interceptors.response.use(
        response => response,
        error => {
          logger.error('Printify API error:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            url: error.config?.url
          });
          throw error;
        }
      );
      
      logger.info('Printify service initialized');
    }
  }
  
  /**
   * Check if Printify service is enabled
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * Get shop information
   */
  async getShop() {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/shops/${this.shopId}.json`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get shop info:', error.message);
      throw error;
    }
  }
  
  /**
   * Get all products from Printify
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of products per page
   */
  async getProducts(page = 1, limit = 100) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/shops/${this.shopId}/products.json`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get products:', error.message);
      throw error;
    }
  }
  
  /**
   * Get a single product by ID
   * @param {string} productId - Printify product ID
   */
  async getProduct(productId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/shops/${this.shopId}/products/${productId}.json`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get product ${productId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create a new product in Printify
   * @param {Object} productData - Product data
   */
  async createProduct(productData) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(`/shops/${this.shopId}/products.json`, productData);
      logger.info(`Created Printify product: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create product:', error.message);
      throw error;
    }
  }
  
  /**
   * Update a product in Printify
   * @param {string} productId - Printify product ID
   * @param {Object} productData - Updated product data
   */
  async updateProduct(productId, productData) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.put(
        `/shops/${this.shopId}/products/${productId}.json`,
        productData
      );
      logger.info(`Updated Printify product: ${productId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to update product ${productId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Delete a product from Printify
   * @param {string} productId - Printify product ID
   */
  async deleteProduct(productId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      await this.client.delete(`/shops/${this.shopId}/products/${productId}.json`);
      logger.info(`Deleted Printify product: ${productId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete product ${productId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Publish a product
   * @param {string} productId - Printify product ID
   */
  async publishProduct(productId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(
        `/shops/${this.shopId}/products/${productId}/publish.json`,
        { title: true, description: true, images: true, variants: true, tags: true }
      );
      logger.info(`Published Printify product: ${productId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to publish product ${productId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get all blueprints (product templates)
   */
  async getBlueprints() {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get('/catalog/blueprints.json');
      return response.data;
    } catch (error) {
      logger.error('Failed to get blueprints:', error.message);
      throw error;
    }
  }
  
  /**
   * Get a specific blueprint
   * @param {string} blueprintId - Blueprint ID
   */
  async getBlueprint(blueprintId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/catalog/blueprints/${blueprintId}.json`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get blueprint ${blueprintId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get print providers for a blueprint
   * @param {string} blueprintId - Blueprint ID
   */
  async getPrintProviders(blueprintId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/catalog/blueprints/${blueprintId}/print_providers.json`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get print providers for blueprint ${blueprintId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get variants for a blueprint and print provider
   * @param {string} blueprintId - Blueprint ID
   * @param {string} printProviderId - Print provider ID
   */
  async getVariants(blueprintId, printProviderId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(
        `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get variants:', error.message);
      throw error;
    }
  }
  
  /**
   * Create an order in Printify
   * @param {Object} orderData - Order data
   */
  async createOrder(orderData) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(`/shops/${this.shopId}/orders.json`, orderData);
      logger.info(`Created Printify order: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create order:', error.message);
      throw error;
    }
  }
  
  /**
   * Get order details
   * @param {string} orderId - Printify order ID
   */
  async getOrder(orderId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/shops/${this.shopId}/orders/${orderId}.json`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get order ${orderId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get all orders
   * @param {number} page - Page number
   * @param {number} limit - Orders per page
   */
  async getOrders(page = 1, limit = 100) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.get(`/shops/${this.shopId}/orders.json`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get orders:', error.message);
      throw error;
    }
  }
  
  /**
   * Submit an order for production
   * @param {string} orderId - Printify order ID
   */
  async submitOrder(orderId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(
        `/shops/${this.shopId}/orders/${orderId}/send_to_production.json`
      );
      logger.info(`Submitted order to production: ${orderId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to submit order ${orderId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Cancel an order
   * @param {string} orderId - Printify order ID
   */
  async cancelOrder(orderId) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(`/shops/${this.shopId}/orders/${orderId}/cancel.json`);
      logger.info(`Cancelled order: ${orderId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Calculate shipping costs
   * @param {Object} shippingData - Shipping calculation data
   */
  async calculateShipping(shippingData) {
    if (!this.enabled) {
      throw new Error('Printify service is not enabled');
    }
    
    try {
      const response = await this.client.post(
        `/shops/${this.shopId}/orders/shipping.json`,
        shippingData
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to calculate shipping:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PrintifyService();
