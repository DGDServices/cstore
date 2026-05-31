const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/messagingController');

// All messaging routes require authentication
router.use(protect);

// IMPORTANT: /messages/:messageId must come BEFORE /:id routes
router.delete('/messages/:messageId', ctrl.deleteMessage);

router.get('/', ctrl.getConversations);
router.post('/', ctrl.createConversation);
router.get('/:id', ctrl.getConversation);
router.get('/:id/messages', ctrl.getMessages);
router.post('/:id/messages', ctrl.sendMessage);
router.put('/:id/read', ctrl.markAsRead);
router.put('/:id/archive', ctrl.archiveConversation);

module.exports = router;
