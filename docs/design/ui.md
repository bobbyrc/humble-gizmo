# Humble Gizmo UI design

Status: **drafted by Claude while the owner was away. Pending owner approval.**
Screens implement this. Expect visual rework if the owner changes direction.

## Direction

The app should feel like a calm, trustworthy utility for people who aren't
technical: plain words, one obvious next action per screen, and nothing that
looks like Humble's or Steam's branding (no Humble red, no Steam blue). The
accent is a quiet green that means "go/redeem". Warnings, such as gift links and
doubtful matches, use amber. Errors use red.

The theme follows the OS light/dark setting. Fonts are the system font stack
only, with nothing remote.

## Tokens (`src/renderer/theme.css`)

```css
:root {
  --bg: #F6F5F2; --surface: #FFFFFF; --surface-2: #EFEDE8;
  --text: #1B1D1F; --text-muted: #5E6368; --border: #DEDBD4;
  --accent: #1F7A5C; --accent-hover: #186049; --accent-text: #FFFFFF;
  --warn: #8A5800; --warn-bg: #FBF1DC;
  --danger: #B3261E; --danger-bg: #FBE9E7;
  --focus: #2F6FEB;
  --radius: 8px; --row-h: 44px;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --fs-sm: 13px; --fs-md: 14px; --fs-lg: 16px; --fs-xl: 20px; --fs-xxl: 28px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15171A; --surface: #1E2125; --surface-2: #262A2F;
    --text: #ECEDEE; --text-muted: #9BA1A6; --border: #33383E;
    --accent: #4CC79A; --accent-hover: #6BD6AE; --accent-text: #0E1F18;
    --warn: #E6B04A; --warn-bg: #3A2E14;
    --danger: #F2867E; --danger-bg: #3B1E1C;
    --focus: #7AA7FF;
  }
}
html, body { margin: 0; background: var(--bg); color: var(--text);
  font: 400 var(--fs-md)/1.45 var(--font); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

Weights are 400 and 600 only. The window has a minimum size of 900×640.

## Shared components (`src/renderer/components/ui.tsx`)

| Component | Spec |
|---|---|
| `Button` | Variants `primary` (accent background), `secondary` (surface-2 background, border), `danger` (danger text, danger-bg on hover), `link` (accent text, no background). Height 36, padding 0 16, radius `--radius`, weight 600. Disabled at 50% opacity, `cursor: not-allowed` |
| `Checkbox` | A native `<input type=checkbox>` with a `<label>`, accent-color `--accent` |
| `Pill` | A 12px-radius tag at `--fs-sm`. Tones: `warn` (warn on warn-bg), `muted` (text-muted on surface-2), `danger` (danger on danger-bg), `ok` (accent text on surface-2) |
| `Banner` | A full-width message box, radius `--radius`, padding `--s4`. Tones: `warn`, `danger`, `ok`. `role="status"` and `aria-live="polite"`. Optional action button on the right |
| `Section` | A collapsible group. The header row has a chevron, label (weight 600), a count in text-muted, an optional hint in text-muted, and right-aligned actions. It's a `<button aria-expanded>` |
| `ConfirmDialog` | A modal over a 40% black scrim. 440px card with title (`--fs-lg`, 600), body, and Cancel (secondary) + Confirm (primary or danger) buttons. Focus is trapped, and Esc cancels. Optional `requireTyped: string`: Confirm stays disabled until the input matches exactly |
| `Spinner` | A 16px ring in `--accent`, with a static dot under reduced motion |

## Layout

- **Unsigned-in shell** (Welcome, SignIn): a centred card, 520px wide, on `--bg`.
- **Main shell** (everything else):
  - A left sidebar, 200px wide, on `--surface` with a right border. Nav items:
    Redeem, Humble Choice, History, Settings. The active item is accent text
    on surface-2.
  - Sidebar footer: account status, `Humble ● Signed in` and
    `Steam ● Signed in`. The dot is accent when signed in and danger when
    signed out; clicking a signed-out row opens sign-in.
- Content area: padding `--s5`. Header row: title at `--fs-xl`/600 on the left,
  primary action on the right.

## Screens

### Welcome (first run)
- Card contents: `PRIVACY_TITLE` (`--fs-xxl`, 600), then `PRIVACY_LINE_1` and
  `PRIVACY_LINE_2` as two paragraphs.
- A bordered row holding the checkbox `UPDATE_TOGGLE`, with `UPDATE_TOGGLE_NOTE`
  muted beside it.
- Below that, muted at `--fs-sm`: "You can change this any time in Settings."
- A primary "Continue" button, right-aligned.
- Footer: `NOT_AFFILIATED`, muted at `--fs-sm`.

### Sign in
- Title: "Sign in to get started".
- Muted line: "You'll sign in on Humble Bundle's and Steam's own pages. Humble
  Gizmo never sees your password."
- Two cards side by side (Humble Bundle, Steam). Each shows the name at
  `--fs-lg`/600, a status pill (`ok` "Signed in" or `muted` "Not signed in"),
  and a "Sign in" button (primary). When signed in, the button becomes a
  "Signed in ✓" pill.
- When both are signed in: a spinner with "Loading your library…", then "Found N
  Steam keys", plus a warn banner "Couldn't load K orders — try again later" when
  K > 0. The screen moves on to Redeem automatically after 1 second.
- Service-changed errors appear as a danger banner with `serviceChanged(...)`
  and the action "Get the latest version".

### Redeem (review)
- Header: "Ready to redeem N games", with a primary "Redeem N" button (disabled
  when N = 0).
- Sections in group order with `GROUP_LABELS`. Only Will redeem is expanded by
  default. Section hints:
  - maybe_owned: "check these"
  - owned: "skipped"
  - failed_before: "tick to retry"
- Rows are `--row-h` tall: checkbox, name, then right-aligned pills.
  - `UNREVEALED_LABEL` (warn)
  - "duplicate" (muted)
  - "matches <matchedName>" (muted)
  - The `CODE_LABELS` text (danger)
- An untickable row shows a disabled checkbox and muted name.
- Each section header has an "Untick all" link button.
- Empty state, when there's nothing in any section: "Nothing new to redeem.
  You're all caught up."

### Run
- Header: "Redeeming…" (or "Done"), with count pills `ok` "N added", `muted`
  "N already owned", `danger` "N errors", and a secondary "Stop" button.
- Banner slot:
  - Rate limited: warn banner with `rateLimitMessage(time)`.
  - Signed out: danger banner "Sign in to Steam again" (or Humble), with the
    action "Sign in".
  - Finished: ok banner "Done — X added, Y already owned, Z errors", with the
    action "Back to review".
- The live list shows the newest at the top. Each row has the name and an outcome
  pill: `ok` added, `muted` already owned, `danger` the code label. The list has
  `aria-live="polite"`.

### Humble Choice
- Header: "Humble Choice".
- One card per month. Card header: month name (600), then muted "Pick up to N (k
  picked)" or "Claim all N games".
- Each game row has a checkbox, the title, and a muted rating ("Very Positive ·
  93%"). Non-claimable games show a link button "Claim on Humble" instead of a
  checkbox.
- Card footer: "Claim all" link (when allowed) and a primary "Claim K" button.
- Confirm uses `ConfirmDialog`: "Claiming can't be undone. Claim K games from
  <month>?"
- Success: ok banner "Claimed. New keys will appear in your review list."
- Empty: "No Humble Choice picks left to make."

### History
- Two columns. On the left, the history table: Name, Result (pill), Date (local
  short date and time), newest first. Empty: "Nothing redeemed yet."
- On the right, a 300px "Export to CSV" card holding checkboxes for the export
  options and a primary "Export…" button.
  - "Nothing to export" is shown muted, with the button disabled, when neither
    revealed nor unrevealed is selected.
  - Reveal-all opens a danger `ConfirmDialog` with `requireTyped: "REVEAL"`.

### Settings
Stacked sections, each with a 600-weight heading:
- **Privacy:** the update checkbox and note, with a secondary
  `CHECK_UPDATES_NOW` button and a result line ("You're up to date", "A new
  version is available" with a link, or "Couldn't check").
- **Background:** schedule select (Off / Every 6 hours / Every 12 hours / Every 24
  hours), "Keep running in background", "Launch at login".
- **Accounts:** sign-out buttons, one per service.
- **Advanced** (collapsed `Section`): Steam Web API key field (password-style
  input). Help text: "Optional. Only needed if Humble Gizmo can't work out which
  games you own. Get one at steamcommunity.com/dev/apikey."
- **Data:** a warn `NO_KEYRING_NOTICE` banner when storage is unencrypted, and
  a danger "Delete all local data" button that goes through `ConfirmDialog`.
- **About:** version, `NOT_AFFILIATED`.
