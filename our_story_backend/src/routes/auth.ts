import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validate } from '../middleware/validate';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
  }),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || 'secret', { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

    res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, message: 'Registration successful' });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || 'secret', { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

    res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'secret', async (err: any, decoded: any) => {
      if (err) return res.status(401).json({ success: false, message: 'Invalid refresh token' });

      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
      res.json({ success: true, data: { accessToken: newAccessToken }, message: 'Token refreshed' });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticateJWT, (req, res, next) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, data: {}, message: 'Logged out successfully' });
});

export default router;
