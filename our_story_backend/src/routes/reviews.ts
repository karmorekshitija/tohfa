import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.post('/:reviewId/helpful', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const reviewId = req.params.reviewId;

    const existing = await prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'already_voted' });
    }

    await prisma.reviewHelpfulVote.create({ data: { reviewId, userId } });
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } }
    });

    res.json({ success: true, data: { helpfulCount: updated.helpfulCount, hasVoted: true } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:reviewId/helpful', async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const reviewId = req.params.reviewId;

    const existing = await prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'not_voted' });
    }

    await prisma.reviewHelpfulVote.delete({ where: { id: existing.id } });
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { decrement: 1 } }
    });

    res.json({ success: true, data: { helpfulCount: updated.helpfulCount, hasVoted: false } });
  } catch (error) {
    next(error);
  }
});

router.post('/:reviewId/report', async (req, res, next) => {
  try {
    const reporterId = (req as any).user.id;
    const reviewId = req.params.reviewId;
    const { reason } = req.body;

    const existing = await prisma.reviewReport.findUnique({
      where: { reviewId_reporterId: { reviewId, reporterId } }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'already_reported' });
    }

    await prisma.reviewReport.create({ data: { reviewId, reporterId, reason } });
    
    // Also mark review as reported
    await prisma.review.update({
      where: { id: reviewId },
      data: { isReported: true }
    });

    res.json({ success: true, data: { reported: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
