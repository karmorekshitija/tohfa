# Tohfa — Customize Feature · Antigravity 2.0 Backend Build
# Sub-Agent Prompt File · Sequential Execution · S1–S7

> **How to use this file:**
> Feed each numbered prompt to Antigravity one at a time.
> Wait for the agent to confirm completion + tests pass before moving to the next.
> Each prompt is self-contained but references tables/modules built in prior steps.
> Stack: Node.js / Express · SQLite · Existing auth + product listing backend already in place.

---

## PROMPT 1 — Database Schema: Three New Tables

```
You are building the backend for the "Customize" feature of Tohfa,
an Indian handmade artisan marketplace. The existing backend is
Node.js/Express with SQLite. Auth (buyers + sellers), product
listings, and Razorpay payment integration already exist.

Your task: Create and migrate three new SQLite tables.
Do NOT touch any existing tables.

─────────────────────────────────────────
TABLE 1: intake_question_templates
─────────────────────────────────────────
Purpose: Stores the bot's question library — both Tohfa platform
defaults and seller-custom questions.

Columns:
  id                INTEGER PRIMARY KEY AUTOINCREMENT
  product_type_tag  TEXT NOT NULL
      -- matches the filter chip slugs: 'resin_art', 'photo_gifts',
         'frames', 'neon_signs', 'jewellery', 'hampers', 'tote_bags'
  question_text     TEXT NOT NULL
  answer_type       TEXT NOT NULL
      -- must be one of: 'free_text' | 'photo_upload' | 'single_choice'
         | 'number' | 'date_picker' | 'long_text'
  options           TEXT DEFAULT NULL
      -- JSON array of strings, only used when answer_type = 'single_choice'
      -- e.g. '["Ocean Teal","Rose Gold","Jet Black","Forest Green"]'
  is_tohfa_default  INTEGER NOT NULL DEFAULT 1
      -- 1 = platform default, 0 = seller custom question
  seller_id         INTEGER DEFAULT NULL
      -- NULL if is_tohfa_default = 1, seller's user id if custom
  display_order     INTEGER NOT NULL DEFAULT 0
  is_active         INTEGER NOT NULL DEFAULT 1
  created_at        TEXT DEFAULT (datetime('now'))

Constraints:
  - FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
  - CHECK (answer_type IN ('free_text','photo_upload','single_choice',
    'number','date_picker','long_text'))

─────────────────────────────────────────
TABLE 2: intake_responses
─────────────────────────────────────────
Purpose: Stores each buyer's answers during bot intake, linked to
their conversation.

Columns:
  id                INTEGER PRIMARY KEY AUTOINCREMENT
  conversation_id   INTEGER NOT NULL
  question_id       INTEGER NOT NULL
  question_text     TEXT NOT NULL
      -- denormalized snapshot of question at time of answer
  answer_type       TEXT NOT NULL
  answer_value      TEXT
      -- for photo_upload: stores the file URL/path as a string
      -- for single_choice: stores the selected option string
      -- for all others: plain text value
  answered_at       TEXT DEFAULT (datetime('now'))

Constraints:
  - FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE
  - FOREIGN KEY (question_id) REFERENCES intake_question_templates(id)

─────────────────────────────────────────
TABLE 3: custom_offers
─────────────────────────────────────────
Purpose: Stores the formal price offer a seller sends to a buyer
inside the chat. This is the "Offer Card" visible in Screen S6.

Columns:
  id                INTEGER PRIMARY KEY AUTOINCREMENT
  conversation_id   INTEGER NOT NULL
  seller_id         INTEGER NOT NULL
  buyer_id          INTEGER NOT NULL
  price             INTEGER NOT NULL
      -- in Indian Rupees, integer (no decimals)
  delivery_date     TEXT NOT NULL
      -- ISO date string 'YYYY-MM-DD'
  seller_notes      TEXT DEFAULT NULL
  status            TEXT NOT NULL DEFAULT 'pending'
      -- must be one of: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at        TEXT NOT NULL
      -- datetime string, always NOW + 48 hours when created
  created_at        TEXT DEFAULT (datetime('now'))
  updated_at        TEXT DEFAULT (datetime('now'))

Constraints:
  - FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  - FOREIGN KEY (seller_id) REFERENCES users(id)
  - FOREIGN KEY (buyer_id) REFERENCES users(id)
  - CHECK (status IN ('pending','accepted','declined','expired'))
  - CHECK (price > 0)

─────────────────────────────────────────
ALTER EXISTING TABLE: conversations
─────────────────────────────────────────
Add two new columns to the existing conversations table:

  ALTER TABLE conversations ADD COLUMN intake_complete INTEGER
    NOT NULL DEFAULT 0;
  ALTER TABLE conversations ADD COLUMN intake_summary TEXT
    DEFAULT NULL;
      -- stores compiled JSON: { product_type, seller_name,
         questions_and_answers: [{question, answer}], submitted_at }

─────────────────────────────────────────
SEED DATA
─────────────────────────────────────────
After creating the tables, seed intake_question_templates with the
following Tohfa platform defaults. Insert all rows in a single
seeding script/migration.

For product_type_tag = 'resin_art':
  1. "What name or text should be engraved or included?"
     answer_type: free_text, display_order: 1
  2. "Pick a colour scheme"
     answer_type: single_choice
     options: ["Ocean Teal","Rose Gold","Jet Black","Forest Green","Sunset Orange","Custom (describe below)"]
     display_order: 2
  3. "Upload a reference photo or inspiration image (optional)"
     answer_type: photo_upload, display_order: 3
  4. "Would you like a lotus engraving?"
     answer_type: single_choice, options: ["Yes","No"]
     display_order: 4
  5. "When do you need this by?"
     answer_type: date_picker, display_order: 5
  6. "Any other details for the seller?"
     answer_type: long_text, display_order: 6

For product_type_tag = 'photo_gifts':
  1. "Who is this gift for?"
     answer_type: free_text, display_order: 1
  2. "What is the occasion?"
     answer_type: single_choice
     options: ["Birthday","Anniversary","Wedding","Graduation","Just Because","Other"]
     display_order: 2
  3. "Upload your photo(s)"
     answer_type: photo_upload, display_order: 3
  4. "What text or message should appear on the gift?"
     answer_type: free_text, display_order: 4
  5. "When do you need this by?"
     answer_type: date_picker, display_order: 5
  6. "Any other details for the seller?"
     answer_type: long_text, display_order: 6

For product_type_tag = 'jewellery':
  1. "What name or initials should be included?"
     answer_type: free_text, display_order: 1
  2. "Select a metal/finish"
     answer_type: single_choice
     options: ["Gold-plated","Silver","Rose Gold","Oxidised Silver","Brass"]
     display_order: 2
  3. "Upload an inspiration image (optional)"
     answer_type: photo_upload, display_order: 3
  4. "What size do you need? (e.g. ring size, chain length)"
     answer_type: free_text, display_order: 4
  5. "When do you need this by?"
     answer_type: date_picker, display_order: 5
  6. "Any other details for the seller?"
     answer_type: long_text, display_order: 6

Apply generic defaults (free_text name, date_picker, long_text) to
remaining tags: 'frames', 'neon_signs', 'hampers', 'tote_bags'.

After seeding, run a query to confirm total row count is correct.
Print the count.
```

---

## PROMPT 2 — Customization Listing Endpoints (Screen S1 + S2)

```
The three new tables from Prompt 1 are now in place. The existing
backend has product listings, users (buyers + sellers), and auth.

Your task: Build the REST endpoints that power the Customize browse
screen (S1) and service detail page (S2).

─────────────────────────────────────────
ENDPOINT 1: GET /customizations/tags
─────────────────────────────────────────
Purpose: Returns only the product_type_tags for which at least one
active customization service has been listed by a seller. Powers
the filter chips row in Screen S1.

Logic:
  SELECT DISTINCT product_type_tag
  FROM intake_question_templates
  WHERE is_active = 1
  ORDER BY product_type_tag ASC

Response shape:
  {
    "tags": ["hampers", "jewellery", "photo_gifts", "resin_art", ...]
  }

Notes:
  - No auth required (public endpoint)
  - If zero tags exist, return { "tags": [] }

─────────────────────────────────────────
ENDPOINT 2: GET /customizations
─────────────────────────────────────────
Purpose: Returns paginated list of customization services with
seller info. Powers the service card grid in Screen S1.

Query params:
  tag        (optional) filter by product_type_tag slug
  sort       (optional) 'popular' | 'newest' | 'price_asc'
             default: 'popular'
  page       (optional) integer, default 1
  limit      (optional) integer, default 20, max 50

Logic:
  Join product listings marked as customizable with their seller's
  profile. Each returned item must include:
  - listing_id, seller_id, seller_name, seller_avatar_url
  - product_type_tag, product_name
  - base_price (integer, INR)
  - lead_time_days (integer)
  - cover_image_url
  - avg_rating (float, 1 decimal), review_count (integer)
  - is_verified_seller (boolean)

Response shape:
  {
    "total": 24,
    "page": 1,
    "limit": 20,
    "services": [ { ...fields above } ]
  }

Notes:
  - No auth required
  - If tag param given and no services exist for it, return
    { "total": 0, "page": 1, "limit": 20, "services": [] }
    (this is what powers the S8 empty state on the frontend)

─────────────────────────────────────────
ENDPOINT 3: GET /customizations/:listing_id
─────────────────────────────────────────
Purpose: Returns full detail for one service. Powers Screen S2.

Response must include:
  - All fields from Endpoint 2 for this listing
  - seller_city (string)
  - seller_bio (string)
  - gallery_images: array of image URLs (up to 10)
  - reviews: array of last 5 reviews, each with:
      { buyer_name, buyer_avatar_url, rating, review_text,
        review_image_url (nullable), created_at }
  - questions_preview: the first 3 intake questions the bot will
    ask for this product_type_tag — pulled from
    intake_question_templates WHERE product_type_tag = [tag]
    AND is_active = 1 ORDER BY display_order ASC LIMIT 3

Notes:
  - No auth required
  - Return 404 with { "error": "Service not found" } if listing_id
    does not exist

─────────────────────────────────────────
VALIDATION + ERROR HANDLING
─────────────────────────────────────────
  - Invalid sort param → default to 'popular', do not error
  - page < 1 → treat as 1
  - limit > 50 → cap at 50
  - All errors return JSON: { "error": "...", "code": "..." }

Write tests for each endpoint. At minimum:
  - GET /customizations/tags returns array
  - GET /customizations with no params returns paginated list
  - GET /customizations?tag=resin_art filters correctly
  - GET /customizations/:id returns 200 with correct shape
  - GET /customizations/999999 returns 404
```

---

## PROMPT 3 — Conversation Creation + Bot Intake Engine (Screen S3a–S3d)

```
Endpoints from Prompt 2 are working. Now build the core of the
feature: the bot intake system. This is what runs when a buyer
taps "Request Customisation" — the automated Layer 1 of the
two-layer chat system.

─────────────────────────────────────────
ENDPOINT 1: POST /conversations
─────────────────────────────────────────
Purpose: Buyer taps "Request Customisation" → creates a new
conversation and starts the bot intake flow.

Auth: Required (buyer JWT)

Request body:
  {
    "listing_id": 42,
    "product_type_tag": "resin_art"
  }

Logic:
  1. Validate buyer is authenticated and listing_id exists.
  2. Check if an OPEN conversation already exists between this
     buyer and this listing's seller for this product_type_tag.
     If yes: return that conversation_id with status 200 and
     flag "existing": true. Do not create a duplicate.
  3. Create new row in conversations table:
       seller_id (from listing), buyer_id (from JWT),
       listing_id, intake_complete = 0, intake_summary = NULL,
       status = 'intake_in_progress', created_at = NOW
  4. Load the intake questions for this product_type_tag:
       SELECT * FROM intake_question_templates
       WHERE product_type_tag = ? AND is_active = 1
       ORDER BY display_order ASC
  5. Do NOT send any messages yet — only create the conversation.
     The first bot message is fetched via a separate call (below).

Response:
  {
    "conversation_id": 17,
    "existing": false,
    "intake_complete": false,
    "question_count": 6
  }

─────────────────────────────────────────
ENDPOINT 2: GET /conversations/:id/next-question
─────────────────────────────────────────
Purpose: Called by the frontend after the conversation is created
(and after each answer is submitted). Returns the next unanswered
question, or a "done" signal when all questions are answered.
This is what drives the bot's sequential question delivery.

Auth: Required (buyer JWT — must own this conversation)

Logic:
  1. Load all intake_question_templates for this conversation's
     product_type_tag, ordered by display_order.
  2. Load all intake_responses for this conversation_id.
  3. Find the first question_id that has no matching intake_response.
  4. If found: return that question.
  5. If all questions answered AND intake_complete = 0:
       → trigger the intake completion flow (see Endpoint 4 below)
       → return { "done": true }
  6. If intake_complete = 1 already: return { "done": true }

Response when question available:
  {
    "done": false,
    "question": {
      "id": 3,
      "question_text": "Pick a colour scheme",
      "answer_type": "single_choice",
      "options": ["Ocean Teal","Rose Gold","Jet Black","Forest Green"],
      "display_order": 2,
      "is_last": false   ← true only if this is the final question
    }
  }

Response when all done:
  { "done": true }

─────────────────────────────────────────
ENDPOINT 3: POST /conversations/:id/answer
─────────────────────────────────────────
Purpose: Buyer submits an answer to the current bot question.

Auth: Required (buyer JWT — must own this conversation)

Request body:
  {
    "question_id": 3,
    "answer_value": "Ocean Teal"
  }

For photo_upload answers: accept multipart/form-data.
  Save the file to /uploads/intake/ directory.
  Store the file URL in answer_value.

Logic:
  1. Validate conversation belongs to this buyer.
  2. Validate intake_complete = 0 (reject if intake already done).
  3. Validate question_id belongs to this conversation's
     product_type_tag.
  4. Validate answer_value is not empty (except photo_upload where
     it can be skipped — check question is optional).
  5. Upsert into intake_responses:
       If a row already exists for this conversation_id +
       question_id, update it. Otherwise insert.
  6. Return the count of answered questions vs total.

Response:
  {
    "saved": true,
    "answered_count": 3,
    "total_questions": 6
  }

─────────────────────────────────────────
ENDPOINT 4: POST /conversations/:id/complete-intake
(also called internally by next-question when all answers done)
─────────────────────────────────────────
Purpose: Compiles all answers into the intake_summary JSON and
marks intake_complete = 1. This fires the bot's closing message
and notifies the seller.

Auth: Required (buyer JWT — must own this conversation)

Logic:
  1. Load all intake_responses for this conversation, joined
     with question text.
  2. Build the intake_summary JSON object:
     {
       "product_type": "resin_art",
       "listing_id": 42,
       "seller_name": "Meera's Corner",
       "submitted_at": "2024-12-12T10:30:00Z",
       "questions_and_answers": [
         {
           "question": "What name should be engraved?",
           "answer_type": "free_text",
           "answer": "Rahul"
         },
         {
           "question": "Pick a colour scheme",
           "answer_type": "single_choice",
           "answer": "Ocean Teal"
         },
         ...
       ]
     }
  3. UPDATE conversations SET
       intake_complete = 1,
       intake_summary = [JSON above],
       status = 'awaiting_seller'
     WHERE id = conversation_id
  4. Send seller notification (see Prompt 5 for notification system).
     For now, insert a row in a notifications table:
       recipient_id = seller_id,
       type = 'new_customize_request',
       conversation_id = conversation_id,
       message = 'A buyer has sent you a customization request',
       is_read = 0,
       created_at = NOW
  5. Return the compiled summary + a "bot_closing_message" string
     the frontend should display in the chat as the bot's last
     message.

Response:
  {
    "intake_complete": true,
    "conversation_status": "awaiting_seller",
    "bot_closing_message": "Your request has been sent to Meera's Corner! They'll review your details and send you a price quote. Feel free to add anything else below — they'll see it when they come online.",
    "intake_summary": { ...compiled JSON above... }
  }

─────────────────────────────────────────
VALIDATION RULES
─────────────────────────────────────────
  - A buyer can only answer questions on their own conversations
  - Once intake_complete = 1, POST /answer must return 400:
    { "error": "Intake already complete", "code": "INTAKE_DONE" }
  - photo_upload files: max 5MB, accept jpg/jpeg/png/webp only.
    Return 400 if format invalid or size exceeded.
  - date_picker answer_value must be a valid ISO date string
    (YYYY-MM-DD) and must be in the future. Return 400 if not.

Write tests covering:
  - Full happy-path: create conversation → answer all 6 questions
    one by one → confirm intake_complete flips to 1
  - Duplicate conversation prevention
  - Answering after intake_complete = 1 returns 400
  - Photo upload rejects files > 5MB
  - Past date on date_picker returns 400
```

---

## PROMPT 4 — Live Chat Layer: Messages + Conversation State (Screen S4 + S5)

```
Bot intake engine from Prompt 3 is complete. Now build the live
chat layer — Layer 2 of the two-layer system. This is the
real-time messaging between buyer and seller after intake is done.

─────────────────────────────────────────
ENDPOINT 1: GET /conversations/:id
─────────────────────────────────────────
Purpose: Load the full conversation for the chat screen. Used by
both buyer (S4/S5) and seller side.

Auth: Required (JWT — must be buyer OR seller of this conversation)

Response:
  {
    "conversation_id": 17,
    "status": "awaiting_seller",
      -- one of: 'intake_in_progress' | 'awaiting_seller' |
                 'live' | 'offer_sent' | 'completed' | 'closed'
    "intake_complete": true,
    "intake_summary": { ...the compiled JSON from Prompt 3... },
    "listing": {
      "id": 42,
      "product_name": "Personalised Resin Keychain",
      "seller_name": "Meera's Corner",
      "base_price": 180,
      "cover_image_url": "..."
    },
    "other_party": {
      "user_id": 5,
      "name": "Meera",
      "avatar_url": "...",
      "is_online": false
    },
    "active_offer": null,
      -- populated with offer object if status = 'offer_sent'
         (see Prompt 5 for offer shape)
    "messages": [ ...array of message objects, oldest first... ]
  }

Message object shape:
  {
    "id": 201,
    "sender_id": 3,
    "sender_role": "buyer",   -- 'buyer' | 'seller' | 'bot'
    "message_type": "text",   -- 'text' | 'photo' | 'system'
    "content": "Can you make the name in gold?",
    "image_url": null,
    "sent_at": "2024-12-12T11:00:00Z",
    "is_read": true
  }

─────────────────────────────────────────
ENDPOINT 2: GET /conversations/:id/intake-summary
─────────────────────────────────────────
Purpose: Returns ONLY the intake_summary JSON for a conversation.
Used to populate the pinned summary card at the top of the chat
(visible to both buyer and seller).

Auth: Required (buyer or seller of this conversation)

Response:
  {
    "intake_summary": { ...the JSON from Prompt 3 Endpoint 4... },
    "submitted_at": "2024-12-12T10:30:00Z"
  }

─────────────────────────────────────────
ENDPOINT 3: POST /conversations/:id/messages
─────────────────────────────────────────
Purpose: Send a new message in the live chat. Works for both buyer
and seller.

Auth: Required (buyer or seller of this conversation)

Request body (JSON):
  {
    "content": "Can you do the engraving in gold ink?"
  }

For photo messages: multipart/form-data with image file.
  Save to /uploads/chat/, return image_url in response.

Logic:
  1. Validate conversation exists and sender is buyer or seller.
  2. Validate conversation status is NOT 'intake_in_progress'.
     Messages in intake phase go through the answer endpoint,
     not here. Return 400 with code 'INTAKE_IN_PROGRESS' if so.
  3. If conversation status = 'awaiting_seller' and sender is
     the BUYER: allow it (buyer can leave extra messages).
  4. If conversation status = 'awaiting_seller' and sender is
     the SELLER: also update status to 'live' automatically.
     This is the moment the seller "comes online" and opens
     the chat — the conversation escalates to live.
  5. Insert into messages table:
       conversation_id, sender_id, sender_role, message_type,
       content (or image_url for photo), sent_at = NOW,
       is_read = 0
  6. Mark all previous unread messages from the OTHER party
     as is_read = 1.
  7. Create a notification for the other party:
       type = 'new_message', conversation_id, is_read = 0

Response:
  {
    "message_id": 205,
    "sent_at": "2024-12-12T11:05:00Z",
    "conversation_status": "live"
  }

─────────────────────────────────────────
ENDPOINT 4: GET /conversations (list view)
─────────────────────────────────────────
Purpose: Returns list of all conversations for the logged-in user
(buyer or seller). Used in the inbox/chat list screen.

Auth: Required

Query params:
  status   (optional) filter by conversation status
  page, limit (pagination, same defaults as Prompt 2)

Response:
  {
    "conversations": [
      {
        "conversation_id": 17,
        "status": "awaiting_seller",
        "other_party_name": "Meera's Corner",
        "other_party_avatar": "...",
        "product_name": "Personalised Resin Keychain",
        "last_message_preview": "Your request has been sent...",
        "last_message_at": "2024-12-12T10:30:00Z",
        "unread_count": 0
      }
    ]
  }

─────────────────────────────────────────
CONVERSATION STATUS TRANSITION RULES
─────────────────────────────────────────
Enforce these in code — status can only move forward, never back:

  intake_in_progress
    → awaiting_seller   (when intake_complete = 1)
    → live              (when seller sends first message OR views
                         the conversation for the first time)
    → offer_sent        (when seller creates an offer — Prompt 5)
    → completed         (when buyer accepts offer and pays)
    → closed            (manual close or 30-day inactivity)

Add a helper function: validateStatusTransition(from, to)
that throws an error if the transition is not in the list above.

─────────────────────────────────────────
TESTS
─────────────────────────────────────────
  - GET /conversations/:id returns full shape with messages array
  - Buyer can send message when status = 'awaiting_seller'
  - Seller sending first message flips status to 'live'
  - POST /messages during intake_in_progress returns 400
  - Intake summary pinned card returns correct compiled JSON
  - GET /conversations list returns correct unread_count
```

---

## PROMPT 5 — Offer Card System (Screen S6)

```
Live chat layer from Prompt 4 is working. Now build the Offer Card
system — the formal price quote a seller sends to a buyer inside
the chat. This is the "Offer Card" in Screen S6.

─────────────────────────────────────────
ENDPOINT 1: POST /conversations/:id/offer
─────────────────────────────────────────
Purpose: Seller creates and sends a price offer to the buyer.
This creates the Offer Card in the chat.

Auth: Required (seller JWT — must be seller of this conversation)

Request body:
  {
    "price": 240,
    "delivery_date": "2024-12-16",
    "seller_notes": "I'll add the lotus engraving as a bonus!"
  }

Validation:
  - price: required, integer > 0
  - delivery_date: required, ISO date (YYYY-MM-DD), must be
    at least 1 day in the future
  - seller_notes: optional, max 500 characters
  - Conversation must be in status 'live' or 'awaiting_seller'
    (seller can send offer even if they haven't chatted yet).
    Return 400 if status is 'completed', 'closed', or
    'intake_in_progress'.
  - Only ONE active offer per conversation at a time.
    If a 'pending' offer already exists for this conversation,
    return 409: { "error": "An offer is already pending",
    "code": "OFFER_PENDING" }

Logic:
  1. Insert into custom_offers:
       conversation_id, seller_id, buyer_id (from conversation),
       price, delivery_date, seller_notes,
       status = 'pending',
       expires_at = datetime('now', '+48 hours'),
       created_at = NOW
  2. Update conversations SET status = 'offer_sent'
  3. Insert a system message in the messages table:
       sender_role = 'bot',
       message_type = 'system',
       content = 'OFFER_CARD',   ← frontend uses this to render
                                     the card UI, not a text bubble
  4. Create notification for buyer:
       type = 'offer_received',
       conversation_id, offer_id,
       message = 'Meera has sent you a price offer',
       is_read = 0

Response:
  {
    "offer_id": 8,
    "status": "pending",
    "price": 240,
    "delivery_date": "2024-12-16",
    "seller_notes": "I'll add the lotus engraving as a bonus!",
    "expires_at": "2024-12-14T10:30:00Z",
    "conversation_status": "offer_sent"
  }

─────────────────────────────────────────
ENDPOINT 2: GET /conversations/:id/offer
─────────────────────────────────────────
Purpose: Returns the current (latest) offer for a conversation.
Used to render the Offer Card in the chat for both buyer and seller.

Auth: Required (buyer or seller of this conversation)

Logic:
  SELECT * FROM custom_offers
  WHERE conversation_id = ? AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1

Also check: if expires_at < NOW and status = 'pending',
  auto-update status to 'expired' before returning.

Response when offer exists:
  {
    "offer": {
      "id": 8,
      "price": 240,
      "delivery_date": "2024-12-16",
      "seller_notes": "...",
      "status": "pending",   -- or 'accepted'/'declined'/'expired'
      "expires_at": "2024-12-14T10:30:00Z",
      "hours_remaining": 36,   ← calculated on the fly
      "created_at": "2024-12-12T10:30:00Z"
    }
  }

Response when no offer:
  { "offer": null }

─────────────────────────────────────────
ENDPOINT 3: POST /conversations/:id/offer/:offer_id/respond
─────────────────────────────────────────
Purpose: Buyer accepts or declines the offer.

Auth: Required (buyer JWT — must be buyer of this conversation)

Request body:
  {
    "action": "accept"   -- or "decline"
  }

Logic for ACCEPT:
  1. Validate offer exists, belongs to this conversation,
     status = 'pending', and expires_at > NOW.
     If expired: return 400 { "error": "Offer has expired",
     "code": "OFFER_EXPIRED" }
  2. Update custom_offers SET status = 'accepted'
  3. Update conversations SET status = 'completed'
  4. Create a Razorpay order:
       amount = offer.price * 100 (Razorpay uses paise)
       currency = 'INR'
       receipt = 'TF-' + conversation_id + '-' + offer_id
       notes = { conversation_id, offer_id, buyer_id, seller_id }
  5. Insert into orders table (if it exists) or create pending
     payment record linked to conversation_id + offer_id.
  6. Notify seller:
       type = 'offer_accepted', message = 'Buyer has accepted
       your offer and initiated payment'

Response for accept:
  {
    "action": "accepted",
    "razorpay_order_id": "order_Nxxxxxxxxx",
    "amount": 24000,
    "currency": "INR",
    "key_id": "[RAZORPAY_KEY_ID from env]"
  }

Logic for DECLINE:
  1. Update custom_offers SET status = 'declined'
  2. Update conversations SET status = 'live'
     (re-opens the chat — buyer can negotiate)
  3. Notify seller:
       type = 'offer_declined', message = 'Buyer declined your
       offer. Chat is re-opened for discussion.'
  4. Add a system message to the chat:
       sender_role = 'bot', message_type = 'system',
       content = 'OFFER_DECLINED'
       (frontend uses this to render the greyed-out offer card
       state from Screen S9)

Response for decline:
  {
    "action": "declined",
    "conversation_status": "live",
    "message": "Chat re-opened. You can continue negotiating."
  }

─────────────────────────────────────────
OFFER EXPIRY BACKGROUND JOB
─────────────────────────────────────────
Create a scheduled job that runs every 15 minutes:

  SELECT id, conversation_id, buyer_id FROM custom_offers
  WHERE status = 'pending' AND expires_at < datetime('now')

For each expired offer found:
  1. UPDATE custom_offers SET status = 'expired'
  2. UPDATE conversations SET status = 'live'
     (same as decline — re-opens chat)
  3. Notify buyer:
       type = 'offer_expired',
       message = 'Your offer from [seller] has expired.
       You can ask them for a new quote.'
  4. Insert system message in conversation:
       content = 'OFFER_EXPIRED'

Use node-cron or setInterval if node-cron is unavailable.

─────────────────────────────────────────
TESTS
─────────────────────────────────────────
  - Seller can POST offer when conversation is live
  - Second offer while one is pending returns 409
  - Expired offer auto-updates to 'expired' on GET
  - Buyer accept returns valid Razorpay order shape
  - Buyer decline flips conversation back to 'live'
  - Offer with past delivery_date returns 400
  - Non-seller cannot POST offer (returns 403)
  - Non-buyer cannot respond to offer (returns 403)
```

---

## PROMPT 6 — Payment Confirmation + Order Creation (Screen S7)

```
Offer system from Prompt 5 is complete. Now build the payment
verification and order creation flow. This is what runs after
the buyer completes Razorpay payment — the "Order Confirmed"
screen (S7).

─────────────────────────────────────────
ENDPOINT 1: POST /payments/verify
─────────────────────────────────────────
Purpose: Called by the frontend after Razorpay payment completes
client-side. Verifies the signature and creates the order.

Auth: Required (buyer JWT)

Request body:
  {
    "razorpay_order_id": "order_Nxxxxxxxxx",
    "razorpay_payment_id": "pay_Nxxxxxxxxx",
    "razorpay_signature": "...",
    "conversation_id": 17,
    "offer_id": 8
  }

Logic:
  1. Verify Razorpay signature:
       expected = HMAC-SHA256(
         razorpay_order_id + "|" + razorpay_payment_id,
         RAZORPAY_KEY_SECRET
       )
       If expected !== razorpay_signature: return 400
         { "error": "Payment verification failed",
           "code": "INVALID_SIGNATURE" }

  2. Fetch the offer and conversation. Validate:
       - offer status = 'accepted'
       - conversation buyer_id = requesting user's id
       - offer has not already been used to create an order
         (check orders table for existing razorpay_order_id)

  3. Generate order code:
       format: 'TF-' + YYYYMMDD + '-' + zero-padded 4-digit
       sequential number (e.g. TF-20241212-4821)
       Store in orders table.

  4. INSERT into orders table:
       order_code, conversation_id, offer_id,
       buyer_id, seller_id,
       product_name (from listing),
       customization_summary (copy of intake_summary JSON),
       amount_paid = offer.price,
       delivery_date = offer.delivery_date,
       razorpay_order_id, razorpay_payment_id,
       status = 'in_production',
       created_at = NOW

  5. Update conversations SET status = 'completed'
  6. Update custom_offers SET status = 'accepted'
     (idempotent — may already be accepted)

  7. Notify seller:
       type = 'payment_received',
       message = 'Payment of ₹[amount] received for your
       custom [product_name] order. Order #[order_code]'

Response:
  {
    "order_code": "TF-20241212-4821",
    "product_name": "Personalised Resin Keychain",
    "seller_name": "Meera's Corner",
    "amount_paid": 240,
    "delivery_date": "2024-12-16",
    "status": "in_production",
    "customization_summary": {
      "questions_and_answers": [
        { "question": "Name to engrave", "answer": "Rahul" },
        { "question": "Colour scheme", "answer": "Ocean Teal" },
        { "question": "Lotus engraving", "answer": "Yes" }
      ]
    }
  }

─────────────────────────────────────────
ENDPOINT 2: GET /orders/:order_code
─────────────────────────────────────────
Purpose: Returns full order detail for the confirmed screen (S7)
and for the order tracking tab.

Auth: Required (buyer or seller — must own this order)

Response:
  {
    "order_code": "TF-20241212-4821",
    "product_name": "Personalised Resin Keychain",
    "seller_name": "Meera's Corner",
    "amount_paid": 240,
    "delivery_date": "2024-12-16",
    "status": "in_production",
      -- one of: 'in_production' | 'dispatched' | 'delivered'
    "tracking_url": null,
      -- populated when seller marks as dispatched
    "customization_summary": { ...intake_summary JSON... },
    "created_at": "2024-12-12T10:30:00Z",
    "timeline": [
      {
        "step": "payment_received",
        "label": "Payment received",
        "description": "Meera has been notified",
        "status": "done",    -- 'done' | 'active' | 'upcoming'
        "at": "2024-12-12T10:30:00Z"
      },
      {
        "step": "in_production",
        "label": "In production",
        "description": "Meera will start crafting your keychain",
        "status": "active",
        "at": null
      },
      {
        "step": "dispatched",
        "label": "Dispatched & delivered",
        "description": "You'll get a tracking link when shipped",
        "status": "upcoming",
        "at": null
      }
    ]
  }

─────────────────────────────────────────
ENDPOINT 3: PATCH /orders/:order_code/status
─────────────────────────────────────────
Purpose: Seller updates the order status (marks as dispatched,
provides tracking link). Only the seller who owns the order
can call this.

Auth: Required (seller JWT — must be seller of this order)

Request body:
  {
    "status": "dispatched",
    "tracking_url": "https://www.delhivery.com/track/12345"
  }

Validation:
  - status must be one of: 'in_production' | 'dispatched' |
    'delivered'
  - Status can only move forward (in_production → dispatched
    → delivered), never backwards
  - tracking_url is required when status = 'dispatched'
  - tracking_url must be a valid URL format

Logic:
  1. Update orders SET status, tracking_url, updated_at = NOW
  2. Notify buyer with appropriate message per status change.

Response:
  { "order_code": "TF-20241212-4821", "status": "dispatched" }

─────────────────────────────────────────
ORDERS TABLE SCHEMA (if not already existing)
─────────────────────────────────────────
  id                INTEGER PRIMARY KEY AUTOINCREMENT
  order_code        TEXT UNIQUE NOT NULL
  conversation_id   INTEGER NOT NULL
  offer_id          INTEGER NOT NULL
  buyer_id          INTEGER NOT NULL
  seller_id         INTEGER NOT NULL
  product_name      TEXT NOT NULL
  customization_summary TEXT
  amount_paid       INTEGER NOT NULL
  delivery_date     TEXT NOT NULL
  razorpay_order_id TEXT
  razorpay_payment_id TEXT
  status            TEXT NOT NULL DEFAULT 'in_production'
  tracking_url      TEXT DEFAULT NULL
  created_at        TEXT DEFAULT (datetime('now'))
  updated_at        TEXT DEFAULT (datetime('now'))

─────────────────────────────────────────
TESTS
─────────────────────────────────────────
  - POST /payments/verify with valid signature creates order
  - POST /payments/verify with invalid signature returns 400
  - Duplicate payment attempt (same razorpay_order_id) returns
    400 with "already processed"
  - GET /orders/:order_code returns correct timeline shape
    with 'active' step = in_production
  - Seller can PATCH status from in_production → dispatched
  - Buyer cannot PATCH order status (returns 403)
  - Status regression (dispatched → in_production) returns 400
```

---

## PROMPT 7 — Seller Question Customization + Notifications API

```
All core flow endpoints (S1–S7) are now built. This final prompt
adds two supporting systems:
  A) The seller's ability to add their own custom intake questions
  B) The notifications API used across all screens

─────────────────────────────────────────
PART A: SELLER CUSTOM QUESTIONS
─────────────────────────────────────────

ENDPOINT: GET /seller/intake-questions
Auth: Required (seller JWT)
Purpose: Returns all questions for this seller — platform defaults
for their product_type_tags + any custom questions they've added.

Response:
  {
    "questions": [
      {
        "id": 1,
        "product_type_tag": "resin_art",
        "question_text": "What name should be engraved?",
        "answer_type": "free_text",
        "is_tohfa_default": true,
        "display_order": 1,
        "is_active": true
      },
      ...custom seller questions below...
    ]
  }

ENDPOINT: POST /seller/intake-questions
Auth: Required (seller JWT)
Purpose: Seller adds a custom question to their intake flow.

Request body:
  {
    "product_type_tag": "resin_art",
    "question_text": "Should I add a glitter base coat?",
    "answer_type": "single_choice",
    "options": ["Yes please!", "No thanks"],
    "display_order": 7
  }

Validation:
  - question_text max 200 characters
  - answer_type must be valid enum
  - options required if answer_type = 'single_choice',
    must be array of 2–8 strings
  - display_order: if not provided, auto-assign as
    MAX(display_order) + 1 for this seller + product_type_tag
  - A seller can have max 5 custom questions per product_type_tag.
    Return 400 if exceeded.

Logic:
  INSERT into intake_question_templates:
    product_type_tag, question_text, answer_type, options (JSON),
    is_tohfa_default = 0, seller_id = [from JWT], display_order,
    is_active = 1

Response:
  { "question_id": 47, "created": true }

ENDPOINT: PATCH /seller/intake-questions/:question_id
Auth: Required (seller JWT — must own this question)
Purpose: Update or deactivate a custom question.

Request body (all optional):
  {
    "question_text": "Updated question text",
    "options": ["Option A", "Option B", "Option C"],
    "display_order": 4,
    "is_active": false
  }

Validation:
  - Cannot edit questions where is_tohfa_default = 1
    Return 403: { "error": "Cannot modify platform defaults" }
  - Cannot edit other sellers' questions (return 403)

Response:
  { "updated": true }

─────────────────────────────────────────
PART B: NOTIFICATIONS API
─────────────────────────────────────────
These notifications are created internally by other endpoints
(Prompts 3–6). Now expose them via API.

TABLE: notifications (create if not existing)
  id               INTEGER PRIMARY KEY AUTOINCREMENT
  recipient_id     INTEGER NOT NULL
  type             TEXT NOT NULL
    -- values used: 'new_customize_request' | 'new_message' |
       'offer_received' | 'offer_accepted' | 'offer_declined' |
       'offer_expired' | 'payment_received'
  conversation_id  INTEGER DEFAULT NULL
  offer_id         INTEGER DEFAULT NULL
  order_code       TEXT DEFAULT NULL
  message          TEXT NOT NULL
  is_read          INTEGER NOT NULL DEFAULT 0
  created_at       TEXT DEFAULT (datetime('now'))

ENDPOINT: GET /notifications
Auth: Required
Purpose: Returns unread (and recent read) notifications for the
logged-in user.

Query params:
  unread_only  (optional) boolean, default false
  limit        (optional) integer, default 20

Response:
  {
    "unread_count": 3,
    "notifications": [
      {
        "id": 12,
        "type": "offer_received",
        "message": "Meera has sent you a price offer",
        "conversation_id": 17,
        "is_read": false,
        "created_at": "2024-12-12T11:00:00Z"
      }
    ]
  }

ENDPOINT: PATCH /notifications/mark-read
Auth: Required
Purpose: Mark one or all notifications as read.

Request body:
  {
    "notification_ids": [12, 13]   -- or pass "all": true
  }

Response:
  { "marked_read": 2 }

─────────────────────────────────────────
FINAL SYSTEM CHECK
─────────────────────────────────────────
After completing Part A and Part B, run a full integration check:

1. Confirm all 7 prompt steps have their tables in place.
   Run: .tables in SQLite and print the list.

2. Confirm the full happy path is wired end-to-end:
   POST /customizations (create conversation)
   → GET /conversations/:id/next-question (6 times)
   → POST /conversations/:id/answer (6 times)
   → POST /conversations/:id/complete-intake
   → POST /conversations/:id/messages (seller replies)
   → POST /conversations/:id/offer
   → POST /conversations/:id/offer/:id/respond { action: accept }
   → POST /payments/verify
   → GET /orders/:order_code
   Print "FULL FLOW OK" if all steps return expected status codes.

3. Print a summary table of all endpoints created across all
   7 prompts in this format:
   METHOD | PATH | PURPOSE | AUTH REQUIRED
```

---

## Reference: Conversation Status State Machine

```
intake_in_progress
  ↓ (all questions answered)
awaiting_seller
  ↓ (seller sends message or views chat)
live
  ↓ (seller sends offer)
offer_sent
  ↓ (buyer accepts + pays)
completed
  ↓ (or: 30 days inactivity / manual)
closed

Side transitions:
  offer_sent → live  (if offer is declined OR expires)
  Any status → closed  (admin action)
```

---

## Reference: Full Table List After All 7 Prompts

| Table | Created in |
|---|---|
| `intake_question_templates` | Prompt 1 |
| `intake_responses` | Prompt 1 |
| `custom_offers` | Prompt 1 |
| `conversations` (altered) | Prompt 1 |
| `notifications` | Prompt 7 |
| `orders` | Prompt 6 |

> All other tables (users, product listings, payments base) are pre-existing.
