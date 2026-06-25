# Marketing landing page — bold redesign (2026-06-25)

**Design read:** B2B SaaS landing for SMB owners/finance teams. Redesign-PRESERVE: keep theme tokens
(`--accent`/`--t1`/`glass-*`), Geist font, routes, `#anchors`, SEO/JSON-LD, and every honest claim.
**Dials:** VARIANCE 7 · MOTION 6 · DENSITY 4. **Stack:** Next 16 RSC + Tailwind v4 + `motion/react` + lucide.

## Section layout-family map (no family twice · ≤2 consecutive splits · ≤3 eyebrows)
1. Hero — asymmetric split (copy + framed product preview)        [eyebrow 1]
2. TrustStrip — slim credibility band                              [no eyebrow]
3. Features — rhythmic bento grid (8 cells, 2-3 visual)            [eyebrow 2]
4. Security — split + divided list (sticky head / divide-y list)   [no eyebrow]
5. DualCurrency — full-width accent statement band                 [no eyebrow]
6. Pricing — 3-tier grid, highlighted popular                      [eyebrow 3]
7. FAQ — 2-col (head left / accordion right)                       [no eyebrow]
8. FinalCta — centered aurora CTA band                             [no eyebrow]

## Tasks
- [x] Install `motion` (12.42.0)
- [ ] `components/marketing/motion.tsx` — Reveal, RevealStagger, SpotlightCard (client, reduced-motion safe)
- [ ] globals.css — add scoped `.mkt-grain` / `.mkt-aurora` helpers (additive, won't touch app)
- [ ] Nav — floating glass "island" pill nav, active-link hover, one line ≤80px, keep Sheet + session
- [ ] Hero — split layout, 4 text elements max (drop tagline-below-CTA), 20-word subtext, elevated preview w/ depth + float
- [ ] TrustStrip — refined band, fold in "14-day trial · no card" reassurance honestly
- [ ] FeatureModules — bento grid w/ featured tiles + mini visuals, hover spotlight, stagger reveal
- [ ] SecuritySection — split + divide-y list + isolation visual (distinct family)
- [ ] DualCurrency — full-width accent band, refined frozen-rate visual
- [ ] Pricing — polish, hover, aligned feature lists, pinned CTA, motion
- [ ] FAQ — 2-col, drop eyebrow, polish
- [ ] FinalCta — aurora band, grain, single primary intent
- [ ] Footer — light polish for consistency
- [ ] section.tsx — heading supports left-align + tighter rhythm
- [ ] `pnpm build` — zero TS/ESLint errors
- [ ] Adversarial review workflow (anti-slop checklist + a11y + RSC + theme correctness)

## Guardrails
- Theme-aware ONLY — no hardcoded light/dark colors except the intentionally-fixed dark product preview.
- ZERO em-dashes in visible copy. No fabricated customer logos (product is bootstrapped). No new fake claims.
- Motion: `whileInView once`, `useReducedMotion` guard, transform/opacity only.
- Honesty: all copy must match shipped features.

## Review fixes (from adversarial multi-agent review — 13 confirmed)
- [ ] Button focus ring (shared components/ui/button.tsx) — WCAG 2.4.7 [HIGH, app-wide → flag]
- [ ] --t3 muted text fails AA — switch meaningful marketing copy to --t2 [HIGH]
- [ ] white-on-accent fails on amber/nord/forest — add per-theme --on-accent token; apply to Button default, pricing popular badge, logo Q [HIGH/MED]
- [ ] --accent2 text fails on solarized — add --accent-ink token for eyebrow/link text [MED]
- [ ] motion hydration mismatch + no-JS/LCP — move reveals to CSS scroll-driven (visible by default), keep motion only for spotlight [MED]
- [ ] DualCurrency h2 missing lg step [MED]
- [ ] focus rings on bare anchors, touch targets (toggle 26→44, hamburger 30→44) [LOW]
- [ ] page TITLE em-dash; aria-current="location"; reduced-motion scrollIntoView; bento radii; chip collision @lg→xl; z-1 consistency; delivery arrow→icon; nav active vs hover; pricing list Y align [LOW polish]

## Review (completed 2026-06-25)
Adversarial multi-agent review (20 agents): 29 raw findings → 13 verified → all fixed. Build exit 0.

Fixed:
- Button focus ring (shared) + `text-[var(--on-accent)]` foreground [HIGH, app-wide]
- `--t3` muted copy → `--t2` across pricing/footer/dual-currency/features/security/faq [HIGH]
- New `--on-accent` token (white default; dark ink for amber/nord/forest) on Button/badge/logo [HIGH/MED]
- New `--accent-ink` token (solarized darkened) on eyebrows/hero badge/faq link [MED]
- Motion re-architected: CSS scroll-driven reveals (`.mkt-reveal/.mkt-rise/.mkt-float`, visible-by-default,
  no-JS/LCP/reduced-motion safe). `motion` lib now only powers SpotlightCard cursor glow. Kills hydration
  mismatch + no-JS-invisible + LCP regression in one move. [MED]
- DualCurrency h2 lg step; focus rings on nav/footer/faq anchors; toggle 44px; hamburger 44px;
  TITLE em-dash→·; aria-current="location"; reduced-motion scrollIntoView; bento radii; chip lg→xl;
  z-1 normalization; delivery arrow→icon; nav active(accent) vs hover; pricing list Y align. [LOW]

Deferred (flagged to user, out of scope):
- Global `--t3` token contrast is weak app-wide (not just marketing) — recommend raising per-theme.
- Shared `.glass-card::before` white sheen is inert in light/solarized — pre-existing app CSS.
