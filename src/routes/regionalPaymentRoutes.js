const express = require('express');
const router = express.Router();
const {
  getRegionalPaymentMethods,
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethodByCode
} = require('../controllers/regionalPaymentController');
const { protect, authorize } = require('../middleware/auth');
// Public routes
router.get('/', getRegionalPaymentMethods);
router.get('/code/:code', getPaymentMethodByCode);

// Admin routes
router.get('/all', protect, authorize('admin'), getAllPaymentMethods);
router.post('/', protect, authorize('admin'), createPaymentMethod);
router.put('/:id', protect, authorize('admin'), updatePaymentMethod);
router.delete('/:id', protect, authorize('admin'), deletePaymentMethod);

module.exports = router;
