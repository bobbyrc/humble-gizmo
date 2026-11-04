---
version: 1
slug: "src-renderer-screens-review-tsx"
primary_target: "src/renderer/screens/Review.tsx"
related_targets: ["src/renderer/App.tsx"]
---

# Surface brief: Humble Gizmo app (all renderer screens)

Mode: Operate. Hero surface: Review ("Redeem"). Every other screen (Welcome, Sign in, Run, Humble Choice, History, Settings) inherits this world.

Audience and job: see PRODUCT.md. Gamers who don't code and less tech-confident adults; clear a backlog of Humble Steam keys without wasting keys or gift links.

Constraints: spec-fixed copy in src/shared/copy.ts unchanged; all fonts bundled locally (CSP default-src 'self'); no remote assets; WCAG 2.2 AA; light and dark follow the OS; min window 900x640. No eyebrow/kicker labels above headings.

## Direction contract

THESIS: Every key is a coupon in the person's ticket wallet: it gets validated on Steam, or voided, and nothing ever disappears. Refuses the category default of a grey utility table with one green accent.

OWN-WORLD: Stock-white ground, coupon-white sheets ruled in navy hairlines with dashed tear lines; carrier-navy rail and primary buttons; carbon-purple numerals, ticks and REDEEMED stamps; void red only for failures; amber tag for "uses up its gift link". Barlow Condensed caps on notched, tabbed coupon heads; Libre Franklin body; Courier Prime carbon data (bundle, dates, keys, times). Dark mode is the wallet at night: navy ground, coupon sheets one step lighter.

STORY: The person sees the whole backlog as a coupon book, knows what will happen to each key before pressing Redeem, then watches coupons get stamped, and can always find every stamped coupon again in History.

FIRST VIEWPORT: Left navy rail: wordmark, nav (Redeem, Humble Choice, History, Settings), sign-in status at the foot. Main: H1 "Ready to redeem 143 games" left, the count set in carbon numerals; Refresh and navy "Redeem 143" top right. Below: a tab row of coupon heads per group with carbon counts (Will redeem active). Then a white ruled sheet: column heads Game / From / Note; one-line rows of checkbox, game name, Courier "from" (bundle, year), note tag (gift link amber, duplicate muted, "matches X" muted, error code red).

Signature interaction: the stamp. When the run resolves a key, its coupon row receives a slightly rotated carbon stamp in a fixed right-hand cell (REDEEMED carbon purple, ALREADY OWNED navy, VOID red with the reason) that lands with a 160ms press (scale 1.12 to 1, ease-out); reduced motion shows it instantly. History shows the same stamps.

FORM: Jet-age airline ticket wallet (dealt catalog challenger vernacular-ephemera-jet-age-ticket-wallet, chosen by the owner over the assigned Sorting Office and the pick Big Box; not on my grounded list). seed:4f8e19eb6eb217f1

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Game cover art stays out (would add CDN loads; undecided in PRODUCT.md).
