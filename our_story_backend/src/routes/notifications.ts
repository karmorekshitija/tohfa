import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: notifications, message: 'Notifications fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const count = await prisma.notification.count({
      where: { userId, isRead: false }
    });
    res.json({ success: true, data: { count }, message: 'Unread count fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, data: {}, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json({ success: true, data: {}, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
