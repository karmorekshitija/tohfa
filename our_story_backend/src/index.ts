import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/error';

// Routes
import authRoutes from './routes/auth';
import artisanRoutes from './routes/artisans';
import sellerRoutes from './routes/sellers';
import reviewRoutes from './routes/reviews';
import studioRoutes from './routes/studio';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import notificationRoutes from './routes/notifications';
import newsletterRoutes from './routes/newsletter';
import commentRoutes from './routes/comments';
import heroSlidesRoutes from './routes/hero-slides';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/artisans', artisanRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/hero-slides', heroSlidesRoutes);

// V1 Routes for Seller Studio
app.use('/api/v1/sellers', sellerRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/studio', studioRoutes);

// Error Handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
