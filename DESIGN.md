# Design System: Vault — Coral Warmth

## Direction Contract

**THESIS**: Warmth as proof of craft. Every other expense tracker is cold SaaS gray. Vault uses a coral accent on warm white with generous spacing to make financial data feel approachable — the Monzo principle applied to expense tracking.

**OWN-WORLD**: Warm white ground (#FAFAF8), coral accent (#FF6B6B), soft cream secondary (#F5F0EB). DM Sans as the typeface. Cards rounded to 16px with subtle warm shadows. Charts use coral-to-peach gradients. Data feels friendly, not clinical.

**STORY**: Recruiter lands → sees a polished dashboard with animated charts, real data, and warm tones → "this person builds production-quality UIs that feel human." Within one viewport they see category breakdown, spending trends, and a recent activity list that looks like a real product.

**FIRST VIEWPORT**: Top nav (Vault logo in coral, nav links, avatar). Below: 3 summary cards in a row (total spent, remaining budget, active groups). Below that: two charts side by side — category donut (coral palette) and spending line chart (coral gradient fill). Below: recent expenses table. Quick-add button anchored bottom-right.

**FORM**: Operate mode. Warm/friendly fintech world. Coral Warmth is direction 1 of 7 grounded candidates within the pinned world. No script roll — user chose directly.

---

## Color Palette

### Ground
- **Warm White**: `#FAFAF8` — primary background, cards sit on this
- **Cream**: `#F5F0EB` — secondary background, sidebar, alternating rows
- **White**: `#FFFFFF` — elevated cards, modals

### Accent
- **Coral**: `#FF6B6B` — primary action, links, active nav, chart primary
- **Coral Light**: `#FFE0E0` — hover states, chart hover, subtle highlights
- **Coral Dark**: `#E85555` — active/pressed states

### Semantic
- **Success**: `#34C759` — positive amounts, approved claims, on-budget
- **Warning**: `#FFB340` — approaching budget limit, pending claims
- **Error**: `#FF3B30` — over budget, rejected claims, destructive actions
- **Info**: `#5AC8FA` — neutral information, links on dark backgrounds

### Neutrals
- **Text Primary**: `#1A1A1A` — headings, amounts, primary content
- **Text Secondary**: `#6B7280` — descriptions, labels, timestamps
- **Text Tertiary**: `#9CA3AF` — placeholders, disabled text
- **Border**: `#E5E7EB` — card borders, dividers, table lines
- **Border Light**: `#F3F4F6` — subtle separators

### Chart Palette (warm spectrum)
1. Coral `#FF6B6B`
2. Peach `#FFAB91`
3. Amber `#FFD54F`
4. Sage `#A8D5BA`
5. Sky `#81D4FA`
6. Lavender `#CE93D8`
7. Rose `#F48FB1`

## Typography

### Font Family
- **Primary**: Figtree — warm, friendly, geometric sans-serif with distinctive character
- **Monospace**: JetBrains Mono — for amounts, code, data values

### Scale (rem)
| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text-xs` | 0.75rem / 12px | 400 | Timestamps, badges |
| `text-sm` | 0.875rem / 14px | 400 | Body secondary, labels |
| `text-base` | 1rem / 16px | 400 | Body primary |
| `text-lg` | 1.125rem / 18px | 500 | Card titles, section headers |
| `text-xl` | 1.25rem / 20px | 600 | Page titles |
| `text-2xl` | 1.5rem / 24px | 700 | Dashboard totals |
| `text-3xl` | 1.875rem / 30px | 700 | Hero amount |

### Line Heights
- Tight: 1.25 (headings)
- Normal: 1.5 (body)
- Relaxed: 1.75 (long-form)

## Spacing

Base unit: 4px. All spacing is a multiple of 4.

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Tight gaps (icon + text) |
| `space-2` | 8px | Small gaps (chip spacing) |
| `space-3` | 12px | Medium gaps (card padding small) |
| `space-4` | 16px | Standard gaps (card padding) |
| `space-5` | 20px | Section spacing |
| `space-6` | 24px | Page padding, card padding large |
| `space-8` | 32px | Major section breaks |
| `space-10` | 40px | Page-level spacing |
| `space-12` | 48px | Hero spacing |

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 6px | Badges, small chips |
| `rounded-md` | 10px | Buttons, inputs |
| `rounded-lg` | 16px | Cards, panels (primary radius) |
| `rounded-xl` | 24px | Modals, large panels |
| `rounded-full` | 9999px | Avatars, status dots |

## Shadows

Warm-toned shadows (not neutral gray):

| Token | Value | Use |
|-------|-------|-----|
| `shadow-sm` | `0 1px 2px rgba(180, 120, 100, 0.05)` | Subtle lift on cards |
| `shadow-md` | `0 4px 12px rgba(180, 120, 100, 0.08)` | Elevated cards, dropdowns |
| `shadow-lg` | `0 8px 24px rgba(180, 120, 100, 0.12)` | Modals, popovers |
| `shadow-xl` | `0 16px 48px rgba(180, 120, 100, 0.16)` | Floating elements |

## Components

### Cards
- Background: white (#FFFFFF)
- Border: 1px solid #F3F4F6
- Border radius: 16px (rounded-lg)
- Padding: 24px (space-6)
- Shadow: shadow-sm default, shadow-md on hover

### Buttons
- Primary: Coral background, white text, 10px radius, 12px 24px padding
- Secondary: White background, coral border, coral text
- Ghost: Transparent background, coral text, hover shows coral-light background
- All buttons: 40px height (h-10), DM Sans 500, 14px text

### Inputs
- Background: white
- Border: 1px solid #E5E7EB, focus: 2px coral ring
- Border radius: 10px
- Padding: 10px 14px
- Height: 40px

### Navigation
- Top nav: 64px height, white background, shadow-sm
- Nav links: 14px, 500 weight, text-secondary, coral on active
- Logo: text-xl, 700 weight, coral color

### Charts
- Coral-to-peach gradient fills
- 2px stroke width on lines
- Rounded line caps
- Animated on load (fade-in + slight grow)
- Tooltips: white background, shadow-md, 12px radius

### Tables (TanStack Table)
- Header: cream background (#F5F0EB), text-secondary, 12px uppercase
- Rows: white background, hover shows cream
- Cells: 14px body, 16px padding
- Borders: bottom border-light only

### Empty States
- Centered illustration or icon (coral tint)
- Title: text-lg, 600 weight
- Description: text-sm, text-secondary
- CTA button: primary coral

### Progress Bars (Budgets)
- Track: cream (#F5F0EB), 8px height, 4px radius
- Fill: coral gradient, 4px radius
- Label: percentage, text-sm, positioned above or right

## Layout

### Dashboard
- Max width: 1200px centered
- Two-column: 60/40 split on desktop
- Single column on mobile
- Grid gap: 24px

### Page Layout
- Consistent 24px padding on content area
- Page titles: text-xl, 600 weight, 32px below nav
- Sections: 32px between major sections

### Responsive Breakpoints
- Mobile: < 640px (single column, stacked charts)
- Tablet: 640-1024px (two-column charts, full-width table)
- Desktop: > 1024px (full dashboard layout)

## Motion

- Chart animations: 600ms ease-out fade + grow
- Card hover: 200ms ease shadow transition
- Page transitions: 300ms ease-in-out slide
- Button press: 100ms scale(0.98)
- Loading skeletons: 1.5s infinite shimmer (cream to white)

## Anti-patterns to Avoid

- No cold blue-gray backgrounds (use warm cream/white)
- No sharp corners below 6px (everything rounded)
- No thin hairline borders (use 1px solid or shadow)
- No all-caps text (except small table headers)
- No dark mode in v1 (Phase 4)
- No generic icon libraries (use consistent line icons)
