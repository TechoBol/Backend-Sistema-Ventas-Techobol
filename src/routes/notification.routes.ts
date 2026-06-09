import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.get('/:employeeId/unread-count', notificationController.getUnreadCount);
router.get('/:employeeId', notificationController.getAll);

router.patch('/:employeeId/read-all', notificationController.markAllAsRead);
router.patch('/:employeeId/:id/read', notificationController.markAsRead);

export default router;