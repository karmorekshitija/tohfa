# Tohfa — Replace Old Frontend with New Stitch Frontend

## What's Happening (Root Cause)

Your backend (`craftnest-backend`) serves the frontend using this line in [main.py](file:///Users/krinjal_agrawal/tohfa/craftnest-backend/app/main.py#L435):

```python
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
```

This means **whatever HTML files are inside `craftnest-backend/frontend/`** is what the app shows. Right now, that folder still contains the **old frontend** (18 files like `home.html`, `category.html`, `profile.html`, etc.).

Your **new frontend** (30 Stitch screens) is sitting in `tohfa/stitch_screens/` — it has never been placed into the `frontend/` folder, so the backend never serves it.

Additionally, there is a **git conflict** blocking `git pull` because your local `main.py` and `run.py` have been modified. You must resolve this first before syncing.

---

## Root Cause Summary

| Problem | Location |
|---|---|
| Old frontend still in place | `craftnest-backend/frontend/` (18 files) |
| New frontend never connected to backend | `tohfa/stitch_screens/` (30 HTML files) |
| Git conflict blocking sync | `main.py` and `run.py` have local uncommitted changes |

---

## Step-by-Step Plan (You Can Do This!)

### Step 1 — Fix the Git Conflict First

You need to save your local changes first, then pull from remote, then re-apply your changes.

Run these commands in your terminal one by one (inside the `tohfa` folder):

```bash
# Step 1a: Save your local changes temporarily
git stash

# Step 1b: Now pull the latest changes from GitHub
git pull

# Step 1c: Bring your saved changes back
git stash pop
```

> [!NOTE]
> `git stash` saves your local edits safely without deleting them. `git stash pop` brings them back after pulling.

If `git stash pop` causes conflicts, you'll see conflict markers in `main.py` and `run.py`. Let me know and I'll help you resolve them.

---

### Step 2 — Delete the Old Frontend Files

The old frontend files are in `craftnest-backend/frontend/`. We need to **clear this folder completely** so the old UI is gone.

I will do this for you automatically — just approve it when I run the command.

**Files to delete (old frontend):**
- `1_categories_botanical_artisanship.html`
- `2_reels_botanical_artisanship.html`
- `3_buyer_profile_botanical_palette.html`
- `4_seller_profile_botanical_palette_update.html`
- `5_seller_profile_refined_upload_flow.html`
- `6_home_ribbed_ribbon_tags_endless_scroll.html`
- `category.html`, `home.html`, `index.html`, `login.html`, `product.html`
- `profile.html`, `reels.html`, `seller-dashboard.html`
- `signup-buyer.html`, `signup-buyer.css`, `signup-seller.html`, `wishlist.html`

---

### Step 3 — Copy New Stitch Frontend into Backend

The new Stitch screens from `tohfa/stitch_screens/` need to be copied into `craftnest-backend/frontend/`.

We also need to identify which new screen is the **home/index page** (the one the browser opens first), and rename it to `index.html`.

> [!IMPORTANT]
> **Open Question for You**: Which of the 30 new Stitch screens should be the **home page** (the first page users see)?
>
> Based on screen names, it looks like `20_tohfa_home_feed_-_pure_white_background_code.html` is the home feed. Is that correct?

---

### Step 4 — Verify the Backend Serves the New Frontend

Once new files are in `craftnest-backend/frontend/`, the line in `main.py`:
```python
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
```
...will automatically serve the new screens. No code changes needed here.

---

### Step 5 — Test It

Run the backend:
```bash
cd craftnest-backend
python run.py
```
Then open your browser at `http://localhost:5002` — you should see the new Stitch frontend.

---

## What I Will Do For You (After Your Approval)

1. ✅ Run `git stash` → `git pull` → `git stash pop` to fix the conflict
2. ✅ Delete all old frontend files from `craftnest-backend/frontend/`
3. ✅ Copy all 30 new Stitch HTML files into `craftnest-backend/frontend/`
4. ✅ Rename the correct screen to `index.html` (home page)
5. ✅ Verify the setup looks correct

## Open Question

> [!IMPORTANT]
> **Before I proceed**: Which screen is your home page? Is it `20_tohfa_home_feed_-_pure_white_background_code.html`? Please confirm so I rename the right file to `index.html`.
