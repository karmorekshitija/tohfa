import sys
import asyncio
from sqlalchemy.future import select
from app.core.database import SessionLocal
from app.models.user import User
from app.models.profile import SellerProfile, BuyerProfile
from app.models.category import Category
from app.models.product import Product
from app.core.security import hash_password

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def seed():
    async with SessionLocal() as session:
        # 1. Create default seller
        seller_email = "seller@tohfa.com"
        result = await session.execute(select(User).where(User.email == seller_email))
        seller = result.scalar_one_or_none()
        if not seller:
            seller = User(
                email=seller_email,
                password_hash=hash_password("password123"),
                full_name="Arjun the Artisan",
                role="seller",
                is_active=True
            )
            session.add(seller)
            await session.flush()
            print(f"Created seller user: {seller_email}")
        else:
            print("Seller user already exists.")

        # Ensure seller profile exists
        result = await session.execute(select(SellerProfile).where(SellerProfile.user_id == seller.id))
        seller_profile = result.scalar_one_or_none()
        if not seller_profile:
            seller_profile = SellerProfile(
                user_id=seller.id,
                shop_name="Tohfa Studio",
                bio="Crafting fine organic and earthen masterpieces.",
                shipping_days=3,
                instagram_handle="@tohfastudio",
                payout_method="Razorpay Bank Transfer"
            )
            session.add(seller_profile)
            await session.flush()
            print("Created seller profile.")

        # 2. Create default buyer
        buyer_email = "buyer@tohfa.com"
        result = await session.execute(select(User).where(User.email == buyer_email))
        buyer = result.scalar_one_or_none()
        if not buyer:
            buyer = User(
                email=buyer_email,
                password_hash=hash_password("password123"),
                full_name="Kavya Sharma",
                role="buyer",
                is_active=True
            )
            session.add(buyer)
            await session.flush()
            print(f"Created buyer user: {buyer_email}")
        else:
            print("Buyer user already exists.")

        # Ensure buyer profile exists
        result = await session.execute(select(BuyerProfile).where(BuyerProfile.user_id == buyer.id))
        buyer_profile = result.scalar_one_or_none()
        if not buyer_profile:
            buyer_profile = BuyerProfile(
                user_id=buyer.id,
                phone="+919876543210",
                default_address="42, Rosewood Villa, Koramangala, Bengaluru, India"
            )
            session.add(buyer_profile)
            await session.flush()
            print("Created buyer profile.")

        # Fetch categories to map products correctly
        cat_result = await session.execute(select(Category))
        categories = {cat.slug: cat.id for cat in cat_result.scalars().all()}

        # 3. Create products if they don't exist
        products_data = [
            {
                "category_slug": "pottery",
                "title": "Earthen Ceramic Matcha Bowl",
                "description": "Hand-thrown speckled clay matcha bowl with a beautiful forest green glaze. Each piece has subtle variations and fits perfectly in your hands for morning tea rituals.",
                "price_paise": 145000, # ₹1,450.00
                "stock": 12,
                "image_urls": ["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": True
            },
            {
                "category_slug": "candles",
                "title": "Scented Soy Wax Candle - Wild Lavender",
                "description": "Hand-poured 100% natural soy wax candle infused with calming organic lavender essential oils. Packaged in a reusable amber glass jar. Burn time: 45 hours.",
                "price_paise": 85000, # ₹850.00
                "stock": 25,
                "image_urls": ["https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": True
            },
            {
                "category_slug": "pottery",
                "title": "Minimalist Ribbed Flower Vase",
                "description": "Elegant ribbed ceramic vase with an off-white stoneware finish. Perfect for fresh or dried botanicals, adding a peaceful minimalist touch to any space.",
                "price_paise": 220000, # ₹2,200.00
                "stock": 8,
                "image_urls": ["https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": False
            },
            {
                "category_slug": "jewellery",
                "title": "Handcrafted Brass Leaf Earrings",
                "description": "Stunning brass earrings inspired by monstera leaves, hand-hammered by master metalsmiths. Lightweight and perfect for both casual wear and evening attire.",
                "price_paise": 125000, # ₹1,250.00
                "stock": 15,
                "image_urls": ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": True
            },
            {
                "category_slug": "journals",
                "title": "Handbound Leather Sketchbook",
                "description": "Premium top-grain leather journal with 200 pages of hand-pressed deckled edge paper. Features a wrap-around leather strap closure, perfect for sketching or travel journaling.",
                "price_paise": 310000, # ₹3,100.00
                "stock": 5,
                "image_urls": ["https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": False
            },
            {
                "category_slug": "woodwork",
                "title": "Rustic Olive Wood Serving Board",
                "description": "Carved from a single piece of organic olive wood, highlighting the dramatic grain pattern and natural live edges. Perfect for cheese, charcuterie, or artisan bread.",
                "price_paise": 280000, # ₹2,800.00
                "stock": 7,
                "image_urls": ["https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80"],
                "is_sponsored": False
            }
        ]

        for p_data in products_data:
            cat_slug = p_data["category_slug"]
            if cat_slug not in categories:
                print(f"Category {cat_slug} not found in database. Skipping product {p_data['title']}.")
                continue
            
            # Check if product already exists
            prod_check = await session.execute(
                select(Product).where(Product.title == p_data["title"])
            )
            if prod_check.scalar_one_or_none():
                print(f"Product {p_data['title']} already exists. Skipping.")
                continue

            product = Product(
                seller_id=seller.id,
                category_id=categories[cat_slug],
                title=p_data["title"],
                description=p_data["description"],
                price_paise=p_data["price_paise"],
                stock=p_data["stock"],
                image_urls=p_data["image_urls"],
                is_active=True,
                is_sponsored=p_data["is_sponsored"]
            )
            session.add(product)
            print(f"Added product: {p_data['title']}")

        await session.commit()
    print("Database seeding with users and products completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
