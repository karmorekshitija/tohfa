---
name: Tohfa Luxury Editorial
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#424842'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#727972'
  outline-variant: '#c2c8c0'
  surface-tint: '#47654e'
  primary: '#173320'
  on-primary: '#ffffff'
  primary-container: '#2d4a35'
  on-primary-container: '#98b99e'
  inverse-primary: '#aecfb3'
  secondary: '#8f4d23'
  on-secondary: '#ffffff'
  secondary-container: '#fda775'
  on-secondary-container: '#773a11'
  tertiary: '#332d24'
  on-tertiary: '#ffffff'
  tertiary-container: '#494339'
  on-tertiary-container: '#b9afa3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9ebce'
  primary-fixed-dim: '#aecfb3'
  on-primary-fixed: '#03210f'
  on-primary-fixed-variant: '#304d38'
  secondary-fixed: '#ffdbc9'
  secondary-fixed-dim: '#ffb68d'
  on-secondary-fixed: '#331200'
  on-secondary-fixed-variant: '#71360d'
  tertiary-fixed: '#ece1d4'
  tertiary-fixed-dim: '#cfc5b8'
  on-tertiary-fixed: '#201b13'
  on-tertiary-fixed-variant: '#4c463c'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.1em
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
  margin-desktop: 80px
  margin-mobile: 20px
  container-max: 1440px
---

## Brand & Style
The brand personality is curated, artisanal, and deeply rooted in a sense of "place" and "craft." This design system serves a luxury lifestyle audience that values slow living, intentionality, and high-quality storytelling.

The design style is **Editorial Minimalism** with a **Tactile** edge. It leans heavily into a sophisticated layout that mimics high-end print journalism. Key characteristics include:
- **Organic Composition:** Avoiding rigid, clinical perfection in favor of "human-touched" arrangements.
- **Textured Layers:** Subtle use of grain and paper-like textures to reduce digital friction.
- **Asymmetric Balance:** Using white space (cream background) as a functional design element to let imagery and typography breathe.

## Colors
The palette is inspired by natural pigments and raw materials.
- **Cream (#F5F0E8):** Used as the primary canvas. It is softer than pure white, providing a "paper" feel that reduces eye strain.
- **Deep Forest Green (#2D4A35):** The primary brand color, used for high-level branding, primary actions, and key navigation elements.
- **Earthy Terracotta (#C4784A):** The accent color, reserved for highlights, pull quotes, and interactive states that require a warm, human touch.
- **Warm Sand (#E8DDD0):** A secondary surface color for cards, dividers, and subtle containers.
- **Charcoal (#3A3A3A):** Used exclusively for body text and labels to ensure high legibility without the harshness of pure black.

## Typography
The typography strategy creates a high-contrast relationship between the serif display face and the sans-serif body copy.
- **Playfair Display:** Used for all headings. It should be typeset with tight letter-spacing in larger sizes to emphasize its elegant, high-contrast strokes.
- **DM Sans:** Used for all functional text. Its geometric but low-contrast nature provides a modern, clean counterpoint to the traditional serif headings.
- **Editorial Flourish:** Large initial caps (drop caps) are encouraged for long-form article starts to signal the beginning of a narrative.

## Layout & Spacing
This design system utilizes a **Masonry Grid** for content discovery and a **Fixed Grid** for reading experiences.

- **The Masonry Grid:** Applied to gallery views and article feeds. Items should vary in aspect ratio (4:5, 1:1, 2:3) to create a rhythmic, curated feel rather than a repetitive commercial grid.
- **Article Layout:** A centered column (max-width 800px) with generous 80px margins on desktop to focus the reader's attention.
- **Gutter Strategy:** 24px gutters provide enough air between elements to prevent the UI from feeling cluttered, maintaining the "Luxury" ethos of "less is more."

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Soft Insets** rather than traditional shadows.
- **The Canvas:** The Cream background is the base. 
- **The Card:** Elements placed on the canvas use the **Warm Sand** color or a thin 1px border in **Deep Forest Green** at 10% opacity.
- **Shadows:** If used, they must be "Ambient Shadows"—extremely soft (20-40px blur), very low opacity (5%), and tinted with a hint of the Terracotta or Green to avoid looking "gray" or "digital."
- **Glassmorphism:** Reserved for navigation bars, using a background blur and 80% opacity of the Cream background to maintain context while scrolling.

## Shapes
The shape language is "Organic Geometric." 
- **Standard UI:** Elements like buttons and input fields use a `0.5rem` (Rounded) corner radius to feel approachable but structured.
- **Imagery:** Large feature images may utilize asymmetric rounding (e.g., top-left and bottom-right only) or custom organic masks to mimic stones or natural forms.
- **Dividers:** Use thin, hairline strokes in Forest Green or Terracotta.

## Components
- **Buttons:** Primary buttons are solid **Deep Forest Green** with **Cream** text. Secondary buttons are outlined with **Terracotta** text. Label styles are always uppercase with increased letter-spacing.
- **Chips/Tags:** Used for categories (e.g., "Architecture," "Sustainability"). These should be pill-shaped with a **Warm Sand** background and **Deep Forest Green** text.
- **Input Fields:** Minimalist. Only a bottom-border in **Deep Forest Green** that becomes **Terracotta** on focus. Labels float above in `label-md` style.
- **Cards:** No heavy shadows. Use a background color change (**Warm Sand**) or a subtle 1px border. Images within cards should have a slight zoom effect on hover.
- **Pull Quotes:** Set in **Playfair Display** (headline-md), centered, with **Terracotta** horizontal lines above and below.