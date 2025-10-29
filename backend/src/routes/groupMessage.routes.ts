import { Router } from 'express';
import { GroupMessageController } from '../controllers/groupMessage.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get messages for a trip
router.get('/trips/:tripId/messages', GroupMessageController.getMessages);

// Send a message (REST fallback)
router.post('/trips/:tripId/messages', GroupMessageController.sendMessage);

// Update a message
router.put('/messages/:messageId', GroupMessageController.updateMessage);

// Delete a message
router.delete('/messages/:messageId', GroupMessageController.deleteMessage);

// Get unread count
router.get('/trips/:tripId/messages/unread', GroupMessageController.getUnreadCount);

// Mark messages as read
router.post('/trips/:tripId/messages/read', GroupMessageController.markAsRead);

// Save push notification token
router.post('/push-tokens', GroupMessageController.savePushToken);

export default router;

