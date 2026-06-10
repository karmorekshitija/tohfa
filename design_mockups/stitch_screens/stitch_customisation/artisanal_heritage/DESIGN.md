---
name: Artisanal Heritage
colors:
  surface: '#fcf9f5'
  surface-dim: '#dcdad6'
  surface-bright: '#fcf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ef'
  surface-container: '#f0edea'
  surface-container-high: '#ebe8e4'
  surface-container-highest: '#e5e2de'
  on-surface: '#1c1c1a'
  on-surface-variant: '#43483e'
  inverse-surface: '#31302e'
  inverse-on-surface: '#f3f0ec'
  outline: '#73796d'
  outline-variant: '#c3c8bb'
  surface-tint: '#476737'
  primary: '#163309'
  on-primary: '#ffffff'
  primary-container: '#2c4a1e'
  on-primary-container: '#96b982'
  inverse-primary: '#add197'
  secondary: '#7b5800'
  on-secondary: '#ffffff'
  secondary-container: '#fdca68'
  on-secondary-container: '#755400'
  tertiary: '#17330b'
  on-tertiary: '#ffffff'
  tertiary-container: '#2c4a1f'
  on-tertiary-container: '#96b983'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c8edb1'
  primary-fixed-dim: '#add197'
  on-primary-fixed: '#062100'
  on-primary-fixed-variant: '#304e22'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#f0bf5e'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4200'
  tertiary-fixed: '#c9edb3'
  tertiary-fixed-dim: '#add199'
  on-tertiary-fixed: '#062100'
  on-tertiary-fixed-variant: '#314e23'
  background: '#fcf9f5'
  on-background: '#1c1c1a'
  surface-variant: '#e5e2de'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  product-title:
    fontFamily: Lora
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-main:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  eyebrow-label:
    fontFamily: Cinzel
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  price-data:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
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
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1280px
---

## Brand & Style

The design system is anchored in the concept of "The Living Archive"—a blend of scholarly documentation and high-end retail. It targets discerning collectors and enthusiasts of Indian craftsmanship who value the story behind the object as much as the object itself.

The aesthetic follows a **Refined Editorial** approach. It avoids the clutter of traditional e-marketplaces in favor of a curated, journal-like experience. The UI acts as a quiet gallery frame: high-fidelity photography is the focal point, supported by airy whitespace, thin structural dividers, and subtle, low-opacity hand-drawn sketch watermarks (such as ceramic outlines and paintbrush strokes) that appear organically in the background of sections. The emotional response is one of warmth, prestige, and timelessness.

## Colors

The palette is derived from natural pigments and raw materials. 

- **Primary Forest Green (#2C4A1E)** is used for primary actions and brand presence, signaling growth and tradition.
- **Gold/Tan (#C4973A)** provides a sophisticated accent for highlights and premium indicators.
- **Ivory (#F8F3ED)** and **Warm Off-white (#F2EBE0)** create a layered depth that feels more "paper-like" and tactile than pure digital white.
- **Muted Sage (#5A7A4A)** acts as a soft tertiary color for success states or environmental categories.
- **Borders** utilize **#D6CCB8** for a subtle, aged-paper effect that structures the page without creating harsh divisions.

## Typography

This system uses a quintet of fonts to establish a clear information hierarchy:
- **Playfair Display**: Used for major headings to evoke an editorial, "Masterpiece" feel.
- **Lora**: Specifically for product names, bridging the gap between headlines and body text with a comfortable, bookish elegance.
- **DM Sans**: The workhorse for UI elements and long-form descriptions, ensuring legibility.
- **Cinzel**: Used exclusively for "eyebrows" and small labels in all-caps, providing a lithographic, historical touch.
- **Space Mono**: Utilized for prices, SKUs, and technical specifications to give a subtle "cataloguer’s" or "curator’s" aesthetic.

## Layout & Spacing

The layout follows a **Fixed-Width Grid** on desktop (1280px max) to maintain the integrity of the editorial compositions. 

- **Columns**: 12-column grid for desktop, 4-column for mobile.
- **Rhythm**: A 4px baseline grid ensures vertical harmony. Large section spacing (80px - 120px) is encouraged to allow the artisanal photography to "breathe."
- **Margins**: Generous 64px margins on desktop create a frame-like effect, while mobile relies on 16px to maximize screen real estate.
- **Dividers**: Use 1px borders (#D6CCB8) sparingly to separate content groups, often with a 24px-48px padding around them.

## Elevation & Depth

This system avoids heavy shadows, favoring **Tonal Layers** and **Low-Contrast Outlines** to define depth.

- **Level 0 (Surface)**: Pure White (#FFFFFF).
- **Level 1 (Sections/Tabs)**: Warm Off-white (#F2EBE0).
- **Level 2 (Containers/Cards)**: Ivory (#F8F3ED) with a 1px border (#D6CCB8).
- **Interactive Depth**: Instead of lifting on hover, elements may transition their border color to Gold (#C4973A) or apply a very subtle, large-radius ambient shadow (10% opacity) to simulate the soft lighting of a museum.

## Shapes

The shape language balances the organic nature of handcrafted goods with modern UI precision. 

- **Cards**: Use a custom **14px radius** to create a soft, inviting container for photography.
- **Buttons**: Use a **16px radius**, bordering on a pill-shape but maintaining enough corner structure to feel intentional and modern.
- **Imagery**: Product images should maintain the same 14px radius as their parent containers, or be kept sharp if they are full-bleed within an editorial layout.

## Components

- **Buttons**: Primary buttons are solid Forest Green (#2C4A1E) with white DM Sans text. Secondary buttons are outlined with Gold/Tan (#C4973A) and use the same typography.
- **Cards**: Product cards feature Ivory (#F8F3ED) backgrounds, 14px rounded corners, and a 1px border. The product name uses Lora, while the price is set in Space Mono.
- **Input Fields**: Minimalist design with a bottom-only border (#D6CCB8) that turns Forest Green on focus, evocative of a signature line.
- **Chips/Tags**: Use the Eyebrow-Label style (Cinzel) in all-caps, with a light Sage (#5A7A4A) background at 10% opacity.
- **Dividers**: Thin 1px lines in #D6CCB8, sometimes accented with a small hand-drawn motif (like a ceramic pot) at the center to break long scrolls.
- **Tabs**: Active states use the Secondary Surface (#F2EBE0) to create a clear visual connection to the content below.