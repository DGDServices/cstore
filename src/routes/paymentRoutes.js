const express = require('express');
const {
  confirmPayment,
  getPaymentByOrder,
  getAllPayments,
  verifyPayment
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

router.post('/confirm', validate(schemas.confirmPayment), confirmPayment);
router.get('/order/:orderId', getPaymentByOrder);
router.get('/', protect, authorize('admin'), getAllPayments);
router.post('/:id/verify', protect, authorize('admin'), verifyPayment);

module.exports = router;
