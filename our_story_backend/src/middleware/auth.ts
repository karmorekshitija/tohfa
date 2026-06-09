import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secret', (err: any, user: any) => {
      if (err) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
      }
      (req as any).user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: 'Authorization header missing' });
  }
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || user.role !== role) {
      res.status(403).json({ success: false, message: 'Forbidden: Insufficient role' });
      return;
    }
    next();
  };
};
