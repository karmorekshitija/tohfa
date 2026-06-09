import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  url: process.env.DATABASE_URL,
});
