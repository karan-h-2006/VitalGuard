# UI Reference Analysis & VitalGuard Adaptation Plan

Reference site analyzed: [https://www.checkpointresearch.ca/](https://www.checkpointresearch.ca/) (at 1440px desktop & 390px mobile viewports).

---

## 1. Reference Site Design Findings

### Color Palette

- **Background:** `#FFFDFD` (crisp, warm off-white), section contrasts in `#000000` / `#17171A` for dark contrast blocks, plus subtle translucent tints (`rgba(37, 82, 252, 0.05)` to `0.20`).
- **Primary Text:** `#17171A` (rich obsidian / near-black) with secondary / muted text at `#616162` and borders at `#E5E7EB` / `#B1B1B1` / `#17171A` (1px clean architectural hairline borders).
- **Accent:** `#2552FC` (vivid electric cobalt blue), used for primary button fills, active step indicators, and gradient glows.
- **Gradients:** Soft radiant hero backdrop glows (`radial-gradient` / conic fade with blur) transitioning from electric blue to transparent; subtle linear gradient accents on cards and FAQ.

### Typography

- **Headlines / Display:** `Unbounded` (geometric modern display sans, weights 300, 400, 500). Very wide, confident character tracking, high impact.
- **UI & Technical Body:** `JetBrains Mono` (weights 300, 400, 500) paired with `Inter` / system sans. Monospace texture used intentionally for technical credibility: uppercase micro-labels, navigation links, buttons, table data, and numbers.
- **Type Scale:**
  - Hero Display: 60px – 75px (desktop), 36px – 44px (mobile), line-height ~0.95–1.0.
  - Section Headings (H2/H3): 30px – 60px, line-height ~1.0.
  - Subhead / Lead: 16px – 20px, light weight (300).
  - Body: 14px – 15px, line-height 1.4–1.6.
  - Micro-labels / Eyebrows / Buttons: 11px – 12px monospace, uppercase, letter-spaced, bracketed `[ LABEL ]`.

### Spacing, Radii, Shadows & Borders

- **Spacing Rhythm:** Generous vertical padding (`py-20` to `py-32` / 80px–128px between major sections), letting typography breathe.
- **Container Max-Width:** Fluid responsive container with max-width 1280px / 1400px with generous gutter margins (1.5rem–3rem).
- **Border Radius:** Very subtle architectural radii: 2px–4px on cards, inputs, and tiles; pill-shaped (`rounded-full`) on primary CTA buttons.
- **Borders & Shadows:** 1px hairline solid borders (`border-neutral-200` or `border-neutral-900`) instead of heavy shadows. Subtle box-shadow or ambient glow for elevated interactive states.

### Key Components & Interaction Patterns

- **Buttons:** Pill-shaped (`rounded-full`) or sharp 2px. Primary has electric fill, secondary has hairline border. Distinctive **text-roll hover effect**: two stacked text spans inside an overflow-hidden container where the text slides up by -100% on hover.
- **Bracketed Micro-Labels:** Small uppercase chips such as `[ Learn ]`, `[ step 01 ]`, `[ live telemetry ]` acting as section eyebrows, status indicators, and category tags.
- **Marquee:** Infinite seamless horizontal ticker with pill/rectangular badges that pauses on cursor hover.
- **Cards & Grids:** Numbered feature cards (`01 / 02 / 03`), clean 3-column problem/solution grids with hairline division borders.
- **Stats Row:** Large tabular counters with animated incrementing numbers accompanied by small uppercase labels below.
- **Accordion:** Clean hairline dividers, subtle background hover tint, fluid chevron / plus-minus expansion with ample breathing room.
- **Timeline / Process:** Vertical step-by-step track with numbered badges `[ step 01 ]`, connected lines, and active glow rings.

---

## 2. VitalGuard Healthcare Design Adaptation

We adapt these aesthetic principles to create a trustworthy, clinical-grade, calm medical platform:

### Healthcare Color Palette & Semantic Tokens

- **Backgrounds:**
  - Page base: `#F9FAFC` (clinical crisp ice white / subtle warm gray tint)
  - Surface / Card: `#FFFFFF` (pure white)
  - Surface elevated / secondary: `#F1F5F9` (slate 100)
  - Dark contrast surface: `#090D16` (deep medical navy/slate)
- **Text:**
  - Primary: `#0F172A` (deep obsidian slate)
  - Secondary / Muted: `#475569` (slate 600)
  - Subtle / Tertiary: `#94A3B8` (slate 400)
- **Primary Brand Accent:**
  - Vital Blue / Deep Teal: `#0284C7` / `#0369A1` (vivid medical cerulean) paired with `#0F766E` (calm medical teal).
  - Hover / Focus rings: `#38BDF8` / `#0284C7` with 2px offset.
- **Hairline Borders:** `#E2E8F0` (light) / `#1E293B` (dark/surface).

### Semantic Severity Tokens (Accessible & Contrast-Compliant)

Each severity level has distinct color, high contrast (WCAG AA > 4.5:1), and a mandatory accompanying icon + text badge:

1. **Normal:**
   - Background: `#ECFDF5` (emerald-50)
   - Border: `#A7F3D0` (emerald-200)
   - Text / Icon: `#065F46` (emerald-800, contrast 6.2:1 against bg)
   - Icon: `CheckCircle2`
2. **Watch:**
   - Background: `#EFF6FF` (blue-50)
   - Border: `#BFDBFE` (blue-200)
   - Text / Icon: `#1E40AF` (blue-800, contrast 7.1:1 against bg)
   - Icon: `Eye`
3. **Warning:**
   - Background: `#FFFBEB` (amber-50)
   - Border: `#FDE68A` (amber-200)
   - Text / Icon: `#92400E` (amber-800, contrast 5.8:1 against bg)
   - Icon: `AlertTriangle`
4. **Critical:**
   - Background: `#FEF2F2` (rose-50)
   - Border: `#FECACA` (rose-200)
   - Text / Icon: `#991B1B` (rose-800, contrast 6.8:1 against bg)
   - Icon: `AlertOctagon`

### Self-Hosted Typography Pairings via `@fontsource`

- **Display / Headings:** `Plus Jakarta Sans` or `Unbounded` / `Space Grotesk` (clean, geometric, authoritative medical-tech aesthetic). We will use `@fontsource/plus-jakarta-sans` (or `@fontsource/space-grotesk`) and `@fontsource/jetbrains-mono` for micro-labels, metrics, and tabular clinical data.
- Small payload footprint (weights 400, 500, 600, 700). Completely self-hosted with zero external CDN calls.

### UI Primitives (`apps/web/src/components/ui/`)

1. `Button`: Primary, secondary, outline, ghost; pill-shaped with optional text-roll hover animation.
2. `Badge` / `Tag`: Standard, outline, bracketed `[ LABEL ]`, and semantic severity badge (`Normal`, `Watch`, `Warning`, `Critical`) with required icon.
3. `Card`: Clean hairline borders, subtle hover rise, optional header/footer slots.
4. `Input` / `Select` / `Textarea`: Architectural border, clear focus ring, inline validation message support, show/hide password toggle.
5. `Modal`: Accessible dialog with focus trap, backdrop blur, Escape-key listener, and smooth enter/exit.
6. `Table`: Architectural striped or hairline borders, responsive horizontal-scroll container or card stack fallback on mobile.
7. `Tabs`: Bracketed tab headers or pill toggles with accessible keyboard navigation.
8. `Accordion`: Accessible disclosure with animated height expand/collapse and subtle background highlight.
9. `Skeleton`: Shimmer placeholder for cards and tables.
10. `EmptyState`: Clean icon, heading, explanatory copy, and action button.
11. `Toast` / `Alert`: Accessible notification banners with auto-dismiss and role indicators.
12. `Stat`: Animated tabular counter with unit and uppercase monospace sub-label.

### Public Landing Page Sections (`/` for logged-out visitors)

1. **Top Navigation:** Sticky navbar, VitalGuard logo, section anchors, Login & "Get Started" CTA, mobile full-screen drawer.
2. **Hero:** Three-beat headline ("Every vital. Every second. Zero blind spots."), rotating bracketed vital chip (`[ heart rate ]` → `[ SpO2 ]` → `[ temperature ]` → `[ motion ]`), dual CTAs, soft radial glow.
3. **Vitals Marquee:** Infinite scrolling strip with pause on hover highlighting monitored telemetry and capabilities.
4. **Problem Section:** Three cards: "Delayed Detection", "Alert Fatigue", "Fragmented Clinical Access".
5. **How It Works:** `01 / Capture`, `02 / Analyze`, `03 / Alert & Respond`.
6. **Live Dashboard Preview:** Styled mock of patient telemetry with live synthetic vitals and severity indicators.
7. **Role Breakdown:** Patient, Doctor, Caregiver, Administrator cards detailing the verified onboarding model.
8. **Process Timeline:** 5-step journey (`[ step 01 ]` to `[ step 05 ]`) from onboarding to active monitoring.
9. **Truthful Stats Row:** Project-derived facts (4 vitals tracked, ~5s sample interval, 4 user roles, 3 alert tiers).
10. **FAQ Accordion:** 6 healthcare/project questions with clear answers.
11. **Closing CTA:** Conversion prompt with Get Started / Sign In.
12. **Footer:** Bracketed column headers (`[ Explore ]`, `[ System ]`, `[ Governance ]`), large wordmark, and the required student project disclaimer.
