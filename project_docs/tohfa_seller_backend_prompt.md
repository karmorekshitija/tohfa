# Tohfa – Seller Studio: Backend Build & Frontend Integration Prompt
> Hand this file to ntgravity as a single, self-contained instruction set.

---

## 0. Project Context

**Tohfa** is an artisanal e-commerce marketplace. The visual identity is "warm elevated minimalism" — earthy cream/forest-green palette, EB Garamond serif + Hanken Grotesk sans-serif, soft ambient shadows, and an editorial feel.

The frontend already exists as static HTML (Tailwind CSS). Your job is to:
1. Build a complete backend (API + database) for the **Seller Studio** feature set.
2. Connect every interactive frontend element to real data from that backend.
3. Implement all real-time state changes (follow/unfollow toggle, share counts, review helpful votes, report flags, etc.).

The three frontend pages you are wiring up are:
- **`/seller/[username]`** — Seller Public Profile (Portfolio tab, default view)
- **`/seller/[username]/about`** — Seller About / Story page
- **`/seller/[username]/reviews`** — Seller Reviews page
- **`/seller/[username]/reels`** — Seller Reels/Video tab

Additionally, the **Seller Studio** is a private dashboard accessible only to the authenticated seller who owns the shop (e.g., `/studio` or `/studio/[username]`).

---

## 1. Tech-Stack Assumptions

Use whatever stack is conventional in this project. If there is no prior backend, default to:

| Layer | Choice |
|---|---|
| Runtime | Node.js (or Python FastAPI — match existing project) |
| Database | PostgreSQL |
| Auth | JWT + refresh tokens (or existing auth system) |
| ORM | Prisma (Node) or SQLAlchemy (Python) |
| File Storage | S3-compatible (for avatar, banner, product images, reels) |
| Real-time | WebSockets or Server-Sent Events for follow counts |
| API Style | REST (with clear `/api/v1/` prefix) |

Adapt naming to whatever already exists in the codebase. The logic below is language-agnostic.

---

## 2. Database Schema

### 2.1 `users` table (extend if it already exists)
```
id              UUID        PRIMARY KEY
email           TEXT        UNIQUE NOT NULL
username        TEXT        UNIQUE NOT NULL   -- e.g. "sakshi_dubey3819"
password_hash   TEXT        NOT NULL
role            ENUM        ('buyer', 'seller', 'admin')  DEFAULT 'buyer'
avatar_url      TEXT
is_verified     BOOLEAN     DEFAULT false
created_at      TIMESTAMP   DEFAULT NOW()
updated_at      TIMESTAMP   DEFAULT NOW()
```

### 2.2 `seller_profiles` table
One row per seller. Foreign key → `users.id`.
```
id                  UUID        PRIMARY KEY
user_id             UUID        REFERENCES users(id) UNIQUE NOT NULL
display_name        TEXT        NOT NULL           -- "Sakshi Dubey"
tagline             TEXT                           -- "Curating hand-painted ceramics..."
bio                 TEXT                           -- long-form story (About page)
craft_category      TEXT                           -- "Contemporary Ceramicist"
location            TEXT
avatar_url          TEXT                           -- overrides users.avatar_url if set
banner_url          TEXT                           -- wide hero image
shop_handle         TEXT        UNIQUE NOT NULL    -- slug used in URL e.g. "sakshi_dubey3819"
is_verified         BOOLEAN     DEFAULT false
follower_count      INTEGER     DEFAULT 0          -- denormalized cache; keep in sync
total_reviews       INTEGER     DEFAULT 0          -- denormalized cache
average_rating      NUMERIC(3,2) DEFAULT 0.00      -- denormalized cache
total_crafts        INTEGER     DEFAULT 0          -- number of listed products
social_instagram    TEXT
social_facebook     TEXT
social_pinterest    TEXT
created_at          TIMESTAMP   DEFAULT NOW()
updated_at          TIMESTAMP   DEFAULT NOW()
```

### 2.3 `follows` table
```
id              UUID        PRIMARY KEY
follower_id     UUID        REFERENCES users(id)    -- the person clicking Follow
seller_id       UUID        REFERENCES seller_profiles(id)
created_at      TIMESTAMP   DEFAULT NOW()
UNIQUE(follower_id, seller_id)
```

### 2.4 `products` table
```
id              UUID        PRIMARY KEY
seller_id       UUID        REFERENCES seller_profiles(id)
title           TEXT        NOT NULL
slug            TEXT        UNIQUE NOT NULL
description     TEXT
price           NUMERIC(10,2)
currency        TEXT        DEFAULT 'INR'
category        TEXT
tags            TEXT[]
images          TEXT[]      -- array of S3 URLs
is_published    BOOLEAN     DEFAULT false
stock           INTEGER     DEFAULT 0
created_at      TIMESTAMP   DEFAULT NOW()
updated_at      TIMESTAMP   DEFAULT NOW()
```

### 2.5 `reviews` table
```
id              UUID        PRIMARY KEY
seller_id       UUID        REFERENCES seller_profiles(id)
reviewer_id     UUID        REFERENCES users(id)
product_id      UUID        REFERENCES products(id)  -- nullable (shop-level review)
rating          INTEGER     CHECK (rating BETWEEN 1 AND 5)
title           TEXT
body            TEXT
helpful_count   INTEGER     DEFAULT 0
is_reported     BOOLEAN     DEFAULT false
is_verified_purchase BOOLEAN DEFAULT false
created_at      TIMESTAMP   DEFAULT NOW()
```

### 2.6 `review_helpful_votes` table
Prevents one user voting helpful multiple times.
```
id          UUID    PRIMARY KEY
review_id   UUID    REFERENCES reviews(id)
user_id     UUID    REFERENCES users(id)
UNIQUE(review_id, user_id)
```

### 2.7 `review_reports` table
```
id          UUID    PRIMARY KEY
review_id   UUID    REFERENCES reviews(id)
reporter_id UUID    REFERENCES users(id)
reason      TEXT
created_at  TIMESTAMP DEFAULT NOW()
UNIQUE(review_id, reporter_id)
```

### 2.8 `seller_reels` table
```
id              UUID        PRIMARY KEY
seller_id       UUID        REFERENCES seller_profiles(id)
title           TEXT
description     TEXT
video_url       TEXT        NOT NULL   -- S3/CDN URL
thumbnail_url   TEXT
duration_sec    INTEGER
view_count      INTEGER     DEFAULT 0
like_count      INTEGER     DEFAULT 0
is_published    BOOLEAN     DEFAULT false
created_at      TIMESTAMP   DEFAULT NOW()
```

### 2.9 `seller_story_blocks` table
For the About page "creative cycle" and story sections:
```
id          UUID    PRIMARY KEY
seller_id   UUID    REFERENCES seller_profiles(id)
block_type  ENUM    ('paragraph', 'image', 'process_step', 'timeline_item')
sort_order  INTEGER
title       TEXT
content     TEXT
icon        TEXT    -- Material Symbol name e.g. "gesture"
image_url   TEXT
created_at  TIMESTAMP DEFAULT NOW()
```

### 2.10 `share_events` table (analytics)
```
id          UUID    PRIMARY KEY
seller_id   UUID    REFERENCES seller_profiles(id)
sharer_id   UUID    REFERENCES users(id)  -- nullable for anonymous
platform    TEXT    -- 'copy_link','whatsapp','instagram','x','facebook'
created_at  TIMESTAMP DEFAULT NOW()
```

---

## 3. API Endpoints

All routes are prefixed with `/api/v1`. Auth middleware is applied where marked `[AUTH]`. Seller-only routes check `req.user.id === seller.user_id`.

---

### 3.1 Seller Profile — Public

#### `GET /sellers/:shopHandle`
Returns full seller profile for the public profile page.

**Response:**
```json
{
  "id": "uuid",
  "shopHandle": "sakshi_dubey3819",
  "displayName": "Sakshi Dubey",
  "tagline": "Curating hand-painted ceramics...",
  "avatarUrl": "https://...",
  "bannerUrl": "https://...",
  "isVerified": true,
  "craftCategory": "Contemporary Ceramicist & Visual Storyteller",
  "location": "Jaipur, Rajasthan",
  "followerCount": 8200,
  "totalReviews": 124,
  "averageRating": 4.8,
  "totalCrafts": 42,
  "social": {
    "instagram": "https://instagram.com/sakshi",
    "facebook": null,
    "pinterest": null
  },
  "isFollowedByCurrentUser": false
}
```

The field `isFollowedByCurrentUser` is `false` for unauthenticated requests; `true`/`false` based on `follows` table for authenticated users. Achieve this by LEFT JOINing `follows` on the current user's id (passed from auth middleware or null).

---

#### `GET /sellers/:shopHandle/products`
Paginated product listing for the Portfolio tab.

**Query params:** `page`, `limit` (default 12), `category`, `sort` (`newest`|`price_asc`|`price_desc`|`popular`)

**Response:** `{ items: [...], total, page, limit }`

---

#### `GET /sellers/:shopHandle/reviews`
Paginated reviews for the Reviews tab.

**Query params:** `page`, `limit` (default 10), `rating` (filter 1–5), `search` (text search in body/title), `sort` (`newest`|`oldest`|`most_helpful`)

**Response:**
```json
{
  "summary": {
    "average": 4.8,
    "total": 1248,
    "distribution": { "5": 940, "4": 210, "3": 70, "2": 20, "1": 8 }
  },
  "items": [
    {
      "id": "uuid",
      "reviewer": { "name": "Priya M.", "avatarUrl": "..." },
      "rating": 5,
      "title": "Absolutely exquisite!",
      "body": "...",
      "helpfulCount": 14,
      "hasVotedHelpful": false,
      "isVerifiedPurchase": true,
      "productRef": { "id": "uuid", "title": "Wildflower Mug", "imageUrl": "..." },
      "createdAt": "2025-11-10T09:23:00Z"
    }
  ],
  "total": 1248,
  "page": 1,
  "limit": 10
}
```

The field `hasVotedHelpful` is `false` for unauthenticated users and computed per-user for authenticated users.

---

#### `GET /sellers/:shopHandle/about`
Returns the seller's story blocks in sorted order.

**Response:**
```json
{
  "bio": "Inspired by the raw textures of nature...",
  "storyBlocks": [
    { "id": "uuid", "blockType": "paragraph", "sortOrder": 1, "title": "Our Story: The Soul of Soil", "content": "..." },
    { "id": "uuid", "blockType": "image", "sortOrder": 2, "imageUrl": "https://..." },
    { "id": "uuid", "blockType": "process_step", "sortOrder": 3, "title": "Conceptualization", "content": "...", "icon": "gesture" }
  ]
}
```

---

#### `GET /sellers/:shopHandle/reels`
Paginated reels.

**Query params:** `page`, `limit` (default 9)

**Response:** `{ items: [{ id, title, thumbnailUrl, videoUrl, viewCount, likeCount, durationSec }], total }`

---

### 3.2 Follow / Unfollow  `[AUTH]`

#### `POST /sellers/:shopHandle/follow`
Follow a seller. Inserts a row into `follows`. Increments `seller_profiles.follower_count` (atomic: `UPDATE seller_profiles SET follower_count = follower_count + 1 WHERE id = ?`).

**Response:**
```json
{ "isFollowing": true, "followerCount": 8201 }
```

If the user already follows, return 409 with `{ "error": "already_following" }`.

---

#### `DELETE /sellers/:shopHandle/follow`
Unfollow. Deletes from `follows`. Decrements `follower_count` (floor at 0).

**Response:**
```json
{ "isFollowing": false, "followerCount": 8200 }
```

If the user wasn't following, return 404 with `{ "error": "not_following" }`.

---

### 3.3 Review Actions  `[AUTH]`

#### `POST /reviews/:reviewId/helpful`
Cast a "helpful" vote. Insert into `review_helpful_votes`. Increment `reviews.helpful_count`.

**Response:** `{ "helpfulCount": 15, "hasVoted": true }`

If already voted: 409 `{ "error": "already_voted" }`.

---

#### `DELETE /reviews/:reviewId/helpful`
Remove helpful vote. Delete from `review_helpful_votes`. Decrement `helpful_count`.

**Response:** `{ "helpfulCount": 14, "hasVoted": false }`

---

#### `POST /reviews/:reviewId/report`  `[AUTH]`
Report a review. Insert into `review_reports`.

**Request body:** `{ "reason": "spam" }`

**Response:** `{ "reported": true }`

If already reported by this user: 409 `{ "error": "already_reported" }`.

---

### 3.4 Share Tracking

#### `POST /sellers/:shopHandle/share`
Log a share event (fire-and-forget from frontend).

**Request body:** `{ "platform": "copy_link" }` (platforms: `copy_link`, `whatsapp`, `instagram`, `x`, `facebook`)

**Response:** `{ "ok": true }`

No auth required; user_id is filled if token is present, null otherwise.

---

### 3.5 Seller Studio (Private — Seller Only)  `[AUTH + SELLER ROLE]`

All routes below require the authenticated user to be the owner of the shop. Return 403 if not.

---

#### `GET /studio/profile`
Returns the seller's own full profile including private fields.

---

#### `PATCH /studio/profile`
Update seller profile.

**Request body (all fields optional):**
```json
{
  "displayName": "Sakshi Dubey",
  "tagline": "...",
  "bio": "...",
  "craftCategory": "...",
  "location": "...",
  "social": { "instagram": "...", "facebook": "...", "pinterest": "..." }
}
```

**Response:** Updated seller profile object.

---

#### `POST /studio/profile/avatar`
Upload new avatar image. Accept `multipart/form-data` with field `file`. Upload to S3, update `seller_profiles.avatar_url`.

**Response:** `{ "avatarUrl": "https://..." }`

---

#### `POST /studio/profile/banner`
Upload new banner image. Same as avatar endpoint.

**Response:** `{ "bannerUrl": "https://..." }`

---

#### `GET /studio/products`
List all the seller's own products (including unpublished drafts).

**Query params:** `page`, `limit`, `status` (`published`|`draft`|`all`)

---

#### `POST /studio/products`
Create a new product listing.

**Request body:**
```json
{
  "title": "Wildflower Mug",
  "description": "...",
  "price": 1800,
  "currency": "INR",
  "category": "Ceramics",
  "tags": ["handmade", "ceramics"],
  "stock": 5
}
```

---

#### `PATCH /studio/products/:productId`
Update product fields.

---

#### `POST /studio/products/:productId/images`
Upload product images (up to 8). Accept `multipart/form-data` with field `files[]`.

---

#### `PATCH /studio/products/:productId/publish`
Toggle publish status.

**Request body:** `{ "isPublished": true }`

---

#### `DELETE /studio/products/:productId`
Delete a product (soft delete recommended: add `deleted_at` column).

---

#### `GET /studio/analytics`
Dashboard analytics for the seller.

**Response:**
```json
{
  "followerCount": 8200,
  "followerGrowth": { "last7Days": 42, "last30Days": 180 },
  "profileViews": { "last7Days": 1200, "last30Days": 5400 },
  "totalShares": 340,
  "sharesByPlatform": { "copy_link": 120, "whatsapp": 90, "instagram": 70, "x": 40, "facebook": 20 },
  "averageRating": 4.8,
  "totalReviews": 124,
  "totalProducts": 42,
  "totalOrders": 318
}
```

---

#### `GET /studio/story-blocks`
List the seller's About page story blocks.

#### `POST /studio/story-blocks`
Add a new story block.

#### `PATCH /studio/story-blocks/:blockId`
Edit a story block.

#### `DELETE /studio/story-blocks/:blockId`
Delete a story block.

#### `POST /studio/story-blocks/reorder`
Reorder all story blocks.

**Request body:** `{ "orderedIds": ["uuid1", "uuid2", "uuid3"] }`

---

#### `GET /studio/reels`
List all the seller's reels (including unpublished).

#### `POST /studio/reels`
Upload a new reel. Accept `multipart/form-data` with fields `video` and optional `thumbnail`.

#### `PATCH /studio/reels/:reelId`
Update reel title, description, or publish status.

#### `DELETE /studio/reels/:reelId`
Delete a reel.

---

### 3.6 Authentication Endpoints (if not already built)

#### `POST /auth/register`
Create a buyer account. Body: `{ email, username, password }`.

#### `POST /auth/login`
Returns `{ accessToken, refreshToken, user }`.

#### `POST /auth/refresh`
Exchange refresh token for new access token.

#### `POST /auth/logout`
Invalidate refresh token.

#### `POST /auth/seller/register`
Upgrade or register as a seller. Body: `{ shopHandle, displayName, craftCategory }`.
Requires existing authenticated user.

---

## 4. Frontend Integration — Page by Page

### 4.1 `/seller/[shopHandle]` — Public Profile Page

**On page load:**
- Call `GET /api/v1/sellers/:shopHandle`
- Populate all static fields: `displayName`, `tagline`, `avatarUrl`, `isVerified`, `followerCount`, `totalReviews`, `averageRating`
- Set initial Follow button state from `isFollowedByCurrentUser`

**Follow Button logic (critical):**

The Follow button exists in two locations in the UI: the hero section and the sticky header (if any). Both must stay in sync.

```
Initial state (NOT following):
  button text = "Follow"
  button icon = person_add
  button class = bg-primary text-on-primary

After clicking Follow (optimistic UI):
  Immediately: button text = "Following"
  Immediately: button icon = how_to_reg (filled)
  Immediately: button class = bg-surface-container-high text-on-surface border border-outline-variant
  Immediately: follower count display = followerCount + 1

API call: POST /api/v1/sellers/:shopHandle/follow
  On success: update followerCount from response
  On error / 401 unauthenticated: revert UI, show login modal
  On 409 already_following: silently accept "Following" state

After clicking "Following" (unfollow flow):
  Show hover state: text changes to "Unfollow" with warning tint
  On click: optimistically revert to Follow state, followerCount - 1
  API call: DELETE /api/v1/sellers/:shopHandle/follow
  On error: revert to Following state
```

**Share Button logic:**

The Share button opens the share panel (modal) that is already in the HTML at `#share-modal`. Wire it up:

1. Click "Share" button → show `#share-modal` (remove `hidden`, add `flex`)
2. Each share option in the modal fires `POST /api/v1/sellers/:shopHandle/share` with the corresponding `platform` value:
   - "Copy Link" → platform: `copy_link` → also calls `navigator.clipboard.writeText(window.location.href)` → show inline "Copied!" confirmation for 2 seconds
   - "WhatsApp" → platform: `whatsapp` → opens `https://wa.me/?text=...`
   - "Instagram" → platform: `instagram` → opens profile or shows copy-link fallback
   - "X / Twitter" → platform: `x` → opens `https://x.com/intent/tweet?url=...`
   - "Facebook" → platform: `facebook` → opens Facebook share dialog
3. Click overlay or close button → hide modal

**Tab Navigation (Portfolio / Reels / Reviews / About):**

The existing JS already handles visual tab switching. Extend it to:
- On tab click, fetch the corresponding data endpoint and re-render the tab content area
- Portfolio tab: `GET /sellers/:shopHandle/products` → render product grid
- Reviews tab: `GET /sellers/:shopHandle/reviews` → render review list + summary widget
- About tab: `GET /sellers/:shopHandle/about` → render story blocks
- Reels tab: `GET /sellers/:shopHandle/reels` → render reel grid

Cache tab data in a JS Map keyed by tab name. Only re-fetch if the cache is stale (older than 60 seconds) or if explicitly invalidated.

**Stats Display:**
Bind `followerCount`, `totalReviews`, `averageRating` from API response. Format numbers: `8200` → `8.2k`, `1248` → `1,248`.

---

### 4.2 `/seller/[shopHandle]/about` — About Page

**On page load:**
- Call `GET /api/v1/sellers/:shopHandle` (for hero section — same as profile page)
- Call `GET /api/v1/sellers/:shopHandle/about` (for story blocks)
- Render the bio text into the existing `<p>` blocks under "Our Story"
- Render `process_step` blocks into the "Creative Cycle" grid

**Follow and Share buttons:** Same exact logic as §4.1 — they exist on this page too with identical behavior.

---

### 4.3 `/seller/[shopHandle]/reviews` — Reviews Page

**On page load:**
- Call `GET /api/v1/sellers/:shopHandle/reviews?page=1&limit=10`
- Render `summary.distribution` into the star-bar widget (the visual percentage bars)
- Render `summary.average` and `summary.total` into the summary card
- Render the `items` list into the review cards

**Search / Filter:**
- The search input (`#review-search`) should debounce (300ms) and call `GET /sellers/:shopHandle/reviews?search=...&page=1`
- Star filter chips (if present) → add `rating=5` etc. to query
- Load More button → call with `page=currentPage+1`, append new items to list

**"Helpful" button on each review card:**
```
Selector: button containing thumbs_up icon near "Was this helpful?"

State (not voted):
  icon = thumb_up (outline)
  text = "Helpful (14)"

On click:
  If not authenticated → show login modal, stop
  Optimistic: icon = thumb_up (filled), count +1, button disabled
  POST /api/v1/reviews/:reviewId/helpful
  On success: update count from response
  On 409: revert, show tooltip "You've already voted"
  On error: revert

State (already voted — hasVotedHelpful: true):
  Render thumb_up filled, count shown, button disabled on load
```

**"Report" button on each review card:**
```
On click:
  If not authenticated → show login modal
  Show small confirmation popover: "Report this review as inappropriate?"
  On confirm: POST /api/v1/reviews/:reviewId/report { reason: "inappropriate" }
  On success: show "Reported — thank you" toast, hide the Report button
  On 409: show "You've already reported this review"
```

---

### 4.4 Reels Tab

**On load:**
- Call `GET /api/v1/sellers/:shopHandle/reels`
- Render each reel as a card with `thumbnailUrl`, `title`, `viewCount`, `likeCount`, and play duration badge

**On reel card click:**
- Open a modal/lightbox
- Load `videoUrl` into a `<video>` element (or iframe if YouTube/Vimeo)
- Fire a view-count increment (can be done as a fire-and-forget POST or simply tracked server-side via a log)

---

## 5. Seller Studio Frontend (Private Dashboard)

The studio is a protected area. Only the seller who owns the shop can access it. A buyer visiting `/studio` should be redirected to the home page or shown a 403 screen.

### Auth Guard
On every studio page load:
1. Check for valid `accessToken` in `localStorage` / cookies
2. Call `GET /api/v1/studio/profile` — if 401, redirect to `/login`; if 403, redirect to `/`

### Studio Pages to Build

#### `/studio/dashboard`
- Render analytics card grid from `GET /api/v1/studio/analytics`
- Cards: Followers, Avg Rating, Total Reviews, Profile Views (7d), Total Shares, Products Listed

#### `/studio/profile`
- Pre-populate form from `GET /api/v1/studio/profile`
- On "Save Changes": `PATCH /api/v1/studio/profile`
- Avatar upload: file input → preview → `POST /api/v1/studio/profile/avatar` → update `<img>` src
- Banner upload: same pattern

#### `/studio/products`
- List view from `GET /api/v1/studio/products`
- "New Product" button → form → `POST /api/v1/studio/products`
- Edit icon → popover/modal → `PATCH /api/v1/studio/products/:id`
- Publish toggle → `PATCH /api/v1/studio/products/:id/publish`
- Delete → confirmation dialog → `DELETE /api/v1/studio/products/:id`
- Image upload → `POST /api/v1/studio/products/:id/images` → show image grid preview

#### `/studio/story`
- Block editor for About page content
- Drag-to-reorder → `POST /api/v1/studio/story-blocks/reorder`
- Add block → type picker → form → `POST /api/v1/studio/story-blocks`
- Edit block → inline edit → `PATCH /api/v1/studio/story-blocks/:id`
- Delete block → `DELETE /api/v1/studio/story-blocks/:id`

#### `/studio/reels`
- Grid of own reels from `GET /api/v1/studio/reels`
- Upload → file picker → progress bar → `POST /api/v1/studio/reels`
- Edit → `PATCH /api/v1/studio/reels/:id`
- Delete → `DELETE /api/v1/studio/reels/:id`

---

## 6. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Unauthenticated user clicks Follow | Show login/signup modal. After successful login, automatically re-fire the follow action. |
| Network error on any mutation | Show toast: "Something went wrong. Please try again." Roll back optimistic UI. |
| Seller visits own public profile | Replace "Follow" button with "Edit Profile" button (check `currentUser.id === seller.userId`). Hide "Share" button or show it alongside. |
| Seller not found (invalid shopHandle) | Return 404 from API. Frontend shows 404 page with "Return to Artisans" CTA. |
| Empty product list | Show empty state: "No crafts listed yet." (for buyers). For seller in studio, show "Add your first product" CTA. |
| Empty reviews | Show empty state: "No reviews yet. Reviews appear here after your first verified sale." |
| Avatar/banner upload too large | Frontend validates `file.size <= 5MB` before upload, shows inline error. |
| Concurrent follow/unfollow clicks | Disable button during in-flight API call to prevent race conditions. |

---

## 7. Security Requirements

1. **Authentication:** All studio endpoints require a valid JWT. Verify the token server-side on every request — never trust client-sent `userId` in the body.
2. **Ownership check:** On every `PATCH`/`DELETE` studio endpoint, query the DB to confirm `product.seller_id === req.user.sellerProfileId`.
3. **Rate limiting:** Apply rate limits to mutation endpoints:
   - Follow/unfollow: 10 calls/min per user
   - Share logging: 20 calls/min per IP
   - Review helpful: 30 calls/min per user
4. **Input validation:** Validate all request bodies. Reject unknown fields. Sanitize HTML in bio/story text fields.
5. **File uploads:** Validate MIME type server-side (not just extension). Allow only `image/jpeg`, `image/png`, `image/webp` for images. Allow only `video/mp4`, `video/webm` for reels. Enforce max sizes (images: 5MB, videos: 100MB).
6. **CORS:** Restrict to the Tohfa frontend domain.

---

## 8. Denormalized Counter Maintenance

The `follower_count`, `total_reviews`, `average_rating`, and `total_crafts` columns on `seller_profiles` are denormalized for read performance. Keep them in sync:

- **follower_count:** Increment on `INSERT INTO follows`, decrement on `DELETE FROM follows`. Use a DB transaction.
- **total_reviews / average_rating:** Recalculate on new review insert. Suggested: run `UPDATE seller_profiles SET total_reviews = ..., average_rating = ... WHERE id = ?` inside the same transaction as the review insert. Use a helper function.
- **total_crafts:** Increment on product publish, decrement on unpublish or delete.

Optionally, add a nightly reconciliation job that recomputes all denormalized counters from source tables, to fix any drift.

---

## 9. URL Structure Summary

```
Public routes (no auth needed):
  GET  /api/v1/sellers/:shopHandle
  GET  /api/v1/sellers/:shopHandle/products
  GET  /api/v1/sellers/:shopHandle/reviews
  GET  /api/v1/sellers/:shopHandle/about
  GET  /api/v1/sellers/:shopHandle/reels
  POST /api/v1/sellers/:shopHandle/share

Auth-required routes:
  POST   /api/v1/sellers/:shopHandle/follow
  DELETE /api/v1/sellers/:shopHandle/follow
  POST   /api/v1/reviews/:reviewId/helpful
  DELETE /api/v1/reviews/:reviewId/helpful
  POST   /api/v1/reviews/:reviewId/report

Seller Studio (auth + seller role + ownership):
  GET    /api/v1/studio/profile
  PATCH  /api/v1/studio/profile
  POST   /api/v1/studio/profile/avatar
  POST   /api/v1/studio/profile/banner
  GET    /api/v1/studio/analytics
  GET    /api/v1/studio/products
  POST   /api/v1/studio/products
  PATCH  /api/v1/studio/products/:id
  POST   /api/v1/studio/products/:id/images
  PATCH  /api/v1/studio/products/:id/publish
  DELETE /api/v1/studio/products/:id
  GET    /api/v1/studio/story-blocks
  POST   /api/v1/studio/story-blocks
  PATCH  /api/v1/studio/story-blocks/:id
  DELETE /api/v1/studio/story-blocks/:id
  POST   /api/v1/studio/story-blocks/reorder
  GET    /api/v1/studio/reels
  POST   /api/v1/studio/reels
  PATCH  /api/v1/studio/reels/:id
  DELETE /api/v1/studio/reels/:id

Auth:
  POST /api/v1/auth/register
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  POST /api/v1/auth/logout
  POST /api/v1/auth/seller/register
```

---

## 10. Design System Tokens (for any new UI you build)

Match the existing Tailwind config exactly. Key values:

```
Primary:          #061b0e  (Deep Forest Green)
On-Primary:       #ffffff
Background:       #fcf9f8  (Warm Cream)
Surface Container Low: #f6f3f2
Outline Variant:  #c3c8c1
On-Surface:       #1b1c1c  (Charcoal)
On-Surface Variant: #434843

Font Display/Headlines: EB Garamond (serif)
Font Body/Labels:        Hanken Grotesk (sans-serif)

Border radius: 0.5rem (buttons, cards), 0.75rem (containers), 9999px (avatars, pills)
Shadow: 0 4px 20px -2px rgba(107,92,76,0.08)  (warm ambient)
Container max-width: 1280px
Desktop margins: 64px
```

All new UI elements (toasts, modals, loaders) must use these exact tokens. Do not introduce new colors or fonts.

---

## 11. Acceptance Checklist

When done, every item below must work end-to-end in the browser:

- [ ] Public profile page loads with real seller data from the database
- [ ] Follow button shows correct state for authenticated and unauthenticated users
- [ ] Clicking Follow increments displayed follower count and changes button to "Following"
- [ ] Clicking "Following" (unfollow) decrements count and reverts button to "Follow"
- [ ] Unauthenticated follow click triggers login modal
- [ ] Share button opens modal; Copy Link copies URL to clipboard and shows "Copied!"
- [ ] Share events are logged to the database
- [ ] Portfolio tab loads real product cards from the database
- [ ] Reviews tab loads real reviews with correct star distribution bars
- [ ] Reviews tab search/filter calls the API with correct params
- [ ] "Helpful" button on reviews toggles correctly and updates count
- [ ] "Report" button fires the report API and confirms to the user
- [ ] About tab loads seller bio and story blocks from the database
- [ ] Reels tab loads video thumbnails from the database
- [ ] Seller Studio dashboard shows real analytics
- [ ] Seller can edit profile and changes persist after page refresh
- [ ] Seller can upload avatar/banner and new image appears immediately
- [ ] Seller can create, edit, publish, and delete a product
- [ ] Seller can add, reorder, and delete story blocks
- [ ] Studio is inaccessible to buyers (403 redirect)
- [ ] All API mutations are protected — cannot be forged by another user
