const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getSuggestions,
  getRecommendations,
  getRelatedProducts,
  syncElasticsearch,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Static paths before '/:id' so they are not swallowed by the id route.
router.get('/', getProducts);
router.get('/suggestions', getSuggestions);
router.get('/recommendations', protect, getRecommendations);
router.post('/sync-elasticsearch', protect, authorize('admin'), syncElasticsearch);
router.get('/:id/related', getRelatedProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorize('admin'), validate(schemas.createProduct), createProduct);
router.put('/:id', protect, authorize('admin'), validate(schemas.updateProduct), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;
