import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
    res.json({ success: true, data: slides, message: 'Hero slides fetched successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { imageUrl, altText, displayOrder, isActive } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }

    const slide = await prisma.heroSlide.create({
      data: {
        imageUrl,
        altText,
        displayOrder: displayOrder ?? 0,
        isActive: isActive ?? true
      }
    });

    res.status(201).json({ success: true, data: slide, message: 'Hero slide created successfully' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.heroSlide.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Hero slide deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
