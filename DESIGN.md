---
name: Humble Gizmo
description: Redeem your Humble Bundle Steam keys like coupons in a jet-age ticket wallet.
colors:
  ground: '#f1f1ee'
  sheet: '#ffffff'
  tab: '#e2e5ec'
  tab-soft: '#f5f6f9'
  ink: '#101a3a'
  ink-2: '#4a5372'
  rule: '#14245e'
  rule-soft: '#c9cedb'
  rail: '#14245e'
  rail-2: '#1f3275'
  on-rail: '#ffffff'
  on-rail-2: '#c3cae6'
  primary: '#14245e'
  primary-hover: '#1f3275'
  on-primary: '#ffffff'
  carbon: '#4b2e83'
  carbon-copy: '#e9e3f6'
  void: '#c42b1c'
  void-bg: '#fbe8e5'
  gift: '#9a5200'
  gift-bg: '#fff0d9'
  brand: '#d9381e'
  brass: '#e3ae3a'
  focus: '#1d5bd8'
  signed-in: '#8ee0b5'
  signed-out: '#ff8a7a'
  scrim: 'rgba(11, 18, 41, 0.55)'
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '38px'
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: '0.01em'
  headline:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '24px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '0.02em'
  title:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '0.02em'
  button:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '16px'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '0.08em'
  nav:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '16px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.1em'
  tab:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '15px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.08em'
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '13px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '0.12em'
  pill:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '13px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '0.07em'
  stamp:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: '13px'
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: '0.1em'
  body:
    fontFamily: "'Libre Franklin', system-ui, sans-serif"
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0em'
  row:
    fontFamily: "'Libre Franklin', system-ui, sans-serif"
    fontSize: '15px'
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: '0em'
  link:
    fontFamily: "'Libre Franklin', system-ui, sans-serif"
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: '0em'
  data:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: '0em'
  numeral:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: '22px'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '0em'
rounded:
  sm: '2px'
  stamp: '3px'
  full: '50%'
spacing:
  s1: '4px'
  s2: '8px'
  s3: '12px'
  s4: '16px'
  s5: '24px'
  s6: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    height: '40px'
    padding: '0 18px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.on-primary}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    height: '40px'
    padding: '0 18px'
  button-secondary-hover:
    backgroundColor: '{colors.tab-soft}'
    textColor: '{colors.ink}'
  button-danger:
    backgroundColor: 'transparent'
    textColor: '{colors.void}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    height: '40px'
    padding: '0 18px'
  button-danger-hover:
    backgroundColor: '{colors.void-bg}'
    textColor: '{colors.void}'
  button-link:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.link}'
  button-link-hover:
    backgroundColor: 'transparent'
    textColor: '{colors.carbon}'
  pill-warn:
    backgroundColor: '{colors.gift-bg}'
    textColor: '{colors.gift}'
    typography: '{typography.pill}'
    rounded: '{rounded.sm}'
    padding: '2px 8px'
  pill-muted:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-2}'
    typography: '{typography.pill}'
    rounded: '{rounded.sm}'
    padding: '2px 8px'
  pill-danger:
    backgroundColor: '{colors.void-bg}'
    textColor: '{colors.void}'
    typography: '{typography.pill}'
    rounded: '{rounded.sm}'
    padding: '2px 8px'
  stamp-redeemed:
    backgroundColor: 'transparent'
    textColor: '{colors.carbon}'
    typography: '{typography.stamp}'
    rounded: '{rounded.stamp}'
    padding: '2px 9px'
  stamp-owned:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-2}'
    typography: '{typography.stamp}'
    rounded: '{rounded.stamp}'
    padding: '2px 9px'
  stamp-void:
    backgroundColor: 'transparent'
    textColor: '{colors.void}'
    typography: '{typography.stamp}'
    rounded: '{rounded.stamp}'
    padding: '2px 9px'
  banner-warn:
    backgroundColor: '{colors.gift-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
  banner-danger:
    backgroundColor: '{colors.void-bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
  banner-ok:
    backgroundColor: '{colors.carbon-copy}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
  tab:
    backgroundColor: '{colors.tab}'
    textColor: '{colors.ink-2}'
    typography: '{typography.tab}'
    padding: '10px 16px 9px'
  tab-selected:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
  sheet:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
  column-head:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink-2}'
    typography: '{typography.label}'
    padding: '10px 20px'
  sheet-row:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    typography: '{typography.row}'
    height: '44px'
    padding: '0 20px'
  sheet-row-hover:
    backgroundColor: '{colors.tab-soft}'
    textColor: '{colors.ink}'
  nav-item:
    backgroundColor: 'transparent'
    textColor: '{colors.on-rail-2}'
    typography: '{typography.nav}'
    padding: '12px 24px'
  nav-item-hover:
    backgroundColor: '{colors.rail-2}'
    textColor: '{colors.on-rail}'
  nav-item-current:
    backgroundColor: '{colors.ground}'
    textColor: '{colors.ink}'
    typography: '{typography.nav}'
    padding: '12px 24px'
  dialog:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    width: '460px'
    padding: '24px'
  text-input:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    height: '40px'
    padding: '0 12px'
---

# Design System: Humble Gizmo

## Overview

**Creative North Star: "The Ticket Wallet"**

Every Humble key is a coupon in a traveller's ticket wallet. The screen shows the whole backlog as a coupon book: each key sits on a ruled sheet, the groups are coupon heads in a row of tabs, and nothing is spent until the person presses Redeem. Once Steam accepts a key, its coupon receives a stamp, and the stamp stays. History is the same stack of stamped coupons, so a key is never lost from view.

The look borrows the type, palette and ruled-coupon construction of a jet-age airline ticket wallet and nothing more. The ground is stock white. Sheets are coupon white, ruled with navy hairlines and broken by dashed tear lines. The rail and primary buttons are carrier navy. Counts, ticks and redeemed stamps are carbon purple. Void red is kept for failure. Density is working density: 44px rows, 15px body, many keys on one screen, because the audience is clearing a backlog. The personality sits in the sheet heads, the notches and the stamp. Body text stays plain for the less confident person.

Dark mode is the same wallet at night: a navy ground, sheets one step lighter, and the carbon and void tones lifted so they stay legible.

**Build notes.** Where the shipped build departs from the original surface brief, the build is recorded here as shipped. The stamp lands from scale 1.14, not 1.12. Data text is Ink Slate, not carbon; carbon is reserved for numerals, ticks, redeemed stamps and success. The Review heading counts the ticked games (the "Redeem 140" count), while the Will redeem tab counts the whole group. In dark mode the primary button inverts to a pale fill with navy text. The Delete all local data and Reveal-and-export confirmations use the danger tone, which the brief had reserved for failures.

**Deliberate limits.** Every stamp carries a subtle procedural ink-wear mask, applied with `mask-image` from `src/renderer/assets/stamp-ink.png` (generated by `scripts/gen-stamp-ink.mjs`). The renderer build sets `assetsInlineLimit` to 0 because the CSP blocks `data:` images. There is no paper grain and no decorative jet stripes on working screens; the brand speed stripes appear only in the wordmark mark. Italic display type is used only on page H1s. The From column truncates with a title tooltip at narrow widths.

**Key Characteristics:**

- Ruled coupon sheets with dashed tear lines; sheets, rows and tabs carry no shadow
- Notched corners on tab heads and the active nav item; sheets stay square
- Barlow Condensed caps for chrome, Libre Franklin for reading, Courier Prime for data
- The stamp is the one signature object, and it marks an outcome
- Carrier navy for the rail and primary actions; carbon purple for counts and success; void red for failure
- Calm, dense working surfaces with the world carried by rules, notches and stamps

## Colors

A two-hue wallet: carrier navy and carbon purple on stock white, with void red and gift amber held back for failure and warnings. Light values are normative in the frontmatter; the dark values are in the sidecar.

### Primary

- **Carrier Navy** (#14245e): The rail, primary buttons, the strong sheet top rule and the column-head underline. The single brand-structure colour. Dark mode uses #121c44 for the rail and inverts the primary button to a pale fill (#dce2f5).
- **Carrier Navy Hover** (#1f3275): Hover fill for primary buttons and the rail nav hover.

### Secondary

- **Carbon Purple** (#4b2e83): Live counts in tabs and tallies, checkbox ticks, the REDEEMED stamp, success banners, selection highlight and the caret. Dark mode lifts it to #b7a2f2.
- **Carbon Copy** (#e9e3f6): The success banner and the stub tint on the Review sheet and the export card.

### Tertiary

- **Void Red** (#c42b1c): Failed keys, the VOID stamp, error pills, the danger button and the danger dialog title.
- **Void Blush** (#fbe8e5): Background for failure pills and danger banners.
- **Gift Amber** (#9a5200): The "uses up its gift link" note, the warn banner and the amber count on Might already own.
- **Gift Cream** (#fff0d9): Background for warn pills and banners.
- **Brand Red** (#d9381e): The wordmark speed-stripe mark and the app icon only.
- **Brass** (#e3ae3a): The focus ring on the rail, where navy would vanish.
- **Focus Blue** (#1d5bd8): The focus outline on every other surface.
- **Signed-in Mint** (#8ee0b5) and **Signed-out Coral** (#ff8a7a): Status dots in the rail footer.

### Neutral

- **Stock White** (#f1f1ee): The page ground behind every sheet.
- **Coupon White** (#ffffff): Sheets, cards, dialogs, inputs and the stub.
- **Tab Blue-Grey** (#e2e5ec): Inactive coupon heads. **Tab Mist** (#f5f6f9) is the row hover.
- **Ink Navy** (#101a3a): Body text and selected tab text.
- **Ink Slate** (#4a5372): Secondary text, column heads, data and inactive tabs (6.0:1 on Tab Blue-Grey, 7.6:1 on Coupon White).
- **Perforation Grey** (#c9cedb): Dashed row separators and the tear line. Decorative only; it is not used for text.
- **Rail Mist** (#c3cae6): Nav item text on the rail (8.9:1).
- **Scrim** (rgba(11, 18, 41, 0.55)): The dialog backdrop.

### Named Rules

**The Carbon Means Done Rule.** Carbon purple marks what was counted or completed: counts, ticks, redeemed stamps and success. Two other carbon uses exist (link hover and the export heading); neither adds a new meaning.

**The Red Is Failure Rule.** Void red marks a failed key and its reason, and the danger tone. The danger tone is used only for destructive or irreversible actions (Delete all local data, Reveal and export). Red is never decorative.

## Typography

**Display Font:** Barlow Condensed (fallback Arial Narrow, sans-serif), bundled at 600, 700 and 700 italic.
**Body Font:** Libre Franklin (fallback system-ui, sans-serif), bundled at 400, 500 and 600.
**Label/Mono Font:** Courier Prime (fallback Courier New, monospace), bundled at 400 and 700, for data, numerals and tabular figures.

**Character:** A condensed, all-caps display face gives the chrome the stamped, timetable feel of a ticket. A humanist sans carries the sentences, so the warnings and explanations read as plain speech. A typewriter face marks the data a person checks against their own records: bundles, dates, keys and times.

### Hierarchy

- **Display** (700 italic, 38px, line-height 1.05, +0.01em, uppercase): Page H1 only, e.g. "Ready to redeem 140 games". Italic is the forward slant of the wallet and is reserved for this one role.
- **Headline** (700, 24px, line-height 1.1, +0.02em, uppercase): Page H2 content and dialog titles.
- **Title** (700, 20px, line-height 1.1, +0.02em, uppercase): Settings group heads and sign-in card names.
- **Tab** (600, 15px, line-height 1.2, +0.08em, uppercase): Coupon-head labels on the Review and Choice tabs.
- **Nav** (600, 16px, line-height 1.2, +0.1em, uppercase): Rail navigation and the account label.
- **Button** (600, 16px, line-height 1, +0.08em, uppercase): Every button except text links.
- **Label** (600, 13px, line-height 1.4, +0.12em, uppercase): Column heads and the rail's small wordmark line.
- **Pill and stamp** (600 and 700, 13px, uppercase, +0.07em and +0.1em): Notes and outcomes on rows.
- **Body** (400, 15px, line-height 1.5): Reading text. Welcome copy is 16px with a 46ch measure.
- **Row** (500, 15px, line-height 1.3): Game names in the list.
- **Link** (600, 14px, line-height 1.5, Libre Franklin): Underlined text links.
- **Data** (400, 13px, line-height 1.4, Courier Prime, tabular): From column, dates, run attempts and version.
- **Numeral** (700, 22px in tallies, 14px in tab counts, Courier Prime): Counts.
- **One-off sizes:** Choice month names (700, 18px) and the export card heading (700, 22px) sit inside their own cards; they are not new tiers of the scale.

### Named Rules

**The Italic Headline Rule.** Only page H1s are italic. Every H2 and below is upright Barlow caps, so the slant is never a second voice.

**The Typewriter Data Rule.** Anything a person checks against their own records (bundle, year, date, key, time, count of attempts) is set in Courier Prime. Names and sentences are never set in it.

## Layout

The app is a fixed two-column shell. A 232px navy rail holds the wordmark, the four nav items and the sign-in status at the foot. The content column fills the rest of the window at full height. The minimum window is 900 by 640.

- **Content column:** padding 32px top, 40px sides, 40px bottom; the column scrolls on its own. Screen headers are a flex row aligned to the end, with 16px between items and 24px below.
- **Header actions:** Refresh and the primary action sit at the right end of the header, 10px apart.
- **Unsigned-in shell:** The welcome and sign-in screens sit in one centred 560px coupon on a navy backdrop, with 24px around it and a 32px by 40px body.
- **Review sheet:** Its columns are 44px (checkbox), a flexible game name, 260px From and 240px Note. Below 1100px the From column becomes flexible and Note narrows to 170px. The sheet fills the window height; the list scrolls inside the sheet and the header and tabs stay fixed. This is the one layout rule people feel most, so it is named below.
- **History:** A flexible table beside a 320px export card; the two stack below 999px.
- **Run list:** A flexible name column and a 240px right-aligned outcome column.
- **Settings:** A single column capped at 760px, with a 24px gap between groups.
- **Sign-in:** Two equal cards in a 16px-gap grid.
- **Spacing rhythm:** The scale is 4, 8, 12, 16, 24 and 32px. Row padding is 20px at the sides, and a few one-off values (10, 14, 20, 28 and 40px) appear in place where the layout needs them. Use the scale first.
- **Responsive behaviour:** Two breakpoints only (1100px for the Review columns, 999px for History). Nothing else reflows; the app is a desktop window.

### Named Rules

**The Sheet Fills The Window Rule.** The Review sheet takes the remaining window height and the list scrolls within it. Headers and tabs never scroll away, so the stamp and the Redeem count stay in view on a long backlog.

## Elevation & Depth

Flat by default. Sheets, rows, tabs and inputs have no shadow; depth comes from rules: a 2px navy top rule on sheets, a 3px one on dialogs, a 1.5px underline under column heads, and dashed perforations between rows. Only floating layers lift: the unsigned-in coupon and the dialogs use one soft shadow, and dialogs sit over a scrim. Stamps are rotated, not shadowed.

### Shadow Vocabulary

- **Lift** (`box-shadow: 0 18px 48px rgba(11, 18, 41, 0.28)`; dark `0 18px 48px rgba(0, 0, 0, 0.5)`): The unsigned-in coupon and dialogs only. Its purpose is to float a layer above the scrim or the navy backdrop.

### Named Rules

**The Flat Sheet Rule.** Sheets, rows, tabs and inputs never cast a shadow. A shadow appears only on a floating layer that sits over the screen.

## Shapes

Nearly square. Corners are 2px on every control, pill, banner, input and sheet bottom; stamps are 3px; dialogs are square. The character comes from cuts and rules, not from curves.

- **Notch:** A 10px diagonal cut on the top-right corner of each coupon head (Review tabs and Choice month names) and the top-left corner of the active nav item. The Review tab panel carries an 18px circular bite at its top and bottom edges, painted in the ground colour, that reads as a torn coupon stub. The bites only read correctly on the ground colour, so they must not be placed over a non-ground surface.
- **Stub:** The first 64px of the Review sheet is tinted (Carbon Copy blended 60% into Coupon White) and separated from the rows by a 1px dashed vertical line.
- **Tear line:** 1px dashed Perforation Grey between rows, under the dialog actions and between settings entries.
- **Borders:** 1.5px on buttons (secondary and danger), pills, banners, the tally chips and inputs; 2px on sheet and card top rules; 3px on the dialog top rule.
- **Stamp:** A double rule: a 2px border plus a 1px outline offset 2px, both in the current colour.
- **Dot:** A 50% circle, 8px, on the rail footer.

### Named Rules

**The Tear Line Rule.** Rows are separated by dashed perforations, never solid lines. A vertical tear line appears only on the Review stub, at 64px.

**The Notch Rule.** Only coupon heads (Review tabs and Choice month names) and the active nav item take a cut corner. Sheets, cards, dialogs and buttons stay square so the notch keeps its meaning.

## Components

Components are plain and dense: they state what happens and what it costs, and they let the coupon carry the character.

### Buttons

- **Shape:** 40px tall, 2px radius, 1.5px border, 18px side padding, Barlow caps 16px at +0.08em.
- **Primary:** Carrier Navy fill with white text; Carrier Navy Hover on hover. The one primary per screen is the action that spends something (Redeem, Continue, Claim, Export).
- **Secondary:** Transparent with a 1.5px Ink Navy border and text; Tab Mist fill on hover. Used for Refresh, Stop, Cancel and sign-out.
- **Danger:** Transparent with a Void Red border and text; Void Blush fill on hover. Used for Delete all local data and in the danger dialog's confirm.
- **Link:** 14px Libre Franklin 600, underlined with a 3px offset, Ink Navy; Carbon Purple on hover. Used for Untick all, Claim all, Claim on Humble and Open the releases page.
- **Disabled:** 45% opacity, not-allowed cursor.
- **Focus:** A 2px Focus Blue outline with a 2px offset; Brass on the rail.
- **Motion:** Background colour only, 0.12s.

### Stamps (signature)

- **Shape:** Inline block, a double rule (2px border plus 1px outline offset 2px), 3px radius, 2px by 9px padding, Barlow 13px 700 caps at +0.1em. Rotated -4deg and set at 92% opacity.
- **Tones:** REDEEMED (Added, Signed in, All caught up) is Carbon Purple. ALREADY OWNED (Already owned) is Ink Slate. VOID (a failure, labelled with its reason) is Void Red.
- **Where:** Each key's outcome in the Run list (right-aligned in the 240px column), the History Result column, the "Signed in" state on the sign-in card, and the empty Review state.
- **Ink-Wear Stamp Rule:** Every `.stamp` carries the procedural ink-wear mask (`src/renderer/assets/stamp-ink.png`, generated by `scripts/gen-stamp-ink.mjs`, applied with `mask-image`). The mask is the stamp's only texture; the renderer build sets `assetsInlineLimit` to 0 because the CSP blocks `data:` images.

### Pills

- **Shape:** Inline block, 1.5px border, 2px radius, 2px by 8px padding, Barlow 13px 600 caps at +0.07em, no wrapping. The lowercase copy is set in caps by the style.
- **Tones:** Gift Amber on Gift Cream for "uses up its gift link"; Ink Slate on a transparent ground for "duplicate" and "matches X"; Void Red on Void Blush for "won't work" and "tick to retry".

### Banners

- **Shape:** Full-width flex row, 1.5px border in the tone colour, 2px radius, 12px by 16px padding, optional secondary action at the right.
- **Tones:** warn (Gift Amber on Gift Cream), danger (Void Red on Void Blush), ok (Carbon Purple on Carbon Copy). Each is a polite live region with role status.

### Coupon Heads (Tabs)

- **Shape:** A row of tabs with a 4px gap, wrapping when space runs out. Each head is Barlow 15px 600 caps at +0.08em, 10px by 16px padding, with the 10px notch at the top-right corner.
- **States:** Inactive heads on Tab Blue-Grey with Ink Slate text. The selected head is Coupon White with Ink Navy text and sits on the sheet's 2px top rule. A count follows the label in Courier Prime bold, Carbon Purple by default, Gift Amber on Might already own and Void Red on Failed before.
- **Keyboard:** Arrow keys move between heads, Home and End jump to the ends; only the selected head is in the tab order.

### Coupon Sheet and Rows

- **Sheet:** Coupon White with a 2px Carrier Navy top rule and 2px bottom corners. A hint bar above the column heads carries the group hint ("check these", "skipped", "tick to retry") and an Untick all link when any row is ticked.
- **Column heads:** Barlow 13px 600 caps at +0.12em, Ink Slate, 10px by 20px padding, a 1.5px Carrier Navy underline.
- **Rows:** 44px tall, 20px side padding, a dashed Perforation Grey bottom rule, Tab Mist on hover. A row reads checkbox, game name (Libre Franklin 15px 500), From (Courier Prime 13px, Ink Slate), then its note pills.
- **Truncation:** Game names truncate with an ellipsis. The From column truncates with an ellipsis and shows its full text in a title tooltip. This is deliberate at narrow widths.
- **Stub:** Rows start after the 64px stub on the tear line; the game name is inset 16px so the tear line never runs through it.
- **The One Landing Rule:** Stamps are the only entrance motion in the system. On the Run list a stamp lands once in 160ms: from rotate(-4deg) scale(1.14) and opacity 0 to rotate(-4deg) scale(1), on a cubic-bezier(0.2, 0.8, 0.2, 1) ease. It never runs in History. Reduced motion removes it and every other transition.

### Checkboxes

- **Shape:** Native checkbox, 18px, accent-coloured Carbon Purple, with a 10px gap to its label.
- **Disabled:** The label moves to Ink Slate; the box stays visible so the person can see why a key cannot be ticked.

### Inputs

- **Shape:** 40px tall (settings) or 36px (dialog), 1.5px Ink Slate border, 2px radius, 12px side padding, Coupon White fill. Settings inputs are at least 320px wide; selects show a CSS chevron on the right edge.
- **Focus:** The Focus Blue outline; borders darken to Ink Navy on hover for selects.

### Dialogs

- **Shape:** 460px wide (capped at the window width less 32px), Coupon White, 3px Carrier Navy top rule, square corners, 24px padding, the lift shadow, over the scrim.
- **Content:** A Barlow 24px caps title, a body paragraph in Libre Franklin, an optional typed confirmation (the word must match, the confirm button stays disabled until it does), and actions right-aligned with a dashed top rule. Cancel sits to the left of the confirm button.
- **Behaviour:** Focus moves to the first control on open and returns on close; Tab is trapped inside; Escape cancels.
- **Tone:** Primary for reversible-but-committing actions (Claim games); danger for destructive ones (Delete everything, Reveal and export). Irreversible copy states the cost plainly ("uses up their gift links").

### Navigation (Rail)

- **Rail:** 232px Carrier Navy, with white or Rail Mist text and a faint 1px divider above the footer.
- **Wordmark:** A two-stripe mark in Brand Red (28px by 12px), then "HUMBLE" in Barlow 13px 600 at +0.24em in Rail Mist over "GIZMO" in Barlow 30px 700 white.
- **Items:** Barlow 16px 600 caps at +0.1em, Rail Mist on navy, 12px by 24px padding. Hover is Carrier Navy Hover with white text. The current item is Stock White with Ink Navy text, inset 12px from the rail and notched at its top-left.
- **Footer:** Each service on a line: a Barlow caps name, a status dot (Mint for signed in, Coral for signed out), then "Signed in" or "Signed out" in Libre Franklin 13px. A signed-out row is a button that starts sign-in.

### Wordmark Card

- **Shape:** On the unsigned-in coupon, the mark and "HUMBLE GIZMO" in Barlow 20px 700 caps at +0.06em, Carrier Navy (Ink Navy in dark mode), over a dashed Perforation Grey rule.

### Spinner

- **Shape:** A 16px ring, 2px Perforation Grey with a Carbon Purple top arc, turning at 0.8s. Under reduced motion it becomes a static 6px Carbon Purple dot.

## Do's and Don'ts

### The Working Screens Rule

The world lives in rules, tabs, notches and stamps. Working screens carry no paper grain and no decorative stripes. The only texture on a working screen is the stamp's ink-wear mask. The speed-stripe mark is the wordmark's alone.

### Do:

- **Do** use Carrier Navy for the one primary action on each screen, and Carbon Purple for counts and success.
- **Do** use a Stamp for a key's outcome, and a Pill for a note on a key that has not been acted on yet.
- **Do** pair every colour with words. A tone is never the only signal; "uses up its gift link" and "won't work" carry the meaning in text.
- **Do** keep rows at 44px with dashed perforations, and keep the Review sheet filling the window with its list scrolling inside it.
- **Do** set counts in Courier Prime bold, and name the cost in plain words before an irreversible action.
- **Do** keep the Stamp double rule and rotation exactly as set (-4deg, 92% opacity); the stamp is the one object that is allowed to tilt.
- **Do** use the danger tone and the typed confirmation for any action that cannot be undone.

### Don't:

- **Don't** add an eyebrow or kicker label above a heading. The surface brief bans it; the headings stand alone.
- **Don't** use italic outside page H1s.
- **Don't** shadow sheets, rows, tabs or inputs. The lift shadow is for floating layers only.
- **Don't** use hard offset shadows; the world is flat rules and soft lift, not a neobrutalist offset.
- **Don't** use Void Red for decoration or for a non-destructive state. A failed key is red; a destructive action is red; nothing else is.
- **Don't** use Brand Red beyond the wordmark mark and the app icon.
- **Don't** set body text or a primary button in Carbon Purple.
- **Don't** add paper grain, extra textures or decorative stripes to a working screen. The stamp's ink-wear mask is the one allowed texture.
- **Don't** round corners beyond 2px on controls or 3px on stamps; no pill-shaped buttons.
- **Don't** set display type in a system face. Barlow Condensed is the display face; the fallbacks exist only for a missing font.
- **Don't** load remote fonts, icons or images. Every face and mark is bundled, and the renderer's CSP is `default-src 'self'`.
- **Don't** use a glyph icon to carry meaning. Words, rules and stamps carry it.
