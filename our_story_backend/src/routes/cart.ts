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
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId }, include: { items: { include: { product: true } } } });
    }
    const totalPrice = cart.items.reduce((sum, item) => sum + (Number(item.product.price) * item.quantity), 0);
    res.json({ success: true, data: { ...cart, totalPrice }, message: 'Cart fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/count', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true }
    });
    const count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    res.json({ success: true, data: { count }, message: 'Cart count fetched successfully' });
  } catch (error) {
    next(error);
  }
});

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().default(1)
  })
});

router.post('/items', validate(addItemSchema), async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { productId, quantity } = req.body;

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) cart = await prisma.cart.create({ data: { userId } });

    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } }
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity }
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity }
      });
    }
    res.json({ success: true, data: {}, message: 'Item added to cart' });
  } catch (error) {
    next(error);
  }
});

const updateItemSchema = z.object({
  body: z.object({
    quantity: z.number().int()
  })
});

router.patch('/items/:itemId', validate(updateItemSchema), async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: req.params.itemId } });
      res.json({ success: true, data: {}, message: 'Item removed from cart' });
    } else {
      await prisma.cartItem.update({
        where: { id: req.params.itemId },
        data: { quantity }
      });
      res.json({ success: true, data: {}, message: 'Item quantity updated' });
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/items/:itemId', async (req, res, next) => {
  try {
    await prisma.cartItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true, data: {}, message: 'Item removed from cart' });
  } catch (error) {
    next(error);
  }
});

export default router;
