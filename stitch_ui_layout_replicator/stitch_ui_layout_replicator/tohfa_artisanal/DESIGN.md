---
name: Tohfa Artisanal
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#434843'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#737973'
  outline-variant: '#c3c8c1'
  surface-tint: '#4d6453'
  primary: '#061b0e'
  on-primary: '#ffffff'
  primary-container: '#1b3022'
  on-primary-container: '#819986'
  inverse-primary: '#b4cdb8'
  secondary: '#6b5c4c'
  on-secondary: '#ffffff'
  secondary-container: '#f4dfcb'
  on-secondary-container: '#716252'
  tertiary: '#171815'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b2c29'
  on-tertiary-container: '#94938f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e9d4'
  primary-fixed-dim: '#b4cdb8'
  on-primary-fixed: '#0b2013'
  on-primary-fixed-variant: '#364c3c'
  secondary-fixed: '#f4dfcb'
  secondary-fixed-dim: '#d7c3b0'
  on-secondary-fixed: '#241a0e'
  on-secondary-fixed-variant: '#524436'
  tertiary-fixed: '#e4e2dd'
  tertiary-fixed-dim: '#c8c6c2'
  on-tertiary-fixed: '#1b1c19'
  on-tertiary-fixed-variant: '#474744'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: ebGaramond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: ebGaramond
    fontSize: 36px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: ebGaramond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: ebGaramond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: hankenGrotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: hankenGrotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: hankenGrotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: hankenGrotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is rooted in the philosophy of "intentional craft." It targets an audience that values slow living, provenance, and the tactile quality of bespoke goods. The emotional response should be one of quiet luxury, warmth, and trust.

The design style is a **warm, elevated minimalism**. It avoids the sterility of modern corporate UI by using organic tones and generous whitespace. It borrows from editorial design—prioritizing legibility and high-quality imagery—while maintaining a tactile feel through soft shadows and subtle container nesting. Every interaction should feel deliberate, mirroring the care put into an artisanal product.

## Colors
The palette is inspired by natural materials and heritage workshops.

- **Primary (Deep Forest Green):** Used for brand expression, primary actions, and meaningful accents. It provides a grounded, sophisticated anchor.
- **Secondary (Soft Beige):** Used for structural containers, secondary buttons, and subtle grouping. It mimics the tone of raw linen or unbleached paper.
- **Background (Warm Cream):** The "canvas" of the application. It is softer on the eyes than pure white and enhances the "hand-crafted" feel.
- **Text (Charcoal):** A high-contrast but slightly softened black used for maximum readability without the harshness of pure #000.

## Typography
The typography pairing establishes a clear hierarchy between storytelling and utility.

- **EB Garamond** (Serif) is used for headlines and editorial moments. Its classical proportions and calligraphic roots reflect the artisanal nature of the brand.
- **Hanken Grotesk** (Sans-serif) provides a clean, modern contrast for body copy, navigation, and functional UI elements. 

Use sentence case for headlines and body text. Use all-caps with increased letter spacing for small labels (metadata, categories) to create an organized, curated appearance.

## Layout & Spacing
This design system utilizes a **fixed-center grid** for desktop to maintain an editorial, magazine-like feel, and a **fluid grid** for mobile.

- **Desktop (12 columns):** 1280px max-width with 64px outer margins. Content should feel spacious; do not be afraid of empty columns to create asymmetrical layouts.
- **Mobile (4 columns):** 20px outer margins with 16px gutters.
- **Rhythm:** An 8px linear scale drives all spacing. For "Artisanal" sections (product galleries, story blocks), use larger `stack-lg` spacing to give elements room to breathe. For functional areas (forms, settings), use `stack-sm`.

## Elevation & Depth
Depth in this design system is achieved through **tonal layering** and **ambient shadows**, rather than harsh lines.

- **Surface Tiers:** Use the primary background (Cream) for the base, and secondary (Beige) for elevated containers or cards.
- **Shadows:** Use a single, very soft, diffuse shadow for floating elements like cards or menus. The shadow should have a slight warm tint (e.g., a dark brown base with 5-8% opacity) to stay consistent with the warm palette.
- **Borders:** Use thin (1px) borders in a slightly darker shade of the container color to define edges without creating visual noise.

## Shapes
The shape language is "Softly Geometric." 

Rounded corners (0.5rem base) are applied to all interactive elements to evoke a sense of approachability and organic form. Avoid fully circular "pill" shapes for buttons to maintain a more structured, sophisticated look; stick to the defined `rounded-md` and `rounded-lg` values. Image containers should always be rounded to soften the photography.

## Components

- **Buttons:** Primary buttons use the Forest Green background with Cream text. Secondary buttons use a Beige background or a Green outline. All buttons have a 0.5rem corner radius.
- **Cards:** Cards should use the Soft Beige background with a 1px border and a subtle ambient shadow. Text within cards should be centered or left-aligned depending on the content density.
- **Inputs:** Text fields use the Cream background with a thin charcoal border. On focus, the border weight remains 1px but transitions to the Forest Green color.
- **Chips/Tags:** Used for product categories or materials. These should be small, capitalized labels (Hanken Grotesk) with a Soft Beige background and no border.
- **Icons:** Use "Artisanal" icons—thin-stroke (1.5pt) line icons with slightly rounded terminals. Icons should feel hand-drawn but precise.
- **Lists:** Product lists should feature generous vertical padding and thin dividers in a muted beige.