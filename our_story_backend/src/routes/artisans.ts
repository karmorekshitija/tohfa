import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = (req as any).user?.id; // Optional, might not be authenticated

    const artisans = await prisma.artisanProfile.findMany({
      take: limit,
      skip: offset,
      include: {
        user: { select: { name: true } },
        products: {
          take: 4,
          orderBy: { createdAt: 'desc' },
          select: { id: true, imageUrl: true }
        }
      }
    });

    let data = artisans.map(a => ({ ...a }));
    if (userId) {
      // Check follows if authenticated
      const follows = await prisma.follow.findMany({
        where: { followerId: userId, artisanId: { in: artisans.map(a => a.id) } }
      });
      const followSet = new Set(follows.map(f => f.artisanId));
      data = data.map(a => ({ ...a, isFollowing: followSet.has(a.id) }));
    }

    res.json({ success: true, data, message: 'Artisans fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const artisan = await prisma.artisanProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true } }, products: true }
    });
    if (!artisan) return res.status(404).json({ success: false, message: 'Artisan not found' });
    res.json({ success: true, data: artisan, message: 'Artisan fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/follow', authenticateJWT, requireRole('BUYER'), async (req, res, next) => {
  try {
    const followerId = (req as any).user.id;
    const artisanId = req.params.id;

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_artisanId: { followerId, artisanId } }
    });

    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      const artisan = await prisma.artisanProfile.update({
        where: { id: artisanId },
        data: { followerCount: { decrement: 1 } }
      });
      res.json({ success: true, data: { following: false, followerCount: artisan.followerCount }, message: 'Unfollowed successfully' });
    } else {
      await prisma.follow.create({ data: { followerId, artisanId } });
      const artisan = await prisma.artisanProfile.update({
        where: { id: artisanId },
        data: { followerCount: { increment: 1 } }
      });
      await prisma.notification.create({
        data: {
          userId: artisan.userId,
          type: 'ARTISAN_UPDATE',
          title: 'New Follower',
          body: 'Someone started following your profile!'
        }
      });
      res.json({ success: true, data: { following: true, followerCount: artisan.followerCount }, message: 'Followed successfully' });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:id/followers', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const followers = await prisma.follow.findMany({
      where: { artisanId: req.params.id },
      take: limit,
      skip: offset,
      include: { follower: { select: { id: true, name: true, avatarUrl: true } } }
    });
    res.json({ success: true, data: followers.map(f => f.follower), message: 'Followers fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/products', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ where: { artisanId: req.params.id } });
    res.json({ success: true, data: products, message: 'Products fetched successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
