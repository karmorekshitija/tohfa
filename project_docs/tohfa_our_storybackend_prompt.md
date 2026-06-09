# Tohfa — "Our Story" Page: Full Backend Build + Frontend Integration Prompt

> **Context for the AI agent:** You are building the complete backend for the **Tohfa** artisanal gifting e-commerce platform, then wiring it into an existing static HTML/TailwindCSS frontend (`code.html`). The page is called **"Our Story"** and has two main sections:
> 1. **USP Banner** — brand philosophy hero section with two CTAs: "Explore Collection" and "Meet Our Artisans"
> 2. **Artisans Grid** — three artisan profile cards (Meera Devi · Textiles · Kutch, Arjun Singh · Woodwork · Jaipur, Zara · Jewellery), each with: portrait, craft tag, quote, a **Follow** button, four product thumbnail images, and a hover overlay linking to their studio
>
> The page also has: a **sticky nav** with Search, Notifications, Favourites, and Cart icons, and a **Newsletter subscribe form** at the bottom.
>
> Every interactive element in the frontend must become fully functional. "No dummy state" — if a button exists, clicking it must trigger a real API call and the UI must update accordingly.

---

## PHASE 1 — BACKEND (Build first, fully, before touching the frontend)

### Tech Stack
Use **Node.js + Express** with **PostgreSQL** (via Prisma ORM). Auth via **JWT** (access token + refresh token). Store media references as URLs (no file-upload scope for now). Expose a **RESTful JSON API**. All responses follow the envelope:
```json
{ "success": true, "data": {}, "message": "" }
```

### 1.1 — Database Schema (Prisma)

Define the following models. Include all relations, indexes, and `createdAt`/`updatedAt` timestamps on every table.

```
User
  id            UUID  PK
  email         String  UNIQUE
  passwordHash  String
  name          String
  avatarUrl     String?
  role          Enum(BUYER, ARTISAN, ADMIN)  default BUYER
  createdAt     DateTime
  updatedAt     DateTime

ArtisanProfile
  id            UUID  PK
  userId        UUID  FK → User
  bio           String
  craft         String          // e.g. "Textiles"
  location      String          // e.g. "Kutch"
  quote         String
  followerCount Int             default 0  (denormalized counter)
  isVerified    Boolean         default false
  coverImageUrl String?
  createdAt     DateTime
  updatedAt     DateTime

Follow
  id            UUID  PK
  followerId    UUID  FK → User
  artisanId     UUID  FK → ArtisanProfile
  createdAt     DateTime
  UNIQUE (followerId, artisanId)

Product
  id            UUID  PK
  artisanId     UUID  FK → ArtisanProfile
  title         String
  description   String
  price         Decimal(10,2)
  currency      String          default "INR"
  imageUrl      String
  stock         Int             default 0
  category      String
  isActive      Boolean         default true
  createdAt     DateTime
  updatedAt     DateTime

Cart
  id            UUID  PK
  userId        UUID  FK → User  UNIQUE
  createdAt     DateTime
  updatedAt     DateTime

CartItem
  id            UUID  PK
  cartId        UUID  FK → Cart
  productId     UUID  FK → Product
  quantity      Int             default 1
  UNIQUE (cartId, productId)

Wishlist
  id            UUID  PK
  userId        UUID  FK → User
  productId     UUID  FK → Product
  createdAt     DateTime
  UNIQUE (userId, productId)

Notification
  id            UUID  PK
  userId        UUID  FK → User
  type          Enum(NEW_PRODUCT, ARTISAN_UPDATE, ORDER_UPDATE, PROMO)
  title         String
  body          String
  isRead        Boolean         default false
  createdAt     DateTime

NewsletterSubscriber
  id            UUID  PK
  email         String  UNIQUE
  subscribedAt  DateTime
```

### 1.2 — API Endpoints

Implement every endpoint below. Include request body schema, auth requirement, and what happens on success/failure.

#### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Create User (role=BUYER by default). Hash password with bcrypt (12 rounds). Return `{ accessToken, refreshToken, user }`. |
| POST | `/api/auth/login` | Public | Validate credentials. Return tokens. |
| POST | `/api/auth/refresh` | Public | Accept `refreshToken` cookie or body. Return new `accessToken`. |
| POST | `/api/auth/logout` | Auth | Invalidate refresh token. |

#### Artisans (powers the "Hands Behind Tohfa" grid)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/artisans` | Public | List all artisans with `followerCount`, `craft`, `location`, `quote`, `coverImageUrl`, and their 4 latest product thumbnail `imageUrl`s (for the grid thumbnails). Support `?limit` and `?offset`. |
| GET | `/api/artisans/:id` | Public | Single artisan full profile + all products. |
| POST | `/api/artisans/:id/follow` | Auth (BUYER) | Toggle follow/unfollow. If not following → create Follow row, increment `ArtisanProfile.followerCount`. If following → delete row, decrement. Return `{ following: true/false, followerCount: N }`. Create a `Notification` for the artisan on new follow. |
| GET | `/api/artisans/:id/followers` | Public | Paginated list of followers. |

#### Products (powers the 4-thumbnail mini-grid per artisan card)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/artisans/:id/products` | Public | All products for an artisan. |
| GET | `/api/products/:id` | Public | Single product detail. |

#### Cart
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cart` | Auth | Get current user's cart with all items, product details, and total price. |
| POST | `/api/cart/items` | Auth | Add product to cart. Body: `{ productId, quantity }`. If item exists, increment quantity. |
| PATCH | `/api/cart/items/:itemId` | Auth | Update quantity. If quantity ≤ 0, remove item. |
| DELETE | `/api/cart/items/:itemId` | Auth | Remove item from cart. |
| GET | `/api/cart/count` | Auth | Return `{ count: N }` — total item count for the nav badge. |

#### Wishlist (powers the ♥ nav icon)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/wishlist` | Auth | All wishlist items with product details. |
| POST | `/api/wishlist` | Auth | Add product. Body: `{ productId }`. Idempotent. |
| DELETE | `/api/wishlist/:productId` | Auth | Remove product. |
| GET | `/api/wishlist/count` | Auth | Return `{ count: N }` for nav badge. |

#### Notifications (powers the 🔔 nav icon)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Auth | All notifications for current user, newest first. |
| PATCH | `/api/notifications/:id/read` | Auth | Mark one as read. |
| PATCH | `/api/notifications/read-all` | Auth | Mark all as read. |
| GET | `/api/notifications/unread-count` | Auth | Return `{ count: N }` for nav badge. |

#### Newsletter
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/newsletter/subscribe` | Public | Body: `{ email }`. Upsert into `NewsletterSubscriber`. Return `{ subscribed: true }`. If duplicate, return success (idempotent). |

### 1.3 — Middleware & Cross-cutting Concerns

- **`authenticateJWT`** middleware: validate `Authorization: Bearer <token>` header. Attach `req.user` on success.
- **`requireRole(role)`** middleware: check `req.user.role`.
- **Input validation** via `zod` on all request bodies. Return structured `400` errors on validation failure.
- **Error handler** middleware: catch all unhandled errors, return `{ success: false, message: "..." }` with appropriate HTTP status.
- **CORS**: allow the frontend origin (configurable via `ALLOWED_ORIGINS` env var).
- **Rate limiting**: 100 req/15 min per IP on auth routes.

### 1.4 — Seed Data

Create a seed script (`prisma/seed.ts`) that inserts:
- 3 artisan users matching the frontend's existing data:
  - **Meera Devi** — Textiles, Kutch — 4 products (indigo textile, ochre wool threads, embroidered throw pillow, backstrap loom work)
  - **Arjun Singh** — Woodwork, Jaipur — 4 products (teak wood tray, lattice carving, artisan tools set, olive wood bowl)
  - **Zara** — Jewellery, Bangalore — 4 products (silver filigree ring, jewelry tools set, brass necklace pendant, silver soldering piece)
- 1 demo buyer user: `buyer@tohfa.in` / `Test@1234`

---

## PHASE 2 — FRONTEND INTEGRATION (Wire `code.html` to the live API)

After the backend is running, make the following changes to `code.html`. Do **not** change any visual styling, layout, colors, fonts, or animations. Only add functionality.

### 2.1 — Auth State & Session

- On page load, check `localStorage` for `accessToken`.
- If not present, show a subtle **"Sign In"** link in the nav (replace the existing "Profile" nav link text with a modal trigger if no session). Do not break the layout.
- Implement a minimal modal (no external library): Sign In form (`email` + `password` → `POST /api/auth/login`) and Register form. On success, store `accessToken` and `refreshToken` in `localStorage`. Close modal and reload nav state.
- Implement a `fetchWithAuth(url, options)` helper that attaches the `Authorization` header and handles 401 by attempting a token refresh before retrying once.

### 2.2 — Nav Badges (Cart, Wishlist, Notifications)

On page load (if authenticated):
- Call `GET /api/cart/count`, `GET /api/wishlist/count`, `GET /api/notifications/unread-count` in parallel via `Promise.all`.
- Render small numeric badges on the corresponding nav icon buttons. Use a `<span>` absolutely positioned top-right of each icon, styled with `bg-brand-terracotta text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center` — matching the design system. Hide badge if count is 0.

### 2.3 — Follow Button (per artisan card)

Each artisan card has a **Follow** button. Wire it up:

1. On page load, call `GET /api/artisans` to fetch live artisan data including `followerCount` and (if authenticated) whether the current user is already following each artisan.
2. Render each artisan's `followerCount` beneath the Follow button as `"N Followers"` in `text-[10px] text-white/60`.
3. On Follow button click:
   - If not authenticated → open the Sign In modal.
   - If authenticated → call `POST /api/artisans/:id/follow`.
   - On success: toggle button text between **"Follow"** and **"Following ✓"**, update the follower count in the DOM, briefly animate the button (scale pulse: `scale-110` → `scale-100` over 200ms).
   - On error: show a small inline toast notification using the existing design tokens (forest green bg, cream text, 3s auto-dismiss).

### 2.4 — "Explore Collection" CTA Button

Currently a static button. On click:
- Navigate to `/products` (or `/?section=collection` if SPA is not set up — use whatever route makes sense for the project structure).
- For now, if no products page exists yet, open a slide-in drawer from the right side of the screen that calls `GET /api/products` (or `GET /api/artisans` with products) and renders a minimal product grid using the existing card styling. The drawer must respect the design system (cream background, forest green headings, terracotta accents).

### 2.5 — "Meet Our Artisans" CTA Button

On click: smooth-scroll to the `#artisans` section (add this `id` to the `<section>` containing the artisan grid).

### 2.6 — Artisan Card Hover Overlay (View Studio)

The hover overlay on each card says **"View Studio"**. On click:
- Call `GET /api/artisans/:id` and open a full-screen modal showing the artisan's full profile: name, craft, location, quote, all products, and a large Follow button.
- Modal should use the existing design system. Close on ESC or clicking outside.

### 2.7 — Newsletter Subscribe Form

Wire the existing `<form>` at the bottom of the page:
1. On submit: prevent default, validate email format client-side.
2. Call `POST /api/newsletter/subscribe` with `{ email }`.
3. On success: replace the form with a confirmation message: *"You're on the list. Expect slow mornings and beautiful things."* styled in `font-body-md italic text-brand-cream`.
4. On error: show inline error in `text-error text-sm`.

### 2.8 — Notification Bell

On click of the 🔔 icon in the nav:
- If authenticated: open a dropdown panel (below the icon, right-aligned) listing notifications from `GET /api/notifications`. Each item shows `title`, `body`, and relative time. Unread items have a left border in `brand-terracotta`. Clicking any item marks it read (`PATCH /api/notifications/:id/read`) and removes the unread styling.
- If not authenticated: open Sign In modal.

### 2.9 — Wishlist Heart Icon

On click of the ♥ icon:
- If authenticated: open a slide-in drawer showing wishlist items (call `GET /api/wishlist`). Each item shows product image, title, artisan name, and price.
- If not authenticated: open Sign In modal.

---

## PHASE 3 — ENVIRONMENT & DEPLOYMENT SETUP

Create the following files:

**`.env.example`**
```
DATABASE_URL=postgresql://user:password@localhost:5432/tohfa
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000
PORT=4000
```

**`README.md`** — include:
1. Prerequisites
2. `npm install` + `npx prisma migrate dev` + `npx prisma db seed`
3. `npm run dev` to start
4. List of all API endpoints with example `curl` commands
5. How to open `code.html` and point it at the local API (set `API_BASE_URL` at top of the script block)

---

## CONSTRAINTS & QUALITY REQUIREMENTS

- **Zero dummy state.** Every button click must trigger an actual API call. No `console.log("TODO")` stubs left in submitted code.
- **Optimistic UI where appropriate.** Follow button should update instantly, then confirm/revert based on API response.
- **No visual regressions.** Do not change any class names, layout, colors, or typography in `code.html` unless explicitly instructed above.
- **Error boundaries.** Every `fetch` call must have `.catch()` handling that shows user-visible feedback using the design system's `error` color (`#ba1a1a`).
- **Mobile-first.** All new UI (modals, drawers, badges, toasts) must be fully responsive.
- **Accessibility.** Modals must trap focus, have `aria-modal="true"`, and close on ESC. Buttons must have `aria-label` where icon-only.
- **Security.** Never expose `passwordHash` in any API response. Sanitize all string inputs. Use parameterized queries (Prisma handles this).

---

## REFERENCE

The frontend file is `code.html`. The design system tokens are in `DESIGN.md` (attached). The screen reference image is `screen.png` (attached) — use it to verify artisan card layout when integrating dynamic data.

Key design tokens to keep consistent in all new UI:
- Primary brand color: `#2D4A35` (Deep Forest Green)
- Accent: `#C4784A` (Earthy Terracotta)
- Surface: `#F5F0E8` (Cream)
- Text: `#3A3A3A` (Charcoal)
- Font headings: `Playfair Display`
- Font body/labels: `DM Sans`
- Button radius: `0.5rem`
- Pill/tag radius: `9999px`
