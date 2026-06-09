---
name: Artisan Studio Journal
colors:
  surface: '#fff8f3'
  surface-dim: '#e5d8c8'
  surface-bright: '#fff8f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff2e1'
  surface-container: '#f9ecdc'
  surface-container-high: '#f3e6d6'
  surface-container-highest: '#ede1d1'
  on-surface: '#211b11'
  on-surface-variant: '#414942'
  inverse-surface: '#362f25'
  inverse-on-surface: '#fcefde'
  outline: '#717972'
  outline-variant: '#c1c9c0'
  surface-tint: '#3a684c'
  primary: '#255338'
  on-primary: '#ffffff'
  primary-container: '#3d6b4f'
  on-primary-container: '#b7e9c6'
  inverse-primary: '#a0d2b0'
  secondary: '#49663f'
  on-secondary: '#ffffff'
  secondary-container: '#c8e9b8'
  on-secondary-container: '#4d6a43'
  tertiary: '#573b81'
  on-tertiary: '#ffffff'
  tertiary-container: '#70539b'
  on-tertiary-container: '#e8d6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bceecb'
  primary-fixed-dim: '#a0d2b0'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#214f36'
  secondary-fixed: '#caecbb'
  secondary-fixed-dim: '#afd0a0'
  on-secondary-fixed: '#062103'
  on-secondary-fixed-variant: '#324e29'
  tertiary-fixed: '#ecdcff'
  tertiary-fixed-dim: '#d6baff'
  on-tertiary-fixed: '#270550'
  on-tertiary-fixed-variant: '#54387e'
  background: '#fff8f3'
  on-background: '#211b11'
  surface-variant: '#ede1d1'
typography:
  display-hero:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '300'
    lineHeight: 56px
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
  title-serif:
    fontFamily: Merriweather
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Cinzel
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  data-price:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style

This design system captures the soulful, tactile essence of a master crafter’s sketchbook. It is designed for "TOFA Artisan Studio," targeting individuals who value the narrative and human touch behind handmade gifts. The brand personality is warm, intentional, and literary—evoking the feeling of a quiet afternoon in a sun-drenched studio.

The design style is a blend of **Minimalism** and **Tactile/Skeuomorphism**. It prioritizes heavy white space and refined typography while introducing "physical" elements: paper-like surfaces, subtle ink textures, and hand-drawn iconography. The interface should never feel "digital" or cold; instead, it should feel like a curated gallery or a physical journal where every element was placed by hand.

## Colors

The palette is grounded in botanical and earthen tones. The primary **Forest** green provides a stable, professional anchor for actions, while the **Sage** secondary tone acts as a soft structural element for borders and dividers. **Violet** is used as a sophisticated "spark" for interactivity and links.

For functional feedback:
- **Gold** is reserved for value-based information (prices, badges) to imply quality.
- **Terracotta** serves as the error state, replacing harsh digital reds with a natural, clay-like warmth.
- **Ivory** and **Deep Cream** create layered depth without the sterility of pure white, mimicking different weights of parchment.

## Typography

The typography system is highly expressive, using five distinct families to organize information through a "journalistic" lens.

- **Playfair Display (Light/Regular):** Used for emotional resonance in hero sections and main headings.
- **Merriweather (Lora alternative):** Used for titles that require a narrative, bookish feel—specifically product titles and pull-quotes.
- **DM Sans:** The workhorse for high-legibility tasks, including descriptions, button labels, and input fields.
- **Space Mono:** Applied to technical data (prices, timestamps) to provide a subtle "stamped" or "typewritten" contrast to the organic serifs.
- **Cinzel:** Used exclusively in all-caps for eyebrows and navigation headers to evoke a sense of timeless craftsmanship.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous margins to maintain an "airy" studio aesthetic. 

- **Desktop:** 12-column grid with 64px side margins. Elements should feel "placed" rather than "crammed," using `xl` spacing (40px) between sections to allow the white space to act as a visual breather.
- **Mobile:** 4-column grid with 20px margins. 
- **Rhythm:** All spacing is derived from a 4px baseline. Use 16px (md) for internal card padding and 24px (lg) for vertical separation between related content blocks.

Avoid rigid, boxy layouts. Use asymmetrical placement of "watercolor-wash" backgrounds to break the grid and enhance the hand-made feel.

## Elevation & Depth

This design system avoids heavy digital shadows. Instead, it uses **Tonal Layers** and **Tinted Ambient Shadows**.

- **Surfaces:** Depth is primarily created by placing `surface-ivory` cards against a `background-primary` (white) base.
- **Shadows:** When elevation is required (e.g., a floating card), use a very soft, diffused shadow tinted with a warm brown (`#3A3328` at 8% opacity). This mimics the look of a heavy piece of cardstock sitting on a wooden table.
- **Outlines:** Most cards and inputs use a 1px `sage` border to define boundaries without the need for heavy shadows.
- **Interactions:** "Pressed" states should involve a slight downward scale (0.98) and a darkening of the background color rather than a glow, simulating physical pressure.

## Shapes

The shape language is organic and soft. Standard UI components use a 0.5rem (8px) radius, while cards and containers utilize a more pronounced "hand-cut" feel with `rounded-lg` (16px) or `rounded-xl` (24px) corners. 

Avoid perfect circles for decorative elements; instead, prefer slightly irregular, pill-shaped containers for status indicators to maintain the "artisan" silhouette.

## Components

### Buttons
- **Primary:** Forest green fill, white DM Sans text. Solid, dependable.
- **Secondary:** White fill, 1px Sage border, Forest green text.
- **Link:** Violet text with a 1px underline that appears hand-drawn or slightly offset.

### Product Cards
- **Structure:** Ivory surface, 1px Sage border.
- **Imagery:** 16px rounded corners on product photos.
- **Content:** Merriweather title (Title-serif), Space Mono price in Gold, and a "Ships in N days" pill in `sage-soft`.

### Navigation
- **Top Bar:** Minimal white background. The wordmark should feature the Playfair Italic "Tofha" in Forest with a Gold dot over the 'i'.
- **Bottom Tab Nav:** Use hand-drawn artisan icons (ink-sketch style). The active state is indicated by a small violet ink-splat or dot beneath the icon.

### Status Indicators
Use the following color-soft fills with dark-muted text for status pills:
- **Awaiting Payment:** Gold-soft fill.
- **Processing:** Violet-soft fill.
- **Shipped:** Sage-soft fill.
- **Delivered:** Forest (solid) with white text.
- **Cancelled:** Terracotta (solid) with white text.

### Empty States & Textures
- **Empty States:** Features a "Chibi" artisan mascot. Typography uses Merriweather for the primary message to keep it warm and personal.
- **Textures:** Apply 8% opacity SVG overlays of lino-cut patterns or botanical sprigs to section backgrounds (e.g., behind the search bar or in the footer) to reinforce the crafter's sketchbook narrative.