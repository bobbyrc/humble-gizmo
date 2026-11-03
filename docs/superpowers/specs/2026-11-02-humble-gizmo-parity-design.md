# Humble Gizmo — milestone 1 (feature parity) design

Status: draft for approval · 2026-11-02

## Intent

People who have bought Humble Bundles for years often have hundreds of Steam keys
they never redeemed. Redeeming them by hand (reveal, copy, paste into Steam,
repeat) is tedious, and Steam limits how fast you can do it.

[castanley/humble-steam-redeem](https://github.com/castanley/humble-steam-redeem)
("upstream") automates this, but it is a terminal app: Python, a keyboard-driven
menu, unsigned binaries, and sign-in forms re-implemented by hand. Humble Gizmo is
the same tool for the **average person**: a desktop app you download, open and
click through.

Milestone 1 is **feature parity with upstream**. New features come after it ships.

## Goals

1. Everything upstream does (see "Parity scope"), in a desktop GUI.
2. A non-technical user can install it, sign in and redeem their backlog without
   reading anything beyond the download page.
3. Privacy: by default the app talks **only to Humble Bundle and Steam**.

## Non-goals (milestone 1)

- New features beyond parity: wishlist sync, multi-account, key trading, other
  stores (GOG, Epic) and so on.
- Telemetry and crash reporting. They're designed for (opt-in, see Privacy) but not
  built in milestone 1, because no service exists to receive them.
- A command-line or headless mode. Upstream's `--auto` cron mode is replaced by
  in-app scheduled checks (see 5 below).
- Windows code signing.

## Anti-goals (a failure even if it works)

- Any byte reaching the developer, or any third party other than Humble, Steam or
  (opt-in only) GitHub, without the user explicitly switching it on.
- Redeeming or revealing a key the user didn't tick. In particular, a background
  check never redeems on its own.
- Silently skipping a key because a fuzzy title match *guessed* the user owns it.
  Upstream has this bug: "Spirit" matched "The Spirit Lift" (upstream PR #15).
- The app ever seeing or storing the user's Humble or Steam password.
- Losing progress: quitting mid-run must never lose the record of what has been
  redeemed or revealed.

## Decisions made with the owner

| Decision | Choice |
|---|---|
| Form | Desktop app (a hosted web page can't call Humble/Steam without a proxy server, which the privacy rule forbids) |
| Stack | Electron + TypeScript |
| Privacy | Only Humble and Steam by default. Updates, analytics and crash reports are each **explicit opt-in**, with plain messaging that nothing reaches the developer unless the user chooses |
| Redeem UX | Show the list first; the user can untick games before anything happens |
| Platforms | Windows, macOS (Apple Silicon + Intel), Linux |
| Signing | macOS signed and notarized with the owner's existing Apple Developer account. Windows unsigned for now |
| Distribution | GitHub Releases on `bobbyrc/humble-gizmo` (public repo) |

## Decisions made by me (Claude), open to override

- **Sign-in through the real sites.** Humble and Steam sign-in happen on their own
  login pages, loaded in an app window using a persistent Electron session
  (`partition: "persist:humble"` and `"persist:steam"`). 2FA, Humble Guard, Steam
  QR, captchas and Cloudflare challenges all work the way they do in a browser. All
  API calls then go through that same Electron session (`session.fetch` / `net`), so
  they carry the real cookies and a real Chromium network fingerprint. That removes
  upstream's Cloudflare workaround (`cloudscraper`) and its hand-built sign-in code.
- **Sessions persist** between launches via those partitions. A "Sign out" button
  per service clears its partition.
- **No Steam Web API key required from the user.** See "Ownership detection".
- **Doubtful ownership matches are shown, not hidden** (see "Review screen").
- **Background checks never redeem.** They only surface new keys for review.
- **Name**: "Humble Gizmo", with "Not affiliated with Humble Bundle or Valve"
  in About and on the download page.
- **Clean reimplementation.** Upstream has **no license file**, so its code is
  all-rights-reserved. We reimplement behaviour from our understanding of the
  Humble/Steam endpoints and copy no upstream code.
- **Local storage** in Electron's `userData` directory. See "Local data".

## Parity scope

Upstream behaviour, and how each piece appears in Humble Gizmo.

### 1. Humble sign-in and library fetch

- Sign in (see above); the session persists.
- Fetch the order list (`GET /api/v1/user/order`), then every order's details
  (`GET /api/v1/order/<gamekey>?all_tpkds=true`) **concurrently with bounded
  parallelism**. Upstream uses 15. Retry failures with backoff. If some orders still
  fail, continue without them and say so (upstream issue #7).
- Steam keys are the "tpk" entries (third-party keys) anywhere in the order details
  that have a `steam_app_id` field. Upstream walks the whole JSON tree for any
  object with that field; match that tolerance, because the nesting has changed
  before.
- A tpk is **revealed** if it has `redeemed_key_val`, and **unrevealed** otherwise.
  Revealing an unrevealed key permanently uses up its gift link.

### 2. Auto-redeem → "Redeem" flow

**Steam sign-in** happens on Steam's login page in an app window.

**Ownership detection:**
- Get the user's owned app and package IDs from
  `GET https://store.steampowered.com/dynamicstore/userdata/` (`rgOwnedApps`,
  `rgOwnedPackages`). This needs only the store session, no API key.
- An exact `steam_app_id` hit means **owned**.
- Otherwise compare titles against owned-app names, to catch editions and DLC
  variants. Upstream gets names from `IStoreService/GetAppList`, which needs a user
  API key.
  - Milestone 1 must find owned-app names **without a user API key**. Candidates:
    the signed-in community games list, or the store's web access token with
    `IPlayerService/GetOwnedGames`.
  - **This is a spike.** If no keyless source works, fall back to an *optional* API
    key field in Settings, explained in plain language. Without names, only exact-ID
    matching happens and doubtful games still show for review.
- Title matching produces **owned (confident)**, **maybe owned (doubtful)** or
  **not owned**. Thresholds are the builder's call. They must be tested against the
  known false positives above ("Spirit" vs "The Spirit Lift", "Book of Demons" vs
  "Book of Hours").

**Review screen** (the owner's choice: list first, user can untick):

```
Ready to redeem 143 games                     [Redeem 143]

▾ Will redeem (143)                          [untick all]
  [x] Hollow Knight
  [x] Into the Breach        unrevealed – uses up its gift link
  ...
▸ Might already own (12)    – check these    (unticked)
▸ You already own (318)     – skipped
▸ Already done in an earlier run (40)
```

- Not owned → ticked. Maybe owned → unticked, in their own group. Owned →
  collapsed, unticked. Already processed in a previous run → collapsed.
- Duplicates (same `steam_app_id` or same name): only the first is ticked; the
  rest are labelled as duplicates.
- Unrevealed keys carry the label "uses up its gift link".
- The user can tick or untick anything in any group.

**Redemption run:**
1. For each ticked key: if it's unrevealed, reveal it on Humble (`POST
   /humbler/redeemkey` with `keytype`=machine_name, `key`=gamekey,
   `keyindex`, plus the CSRF header from `csrf_cookie`). **Persist the revealed key
   immediately**, before trying Steam.
2. Check the key format (`XXXXX-XXXXX-XXXXX`); a bad format is an error.
3. Redeem on Steam: `POST https://store.steampowered.com/account/ajaxregisterkey/`
   with `product_key` and `sessionid` (from the `sessionid` cookie). Success is
   `success == 1`. Otherwise the result code is `purchase_result_details` or
   `purchase_receipt_info.result_detail`.
   - Known codes: 9 already owned · 13 region locked · 14 invalid key · 15 used
     elsewhere · 24 requires base game · 36 requires PS3 · 50 wallet code · 53 rate
     limited.
   - A non-JSON response is treated as 53.
4. Codes 9 and 15 count as **already owned**, any other non-zero code is an **error**,
   and 0 is **redeemed**. Persist the result immediately.
5. **Rate limit (53):** Steam allows about 50 successful or about 10 failed
   activations per hour. Pause, then retry the same key after about an hour.
   - Show a plain message with a wall-clock resume time: "Steam allows about 50
     activations an hour. Continuing at 3:42 PM. You can leave this running."
   - Keep the system awake while waiting (Electron `powerSaveBlocker`).
- A live list shows each game's outcome, with running counts of redeemed, owned and
  errors.
- Quitting mid-run is safe, and the next run excludes everything already recorded.

### 3. Export

On the History screen. Writes a CSV, with a file-save dialog, of the user's
library using upstream's options:

- Steam keys only, or all keys
- Include revealed / unrevealed
- Optionally reveal all unrevealed keys. This needs a **hard confirmation** stating
  it can't be undone and uses up gift links.
- Optionally add an "already owned on Steam" column (needs Steam sign-in)

Columns at minimum: name, key, is_gift, key type, is_expired, steam_owned.
Use RFC 4180 quoting; upstream's hand-rolled CSV is a bug source.

### 4. Humble Choice picker

- Find subscription months with unclaimed picks:
  - Orders with `product.category == "subscriptioncontent"` and a
    `product.choice_url`, sorted by `created`.
  - Include classic months with `choices_remaining > 0`, and "unlock-all" (v3)
    months (`product.is_subs_v3_product`).
- For each month, fetch `https://www.humblebundle.com/subscription/<choice_url>`
  and parse the JSON in `<script id="webpack-monthly-product-data">` →
  `contentChoiceOptions`.
  - Skip the month if `canRedeemGames` is false.
  - If `usesChoices` is false (v3), the games are under
    `contentChoiceData.game_data`.
  - Otherwise they're under `contentChoiceData[<identifier>].content_choices`, where
    the identifier is `initial`, `initial-classic`, or whichever key has
    `content_choices`.
  - Remove games already chosen: any `machine_name` that already appears in the
    order's `tpkd_dict`.
- UI: a list of months. Each shows its games with their Steam rating
  (`user_rating.review_text` and `steam_percent|decimal`) and enforces "pick up to N"
  for classic months. There's a "Claim all" for v3 months, or when N equals the
  number available.
- Claim with `POST /humbler/choosecontent`, sending `gamekey` (from the choice's
  `tpkds[0].gamekey`), `parent_identifier`, `chosen_identifiers[]` (the
  `display_item_machine_name`) and `is_multikey_and_from_choice_modal=false`.
  Show failures per game.
- Games without `tpkds` can't be claimed through the API. Show "Claim on Humble"
  and open the page in the user's browser.
- After claiming, re-fetch those orders. The new keys appear in the Redeem review
  list; they are not auto-redeemed.
- This part of Humble has changed twice in 2026 (upstream #2: the subscription
  marker in May, unlock-all months in August). Parse defensively: if the expected
  structure is missing, show "Humble changed something — check for an update" rather
  than crashing or showing nothing.

### 5. Scheduled checks (replaces upstream `--auto`)

- An opt-in setting, "Check for new keys every N hours", default off.
- It runs while the app is open, or minimized to the tray/menu bar when the user
  enables "Keep running in background".
- A check fetches the library and ownership. If there are new redeemable keys, it
  shows a system notification ("5 new games ready to redeem"). Clicking it opens
  the review screen. **It never redeems or reveals on its own.**
- If a session has expired, the notification says so and asks the user to sign in.
- "Launch at login" is a separate opt-in, default off.

## Privacy and consent

- **Default network traffic:** humblebundle.com, store.steampowered.com,
  steamcommunity.com, login.steampowered.com, api.steampowered.com, plus the CDNs
  and challenge pages these sites load in the sign-in windows. Nothing else.
- **First-run screen,** before sign-in:

  ```
  Your data stays on this computer.
  This app only talks to Humble Bundle and Steam.
  Nothing is sent to the developer unless you turn it on below.

  [ ] Check for updates automatically   (contacts GitHub)
  ```

  Milestone 1 has only the update toggle. Future crash and usage toggles go here
  too, each naming exactly where its data goes, default off.
- Settings has the same toggles, the same wording, and a **"Check for updates
  now"** button that makes one check only when clicked.
- When the update toggle is on, use `electron-updater` against GitHub Releases:
  - Windows (NSIS): unsigned self-update.
  - macOS (signed and notarized): self-update.
  - Linux (AppImage): self-update. Other Linux formats get notify + download link.
  - Always ask before installing.
- When Humble or Steam responses don't match what the app expects, the error says
  so plainly and links to the Releases page; it contacts nothing.
- The app's own UI loads no remote resources (fonts, images, scripts). Everything
  is bundled. Game cover art, if shown, comes from Humble/Steam CDNs only.

## Local data

Stored in Electron `userData`:

- Per-key records: gamekey, keyindex, machine_name, name, steam_app_id, revealed
  key value, outcome (redeemed / owned / error code / pending), timestamps, run ID.
  These records are what upstream's `redeemed.csv`, `already_owned.csv` and
  `errored.csv` do, including excluding processed keys from later runs.
- Settings and consent flags.
- Revealed keys have monetary value. Store them encrypted at rest with Electron
  `safeStorage` (OS keychain), or the builder may justify plaintext.
- Settings has "Delete all local data".
- The storage engine (SQLite or JSON) is the builder's call. Writes must be
  durable per key, not batched at the end of a run.

## Distribution

- GitHub Actions builds on tag push for:
  - Windows: NSIS installer, x64.
  - macOS: universal or separate arm64/x64 `.dmg`, signed and notarized.
  - Linux: AppImage, x64.
- The download page (README or GitHub Pages) has one big button per OS and
  screenshot instructions for the Windows SmartScreen "More info → Run anyway"
  step. Pages must not load trackers.
- macOS signing needs the owner's Developer ID certificate and notarization
  credentials as GitHub Actions secrets. The owner sets these up; the builder
  documents exactly which ones.

## Engineering constraints

- Electron security baseline:
  - `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true` for
    every window.
  - The app's UI talks to the main process only through a typed preload bridge.
  - Sign-in windows get no preload bridge.
  - Strict CSP on app pages.
- All Humble/Steam HTTP happens in the main process through the persisted
  sessions. The UI process never sees cookies.
- Humble and Steam endpoints are undocumented and change. Isolate each in one
  module with response-shape validation (e.g. zod), so a change produces a clear
  error and a small fix.
- Tests: the parsing, matching, filtering and state-machine logic is unit-tested
  against **recorded, sanitized fixtures** (no real keys, emails or cookies). CI
  never hits live Humble/Steam. A manual smoke checklist against a real account is
  part of the release process.

## Settled after builder review (Claude's calls, open to override)

1. **Network guard.** This is enforced in code, not just documented.
   - The app's own windows and all main-process HTTP use a deny-by-default host
     allowlist: Humble, Steam, their CDNs, and GitHub only when update checks are on.
     The allowlist is enforced with `session.webRequest` and covered by a test.
   - Sign-in windows may load whatever Humble's and Steam's own pages load (that's
     the user browsing those sites). Navigation to any other site opens in the
     user's default browser instead.
2. **Spikes are task zero, with a go/no-go checkpoint.** Before building features,
   prove three things:
   - Humble API calls work through the signed-in session from the main process. If
     not, they work from a hidden humblebundle.com window.
   - Steam `ajaxregisterkey` works through the signed-in session.
   - There is a keyless source of owned-app names.

   A hidden window for all Humble calls is acceptable. If neither Humble approach
   works, stop and report to the owner.
3. **No OS keyring (common on Linux).** Store data in plaintext and show a one-time
   notice explaining that. Upstream stores plaintext CSVs, so this matches parity.
   Never refuse to save, because losing progress is an anti-goal.
4. **Crash recovery.** A key left `pending` is retried automatically on the next run.
   This is safe: the revealed key value is persisted before the Steam call, and a
   second Steam attempt returns 9 or 15, which count as owned. A reveal whose
   response was lost shows up as revealed on the next library fetch.
5. **Rate limit.** React to code 53 only. Wait about an hour and retry the same key,
   repeating each hour with no cap, as upstream does. The user can stop at any time,
   and the screen shows the attempt count.
6. **Ownership precedence.**
   - An exact `steam_app_id` hit against `rgOwnedApps ∪ rgOwnedPackages` always
     means owned.
   - Otherwise use title matching.
   - A key with a missing or zero `steam_app_id` is classified by title only, and is
     "maybe owned" at best, never confidently owned.
7. **Previously failed keys.**
   - Codes 13, 14, 36 and 50 (region lock, invalid, PS3, wallet) are terminal.
   - Code 24 (requires base game) and unknown codes are retryable.
   - The review screen has a collapsed "Failed before" group: retryable ones
     unticked but tickable; terminal ones shown for information.
8. **Export reveal.** Keys revealed during export are persisted and then appear in
   the Redeem list like any other revealed key. The `steam_owned` column uses the
   same classification: `yes` / `maybe` / `no`.
9. **Choice pick limit.** `choices_remaining` from the order is the source of truth,
   as in upstream. Humble validates claims server-side, and failures show per game.
10. **Background mode** must work on Windows and macOS. On Linux, the tray and
    notification click-through are best-effort.
11. **macOS:** a single universal DMG and a single update feed.
12. **Fixtures.** Milestone 1 includes a dev-only capture command that saves
    sanitized Humble/Steam responses: keys, gamekeys, emails, user IDs and cookies
    replaced with stable fakes. Parsers may be written against upstream-documented
    shapes first, then confirmed against captured fixtures before the milestone is
    done.

## Left to the builder

- UI framework (React, Svelte, etc.), styling and component library.
- Storage engine, IPC shape, project layout and test runner.
- Exact fuzzy-match algorithm and thresholds, within the anti-goal above.
- Concurrency limit for order fetches.
- How to capture the initial fixtures, using the capture command described in
  "Settled after builder review", item 12.

## Testing against real accounts (owner's decision)

The owner's own Humble and Steam accounts are the test accounts.
- Read-only capture of the library and ownership data is fine at any time.
- Any real reveal, Steam redemption or Choice claim during development or smoke
  testing may touch **only keys or months the owner names for that run**. These
  actions are irreversible: they add games to the account and use up gift links or
  picks.
- The smoke checklist must list which steps are irreversible, and get the owner's
  named targets before running them.
- Visual design (to be shaped with the owner before UI build-out).

## Known risks

- **Keyless ownership names** may not be available. The fallback is an optional API
  key, which costs some ease of use.
- **Cloudflare** may still challenge `net`/`session.fetch` requests that aren't made
  from a page. Mitigation: make the Humble calls from a hidden window on
  humblebundle.com. The spike should confirm which works.
- **Humble site changes** will break things periodically. That's why parsing is
  isolated, errors are clear, and there's an opt-in update path.
- **Windows unsigned**: SmartScreen friction until signing is added.
