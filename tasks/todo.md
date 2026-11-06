# Milestone 1 (parity)

Plan: `docs/superpowers/plans/2026-11-02-humble-gizmo-parity.md` (step-level checkboxes live there)
Spec: `docs/superpowers/specs/2026-11-02-humble-gizmo-parity-design.md`

- [x] Phase 0: scaffold, allowlist, sign-in windows, probe (Tasks 1–4)
- [x] Task 5 checkpoint: probe run 2026-11-03. Session transport works (no Cloudflare); keyless web-token owned names work (1,030 games); community-page names do not; batch `/api/v1/orders` works (3/3). Owner chose to keep only what works: window transport, community-page and API-key sources, and the Settings API-key field removed.
- [x] Phase 1: pure core logic (Tasks 6–12)
- [x] Phase 2: Humble/Steam clients, runner, fixture capture tool, IPC shell (Tasks 13–17). Capture run 2026-11-03: trimmed, sanitized fixtures committed (6fcd24e); the 3 captured tests pass. No Choice month fixture (the account's Choice pages redirect: no active subscription).
- [x] Task 18 checkpoint: UI design drafted (`docs/design/ui.md`) and the built screens checked against it; owner approved 2026-11-05
- [x] Phase 3: screens 19–23. Task 20 (sign-in) was re-dispatched with the owner's go-ahead on 2026-11-03 (a6ce9ae, review fix round 9fba244)
- [x] Phase 4: scheduler, updates, packaging (Tasks 24–26)
- [ ] Task 27: smoke checklist written (`docs/SMOKE.md`), final verification and whole-branch review done; owner smoke run and the v0.1.0 tag pending

## Review

- 34 test files, 431 tests passing (3 skipped until captured fixtures exist); typecheck, lint and prettier clean on `9fba244` (`electron-builder --dir` last run on `c5bb3db`).
- Dev mode now allows Vite's live-reload websocket (`ws://localhost`), so edits refresh the window.
- A whole-branch review (most capable model) found boundary bugs that per-task reviews could not see, notably error names lost over Electron's contextBridge and `session.fetch` throwing on redirects. Both were fixed with tests that mimic real Electron behaviour.
- Every decision made without the owner is in `docs/superpowers/rulings-2026-11-03.md`.
- Lesson: test doubles that are more permissive than Electron hide real bugs. Mimic the bridge and the fetch semantics in tests.

# UI redesign: Ticket Wallet (2026-11-03)

Spec: `docs/design/ui.md`. Contract: `.impeccable/surfaces/src-renderer-screens-review-tsx.md`.
Owner chose the Ticket Wallet direction on the Impeccable decision page.

Wave 1 (parallel, disjoint files):

- [x] U0 preview harness: `scripts/ui-preview/**` (renders the renderer in a browser with a fake `window.gizmo`)
- [x] U1 core: `bundle`/`purchased` on HumbleKey (`src/shared/types.ts`, `src/core/keys.ts`, `test/core/keys.test.ts`, `test/fixtures/hand/orders.json`)
- [x] U2 foundation: fonts, tokens, shared components, shells (`package.json`, `package-lock.json`, `src/renderer/{fonts.css,theme.css,app.css,App.tsx,main.tsx}`, `src/renderer/components/{ui.tsx,ui.css}`, `test/renderer/{ui,App}.test.tsx`; moves shared page rules out of `review.css`/`settings.css`)
- [x] U9 icon exports from `build/icon.svg` / `build/icon-mac.svg`

Wave 2 (after U1 + U2; parallel, disjoint files):

- [x] U3 Review (`screens/Review.tsx`, `components/review/*`, `test/renderer/Review.test.tsx`)
- [x] U4 Run (`screens/Run.tsx`, new `components/run/run.css`, `test/renderer/Run.test.tsx`)
- [x] U5 Choice (`screens/Choice.tsx`, `components/choice/*`, `test/renderer/Choice.test.tsx`)
- [x] U6 History (`screens/History.tsx`, `components/history/*`, `test/renderer/History.test.tsx`)
- [x] U7 Settings (`screens/Settings.tsx`, `components/settings/*`, `test/renderer/Settings.test.tsx`)
- [x] U8 Welcome + Sign in (`screens/Welcome.tsx`, `screens/SignIn.tsx`, `screens/signin.css`, their tests)

- [x] Finish review (fresh reviewer), two fix rounds, owner-chosen stamp ink texture
- [x] DESIGN.md + .impeccable/design.json (documenter), final verification

## Review (redesign)

- Owner chose Ticket Wallet; build is code-led per Impeccable's Operate rules. Spec `docs/design/ui.md`, system `DESIGN.md`.
- Reviewer verdict after two rounds: everything scored resolved except From-column truncation at 900px (owner chose to leave it). Owner chose ink-textured stamps over crisp ones.
- Declined reviewer asks: paper grain, decorative jet stripes, removing counts from the Done banner (aria-live announcement).
- 446 tests pass (3 skipped until captured fixtures); typecheck, lint, build clean; built CSS has no data:/remote URLs (CSP); detector clean with three scoped, reasoned ignores in `.impeccable/config.json`.
- Preview harness: `npx vite --config scripts/ui-preview/vite.config.ts`, `?s=<scenario>&go=<screen>`.
- Gotcha: headless Chrome `--virtual-time-budget` captures can freeze the 160ms stamp animation mid-frame; judge stamps from a real-browser capture. Use a fresh `--user-data-dir` per capture.

## Smoke run (2026-11-05)

Owner named the target: the first key alphabetically. Resolved to the first key in the "will redeem"
group, since the two keys that sort before it (.HACK/G.U. LAST RECODE, 198X) are already owned.

- [x] 1 Setup: dev app opens; renderer console has no CSP or preamble errors on reload
- [x] 5 Library: refresh loads in ~6s; 652 keys, 615 Steam, 0 failed orders; 55 will redeem, 50 maybe owned, 510 owned
- [x] 6 Redeem one: "A Game Of Thrones - A Dance With Dragons" redeemed through the bridge (`startRun` with that one id), Steam code 0; History shows it; review now groups it as done before
- [x] 3 Network: no blocked hosts in the main-process log during the session
- [x] 12 `npm run build:unpack` (unsigned) builds `dist/mac-arm64`; `actionlint` clean
- [ ] Owner: check the game in the Steam library; the hand-driven steps (sign-in flows, untick-all in the UI, quit mid-run, CSV export dialog, tray, notifications, login item, Windows build)
- [ ] 7 Choice: owner subscribes and names one game and month; then rerun `npm run capture` for a real `choice-month.json`
- Note: dev launch logs "Unable to set login item: Operation not permitted" with launchAtLogin off (unsigned dev Electron on macOS)
