const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserRole,
  deleteUser,
  getSalesAnalytics,
  getProductAnalytics,
  getSystemHealth,
  getPendingReviews,
  getActivityLog,
  reorderProducts,
  exportProductsCSV,
  exportProductsPDF,
  exportOrdersCSV,
  exportOrdersPDF,
  exportUsersCSV,
} = require('../controllers/adminController');

// All admin routes require admin authorization
router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/activity', getActivityLog);

// User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Analytics
router.get('/analytics/sales', getSalesAnalytics);
router.get('/analytics/products', getProductAnalytics);

// Reviews Moderation
router.get('/reviews/pending', getPendingReviews);

// System
router.get('/system/health', getSystemHealth);

// Product Management
router.put('/products/reorder', reorderProducts);

// Export Routes
router.get('/products/export/csv', exportProductsCSV);
router.get('/products/export/pdf', exportProductsPDF);
router.get('/orders/export/csv', exportOrdersCSV);
router.get('/orders/export/pdf', exportOrdersPDF);
router.get('/users/export/csv', exportUsersCSV);

module.exports = router;
