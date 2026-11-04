# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An Electron desktop app for macOS, Windows and Linux. The UI is web-rendered React and is the same
on every OS; it follows the OS light/dark setting. Minimum window 900×640.)

## Users

Two audiences, designed for equally:

- **Gamers who don't code.** Comfortable with Steam, Discord and installers, and know what a Steam
  key is, but would never run a terminal script. They want the backlog cleared fast.
- **Less tech-confident adults.** Bought bundles for charity or on a friend's tip, rarely install
  desktop apps, and are nervous about anything that touches their accounts. They need reassurance
  at every step that touches money or accounts.

Design for the less confident person without talking down to the gamer.

Their situation: years of Humble Bundle purchases, often hundreds of Steam keys never redeemed.
Their job: get those games into their Steam library without revealing, copying and pasting each key
by hand, and without wasting keys on games they already own.

## Product Purpose

Humble Gizmo redeems a person's unredeemed Humble Bundle Steam keys on Steam for them. Milestone 1
is feature parity with castanley/humble-steam-redeem (a terminal tool): sign in to Humble and
Steam, review the list, redeem, export a CSV of the library, claim Humble Choice picks, and
optionally check for new keys on a schedule.

Success: a non-technical person installs it, signs in and redeems their backlog without reading
anything beyond the download page, and never loses a key or progress.

## Positioning

The same job as a terminal script, made safe and clickable for ordinary people. It signs in through
Humble's and Steam's own login pages (so it never sees a password), shows the full list before
anything happens, and talks to nobody but Humble and Steam. Free, open source, local-only.

## Operating Context

- Main flow: Welcome (privacy promise) → sign in to Humble and Steam in their real login pages →
  Review the list (grouped: Will redeem / Might already own / You already own / Failed before /
  Already done) → untick anything → Redeem → a live run screen with per-game outcomes.
- A run can take hours: Steam allows about 50 activations an hour, so the app waits and resumes on
  its own ("Continuing at 3:42 PM. You can leave this running."). The user often leaves it open.
- Other screens: Humble Choice (claim unclaimed monthly picks), History (past outcomes and CSV
  export), Settings (privacy toggles, scheduled checks, background mode, launch at login, sign out,
  delete all data).
- Scheduled checks run in the background and only notify ("5 new games ready to redeem"); they
  never redeem.

## Capabilities and Constraints

- **Irreversible actions:** revealing a key uses up its gift link; redeeming adds a game to the
  Steam account; claiming a Choice pick uses up a pick. Each must be unmistakable and confirmed
  where the spec says so (export reveal-all needs a hard, typed confirmation).
- **Never act on what the user didn't tick.** Doubtful ownership matches are shown, unticked, in
  their own group; never silently skipped.
- **Privacy:** by default the app contacts only Humble and Steam. Update checks (GitHub) are opt-in
  with the exact wording in `src/shared/copy.ts`. No telemetry. The app's own UI loads no remote
  resources: fonts, icons and images are bundled. Game cover art, if ever shown, comes only from
  Humble/Steam CDNs.
- **Strict CSP**, sandboxed renderer, typed preload bridge. Sign-in windows are the real sites and
  are not styled by the app.
- Spec-fixed copy lives in `src/shared/copy.ts` and must not be reworded without the owner.
- Terminology: "redeem" (activate on Steam), "reveal" (get the key from Humble; uses up the gift
  link), "gift link", "Humble Choice", "pick", "already own", "might already own".
- Undecided: whether game cover art appears anywhere (would add Humble/Steam CDN image loads).

## Brand Commitments

- Name: **Humble Gizmo**. Must show "Not affiliated with Humble Bundle or Valve." in About and on the
  download page.
- Must not look like Humble's or Steam's own branding.
- Voice: **friendly gadget.** Plain and trustworthy first, with a little character that fits the
  name: a satisfying moment when keys land, a light touch in empty states. Never jokey around
  warnings, errors or irreversible actions.
- No app icon exists yet (the current one is Electron's placeholder). The redesign includes one.

## Evidence on Hand

- No screenshots, testimonials, users or download numbers exist yet. Do not invent any.
- Upstream bugs the product deliberately avoids (fuzzy match "Spirit" vs "The Spirit Lift",
  upstream PR #15) are real and may be cited.

## Product Principles

1. **Show before doing.** Nothing irreversible happens until the person has seen the list and
   chosen.
2. **Calm through long waits.** A run that pauses for an hour should feel under control, not
   stuck.
3. **Plain words, honest stakes.** Name the consequence ("uses up its gift link") in the moment it
   matters.
4. **Local and quiet.** The person's data stays on their computer, and the app says so without
   making them read a policy.
5. **A little delight, never at the cost of trust.**

## Accessibility & Inclusion

- WCAG 2.2 AA contrast and full keyboard operation (focus visible, dialogs trap focus, Esc
  cancels).
- Honors reduced motion and the OS light/dark setting.
- Long lists (hundreds of rows) stay readable and scannable for less confident users.
