import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('ARTISAN'));

// Profile
router.get('/profile', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({
      where: { userId },
      include: { user: true }
    });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller profile not found' });
    res.json({ success: true, data: seller });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { displayName, tagline, bio, craftCategory, location, social } = req.body;
    
    const updated = await prisma.artisanProfile.update({
      where: { userId },
      data: {
        displayName,
        tagline,
        bio,
        craft: craftCategory, // mapping craftCategory to craft
        location,
        socialInstagram: social?.instagram,
        socialFacebook: social?.facebook,
        socialPinterest: social?.pinterest
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/profile/avatar', async (req, res, next) => {
  try {
    // Mock S3 upload for now
    const userId = (req as any).user.id;
    const mockUrl = 'https://example.com/avatar.jpg';
    const updated = await prisma.artisanProfile.update({
      where: { userId },
      data: { coverImageUrl: mockUrl } // mapping avatarUrl to coverImageUrl
    });
    res.json({ success: true, data: { avatarUrl: mockUrl } });
  } catch (error) {
    next(error);
  }
});

router.post('/profile/banner', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const mockUrl = 'https://example.com/banner.jpg';
    const updated = await prisma.artisanProfile.update({
      where: { userId },
      data: { bannerUrl: mockUrl }
    });
    res.json({ success: true, data: { bannerUrl: mockUrl } });
  } catch (error) {
    next(error);
  }
});

// Analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    res.json({
      success: true,
      data: {
        followerCount: seller.followerCount,
        followerGrowth: { last7Days: 42, last30Days: 180 }, // mocked
        profileViews: { last7Days: 1200, last30Days: 5400 }, // mocked
        totalShares: await prisma.shareEvent.count({ where: { artisanId: seller.id } }),
        sharesByPlatform: { copy_link: 120, whatsapp: 90, instagram: 70, x: 40, facebook: 20 }, // mocked distribution
        averageRating: seller.averageRating,
        totalReviews: seller.totalReviews,
        totalProducts: seller.totalCrafts,
        totalOrders: 318 // mocked
      }
    });
  } catch (error) {
    next(error);
  }
});

// Products
router.get('/products', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const status = req.query.status as string;
    const where: any = { artisanId: seller.id };
    if (status === 'published') where.isPublished = true;
    if (status === 'draft') where.isPublished = false;

    const products = await prisma.product.findMany({ where });
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const { title, description, price, currency, category, tags, stock } = req.body;
    const product = await prisma.product.create({
      data: {
        artisanId: seller.id,
        title,
        description,
        price,
        currency,
        category,
        tags,
        stock
      }
    });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.patch('/products/:id/publish', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { isPublished } = req.body;
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { isPublished }
    });

    if (isPublished && !product.isPublished) {
      await prisma.artisanProfile.update({ where: { id: seller.id }, data: { totalCrafts: { increment: 1 } } });
    } else if (!isPublished && product.isPublished) {
      await prisma.artisanProfile.update({ where: { id: seller.id }, data: { totalCrafts: { decrement: 1 } } });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await prisma.product.delete({ where: { id: req.params.id } });
    if (product.isPublished) {
      await prisma.artisanProfile.update({ where: { id: seller.id }, data: { totalCrafts: { decrement: 1 } } });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

// Story Blocks
router.get('/story-blocks', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const blocks = await prisma.sellerStoryBlock.findMany({
      where: { artisanId: seller.id },
      orderBy: { sortOrder: 'asc' }
    });
    res.json({ success: true, data: blocks });
  } catch (error) {
    next(error);
  }
});

router.post('/story-blocks', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const block = await prisma.sellerStoryBlock.create({
      data: { ...req.body, artisanId: seller.id }
    });
    res.json({ success: true, data: block });
  } catch (error) {
    next(error);
  }
});

router.patch('/story-blocks/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const block = await prisma.sellerStoryBlock.findUnique({ where: { id: req.params.id } });
    if (!block || block.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const updated = await prisma.sellerStoryBlock.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/story-blocks/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const block = await prisma.sellerStoryBlock.findUnique({ where: { id: req.params.id } });
    if (!block || block.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await prisma.sellerStoryBlock.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/story-blocks/reorder', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const { orderedIds } = req.body;
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.sellerStoryBlock.updateMany({
        where: { id: orderedIds[i], artisanId: seller.id },
        data: { sortOrder: i + 1 }
      });
    }
    res.json({ success: true, data: { reordered: true } });
  } catch (error) {
    next(error);
  }
});

// Reels
router.get('/reels', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const reels = await prisma.sellerReel.findMany({ where: { artisanId: seller.id } });
    res.json({ success: true, data: reels });
  } catch (error) {
    next(error);
  }
});

router.post('/reels', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const reel = await prisma.sellerReel.create({
      data: { ...req.body, artisanId: seller.id }
    });
    res.json({ success: true, data: reel });
  } catch (error) {
    next(error);
  }
});

router.patch('/reels/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const reel = await prisma.sellerReel.findUnique({ where: { id: req.params.id } });
    if (!reel || reel.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const updated = await prisma.sellerReel.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/reels/:id', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { userId } });
    const reel = await prisma.sellerReel.findUnique({ where: { id: req.params.id } });
    if (!reel || reel.artisanId !== seller?.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await prisma.sellerReel.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
