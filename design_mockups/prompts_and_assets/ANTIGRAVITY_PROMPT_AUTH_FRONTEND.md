# TOHFA — Auth Pages Frontend Redesign
### Antigravity prompt | Frontend-only | No logic/backend changes

---

## IMPORTANT RULES BEFORE YOU START

- **Do NOT rewrite any file from scratch.** Open each existing file and make targeted changes only.
- **Do NOT touch** any form `action`, `method`, JS event listeners, API calls, auth logic, or routing.
- **Preserve all existing** `id`, `name`, `class` attributes on inputs and forms.
- **Preserve all existing illustrations/images** — just restyle their wrapper containers.
- Use `href="#"` for all new nav/footer links.
- All changes are HTML + CSS only.

---

## PROJECT FILE PATHS

```
auth_screens/
├── 01_tohfa_login_-_desktop_refined_code.html
├── 02_tohfa_buyer_signup_-_refined_desktop_panel_code.html
├── 03_tohfa_seller_signup_desktop_code.html
├── 05_tohfa_session_ended_-_desktop_code.html
├── 06_tohfa_profile__logout_confirmation_-_desktop_code.html
└── 08_tohfa_login_-_desktop_panel_code.html
```

---

## STEP 0 — Create shared components (do this first)

Create a new folder: `auth_screens/components/`

### `components/tohfa-navbar.html`
Build the navbar shown in **navbar.png**:
- Left: **Tohfa** italic serif logo with a gold dot accent after the wordmark
- Center: nav links with icons — Home · Category · Reels · Profile
- Right: Search icon · Cart icon · Bell icon · Dark green circle avatar ("U")
- Background: `#FDFAF5`, 1px bottom border `#E8E0D5`
- Full width, sticky top, height ~64px
- All links: `href="#"`

### `components/tohfa-footer.html`
Build the footer shown in **footer.png**:
- Left: Tohfa italic logo + tagline + 3 circular social icon buttons (globe, share, mail)
- Middle-left: **Shop** column — New Arrivals, Ceramics, Stationery, Home Decor
- Middle-right: **Support** column — Shipping & Returns, Artisan Care, FAQ, Contact Us
- Right: "Join our little family" italic serif heading + description + email input + dark green SUBSCRIBE button
- Bottom bar: "© 2024 Tohfa Artisan Studio. Handcrafted with intention." + Privacy Policy · Terms of Service · Sustainability links
- Background: `#FDFAF5`, 1px top border `#E8E0D5`
- All links: `href="#"`

### `components/tohfa-include.js`
Write a small vanilla JS utility that injects the navbar and footer into any page that calls it:
```js
// Usage in HTML: 
// <div id="tohfa-navbar"></div>
// <div id="tohfa-footer"></div>
// <script src="../components/tohfa-include.js"></script>
```
Use `fetch()` to load each component HTML and insert it into the respective div.

---

## DESIGN SYSTEM (apply consistently across all files)

### Colors
- Page background (default): `#F0EDE6`
- Page background (session ended): `#D8E8D0`
- Card background: `#FDFAF5`
- Primary CTA green: `#2D5016`
- Text primary: `#1A1A1A`
- Text muted: `#6B6B6B`
- Input border: `#D4C9B8`
- Link color: `#2D5016`
- Destructive/logout red: `#C0392B`

### Typography
- Headings: Serif (Playfair Display or Georgia), italic where decorative
- Body/labels/inputs: Sans-serif (Inter or system-ui)

### Components
- Card: `border-radius: 16px`, `box-shadow: 0 4px 24px rgba(0,0,0,0.07)`, padding `40px`
- Button (primary): full-width, `background: #2D5016`, `color: white`, `border-radius: 8px`, `padding: 14px`, `font-weight: 600`
- Input: `border: 1.5px solid #D4C9B8`, `border-radius: 8px`, `padding: 12px 14px`, `background: #FDFAF5`
- Links: `color: #2D5016`

---

## TASK 1 — `01_tohfa_login_-_desktop_refined_code.html`
**Reference: login_buyer.png**

Open the existing file and make these changes only:

1. Add `<div id="tohfa-navbar"></div>` at top of body
2. Add `<div id="tohfa-footer"></div>` at bottom of body
3. Add `<script src="../components/tohfa-include.js"></script>` before `</body>`
4. Set page background to `#F0EDE6`
5. Restyle the card wrapper: `max-width: 420px`, centered, parchment bg, rounded corners, shadow per design system
6. Style the scissor icon container at top of card — centered, `font-size: 24px`
7. Style the greeting: small `DAN` label in spaced caps above, large serif `WELCOME BACK`, italic serif subtext
8. Restyle email + password inputs per design system
9. Restyle the "Forgot password?" link — right-aligned, muted green
10. Restyle the "Log In →" button — full-width dark green
11. Restyle the "New here? Create an account" link — centered below button
12. Restyle the "✦ SELL ON TOHFA" footer text inside card — centered, small caps
13. Restyle the existing snail illustration container — keep the image, just ensure it sits neatly at bottom of card

---

## TASK 2 — `02_tohfa_buyer_signup_-_refined_desktop_panel_code.html`
**Reference: signup_buyer.png**

Open the existing file and make these changes only:

1. Add navbar div, footer div, include script (same as Task 1)
2. Set page background to `#F0EDE6`
3. Restyle card: `max-width: 440px`, centered, white/parchment, rounded, shadow
4. Restyle the Tohfa logo at top of card — italic serif + gold dot
5. Restyle tagline "Join our community of craft lovers" — muted, small, centered
6. Restyle Full Name, Email Address, Password inputs per design system
7. Add password show/hide eye toggle if not already present
8. Restyle the password helper text — `font-size: 12px`, muted
9. Restyle "Create account" button — full-width dark green
10. Restyle "Already have an account? Log in" link — centered below
11. Restyle the existing bunny illustration container — keep the image, ensure it peeks from bottom-left corner of card correctly

---

## TASK 3 — `03_tohfa_seller_signup_desktop_code.html`
**Reference: signup_seller.png**

Open the existing file and make these changes only:

1. Add navbar div, footer div, include script (same as Task 1)
2. Set page background to `#F0EDE6`
3. Restyle the outer card: `max-width: 680px`, centered, rounded, shadow
4. Restyle left panel (illustration side): add a soft card/box treatment, center the existing artisan girl illustration, style the "TOFA / Since 2024" badge below it, add the quote text in italic muted serif
5. Restyle right panel (form side):
   - Section label "STEP 1 — YOUR ACCOUNT" in small spaced caps, muted
   - Full Name, Email, Password inputs per design system, password eye toggle
   - Section label "STEP 2 — SHOP DETAILS" in small spaced caps, muted
   - Shop name, Shop bio (textarea), Ships in dropdown, Instagram handle — all per design system
6. Restyle the terms checkbox line — small text, muted
7. Restyle "Create maker account" button — full-width dark green, large
8. Restyle "Just here to shop? Create a buyer account" link — centered below

---

## TASK 4 — `05_tohfa_session_ended_-_desktop_code.html`
**Reference: session_ended.png**

Open the existing file and make these changes only:

1. Add navbar div, footer div, include script (same as Task 1)
2. Set page background to `#D8E8D0` (soft sage green)
3. Restyle card: `max-width: 360px`, centered, parchment bg, rounded, shadow
4. Restyle the existing character illustration container at top of card — keep image, ensure it's centered and capped at ~120px width
5. Restyle heading "Your session has rested" — italic serif, centered
6. Restyle subtext "For your safety, please log in again." — muted, small, centered
7. Restyle "Log In" button — full-width dark green
8. Restyle "Return to gallery" link — centered below, muted

---

## TASK 5 — `06_tohfa_profile__logout_confirmation_-_desktop_code.html`
**Reference: profile.png**

Open the existing file and make these changes only:

1. Add navbar div, footer div, include script (same as Task 1)
2. Set page background to `#F5F3EF`
3. Restyle card: `max-width: 400px`, centered, white, rounded, shadow
4. Restyle avatar container at top — circular image, centered, ~72px diameter
5. Restyle user name — bold serif, centered
6. Restyle subtitle ("Connected to Collective") — muted, small, centered
7. Restyle the two pill tags — `# Kp Artisan` (lavender bg `#E8E4F4`, lavender text) and `# Kp Seller` (sage bg `#E0EDD8`, green text) — `border-radius: 20px`, `padding: 4px 12px`, `font-size: 12px`
8. Restyle each menu list item:
   - Full-width row, `padding: 16px 0`
   - Icon on left, label text, chevron `›` on right
   - Bottom border separator `#F0EDE6` between items
9. Restyle the Log Out item — red text `#C0392B`, icon on left, no chevron
10. Restyle the version text at bottom — `font-size: 11px`, muted, centered

---

## TASK 6 — `08_tohfa_login_-_desktop_panel_code.html`
**Reference: login_seller.png**

Open the existing file and make these changes only:

1. **KEEP the existing seller navbar** (Explore · Artisans · Our Story) — do NOT replace it
2. Add `<div id="tohfa-footer"></div>` at bottom of body only
3. Add `<script src="../components/tohfa-include.js"></script>` before `</body>` — the script should only inject the footer (not the navbar) for this file. Add a flag or just manually fetch only the footer component.
4. Replace the existing footer with the shared Tohfa footer
5. Set page background to `#F0EDE6`
6. Restyle card: `max-width: 460px`, centered, parchment bg, rounded, shadow
7. Restyle scissor icon container — centered at top of card
8. Restyle `WELCOME BACK` label — small spaced caps, muted
9. Restyle "Return to the nest" — large serif heading
10. Restyle italic Tohfa decorative text below heading
11. Restyle email + password inputs per design system, password eye toggle
12. Restyle "Forgot password?" — right-aligned, muted green
13. Restyle "Log in" button — full-width dark green
14. Restyle the "or" horizontal divider
15. Restyle the existing sleeping cat illustration container at bottom of card — keep image, center it, cap width ~160px

---

## VERIFICATION CHECKLIST

After **each task**, confirm before moving on:
- [ ] Navbar appears at top (or seller navbar preserved for Task 6)
- [ ] Footer appears at bottom
- [ ] Card is centered, correct max-width, has shadow + rounded corners
- [ ] All inputs match design system (border, bg, padding, radius)
- [ ] CTA button is dark green, full-width
- [ ] Existing illustrations are still visible and correctly positioned
- [ ] No JS errors in console
- [ ] Looks correct at 1440px desktop width

