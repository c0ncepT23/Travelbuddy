import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { MessageType } from '../types';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Send message
router.post(
  '/:id/messages',
  validate([
    param('id').isUUID().withMessage('Invalid trip ID'),
    body('content').trim().notEmpty().withMessage('Message content required'),
    body('messageType')
      .optional()
      .isIn(Object.values(MessageType))
      .withMessage('Invalid message type'),
  ]),
  ChatController.sendMessage
);

// Get messages
router.get(
  '/:id/messages',
  validate([
    param('id').isUUID().withMessage('Invalid trip ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  ChatController.getMessages
);

// Upload image
router.post(
  '/:id/upload-image',
  validate([param('id').isUUID().withMessage('Invalid trip ID')]),
  upload.single('image'),
  ChatController.uploadImage
);

export default router;

