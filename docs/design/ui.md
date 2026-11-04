# Humble Gizmo UI design: Ticket Wallet

Status: **direction chosen by the owner on 2026-11-03 (Impeccable direction round). Build in
progress; final approval after the owner sees the built screens.** Supersedes the earlier
"calm utility" draft.

Product facts live in `PRODUCT.md`. The direction contract lives in
`.impeccable/surfaces/src-renderer-screens-review-tsx.md`.

## Idea

Every key is a coupon in the person's ticket wallet. It gets **stamped** when Steam accepts it
(or voided when it fails), and nothing ever disappears: History is the stack of stamped coupons.
The look borrows a jet-age airline ticket wallet's type, palette, ruled coupons and stamps. It never
borrows its layout: navigation, buttons, tabs, checkboxes and tables stay standard controls.

Stamp ink: every `.stamp` carries a subtle ink-wear mask (`src/renderer/assets/stamp-ink.png`, a procedural tile from `scripts/gen-stamp-ink.mjs`) via `mask-image`, so stamps read as rubber-stamped while staying legible at 13px. The renderer build never inlines assets (`assetsInlineLimit: 0`), because the CSP blocks `data:` images and a blocked mask would hide the stamp. Deliberate limits: no paper grain or decorative jet stripes on working screens, where more world would be costume.

Bans for every screen: no eyebrow/kicker label above a heading; no coloured side stripes on rows,
cards or banners; no gradient text; no emoji or unicode glyphs as icons (draw small SVGs); no
remote fonts or images.

## Fonts (bundled, never remote)

Installed as npm dependencies and imported in `src/renderer/fonts.css` (latin subset only):

| Role                                  | Family           | Weights              | Package import                                                                        |
| ------------------------------------- | ---------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Display and labels (`--font-display`) | Barlow Condensed | 600, 700, 700 italic | `@fontsource/barlow-condensed/latin-600.css`, `latin-700.css`, `latin-700-italic.css` |
| Body (`--font-body`)                  | Libre Franklin   | 400, 500, 600        | `@fontsource/libre-franklin/latin-400.css`, `latin-500.css`, `latin-600.css`          |
| Data (`--font-data`)                  | Courier Prime    | 400, 700             | `@fontsource/courier-prime/latin-400.css`, `latin-700.css`                            |

"Data" means things the person might compare or copy: bundle names and dates, keys, times,
counts, ratings. Never use it for prose or as a "techy" costume.

## Tokens (`src/renderer/theme.css`)

```css
:root {
  /* light: the wallet on a desk */
  --ground: #f1f1ee; /* stock white: page background */
  --sheet: #ffffff; /* coupon stock: lists, cards, dialogs */
  --tab: #e2e5ec; /* inactive coupon heads, row hover is --tab-soft */
  --tab-soft: #f5f6f9;
  --ink: #101a3a; /* body text */
  --ink-2: #4a5372; /* secondary text (7.5:1 on white) */
  --rule: #14245e; /* strong rules: sheet tops, column-head underline */
  --rule-soft: #c9cedb; /* dashed tear lines between rows */
  --rail: #14245e; /* carrier navy: nav rail, unsigned-in backdrop */
  --rail-2: #1f3275; /* rail hover */
  --on-rail: #ffffff;
  --on-rail-2: #c3cae6;
  --primary-bg: #14245e;
  --primary-bg-hover: #1f3275;
  --primary-fg: #ffffff;
  --carbon: #4b2e83; /* carbon purple: counts, ticks, REDEEMED stamp, ok */
  --carbon-copy: #e9e3f6; /* carbon-copy surface (export card, ok banner) */
  --void: #c42b1c; /* failures, VOID stamp, danger */
  --void-bg: #fbe8e5;
  --gift: #9a5200; /* "uses up its gift link" and other warnings */
  --gift-bg: #fff0d9;
  --brand: #d9381e; /* wordmark speed stripes and the icon only */
  --brass: #e3ae3a; /* rail focus ring */
  --focus: #1d5bd8;
  --signed-in: #8ee0b5; /* status dot on the rail */
  --signed-out: #ff8a7a;
  --scrim: rgba(11, 18, 41, 0.55);
  --shadow-lift: 0 18px 48px rgba(11, 18, 41, 0.28);

  --font-display: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  --font-body: 'Libre Franklin', system-ui, sans-serif;
  --font-data: 'Courier Prime', 'Courier New', monospace;
  --fs-xs: 12px;
  --fs-sm: 13px;
  --fs-md: 15px;
  --fs-lg: 18px;
  --fs-xl: 24px;
  --fs-h1: 38px;
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 24px;
  --s6: 32px;
  --s7: 48px;
  --radius: 2px;
  --row-h: 44px;
  --notch: 10px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    /* dark: the wallet at night */
    --ground: #0b1229;
    --sheet: #141d3a;
    --tab: #1c2648;
    --tab-soft: #18213f;
    --ink: #eef0f7;
    --ink-2: #a9b1cc;
    --rule: #8e9bc9;
    --rule-soft: #2e3a63;
    --rail: #121c44;
    --rail-2: #1b2757;
    --on-rail: #ffffff;
    --on-rail-2: #a9b1cc;
    --primary-bg: #dce2f5;
    --primary-bg-hover: #ffffff;
    --primary-fg: #0b1229;
    --carbon: #b7a2f2;
    --carbon-copy: #2a2150;
    --void: #ff8a7a;
    --void-bg: #3a1714;
    --gift: #f4b860;
    --gift-bg: #3a2a10;
    --focus: #8fb0ff;
    --scrim: rgba(0, 0, 0, 0.6);
    --shadow-lift: 0 18px 48px rgba(0, 0, 0, 0.5);
  }
}
html,
body {
  margin: 0;
  height: 100%;
  background: var(--ground);
  color: var(--ink);
  font: 400 var(--fs-md)/1.5 var(--font-body);
  -webkit-font-smoothing: antialiased;
}
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
::selection {
  background: var(--carbon);
  color: var(--sheet);
}
input,
select,
textarea {
  caret-color: var(--carbon);
}
* {
  scrollbar-color: var(--rule-soft) transparent;
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

Type scale in use: H1 `--font-display` 700 **italic** `--fs-h1`/1.05, uppercase, letter-spacing 0.01em (the jet-age forward slant; H1 only).
H2 `--font-display` 700 `--fs-xl`/1.1 uppercase 0.02em. Labels (buttons, tabs, nav, column heads,
tags) `--font-display` 600 uppercase, letter-spacing 0.06–0.12em. Body Libre Franklin 400/500
15px. Muted text is `--ink-2`, never grey or opacity.

## Shared components (`src/renderer/components/ui.tsx` + `ui.css`)

The existing component APIs stay unchanged unless stated. Visuals:

| Component                            | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                             | Never wraps (`white-space: nowrap`). Height 40, padding 0 18px, radius `--radius`, `--font-display` 600 16px uppercase 0.08em. `primary`: `--primary-bg`/`--primary-fg`, hover `--primary-bg-hover`. `secondary`: transparent, 1.5px solid `--ink`, `--ink` text, hover bg `--tab-soft`. `danger`: transparent, 1.5px solid `--void`, `--void` text, hover bg `--void-bg`. `link`: no border/bg, height auto, padding 0, `--font-body` 600 14px, normal case, `--ink`, underline, underline-offset 3px, hover `--carbon`. Disabled: opacity 0.45, `cursor: not-allowed`                                                                                                                                                      |
| `Checkbox`                           | Native checkbox, 18×18, `accent-color: var(--carbon)`, margin 0. Label `--font-body`, gap 10px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Pill` (rendered as a tag)           | Rectangular: radius `--radius`, 1.5px solid border, padding 2px 8px, `--font-display` 600 13px uppercase 0.07em, line-height 1.3, `white-space: nowrap`. `warn`: `--gift` text and border on `--gift-bg`. `muted`: `--ink-2` text, `--rule-soft` border, transparent. `danger`: `--void` on `--void-bg`, `--void` border. `ok`: `--carbon` on `--carbon-copy`, `--carbon` border                                                                                                                                                                                                                                                                                                                                             |
| `Stamp` **(new)**                    | `export function Stamp({ tone, children }: { tone: 'redeemed' \| 'owned' \| 'void'; children: React.ReactNode })` renders `<span className={`stamp stamp-${tone}`}>`. Inline-block, 2px solid currentColor plus `outline: 1px solid currentColor; outline-offset: 2px` (a double-ruled stamp), radius 3px, padding 2px 9px, `--font-display` 700 13px uppercase 0.1em, `transform: rotate(-4deg)`, opacity 0.92. Colours: redeemed `--carbon`, owned `--ink-2`, void `--void`. A `@keyframes stamp-in` (from `transform: rotate(-4deg) scale(1.14); opacity: 0` to `rotate(-4deg) scale(1); opacity: 0.92`, 160ms `cubic-bezier(0.2, 0.8, 0.2, 1)`) applies only under `.run-list .stamp` (the Run screen), never in History |
| `Banner`                             | bg `--sheet`, 1.5px solid border in the tone colour, radius `--radius`, padding 12px 16px, flex row, gap 16, action button right. `warn`: border `--gift`, bg `--gift-bg`. `danger`: border `--void`, bg `--void-bg`. `ok`: border `--carbon`, bg `--carbon-copy`. Text `--ink`. Keeps `role="status"`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Tabs` **(new, replaces `Section`)** | See below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ConfirmDialog`                      | Scrim `--scrim`. Dialog 460px, bg `--sheet`, border-top 3px solid `--rule`, square corners, padding 24px, `--shadow-lift`. Title as H2 (danger tone dialogs colour the title `--void`). Typed-confirm input styled like Settings inputs. Actions row has a 1px dashed `--rule-soft` top border with 16px padding-top. Behaviour unchanged                                                                                                                                                                                                                                                                                                                                                                                    |
| `Spinner`                            | 16px ring: 2px solid `--rule-soft`, top border `--carbon`, 0.8s linear spin; label `--ink-2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### `Tabs`

```ts
export type TabSpec = { id: string; label: string; count: number; tone?: 'warn' | 'danger' }
export function Tabs(props: {
  label: string // aria-label for the tablist
  tabs: TabSpec[]
  active: string // id of the selected tab
  onChange: (id: string) => void
  children: React.ReactNode // the selected tab's panel content
}): React.JSX.Element
```

- Markup: `<div className="tabs"><div role="tablist" aria-label={label} className="tabs-list">`
  one `<button role="tab" id={tabId} aria-selected aria-controls={panelId} tabIndex={selected ? 0 : -1}>`
  per tab, containing `<span className="tabs-label">{label}</span><span className="tabs-count">{count}</span>`;
  then `<div role="tabpanel" id={panelId} aria-labelledby={activeTabId} className="tabs-panel">{children}</div>`.
  Ids from `useId()`.
- Keyboard (WAI-ARIA tabs, automatic activation): ArrowRight/ArrowLeft move to the next/previous
  tab with wrap and select it; Home/End select first/last; focus follows selection.
- Visual: tabs sit in a row with 4px gaps, flush on the panel; when they do not fit, whole tabs wrap to a new row (labels never wrap). Each tab: bg `--tab`, `--ink-2`,
  `--font-display` 600 15px uppercase 0.08em, padding 10px 16px 9px, notched top-right corner
  `clip-path: polygon(0 0, calc(100% - var(--notch)) 0, 100% var(--notch), 100% 100%, 0 100%)`.
  Count: `--font-data` 700 14px, margin-left 8px, `--carbon`; tone `warn` → `--gift`, `danger` →
  `--void`. Selected tab: bg `--sheet`, `--ink`. Hover (unselected): `--ink`.
- Panel: bg `--sheet`, border-top 2px solid `--rule`.

## Sheet primitives (`app.css`)

Shared by Review, Run, Choice, History and Settings:

- `.sheet`: bg `--sheet`, border-top 2px solid `--rule`, radius 0 0 `--radius` `--radius`.
- `.sheet-cols`: a column-head row: `--font-display` 600 13px uppercase 0.12em `--ink-2`,
  padding 10px 20px, border-bottom 1.5px solid `--rule`.
- `.sheet-row`: min-height `--row-h`, padding 0 20px, border-bottom 1px dashed `--rule-soft`
  (the perforation), align-items center; hover bg `--tab-soft`.
- `.data`: `--font-data` 400 13px `--ink-2`, `font-variant-numeric: tabular-nums`.
- `.num`: `--font-data` 700, `--carbon`, tabular-nums (counts inside headings and tallies).

## Shells

### Main shell (`App.tsx` + `app.css`)

- Grid: 232px rail + 1fr, full height.
- **Rail** (`.sidebar`): bg `--rail`, `--on-rail`. Top: the wordmark, padding 28px 24px 32px: an
  authored inline SVG of two forward-leaning speed stripes in `--brand` (28×12), then "HUMBLE"
  (`--font-display` 600 13px, 0.24em, `--on-rail-2`) over "GIZMO" (`--font-display` 700 30px,
  0.04em, `--on-rail`).
- **Nav items**: full-width buttons, `--font-display` 600 16px uppercase 0.1em, `--on-rail-2`,
  padding 12px 24px, hover `--on-rail` on `--rail-2`. **Active** (`aria-current="page"`): the
  item becomes a coupon tab joined to the page: bg `--ground`, colour `--ink`, margin-left 12px,
  padding-left 12px, notched top-left corner `clip-path: polygon(var(--notch) 0, 100% 0, 100% 100%, 0 100%, 0 var(--notch))`.
  Focus ring on the rail uses `--brass`.
- **Footer** (account status): padding 20px 24px, border-top 1px solid rgba(255,255,255,0.12).
  Each row: service name `--font-display` 600 13px 0.12em uppercase `--on-rail-2`, then an 8px
  round dot (`--signed-in` / `--signed-out`) and status text `--font-body` 13px `--on-rail`. A
  signed-out row is a button with underlined text.
- **Content** (`.content`): bg `--ground`, padding 32px 40px 40px, overflow auto.
- **Page primitives** (moved here from review.css/settings.css): `.screen-pad` (no extra padding;
  content already pads), `.screen-header` (flex, align-items flex-end, gap 16px, margin-bottom
  24px; `h1` margin 0; `.screen-header-actions` margin-left auto, gap 10px), `.muted`
  (`--ink-2`), `.small` (`--fs-sm`).

### Unsigned-in shell (Welcome, Sign in)

- `.shell-card`: full window bg `--rail` (the wallet), content centred.
- `.shell-card-inner`: a coupon, width 560px (max 100% − 48px), bg `--sheet`, radius
  `--radius`, `--shadow-lift`, padding 0. Top strip: the wordmark (stripes + "HUMBLE GIZMO" on one
  line, `--font-display` 700 20px 0.06em, `--rail` colour in light mode, `--ink` in dark),
  padding 20px 40px, then a 1px dashed `--rule-soft` tear line. Body padding 32px 40px 36px.

## Screens

### Redeem / Review (hero)

- Header: H1 `Ready to redeem <span class="num">N</span> games` (or "Redeem" when nothing is
  listed). Actions right: Refresh (secondary), "Redeem N" (primary, disabled at 0).
- Warn/danger banners under the header, 16px apart.
- **Group tabs** (`Tabs`, label "Key groups"): one tab per non-empty group in `GROUP_ORDER`, label
  `GROUP_LABELS[group]`, count = items in group. `maybe_owned` tone `warn`, `failed_before` tone
  `danger`. Default selection: `will_redeem` if present, else the first tab. Switching tabs
  keeps every tick.
- Panel: when the group has a hint (`maybe_owned` "check these", `owned` "skipped",
  `failed_before` "tick to retry"), a hint strip (14px `--ink-2`, padding 12px 20px, dashed
  bottom rule) with the "Untick all" link button on its right (shown when any item in the group is
  ticked; keep its aria-label). Without a hint the strip still renders when "Untick all" is
  shown.
- Column heads (`.sheet-cols`) on a grid `44px minmax(0,1fr) 260px 240px`: (blank), Game, From,
  Note.
- Rows (`.sheet-row`, same grid, height `--row-h`): checkbox; game name (15px 500; untickable rows
  `--ink-2`); From in `.data`: `${bundle} · ${year}` from `item.key.bundle` and the first four
  digits of `item.key.purchased`; either part may be missing; "—" when both are; ellipsis on
  overflow with a `title`; Note: the existing tags, left-aligned, gap 6px. Make the `Checkbox`
  wrapper `display: contents` inside rows so the input and label fall into the first two columns.
- **The stub:** the sheet's first 64px (row padding + tick column) is the coupon's tear-off stub, tinted `color-mix(in srgb, var(--carbon-copy) 60%, var(--sheet))`, separated from the rest by a full-height 1px dashed `--ink-2` tear line, with a 14px semicircle notch (filled `--ground`) cut where the tear line meets the sheet's top and bottom edges.
- Below 1100px the grid becomes `44px minmax(0,1fr) minmax(0,1fr) 170px`.
- Virtualisation unchanged (`ROW_HEIGHT` 44).
- Empty (no items at all): a `.sheet` with centred content, padding 48px: a `Stamp
tone="redeemed"` reading "All caught up", then the existing sentence "Nothing new to redeem.
  You're all caught up." in `--ink-2`.
- Loading: the spinner inside an empty `.sheet` with padding 32px.

### Run

- Header: H1 "Redeeming…" / "Done" / "Stopped". Beside it three tallies, then Stop (secondary)
  at the far right while active. A tally is `<span className="tally tally-{kind}"><span
className="num">N</span> label</span>`: 1.5px solid `--rule-soft` border, bg `--sheet`, padding
  6px 12px, number `--font-data` 700 22px, label `--font-display` 600 13px uppercase 0.08em
  `--ink-2`. Number colours: added `--carbon`, already owned `--ink`, errors `--void`. Text
  content stays "N added", "N already owned", "N errors".
- Banners as today (copy unchanged).
- Live list (`.run-list`, `aria-live="polite"`) is a `.sheet` of `.sheet-row`s, newest first,
  grid `minmax(0,1fr) 240px`: name; right-aligned outcome. Outcomes render as `Stamp`: added →
  `redeemed` "Added", already owned → `owned` "Already owned", error → `void` with the code
  label. In-progress text ("Revealing…"/"Redeeming…" or whatever the screen shows today) in `.data`.
  The stamp's landing animation is the signature moment.
- Styles live in a new `components/run/run.css`; Run stops importing review.css.

### Humble Choice

- H1 "Humble Choice". Months stacked with 28px gaps.
- Each month: a single static coupon head (the `.tabs` look, not a tablist): month name as H2
  inside a `--sheet`-coloured notched tab, followed on the same baseline by the pick rule ("Pick up
  to N (k picked)" / "Claim all N games") in `.data`; then a `.sheet` of rows: checkbox + title,
  rating right in `.data`; non-claimable rows show the "Claim on Humble" link button. Footer row:
  1px dashed top rule, padding 14px 20px, "Claim all" link left, primary "Claim K" right.
- Success/failed/empty states as today; empty sentence in `--ink-2` inside a `.sheet` with padding
  32px.

### History

- H1 "History". Two columns: table (1fr) and export card (320px), gap 24px.
- Table: `.sheet` holding a real `<table>`: thead cells styled as `.sheet-cols`, rows as
  `.sheet-row` (dashed perforations). Name 15px; Result as `Stamp` (Added/Already owned/code
  label; "In progress" stays plain `.data` text); Date in `.data`. No stamp animation here.
- Export card: the carbon copy. bg `--carbon-copy`, 1.5px dashed `--carbon` border, radius
  `--radius`, padding 20px. H2 "Export to CSV" in `--carbon`. Options stacked, 10px apart; primary
  "Export…" at the bottom; "Nothing to export" in `--ink-2`.

### Settings

- H1 "Settings". Groups stack with 24px gaps, max-width 760px.
- Each group is a `.sheet` with the H2 as a header row (padding 16px 20px 12px) and rows
  (`.settings-row`) separated by dashed perforations, padding 14px 20px.
- `select` is themed: `appearance: none`, a CSS-drawn chevron (rotated bordered square, `--ink-2`) inside a `.select-wrap`, padding-right 36px. `select` and text/password inputs: height 40, 1.5px solid `--ink-2` border, radius `--radius`,
  bg `--sheet`, `--ink`, 15px body font, padding 0 12px; focus ring `--focus`.
- Advanced disclosure keeps its behaviour; its header styled like the H2 row with a small authored
  SVG chevron that rotates 90° when open.
- Delete all local data: `danger` button. About: version in `.data`.

### Welcome (inside the unsigned-in coupon)

- H1 `PRIVACY_TITLE`. Two paragraphs, 16px, `--ink`, max 46ch.
- The update toggle in a box: 1px dashed `--rule-soft` border, padding 14px 16px, radius
  `--radius`.
- "You can change this any time in Settings." `.muted .small`.
- Continue (primary) right-aligned.
- `NOT_AFFILIATED` below a dashed tear line, `.muted .small`.

### Sign in (inside the unsigned-in coupon)

- H1 "Sign in to get started", intro paragraph `--ink-2`.
- Two service coupons side by side (gap 16px): each bg `--ground`, border-top 2px solid
  `--rule`, padding 16px; name as H2 (20px); status tag; Sign in (primary, full width). When
  signed in, the "Signed in ✓" pill becomes `Stamp tone="redeemed"` reading "Signed in".
- Result area as today.

## App icon

A navy rounded square holding a white airline coupon tilted −10°, with two semicircle notches on
its perforation line and a carbon-purple stamp. Source `build/icon.svg`; exports `build/icon.png`
(1024), `build/icon.icns`, `build/icon.ico`, `resources/icon.png`.
