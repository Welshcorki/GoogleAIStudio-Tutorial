---
name: TubeFinder Lumina
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#58413b'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#8c716a'
  outline-variant: '#e0bfb7'
  surface-tint: '#a93713'
  primary: '#a93713'
  on-primary: '#ffffff'
  primary-container: '#f06a42'
  on-primary-container: '#581300'
  inverse-primary: '#ffb5a0'
  secondary: '#7c5725'
  on-secondary: '#ffffff'
  secondary-container: '#fecc8f'
  on-secondary-container: '#795423'
  tertiary: '#904d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#dd7a0c'
  on-tertiary-container: '#472300'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a0'
  on-primary-fixed: '#3b0a00'
  on-primary-fixed-variant: '#862200'
  secondary-fixed: '#ffddb6'
  secondary-fixed-dim: '#efbe82'
  on-secondary-fixed: '#2a1800'
  on-secondary-fixed-variant: '#614010'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-timestamp:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.75rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses quiet luxury, technical precision, and luminous clarity for an AI-powered video search and transcript intelligence platform. Rather than leaning into the harsh dark neon tropes of conventional AI tools, the aesthetic embraces tactile serenity: warm champagne air, sand-dune gradients, brushed acrylic sheets, and vibrant sunset coral highlights.

The visual style blends **frosted glassmorphism** with **warm minimalism**. Layered translucent sheets evoke optical lenses and physical slides, mirroring how users sift through layers of spoken footage, timestamps, and semantic transcripts. Surfaces glow softly from within, producing an aura of calm authority tailored to researchers, creators, media analysts, and executives who expect software to feel like a bespoke atelier tool.

## Colors

The palette is rooted in sunlight passing through frosted amber glass. 

- **Primary (`#F06A42` - Sunset Coral):** Used for focal semantic triggers, AI transcript highlights, active video timeline markers, and primary call-to-actions.
- **Secondary (`#E8B87D` - Warm Champagne):** Used for subtle ambient glows, radiant container borders, badges, and secondary illumination.
- **Tertiary (`#D97706` - Radiant Amber):** Reserved for confidence scores, keyframe tags, and contextual search hits within dense audio timelines.
- **Neutral Surface (`#FBF9F5` - Alabaster Sand):** The primary canvas surface in light mode, complemented by an ink-stone dark companion (`#1C1917`) for video viewport overlays and cinema mode transcript inspection.
- **Text & Ink Hierarchy:** Primary typography relies on rich charcoal stone (`#292524`), secondary metadata rests in warm muted taupe (`#78716C`), and hairline acrylic borders sit at `rgba(255, 255, 255, 0.65)` on light layers or `rgba(240, 106, 66, 0.15)` on active states.

## Typography

The typographic hierarchy combines contemporary warmth with technological precision:

1. **Headlines (`Plus Jakarta Sans`):** Soft geometry and gentle terminals impart an approachable, editorial sheen suitable for search query headers, intelligence dossiers, and category markers.
2. **Body Content (`Manrope`):** Optimized for long-form readability within video transcripts, auto-summaries, and speaker quotes, maintaining neutral clarity under subtle backdrop blur.
3. **Labels & Metadata (`Space Grotesk`):** Injects an engineered, timecode-accurate character into video timestamps (e.g., `04:12.89`), sentiment percentages, tokens/second badges, and channel metrics.

## Layout & Spacing

This design system uses a 12-column responsive fluid grid anchored by expansive horizontal margins to preserve a tranquil, gallery-like framing.

- **Desktop (1200px+):** 12 columns with `1.75rem` gutters and `3.5rem` outer margins. Search command palettes and floating video inspection surfaces float over the grid in stacked acrylic planes.
- **Tablet (768px – 1199px):** 8 columns, `1.25rem` gutters, and `2rem` margins. Video players pin to the top, while transcript search streams stack below with fluid width cards.
- **Mobile (< 768px):** 4 columns with `1rem` gutters and `1rem` safe margins. Bottom-sheet navigation replaces floating side panels.
- **Internal Component Rhythm:** Component padding scales strictly along the 4px base multiplier, using `space-md` for standard glass card padding and `space-xl` for section demarcations within transcript reports.

## Elevation & Depth

Visual hierarchy is constructed through optical transmission rather than opaque drop shadows. 

1. **Backdrop Blurs:** Core floating panes use `backdrop-filter: blur(24px) saturate(160%)` layered over ambient radiant gradients.
2. **Surface Composition:** 
   - **Level 0 (Canvas):** Smooth gradient mesh transitioning from Warm Sand (`#FBF9F5`) to a faint rose-gold haze (`#F6EFE9`).
   - **Level 1 (Dock & Glass Plinths):** Semi-opaque white acrylic (`rgba(255, 255, 255, 0.62)`) bordered by an inner top-lit stroke (`1px solid rgba(255, 255, 255, 0.85)`).
   - **Level 2 (Active Cards & Floating Modules):** Acrylic fill (`rgba(255, 255, 255, 0.78)`) backed by a diffused ambient shadow: `0 20px 40px -15px rgba(232, 184, 125, 0.35), 0 1px 3px rgba(41, 37, 36, 0.04)`.
   - **Level 3 (Command Overlays & Modals):** Pure frosted glass (`rgba(255, 255, 255, 0.88)`) surrounded by a dual aura: a subtle 1px border (`rgba(240, 106, 66, 0.2)`) and a deep atmospheric glow (`0 32px 64px -12px rgba(240, 106, 66, 0.18)`).
3. **Specularity:** Surface borders use linear gradient strokes simulating an upper-left light source (`from rgba(255,255,255,0.9) to rgba(232,184,125,0.2)`).

## Shapes

The shape architecture relies on refined pill forms (`roundedness: 3`) and organic radiused slabs.

- **Buttons, Badges, Search Bars, and Timecode Chips:** Fully rounded pill silhouettes (`rounded-full` / 9999px) to communicate soft tactile comfort.
- **Translucent Dashboard Cards and Floating Viewports:** Generously contoured radiuses (`2rem` / `32px` on desktop, `1.25rem` / `20px` on mobile), echoing smooth, sea-tumbled glass sheets.
- **Nested Controls:** Inner controls maintain nested concentric geometry, holding a constant delta of 8px to 12px from parent card radiuses.

## Components

### Buttons
- **Primary Action:** Pill-shaped, gradient-filled (`linear-gradient(135deg, #F06A42 0%, #E8835C 100%)`) with high-contrast warm white text (`#FFFFFF`), an inner inset glow (`inset 0 1px 1px rgba(255,255,255,0.4)`), and an ambient coral drop shadow on hover.
- **Secondary (Glass Pill):** Frosted translucent background (`rgba(255, 255, 255, 0.5)`), micro-stroke border (`1px solid rgba(255, 255, 255, 0.8)`), and text in rich charcoal (`#292524`). Hover state elevates the opacity to `0.85` with a warm champagne outline.
- **Icon / Utility Pill:** Compact circular or capsule-shaped acrylic buttons housing search, audio waveform, and transcript export actions.

### Search Input Bar
- Floating monolithic capsule with a high-translucency glass base (`backdrop-filter: blur(30px)`), an integrated brand logo badge, an embedded voice/semantic search trigger, and an illuminated focus ring (`0 0 0 3px rgba(240, 106, 66, 0.25)`).

### Transcript & Video Cards
- Translucent acrylic slabs featuring subtle chamfered edges and dual border highlights.
- Inside cards, spoken text lines highlight automatically with a warm coral tint (`rgba(240, 106, 66, 0.12)`) as the user scrubs through the timeline.
- Interactive scrubbers mimic micro-optical tracks with champagne-tinted timeline scrub-heads.

### Chips & Badges
- Ultra-refined capsules featuring `Space Grotesk` uppercase text.
- **Timestamp Chip:** Sandstone frosted background (`rgba(232, 184, 125, 0.18)`), coral border, and amber monospaced timecodes that trigger instant video playback jumps upon click.

### Inputs & Checkboxes
- **Input Fields:** Warm glass background (`rgba(255, 255, 255, 0.45)`) with inset shadow (`inset 0 2px 4px rgba(0,0,0,0.02)`) and muted champagne placeholder styling.
- **Checkboxes & Radios:** Pill-contoured toggles and circular selectors that reveal a radiant Sunset Coral fill with a glowing white checkmark upon selection.

### Intelligence Graphs & Video Scrubbers
- Embedded data visualizations use sunset gradients with translucent area fills underneath spline curves.
- Video timeline markers glow with concentrated coral dot nodes when semantic relevance thresholds exceed 90%.