import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticateJWT);

router.get('/', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const wishlist = await prisma.wishlist.findMany({
      where: { userId },
      include: { product: { include: { artisan: { select: { user: { select: { name: true } } } } } } }
    });
    res.json({ success: true, data: wishlist, message: 'Wishlist fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/count', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const count = await prisma.wishlist.count({ where: { userId } });
    res.json({ success: true, data: { count }, message: 'Wishlist count fetched successfully' });
  } catch (error) {
    next(error);
  }
});

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().uuid()
  })
});

router.post('/', validate(addItemSchema), async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { productId } = req.body;

    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } }
    });

    if (!existing) {
      await prisma.wishlist.create({ data: { userId, productId } });
    }
    
    res.json({ success: true, data: {}, message: 'Added to wishlist' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const productId = req.params.productId;
    await prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } }
    });
    res.json({ success: true, data: {}, message: 'Removed from wishlist' });
  } catch (error) {
    next(error);
  }
});

export default router;
