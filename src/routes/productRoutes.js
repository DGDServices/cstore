const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', protect, authorize('admin'), validate(schemas.createProduct), createProduct);
router.put('/:id', protect, authorize('admin'), validate(schemas.updateProduct), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;
