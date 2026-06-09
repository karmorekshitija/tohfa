import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { artisan: { select: { id: true, user: { select: { name: true } } } } }
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product, message: 'Product fetched successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
