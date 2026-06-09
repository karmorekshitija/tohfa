import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Public Profile
router.get('/:shopHandle', async (req, res, next) => {
  try {
    const shopHandle = req.params.shopHandle;
    // Authenticate optionally
    const authHeader = req.headers.authorization;
    let currentUserId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET || 'secret');
        currentUserId = decoded.id;
      } catch (e) {}
    }

    const seller = await prisma.artisanProfile.findUnique({
      where: { shopHandle },
      include: { user: true }
    });

    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    let isFollowedByCurrentUser = false;
    if (currentUserId) {
      const follow = await prisma.follow.findUnique({
        where: { followerId_artisanId: { followerId: currentUserId, artisanId: seller.id } }
      });
      isFollowedByCurrentUser = !!follow;
    }

    res.json({
      success: true,
      data: {
        id: seller.id,
        shopHandle: seller.shopHandle,
        displayName: seller.displayName || seller.user.name,
        tagline: seller.tagline,
        avatarUrl: seller.coverImageUrl || seller.user.avatarUrl,
        bannerUrl: seller.bannerUrl,
        isVerified: seller.isVerified,
        craftCategory: seller.craft,
        location: seller.location,
        followerCount: seller.followerCount,
        totalReviews: seller.totalReviews,
        averageRating: seller.averageRating,
        totalCrafts: seller.totalCrafts,
        social: {
          instagram: seller.socialInstagram,
          facebook: seller.socialFacebook,
          pinterest: seller.socialPinterest
        },
        isFollowedByCurrentUser
      }
    });
  } catch (error) {
    next(error);
  }
});

// Products (Portfolio)
router.get('/:shopHandle/products', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 12;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const products = await prisma.product.findMany({
      where: { artisanId: seller.id, isPublished: true },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });
    const total = await prisma.product.count({ where: { artisanId: seller.id, isPublished: true } });

    res.json({ success: true, data: { items: products, total, page, limit } });
  } catch (error) {
    next(error);
  }
});

// Reviews
router.get('/:shopHandle/reviews', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    // Handle optional auth for hasVotedHelpful
    const authHeader = req.headers.authorization;
    let currentUserId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET || 'secret');
        currentUserId = decoded.id;
      } catch (e) {}
    }

    const reviews = await prisma.review.findMany({
      where: { artisanId: seller.id },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { name: true, avatarUrl: true } },
        product: { select: { id: true, title: true, imageUrl: true } }
      }
    });

    const total = await prisma.review.count({ where: { artisanId: seller.id } });

    // distribution
    const allReviews = await prisma.review.findMany({ where: { artisanId: seller.id }, select: { rating: true } });
    const distribution: any = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let sum = 0;
    allReviews.forEach(r => {
      distribution[r.rating.toString()]++;
      sum += r.rating;
    });
    const average = total > 0 ? sum / total : 0;

    let items = reviews.map(r => ({
      id: r.id,
      reviewer: { name: r.reviewer.name, avatarUrl: r.reviewer.avatarUrl },
      rating: r.rating,
      title: r.title,
      body: r.body,
      helpfulCount: r.helpfulCount,
      hasVotedHelpful: false,
      isVerifiedPurchase: r.isVerifiedPurchase,
      productRef: r.product ? { id: r.product.id, title: r.product.title, imageUrl: r.product.imageUrl } : null,
      createdAt: r.createdAt
    }));

    if (currentUserId && items.length > 0) {
      const helpfulVotes = await prisma.reviewHelpfulVote.findMany({
        where: { userId: currentUserId, reviewId: { in: items.map(i => i.id) } }
      });
      const votedSet = new Set(helpfulVotes.map(v => v.reviewId));
      items = items.map(i => ({ ...i, hasVotedHelpful: votedSet.has(i.id) }));
    }

    res.json({
      success: true,
      data: {
        summary: { average, total, distribution },
        items,
        total,
        page,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
});

// About (Story Blocks)
router.get('/:shopHandle/about', async (req, res, next) => {
  try {
    const seller = await prisma.artisanProfile.findUnique({
      where: { shopHandle: req.params.shopHandle },
      include: { storyBlocks: { orderBy: { sortOrder: 'asc' } } }
    });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    res.json({
      success: true,
      data: {
        bio: seller.bio,
        storyBlocks: seller.storyBlocks.map(b => ({
          id: b.id,
          blockType: b.blockType,
          sortOrder: b.sortOrder,
          title: b.title,
          content: b.content,
          icon: b.icon,
          imageUrl: b.imageUrl
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Reels
router.get('/:shopHandle/reels', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 9;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const reels = await prisma.sellerReel.findMany({
      where: { artisanId: seller.id, isPublished: true },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });
    const total = await prisma.sellerReel.count({ where: { artisanId: seller.id, isPublished: true } });

    res.json({
      success: true,
      data: {
        items: reels.map(r => ({
          id: r.id,
          title: r.title,
          thumbnailUrl: r.thumbnailUrl,
          videoUrl: r.videoUrl,
          viewCount: r.viewCount,
          likeCount: r.likeCount,
          durationSec: r.durationSec
        })),
        total, page, limit
      }
    });
  } catch (error) {
    next(error);
  }
});

// Mutations
router.post('/:shopHandle/follow', authenticateJWT, async (req, res, next) => {
  try {
    const followerId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_artisanId: { followerId, artisanId: seller.id } }
    });

    if (existingFollow) {
      return res.status(409).json({ success: false, message: 'already_following' });
    }

    await prisma.follow.create({ data: { followerId, artisanId: seller.id } });
    const updated = await prisma.artisanProfile.update({
      where: { id: seller.id },
      data: { followerCount: { increment: 1 } }
    });

    res.json({ success: true, data: { isFollowing: true, followerCount: updated.followerCount } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:shopHandle/follow', authenticateJWT, async (req, res, next) => {
  try {
    const followerId = (req as any).user.id;
    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_artisanId: { followerId, artisanId: seller.id } }
    });

    if (!existingFollow) {
      return res.status(404).json({ success: false, message: 'not_following' });
    }

    await prisma.follow.delete({ where: { id: existingFollow.id } });
    const updated = await prisma.artisanProfile.update({
      where: { id: seller.id },
      data: { followerCount: { decrement: 1 } }
    });

    res.json({ success: true, data: { isFollowing: false, followerCount: updated.followerCount } });
  } catch (error) {
    next(error);
  }
});

router.post('/:shopHandle/share', async (req, res, next) => {
  try {
    const { platform } = req.body;
    const seller = await prisma.artisanProfile.findUnique({ where: { shopHandle: req.params.shopHandle } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    let sharerId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET || 'secret');
        sharerId = decoded.id;
      } catch (e) {}
    }

    await prisma.shareEvent.create({
      data: { artisanId: seller.id, sharerId, platform }
    });

    res.json({ success: true, data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
