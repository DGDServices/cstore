const elasticsearchService = require('../src/services/elasticsearchService');
const Product = require('../src/models/Product');

describe('Elasticsearch Service', () => {
  describe('Configuration', () => {
    it('should check if Elasticsearch is enabled', () => {
      const isEnabled = elasticsearchService.isEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should handle Elasticsearch being disabled gracefully', async () => {
      // If disabled, these operations should not throw errors
      const result = await elasticsearchService.indexProduct({
        _id: 'test-id',
        name: 'Test Product',
        description: 'Test Description',
        price: 0.001,
        priceUSD: 50,
        stock: 10,
        isActive: true,
        featured: false
      });
      
      // Should return false if not enabled
      if (!elasticsearchService.isEnabled()) {
        expect(result).toBe(false);
      }
    });
  });

  describe('Search Operations', () => {
    it('should handle search when Elasticsearch is not available', async () => {
      const results = await elasticsearchService.searchProducts({
        search: 'test',
        page: 1,
        limit: 10
      });

      // Should return null if not available
      if (!elasticsearchService.isEnabled() || !(await elasticsearchService.isAvailable())) {
        expect(results).toBeNull();
      }
    });

    it('should handle suggestions when Elasticsearch is not available', async () => {
      const suggestions = await elasticsearchService.getSuggestions('test', 5);

      // Should return empty array if not available
      if (!elasticsearchService.isEnabled() || !(await elasticsearchService.isAvailable())) {
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBe(0);
      }
    });
  });

  describe('Index Management', () => {
    it('should handle index creation gracefully', async () => {
      const result = await elasticsearchService.createProductsIndex();
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });

    it('should handle bulk indexing gracefully', async () => {
      const products = [
        {
          _id: 'test-1',
          name: 'Product 1',
          description: 'Description 1',
          price: 0.001,
          priceUSD: 50,
          stock: 10,
          isActive: true,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await elasticsearchService.bulkIndexProducts(products);
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });
  });

  describe('CRUD Operations', () => {
    it('should handle update operations gracefully', async () => {
      const result = await elasticsearchService.updateProduct('test-id', {
        name: 'Updated Product'
      });
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });

    it('should handle delete operations gracefully', async () => {
      const result = await elasticsearchService.deleteProduct('test-id');
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Sync Operations', () => {
    it('should handle sync all products gracefully', async () => {
      const result = await elasticsearchService.syncAllProducts(Product);
      
      // Should return boolean
      expect(typeof result).toBe('boolean');
    });
  });
});
