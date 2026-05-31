const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateCartItem, validateUpdateCartItem } = require('../middleware/validation');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCart
} = require('../controllers/cartController');

// All cart routes require authentication
router.use(protect);

router.get('/', getCart);
router.post('/items', validateCartItem, addToCart);
router.put('/items/:productId', validateUpdateCartItem, updateCartItem);
router.delete('/items/:productId', removeFromCart);
router.delete('/', clearCart);
router.post('/validate', validateCart);

module.exports = router;
