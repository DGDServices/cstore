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
  getAllMultiSigWallets,
  getMultiSigWalletById,
  getAllMultiSigTransactions,
  getMultiSigTransactionById,
  updateMultiSigWalletStatus,
  getMultiSigStats,
  reorderProducts,
  exportProductsCSV,
  exportProductsPDF,
  exportOrdersCSV,
  exportOrdersPDF,
  exportUsersCSV
} = require('../controllers/adminController');
const {
  getPodStats,
  getAdminPodProducts,
  updatePodProduct,
  deletePodProduct,
  getAdminPodOrders,
  getAdminPodOrder,
  syncSingleProduct,
  publishProduct,
  getBlueprints,
  getPrintProviders
} = require('../controllers/adminPodController');

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

// Multi-sig Wallet Management
router.get('/multi-sig/stats', getMultiSigStats);
router.get('/multi-sig/wallets', getAllMultiSigWallets);
router.get('/multi-sig/wallets/:id', getMultiSigWalletById);
router.put('/multi-sig/wallets/:id/status', updateMultiSigWalletStatus);
router.get('/multi-sig/transactions', getAllMultiSigTransactions);
router.get('/multi-sig/transactions/:id', getMultiSigTransactionById);

// Product Management
router.put('/products/reorder', reorderProducts);

// Export Routes
router.get('/products/export/csv', exportProductsCSV);
router.get('/products/export/pdf', exportProductsPDF);
router.get('/orders/export/csv', exportOrdersCSV);
router.get('/orders/export/pdf', exportOrdersPDF);
router.get('/users/export/csv', exportUsersCSV);

// POD (Print-on-Demand) Management
router.get('/pod/stats', getPodStats);
router.get('/pod/products', getAdminPodProducts);
router.put('/pod/products/:id', updatePodProduct);
router.delete('/pod/products/:id', deletePodProduct);
router.post('/pod/products/:id/sync', syncSingleProduct);
router.post('/pod/products/:id/publish', publishProduct);
router.get('/pod/orders', getAdminPodOrders);
router.get('/pod/orders/:id', getAdminPodOrder);
router.get('/pod/catalog/blueprints', getBlueprints);
router.get('/pod/catalog/blueprints/:id/providers', getPrintProviders);

module.exports = router;
