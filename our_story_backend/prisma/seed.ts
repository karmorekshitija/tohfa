import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient({ url: process.env.DATABASE_URL });

async function main() {
  const passwordHash = await bcrypt.hash('Test@1234', 12);

  // 1 demo buyer user
  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@tohfa.in' },
    update: {},
    create: {
      email: 'buyer@tohfa.in',
      name: 'Demo Buyer',
      passwordHash,
      role: 'BUYER',
    },
  });

  // Meera Devi
  const meeraUser = await prisma.user.upsert({
    where: { email: 'meera@tohfa.in' },
    update: {},
    create: {
      email: 'meera@tohfa.in',
      name: 'Meera Devi',
      passwordHash,
      role: 'ARTISAN',
      artisanProfile: {
        create: {
          bio: 'Master of handloom textiles with over 20 years of experience.',
          craft: 'Textiles',
          location: 'Kutch',
          quote: 'Every thread tells a story of our ancestors.',
          products: {
            create: [
              { title: 'Indigo Textile', description: 'Hand-dyed indigo textile', price: 1200, category: 'Textiles', imageUrl: '/images/indigo-textile.jpg', stock: 10 },
              { title: 'Ochre Wool Threads', description: 'Natural dyed wool threads', price: 800, category: 'Textiles', imageUrl: '/images/ochre-wool.jpg', stock: 15 },
              { title: 'Embroidered Throw Pillow', description: 'Hand-embroidered pillow', price: 1500, category: 'Textiles', imageUrl: '/images/pillow.jpg', stock: 5 },
              { title: 'Backstrap Loom Work', description: 'Traditional backstrap loom piece', price: 2500, category: 'Textiles', imageUrl: '/images/loom-work.jpg', stock: 2 }
            ]
          }
        }
      }
    }
  });

  // Arjun Singh
  const arjunUser = await prisma.user.upsert({
    where: { email: 'arjun@tohfa.in' },
    update: {},
    create: {
      email: 'arjun@tohfa.in',
      name: 'Arjun Singh',
      passwordHash,
      role: 'ARTISAN',
      artisanProfile: {
        create: {
          bio: 'Carving stories in wood for three generations.',
          craft: 'Woodwork',
          location: 'Jaipur',
          quote: 'The wood speaks, I just guide the chisel.',
          products: {
            create: [
              { title: 'Teak Wood Tray', description: 'Hand-carved teak tray', price: 1800, category: 'Woodwork', imageUrl: '/images/teak-tray.jpg', stock: 8 },
              { title: 'Lattice Carving', description: 'Intricate lattice wood carving', price: 3500, category: 'Woodwork', imageUrl: '/images/lattice.jpg', stock: 3 },
              { title: 'Artisan Tools Set', description: 'Handmade carving tools', price: 2200, category: 'Woodwork', imageUrl: '/images/tools.jpg', stock: 10 },
              { title: 'Olive Wood Bowl', description: 'Smooth olive wood bowl', price: 1400, category: 'Woodwork', imageUrl: '/images/olive-bowl.jpg', stock: 12 }
            ]
          }
        }
      }
    }
  });

  // Zara
  const zaraUser = await prisma.user.upsert({
    where: { email: 'zara@tohfa.in' },
    update: {},
    create: {
      email: 'zara@tohfa.in',
      name: 'Zara',
      passwordHash,
      role: 'ARTISAN',
      artisanProfile: {
        create: {
          bio: 'Crafting contemporary jewellery using ancient techniques.',
          craft: 'Jewellery',
          location: 'Bangalore',
          quote: 'Metal has a memory of the fire it was born in.',
          products: {
            create: [
              { title: 'Silver Filigree Ring', description: 'Delicate filigree work', price: 2800, category: 'Jewellery', imageUrl: '/images/silver-ring.jpg', stock: 5 },
              { title: 'Jewelry Tools Set', description: 'Essential tools for jewelry making', price: 4000, category: 'Jewellery', imageUrl: '/images/jewel-tools.jpg', stock: 2 },
              { title: 'Brass Necklace Pendant', description: 'Hand-hammered brass pendant', price: 1600, category: 'Jewellery', imageUrl: '/images/brass-pendant.jpg', stock: 7 },
              { title: 'Silver Soldering Piece', description: 'Custom soldering work', price: 3200, category: 'Jewellery', imageUrl: '/images/silver-soldering.jpg', stock: 4 }
            ]
          }
        }
      }
    }
  });

  // Hero Slides
  const existingSlides = await prisma.heroSlide.count();
  if (existingSlides === 0) {
    await prisma.heroSlide.createMany({
      data: [
        { imageUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=1000&auto=format&fit=crop', altText: 'Ceramics and pottery', displayOrder: 1 },
        { imageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?q=80&w=1000&auto=format&fit=crop', altText: 'Crochet handmade', displayOrder: 2 },
        { imageUrl: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=1000&auto=format&fit=crop', altText: 'Handcrafted Jewellery', displayOrder: 3 },
        { imageUrl: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?q=80&w=1000&auto=format&fit=crop', altText: 'Handmade Keychains', displayOrder: 4 },
        { imageUrl: 'https://images.unsplash.com/photo-1508264443919-15a31e1d9c1a?q=80&w=1000&auto=format&fit=crop', altText: 'Dried florals', displayOrder: 5 },
        { imageUrl: 'https://images.unsplash.com/photo-1611078512398-75c13243d6a2?q=80&w=1000&auto=format&fit=crop', altText: 'Woodcraft', displayOrder: 6 }
      ]
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
