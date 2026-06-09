# Tohfa Our Story - Backend

## Prerequisites
- Node.js (v18+)
- PostgreSQL running locally (or remote)

## Setup
1. Run `npm install` to install dependencies.
2. Update `.env` with your `DATABASE_URL` and JWT secrets.
3. Run `npx prisma migrate dev` to create the database schema.
4. Run `npx prisma db seed` to populate the database with dummy artisans and products.

## Running
- Start development server: `npm run dev` (Ensure you add this to package.json scripts using nodemon + ts-node or run `npx ts-node src/index.ts`)
- Alternatively, you can use `npx ts-node src/index.ts` directly for now.

## API Endpoints
All endpoints are prefixed with `/api`. Note: `[Auth]` denotes routes that require a `Bearer <token>` Authorization header.

### Auth
- `POST /api/auth/register` - Register a new user
  - `curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123","name":"Test User"}'`
- `POST /api/auth/login` - Login
  - `curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123"}'`
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` [Auth] - Logout

### Artisans
- `GET /api/artisans` - List all artisans
  - `curl http://localhost:4000/api/artisans`
- `GET /api/artisans/:id` - Single artisan
- `POST /api/artisans/:id/follow` [Auth] - Follow/unfollow artisan
- `GET /api/artisans/:id/followers` - List followers
- `GET /api/artisans/:id/products` - List products for an artisan

### Products
- `GET /api/products/:id` - Get a single product

### Cart
- `GET /api/cart` [Auth] - Get cart contents
- `POST /api/cart/items` [Auth] - Add item to cart
- `PATCH /api/cart/items/:itemId` [Auth] - Update cart item quantity
- `DELETE /api/cart/items/:itemId` [Auth] - Remove item from cart
- `GET /api/cart/count` [Auth] - Get total cart item count

### Wishlist
- `GET /api/wishlist` [Auth] - Get wishlist
- `POST /api/wishlist` [Auth] - Add product to wishlist
- `DELETE /api/wishlist/:productId` [Auth] - Remove product from wishlist
- `GET /api/wishlist/count` [Auth] - Get wishlist item count

### Notifications
- `GET /api/notifications` [Auth] - List notifications
- `PATCH /api/notifications/:id/read` [Auth] - Mark notification read
- `PATCH /api/notifications/read-all` [Auth] - Mark all read
- `GET /api/notifications/unread-count` [Auth] - Get unread count

### Newsletter
- `POST /api/newsletter/subscribe` - Subscribe to newsletter
  - `curl -X POST http://localhost:4000/api/newsletter/subscribe -H "Content-Type: application/json" -d '{"email":"test@test.com"}'`

## Frontend Integration
To integrate this API with your frontend:
1. Ensure your frontend runs at the URL specified in `ALLOWED_ORIGINS` (e.g. `http://localhost:3000`).
2. Point your `API_BASE_URL` in your script to `http://localhost:4000`.
3. Start the backend with `npx ts-node src/index.ts`.
