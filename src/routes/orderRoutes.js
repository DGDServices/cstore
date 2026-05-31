const express = require('express');
const {
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  confirmDelivery,
  getCryptocurrencies
} = require('../controllers/orderController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

router.post('/', protect, validate(schemas.createOrder), createOrder);
router.get('/my-orders', protect, getMyOrders);
router.post('/:id/confirm-delivery', protect, confirmDelivery);
router.get('/', protect, authorize('admin'), getAllOrders);
router.get('/:id', optionalAuth, getOrder);
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

module.exports = router;
