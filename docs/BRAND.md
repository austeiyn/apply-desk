# ApplyDesk brand

"Confetti": a deep indigo ink and a confident grape-violet brand colour on soft lavender surfaces, with five playful accents. Fun, but professional: colour carries meaning and delight, and body text stays calm.

## Logo

An **A** with a check (applied, done) on a grape gradient tile, plus a coral dot.

| File | Use |
|---|---|
| `components/brand/logo.tsx` | `Logo` (mark + wordmark) and `LogoMark` in the app. Use `tone="light"` on dark backgrounds. |
| `app/icon.svg`, `app/favicon.ico` | Browser tab icon |
| `app/apple-icon.png` | iPhone/iPad home screen (square; iOS rounds the corners) |
| `app/opengraph-image.png`, `app/twitter-image.png` | Social share card (1200×630) |

Keep the mark in step across these files if it ever changes. The wordmark is "Apply" in ink and "Desk" in grape.

## Palette

Defined once in `app/globals.css` and available as Tailwind classes (`bg-grape-50`, `text-coral-700`, …).

| Name | Role | 50 (tint) | 500 (fill) | 600 (icon) | 700 (text on tint) |
|---|---|---|---|---|---|
| **Grape** | Brand, primary buttons, links | `#F0ECFF` | `#5B3FE4` | `#4A31C8` | `#3F2AA8` |
| **Coral** | Interviews, warnings of problems, accent CTA | `#FFEEEA` | `#FF6A55` | `#E0472F` | `#B3361F` |
| **Sun** | Preparing, caution, highlights | `#FFF5D6` | `#F5B400` | `#B87A00` | `#7A4E00` |
| **Mint** | Success, offers, "verified" | `#DDF7EF` | `#19C39A` | `#0B8F70` | `#0A6650` |
| **Ocean** | Information, "ready", profile | `#E1F0FF` | `#3AA0FF` | `#1C7FE0` | `#0B58A8` |
| **Bloom** | Documents, screening | `#FFE7F2` | `#FF5FA8` | `#E03B88` | `#A8225C` |

Neutrals: ink `#17143A` (text and dark panels), muted text `#5B5878`, background `#F8F7FF`, cards white, borders `#E6E2F5`.

## Rules that keep it accessible

- **Text on a tint uses the 700 step**, never 500. All text pairs in the table meet WCAG AA (4.5:1) or better; icons on tinted tiles use the 600 step (3:1 or better).
- **White text on coral fails** (2.8:1). Coral fills carry ink text (the "brand" button variant does this).
- **Colour is never the only signal.** Statuses and match levels always have a text label.
- Use colour for **meaning or navigation**, not decoration: sections of the sidebar, application statuses, chart series. Don't add a new hue; reuse these.

## Where colour is assigned

- **Navigation**: `components/app-shell/nav-config.ts` (`tone` per item). Related pages share a colour: profile and CV are ocean, applications coral, documents bloom, interview prep mint.
- **Application statuses**: `STATUS_META` in `lib/constants.ts`.
- **Alerts, badges, match levels**: `components/ui/feedback.tsx`, `components/ui/badge.tsx`, `components/applications/analysis-panel.tsx`.
- **Flourishes** (`app/globals.css`): `.bg-aurora` (pastel hero glow), `.text-gradient` (large headline words only), `.bg-ink-panel` (deep indigo panels), `.bg-confetti-line` (rainbow hairline).

## Charts

Categorical series, in this fixed order: grape `#5B3FE4`, orange `#EB6834`, aqua `#1BAF7A` (`SERIES_COLORS` in `components/charts/time-series-chart.tsx`). Checked with the dataviz palette validator on the white card surface, including the all-pairs check: worst colour-blind separation ΔE 9.2, normal vision 27.6. Aqua is under 3:1 on white, so every chart keeps a legend, a table view and visible labels. Don't add a fourth series colour: fold extra series into "Other".

## Resume and cover letter styles

Document accent colours (`lib/documents/templates.ts`) are separate on purpose: they are for the user's printed documents, not the app's branding.

## Emails

`supabase/templates/*.html` use inline styles only (email clients ignore stylesheets). Supabase uses the copies set in **Authentication → Emails → Templates** on a hosted project, so paste updated HTML there; the files here drive local development.
