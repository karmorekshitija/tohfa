import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validate } from '../middleware/validate';

const router = Router();

const subscribeSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

router.post('/subscribe', validate(subscribeSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email }
    });
    res.json({ success: true, data: { subscribed: true }, message: 'Subscribed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
