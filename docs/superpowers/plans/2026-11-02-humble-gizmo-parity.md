# Humble Gizmo Milestone 1 (Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop app (Windows, macOS, Linux) that does everything upstream
`humble-steam-redeem` does: Humble library fetch, review-first Steam
redemption, CSV export, Humble Choice picker and scheduled checks. It's built for
non-technical users and talks only to Humble and Steam by default.

**Architecture:**
- Electron. The main process owns all network traffic, through persisted Electron
  sessions that the user signs into on the real Humble and Steam login pages.
- Pure, Electron-free domain logic lives in `src/core` and is unit-tested against
  fixtures.
- A React renderer talks to main only through a typed preload bridge
  (`window.gizmo`).
- Phase 0 spikes decide the network transport and the owned-names source, behind
  interfaces that are frozen in Task 1.

**Tech Stack:**
- Node 24 LTS, TypeScript (strict)
- Electron (current stable), electron-vite, electron-builder, electron-updater
- React 19, Vitest, @testing-library/react with jsdom, zod
- npm

**Spec:** `docs/superpowers/specs/2026-11-02-humble-gizmo-parity-design.md`.
Read it before any task. Where this plan and the spec disagree, the spec wins:
stop and report.

## Global Constraints

- Default network traffic goes to Humble and Steam only. GitHub is contacted only
  when the user has turned on update checks, or clicked "Check for updates now".
  Nothing else is ever contacted, and there is no telemetry in milestone 1.
- Main-process HTTP and app windows enforce `isAllowedUrl` (Task 2), deny by
  default. Sign-in windows are unrestricted, but navigation off Humble/Steam opens
  in the user's default browser.
- Never redeem, reveal or claim anything the user didn't tick. Background checks
  never redeem.
- The app never reads, stores or logs a Humble or Steam password, cookie value or
  key value. That covers logs, error messages and probe/capture output.
- Every BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false` and
  `sandbox: true`. Sign-in windows get no preload. App pages get a strict CSP with
  no remote resources.
- Per-key results are persisted durably, with an atomic write before moving on,
  never batched to the end of a run.
- Clean reimplementation: copy no code from upstream (it has no license).
- UI copy that the spec fixes lives verbatim in `src/shared/copy.ts` (Task 1), and
  the UI imports it from there.
- Real-account testing: read-only calls are fine at any time. A real reveal, Steam
  redemption or Choice claim may touch **only keys or months the owner names for
  that run**. Agents never perform these on their own; they hand the step to the
  orchestrator, who asks the owner.
- Upstream endpoint facts (URLs, form fields, result codes) are in the spec's
  "Parity scope". Use them exactly.

## Review Focus

These are the failure modes most likely to bite a real user that the spec doesn't
spell out. Each one has a pinning test in the task named.

1. **Steam signs the user out mid-run.** `ajaxregisterkey` then returns a
   redirect or HTML. Upstream treats non-JSON as "rate limited" and would wait
   forever. Expected: the run stops, the key stays `pending`, and the UI says
   "Sign in to Steam again". Pinned in Task 14 and Task 15.
2. **Huge libraries** (3,000 keys against 3,000 owned names). Expected: the review
   list builds in under 2 s and the UI stays responsive. Pinned in Task 9;
   virtualized list in Task 21.
3. **The laptop sleeps during the hour-long rate-limit wait.** Expected: on wake,
   if the wall clock is past `resumeAt`, retry immediately; never wait a second
   full hour. Pinned in Task 15.
4. **Titles with ™ ® © accents, colons, quotes, commas or newlines.** Expected:
   matching ignores the symbols, and the CSV round-trips safely. Pinned in Task 7
   and Task 11.
5. **One malformed or failed order among hundreds.** Expected: the rest of the
   library loads, and the failure count is shown. Pinned in Task 6 and Task 13.

## Execution order and parallelism

| Wave | Tasks | Depends on | Notes |
|---|---|---|---|
| A | 1 | — | Freezes shared types, errors, copy and IPC types |
| B | 2, 3, 6, 7, 8, 10, 11, 12 | 1 | Disjoint files, all in parallel |
| C | 4 → 5 | 2, 3 | Task 5 is an **owner checkpoint** at a desktop (not SSH) |
| C′ | 9 | 7, 8 | Can run during wave C |
| C″ | 18 | 1 | **Design checkpoint**, main agent and owner; can run any time after 1 |
| D | 13, 14, 15 | 5 (13, 14); 8, 12 (15) | 15 needs only the interfaces from Task 1, so it can start before 5 |
| E | 16 | 13, 14 | Owner runs capture. Orchestrator reviews fixtures for leaks before commit |
| F | 17 | 9, 10, 11, 13, 14, 15 | |
| G | 19, 20, 21, 22, 23 | 17, 18 | Separate screen files, all in parallel |
| H | 24 → 25 | 17 | Sequential: both edit `src/main/index.ts` |
| I | 26 → 27 | all | Release tagging is outward-facing: the owner approves first |

Shared files that get sequenced:
- `src/shared/*`: Task 1 creates them. Later edits go through the orchestrator
  only.
- `src/main/index.ts`: Tasks 17, 24 and 25, in that order.
- `package.json`: each task adds its own dependencies; the orchestrator merges any
  conflicts.

## File structure

```
src/shared/types.ts      domain types (frozen in Task 1)
src/shared/errors.ts     ServiceChangedError, SessionExpiredError
src/shared/copy.ts       exact UI copy from the spec
src/shared/ipc.ts        GizmoApi type (the preload bridge contract)
src/core/                pure logic, no electron/fs imports
  keys.ts titles.ts ownership.ts steamCodes.ts review.ts choice.ts
  export.ts runner.ts sanitize.ts
src/main/                electron main process
  index.ts               app lifecycle and wiring
  windows/appWindow.ts   windows/signIn.ts
  net/allowlist.ts       net/httpClient.ts (interface + implementation chosen in Task 5)
  humble/humbleApi.ts    steam/steamApi.ts  steam/ownedNames.ts
  store/atomicJson.ts    store/keyStore.ts  store/settingsStore.ts  store/secretCodec.ts
  ipc/handlers.ts        scheduler.ts  tray.ts  updater.ts
  dev/probe.ts           dev/capture.ts
src/preload/index.ts
src/renderer/            React app: App.tsx, screens/*.tsx, components/*.tsx
test/core/ test/main/ test/renderer/ test/fixtures/{hand,captured}/
```

---

## Phase 0: Foundation and spikes

### Task 1: Scaffold and frozen shared contracts

**Files:**
- Create: the electron-vite React-TS scaffold at the repo root: `package.json`,
  `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`,
  `src/main/index.ts`, `src/main/windows/appWindow.ts`, `src/preload/index.ts`,
  `src/renderer/index.html`, `src/renderer/main.tsx` and `src/renderer/App.tsx`.
- Create: `src/shared/types.ts`, `src/shared/errors.ts`, `src/shared/copy.ts` and
  `src/shared/ipc.ts`, all with the exact contents below.
- Create: `.github/workflows/ci.yml`. On PR and push, on ubuntu-latest, it runs
  `npm ci && npm run typecheck && npm run lint && npm test`.
- Test: `test/main/appWindow.test.ts`

**Interfaces — Produces (frozen; every later task uses these names):**

```ts
// src/shared/types.ts
export type HumbleKey = {
  id: string;               // `${gamekey}:${keyindex}:${machineName}`
  gamekey: string;
  keyindex: number;
  machineName: string;      // tpk.machine_name
  name: string;             // tpk.human_name, trimmed
  keyTypeName: string;      // tpk.key_type_human_name
  isSteam: boolean;         // tpk has a `steam_app_id` property (even if null)
  steamAppId: number | null;// null when missing or 0
  revealedKey: string | null; // tpk.redeemed_key_val
  isGift: boolean;
  isExpired: boolean;
};
export type Ownership = 'owned' | 'maybe' | 'not_owned';
export type OwnedData = { ids: Set<number>; names: Map<number, string> };
export type Outcome = 'pending' | 'redeemed' | 'owned' | 'error';
export type KeyRecord = {
  id: string; name: string; steamAppId: number | null;
  revealedKey: string | null; outcome: Outcome; resultCode: number | null;
  runId: string; updatedAt: string; // ISO 8601
};
export type ReviewGroup = 'will_redeem' | 'maybe_owned' | 'owned' | 'failed_before' | 'done_before';
export type ReviewReason = 'duplicate' | 'unrevealed' | 'terminal_error' | 'retryable_error';
export type ReviewItem = {
  key: HumbleKey; group: ReviewGroup; ticked: boolean; tickable: boolean;
  reasons: ReviewReason[]; matchedName?: string;
};
export type ChoiceGame = {
  identifier: string;        // display_item_machine_name
  title: string;
  rating: { text: string; percent: number | null } | null;
  claimable: boolean;        // has tpkds
  gamekey: string | null;    // tpkds[0].gamekey
};
export type ChoiceMonth = {
  gamekey: string; name: string; choiceUrl: string; created: string;
  usesChoices: boolean; choicesRemaining: number; parentIdentifier: string;
  games: ChoiceGame[];
};
export type RunEvent =
  | { type: 'key-start'; id: string }
  | { type: 'revealing'; id: string }
  | { type: 'key-done'; id: string; outcome: Exclude<Outcome, 'pending'>; code: number | null }
  | { type: 'rate-limited'; id: string; resumeAt: string; attempt: number }
  | { type: 'stopped'; reason: 'user' | 'steam-signed-out' | 'humble-signed-out' }
  | { type: 'finished'; summary: RunSummary };
export type RunSummary = { redeemed: number; owned: number; errors: number; remaining: number };
export type Settings = {
  consentShown: boolean; autoUpdate: boolean;
  scheduleHours: number | null; keepInBackground: boolean; launchAtLogin: boolean;
  steamApiKey: string | null; // optional fallback, only if Task 5 requires it
};
export const DEFAULT_SETTINGS: Settings = {
  consentShown: false, autoUpdate: false, scheduleHours: null,
  keepInBackground: false, launchAtLogin: false, steamApiKey: null,
};
export type Service = 'humble' | 'steam';
```

```ts
// src/shared/errors.ts
import type { Service } from './types';
export class ServiceChangedError extends Error {
  constructor(public service: Service, public detail: string) { super(`${service} changed: ${detail}`); }
}
export class SessionExpiredError extends Error {
  constructor(public service: Service) { super(`${service} session expired`); }
}
```

```ts
// src/shared/copy.ts — verbatim from the spec; the UI imports from here only
export const PRIVACY_TITLE = 'Your data stays on this computer.';
export const PRIVACY_LINE_1 = 'This app only talks to Humble Bundle and Steam.';
export const PRIVACY_LINE_2 = 'Nothing is sent to the developer unless you turn it on below.';
export const UPDATE_TOGGLE = 'Check for updates automatically';
export const UPDATE_TOGGLE_NOTE = '(contacts GitHub)';
export const CHECK_UPDATES_NOW = 'Check for updates now';
export const UNREVEALED_LABEL = 'uses up its gift link';
export const NOT_AFFILIATED = 'Not affiliated with Humble Bundle or Valve.';
export const serviceChanged = (s: 'Humble' | 'Steam') => `${s} changed something — check for an update.`;
export const rateLimitMessage = (time: string) =>
  `Steam allows about 50 activations an hour. Continuing at ${time}. You can leave this running.`;
export const newKeysNotification = (n: number) => `${n} new games ready to redeem`;
export const NO_KEYRING_NOTICE =
  'Your system has no password keychain, so revealed keys are saved unencrypted on this computer.';
export const GROUP_LABELS = {
  will_redeem: 'Will redeem', maybe_owned: 'Might already own', owned: 'You already own',
  failed_before: 'Failed before', done_before: 'Already done in an earlier run',
} as const;
```

```ts
// src/shared/ipc.ts — the preload bridge contract, implemented in Task 17
export type LibrarySummary = { keys: number; steamKeys: number; failedOrders: number };
export type GizmoApi = {
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  signIn(service: Service): Promise<boolean>;      // opens sign-in window; resolves on success/close
  signOut(service: Service): Promise<void>;
  status(): Promise<Record<Service, boolean>>;     // signed in?
  loadLibrary(): Promise<LibrarySummary>;
  buildReview(): Promise<ReviewItem[]>;
  startRun(keyIds: string[]): Promise<void>;
  stopRun(): Promise<void>;
  onRunEvent(cb: (e: RunEvent) => void): () => void; // returns unsubscribe
  listChoiceMonths(): Promise<ChoiceMonth[]>;
  claimChoices(monthGamekey: string, identifiers: string[]): Promise<{ failed: string[] }>;
  openExternal(url: string): Promise<void>;        // only humblebundle.com / steampowered.com / github.com release URLs
  history(): Promise<KeyRecord[]>;
  exportCsv(opts: ExportOptions & { revealAll: boolean; withOwnership: boolean }): Promise<{ saved: boolean; path?: string }>;
  deleteAllData(): Promise<void>;
  checkForUpdatesNow(): Promise<'none' | 'available' | 'error'>;
  storageEncrypted(): Promise<boolean>;
};
export type ExportOptions = { steamOnly: boolean; includeRevealed: boolean; includeUnrevealed: boolean };
```

- [ ] **Step 1:** Scaffold with `npm create @quick-start/electron@latest . -- --template react-ts`
  (non-interactive). Add the scripts `typecheck`, `lint` and `test` (`vitest run`).
  Configure Vitest: node environment by default, `jsdom` for `test/renderer/**`.
- [ ] **Step 2: Write the failing test** `test/main/appWindow.test.ts`.
  It imports `APP_WINDOW_WEB_PREFERENCES` from `src/main/windows/appWindow.ts` and
  asserts `contextIsolation === true`, `nodeIntegration === false` and
  `sandbox === true`, with `preload` defined.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (export missing).
- [ ] **Step 4: Implement** `export const APP_WINDOW_WEB_PREFERENCES` and
  `createAppWindow(): BrowserWindow`, using it. Set the CSP meta in
  `src/renderer/index.html` to
  `default-src 'self'; img-src 'self' https://*.humblebundle.com https://hb.imgix.net https://*.steamstatic.com; style-src 'self' 'unsafe-inline'; script-src 'self'`.
  Add the four `src/shared` files verbatim.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run lint`. Expected: all pass.
  Running `npm run dev` opens a window.
- [ ] **Step 6: Commit:** `chore: scaffold Electron app and freeze shared contracts`.

### Task 2: Network allowlist

**Files:**
- Create: `src/main/net/allowlist.ts`
- Test: `test/main/allowlist.test.ts`

**Interfaces:**
- Produces: `isAllowedUrl(url: string, opts: { updatesAllowed: boolean }): boolean`
- Produces: `installAppSessionGuard(ses: Session, getOpts: () => { updatesAllowed: boolean }): void`.
  This uses `ses.webRequest.onBeforeRequest` to cancel disallowed requests and
  logs the **host only**.

Allowed: `https:` URLs whose host is, or is a subdomain of, `humblebundle.com`,
`steampowered.com`, `steamcommunity.com` or `steamstatic.com`, or is exactly
`hb.imgix.net`. When `updatesAllowed`, also `github.com`, `api.github.com`,
`objects.githubusercontent.com` and `release-assets.githubusercontent.com`.
Also allowed: the app's own `file:`, `devtools:` and `data:` URLs, and
`http://localhost:*` only when `!app.isPackaged`. Pass `devServer: boolean`
through opts for testability, adding `devServer?: boolean` to the opts type.

- [ ] **Step 1: Write failing tests:**
  - `isAllowedUrl('https://www.humblebundle.com/api/v1/user/order', {updatesAllowed:false}) === true`
  - `'https://store.steampowered.com/account/ajaxregisterkey/'` → true
  - `'https://evilhumblebundle.com/'` → false (suffix match must be on a dot boundary)
  - `'http://www.humblebundle.com/'` → false (http)
  - `'https://api.github.com/repos/bobbyrc/humble-gizmo/releases'` → false with `updatesAllowed:false`, true with `true`
  - `'https://www.google-analytics.com/collect'` → false
  - `'http://localhost:5173/'` → false unless `devServer:true`
- [ ] **Step 2:** `npx vitest run test/main/allowlist.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions, using the `URL` parser and host-suffix
  matching on label boundaries.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: deny-by-default network allowlist`.

### Task 3: Sign-in windows and session status

**Files:**
- Create: `src/main/windows/signIn.ts`
- Test: `test/main/signIn.test.ts`

**Interfaces:**
- Produces: `PARTITIONS: Record<Service, string>` = `{ humble: 'persist:humble', steam: 'persist:steam' }`
- Produces: `SIGN_IN_URLS` = `{ humble: 'https://www.humblebundle.com/login?goto=/home/library', steam: 'https://store.steampowered.com/login/?redir=account%2Fregisterkey' }`
- Produces: `STATUS_URLS` = `{ humble: 'https://www.humblebundle.com/home/library', steam: 'https://store.steampowered.com/account/registerkey' }`
- Produces: `isSignInSuccessUrl(service: Service, url: string): boolean`. True
  when the window has navigated to the status URL's path (for Humble,
  `/home/library`; for Steam, `/account/registerkey`).
- Produces: `isSameServiceNavigation(url: string): boolean`. True for Humble and
  Steam hosts, including `login.steampowered.com` and `steamcommunity.com`.
- Produces: `openSignInWindow(service: Service, parent?: BrowserWindow): Promise<boolean>`.
  It resolves true when `isSignInSuccessUrl` matches (and closes the window), or
  false if the user closes the window. The window uses
  `partition: PARTITIONS[service]`, no preload, and sandbox on.
  `will-navigate` and `setWindowOpenHandler` send anything failing
  `isSameServiceNavigation` to `shell.openExternal` and deny it in-app.
- Produces: `checkSignedIn(service: Service): Promise<boolean>`. It calls
  `session.fromPartition(...).fetch(STATUS_URLS[service], { redirect: 'manual' })`;
  signed in means the status is neither 301/302 nor an opaque redirect.
- Produces: `signOut(service: Service): Promise<void>`. It calls `clearStorageData()`
  on the partition.

- [ ] **Step 1: Write failing tests** for the pure helpers:
  - `isSignInSuccessUrl('humble','https://www.humblebundle.com/home/library')` → true
  - `isSignInSuccessUrl('humble','https://www.humblebundle.com/login?goto=/home/library')` → false
  - `isSignInSuccessUrl('steam','https://store.steampowered.com/account/registerkey')` → true
  - `isSameServiceNavigation('https://login.steampowered.com/jwt/...')` → true
  - `isSameServiceNavigation('https://accounts.google.com/')` → false
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and the Electron functions.
- [ ] **Step 4:** Run. Expected: PASS. Manual check in `npm run dev`: a temporary
  dev menu item opens each sign-in window. Remove the menu item before commit, or
  keep it behind `!app.isPackaged`.
- [ ] **Step 5: Commit:** `feat: sign-in windows on real Humble/Steam pages`.

### Task 4: Probe command (spike)

**Files:**
- Create: `src/main/dev/probe.ts`, plus an `npm run probe` script that launches
  electron-vite with `GIZMO_PROBE=1`.
- Modify: `src/main/index.ts`. When `process.env.GIZMO_PROBE === '1'`, run the
  probe instead of the app.

**Interfaces:**
- Consumes: `openSignInWindow`, `checkSignedIn` and `PARTITIONS` (Task 3).
- Produces: a report written to `probe-report.json` in the repo root, which is
  gitignored. Every value in it is a status code, a boolean, a count or a list of
  top-level JSON key names. **Never** body content, cookies or key values.

The probe, in order:
1. If Humble is signed out, open Humble sign-in. Same for Steam.
2. **H1, session fetch:** `session.fromPartition('persist:humble').fetch('https://www.humblebundle.com/api/v1/user/order')`.
   Record the status, whether it parsed as JSON, the array length, and whether
   the body contains `cf-chl` or `challenge-platform` (Cloudflare).
3. **H1b:** with the gamekey from H1's first entry, `GET /api/v1/order/<gamekey>?all_tpkds=true`.
   Record the status and the top-level keys.
4. **H2, hidden window:** a hidden `BrowserWindow` on `persist:humble` loads
   `https://www.humblebundle.com/home/library`, then runs
   `executeJavaScript("fetch('/api/v1/user/order').then(r=>r.status)")`. Record
   the status.
5. **S1:** `GET https://store.steampowered.com/dynamicstore/userdata/` via
   `persist:steam`. Record the status and the counts of `rgOwnedApps` and
   `rgOwnedPackages`.
6. **S2, permission path for redemption:**
   `POST https://store.steampowered.com/account/ajaxregisterkey/` with
   `product_key=AAAAA-AAAAA-AAAAA` and `sessionid=<sessionid cookie for store.steampowered.com>`.
   Record the status, `success`, and `purchase_result_details`. Expected: 14
   (invalid key).
   - This costs one failed activation from Steam's hourly allowance. Run it
     **once** per probe.
7. **N1, keyless owned names via the community games page:**
   `GET https://steamcommunity.com/profiles/<steamid>/games/?tab=all` via
   `persist:steam`, where steamid comes from S1's or the store page's
   `g_steamID`. Record whether an embedded JSON games list with names is found,
   and its count.
8. **N2, keyless owned names via the store web token:**
   `GET https://store.steampowered.com/pointssummary/ajaxgetasyncconfig`, read
   `data.webapi_token`, then
   `GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?access_token=<t>&steamid=<id>&include_appinfo=1&include_played_free_games=1`.
   Record the status and `response.game_count`, and whether `games[0].name`
   exists.
9. Print the report path and quit.

- [ ] **Step 1:** Implement `probe.ts`. Wrap each probe in try/catch, recording
  `error: e.name`, never `e.message` if it might contain a body.
- [ ] **Step 2:** `npm run typecheck && npm run lint` pass. The probe is not
  unit-tested; it's a throwaway spike.
- [ ] **Step 3: Commit:** `chore: add dev probe for transport and ownership spikes`.

### Task 5: CHECKPOINT: go/no-go (owner + orchestrator)

This needs the owner **at a desktop session**, not SSH, because sign-in windows
must be visible.

- [ ] **Step 1:** The orchestrator asks the owner to run `npm run probe`, sign in
  to both services, and share `probe-report.json`. The orchestrator first reads
  the file for leaks.
- [ ] **Step 2:** Decide and record in this plan, under "Checkpoint decisions"
  below:
  - **Humble transport:** H1 OK → `SessionHttpClient`. Otherwise H2 OK →
    `WindowHttpClient`. Both fail → **stop and report to the owner** (spec,
    "Settled", item 2).
  - **Steam transport:** S1 and S2 OK → `SessionHttpClient`. If S2's code is not
    14, stop and report.
  - **Owned-names source:** N2 → `WebTokenOwnedNames`. Otherwise N1 →
    `CommunityPageOwnedNames`. Otherwise `ApiKeyOwnedNames`, with the optional
    Settings field.
- [ ] **Step 3:** Commit the plan update: `docs: record spike decisions`.

**Checkpoint decisions:** _(filled in at Task 5)_

---

## Phase 1: Pure domain logic (parallel with Tasks 2–5)

All files in `src/core` import nothing from `electron`, `fs` or `node:*`, except
`crypto.randomUUID` via `globalThis.crypto`.

### Task 6: Key extraction from order details

**Files:**
- Create: `src/core/keys.ts`
- Test: `test/core/keys.test.ts`, `test/fixtures/hand/orders.json`

**Interfaces:**
- Produces: `extractKeys(orders: unknown[]): HumbleKey[]`. It walks every
  object at any depth; each object with string `machine_name`, string `gamekey`,
  numeric `keyindex` and string `key_type_human_name` becomes a `HumbleKey`.
  Objects missing any of those are skipped, never thrown on. Results are deduped
  by `id`.
- Produces: `steamKeys(keys: HumbleKey[]): HumbleKey[]`. Returns
  `keys.filter(k => k.isSteam)`.
- Produces: `isValidSteamKeyFormat(s: string | null): boolean`. Matches
  `/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i`.

- [ ] **Step 1: Write the fixture.** Hand-write `orders.json` with three orders:
  - Order 1: a revealed Steam tpk; an unrevealed Steam tpk with
    `steam_app_id: 0`; a non-Steam tpk with no `steam_app_id` property.
  - Order 2: a Steam tpk nested two levels deeper (inside
    `subproducts[].tpkd_dict.all_tpks`).
  - Order 3: malformed. `tpkd_dict` is a string, plus one tpk missing `gamekey`.

  Use fake keys like `AAAAA-BBBBB-CCCCC`.
- [ ] **Step 2: Write failing tests:**
  - `extractKeys(orders).length === 4`
  - The revealed key has `revealedKey === 'AAAAA-BBBBB-CCCCC'` and `isSteam === true`.
  - The `steam_app_id: 0` key has `steamAppId === null` and `isSteam === true`.
  - The non-Steam key has `isSteam === false`.
  - The nested key is found.
  - The malformed order doesn't throw.
  - `name` is trimmed.
  - `isValidSteamKeyFormat('AAAAA-BBBBB-CCCCC') === true`;
    `isValidSteamKeyFormat('AAAA-BBBBB-CCCCC') === false`;
    `isValidSteamKeyFormat(null) === false`.
- [ ] **Step 3:** Run. Expected: FAIL. **Step 4:** Implement. **Step 5:** Run. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(core): extract keys from Humble order details`.

### Task 7: Title normalization and ownership classification

**Files:**
- Create: `src/core/titles.ts`, `src/core/ownership.ts`
- Test: `test/core/ownership.test.ts`

**Interfaces:**
- Produces: `normalizeTitle(s: string): string[]`, which returns content tokens.
- Produces: `classifyOwnership(key: HumbleKey, owned: OwnedData): { ownership: Ownership; matchedName?: string }`.
- Produces: `buildTitleIndex(owned: OwnedData): TitleIndex` (an opaque type), plus
  `classifyOwnershipIndexed(key: HumbleKey, owned: OwnedData, index: TitleIndex)`.
  This is the fast path for large libraries. `classifyOwnership` builds the index
  and delegates to it.

Algorithm. The tests don't fully determine it, so it's spelled out here:
1. `normalizeTitle`:
   - NFKD, strip combining marks, lowercase.
   - Remove `™ ® ©`, replace `&` with ` and `, and turn every other character
     outside `[a-z0-9]` into a space.
   - Strip a trailing phrase from `EDITION_SUFFIXES`, repeatedly. The list, in
     order: `game of the year edition`, `game of the year`, `goty edition`,
     `goty`, `definitive edition`, `complete edition`, `deluxe edition`,
     `enhanced edition`, `special edition`, `anniversary edition`,
     `remastered`, `edition`.
   - Split on spaces and drop the stopwords `the a an of and`.
2. Classify:
   - **ID match:** `steamAppId !== null` and `owned.ids.has(steamAppId)` → `owned`.
   - **Exact title match:** for any owned name whose token list equals the key's
     (same tokens, same order) → `owned` if `steamAppId !== null`, otherwise
     `maybe`.
   - **Similar title:** for any owned name where
     `jaccard(tokens) >= 0.6`, or one token set is a strict subset of the other
     and the extra tokens contain no digit and no roman numeral
     (`ii iii iv v vi vii viii ix x`) → `maybe`, with `matchedName` set.
   - Otherwise → `not_owned`.
   - The index maps each token to the owned app IDs containing it, so only
     candidates that share a token are compared.

- [ ] **Step 1: Write failing tests.** These are the exact cases; keys are built
  with a `makeKey(name, steamAppId)` helper.
  - App ID 400 in `owned.ids` → `owned`.
  - `'The Witcher 3: Wild Hunt - Game of the Year Edition'` (id 999) against owned
    `'The Witcher 3: Wild Hunt'` → `owned`.
  - `'Hollow Knight™'` (id 999) against owned `'Hollow Knight'` → `owned`.
  - `'Hollow Knight'` with `steamAppId: null` against owned `'Hollow Knight'` →
    `maybe`.
  - `'Spirit'` against owned `'The Spirit Lift'` → `maybe` with
    `matchedName === 'The Spirit Lift'` (upstream false positive: never `owned`).
  - `'Book of Demons'` against owned `'Book of Hours'` → `not_owned`.
  - `'Portal'` against owned `'Portal 2'` → `not_owned`.
  - `'Pokémon-like: Café'` against owned `'Pokemon like Cafe'` → `owned` (id 999).
  - `normalizeTitle('Into the Breach: Advanced Edition')` deep-equals
    `['into','breach','advanced']`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(core): ownership classification without silent fuzzy skips`.

### Task 8: Steam result codes

**Files:**
- Create: `src/core/steamCodes.ts`
- Test: `test/core/steamCodes.test.ts`

**Interfaces:**
- Produces: `RATE_LIMITED = 53`, `REVEAL_FAILED = -1`, `BAD_FORMAT = -2`
- Produces: `TERMINAL_CODES = new Set([13, 14, 36, 50, BAD_FORMAT])`
- Produces: `parseRegisterKeyResponse(status: number, body: string): number`:
  - JSON with `success === 1` → 0.
  - Otherwise `purchase_result_details`, then `purchase_receipt_info.result_detail`.
  - Otherwise, or for non-JSON bodies → 53.
  - 401, 403, or a 3xx status → throws `SessionExpiredError('steam')`.
- Produces: `outcomeForCode(code: number): Exclude<Outcome,'pending'>`. 0 →
  `redeemed`; 9 or 15 → `owned`; anything else → `error`.
- Produces: `isRetryableError(code: number): boolean`, which is
  `!TERMINAL_CODES.has(code)`.
- Produces: `CODE_LABELS: Record<number,string>`: 9 "already owned", 13 "region
  locked", 14 "invalid key", 15 "used elsewhere", 24 "requires base game", 36
  "requires PS3", 50 "wallet code", 53 "rate limited", -1 "couldn't reveal on
  Humble", -2 "not a Steam key".

- [ ] **Step 1: Write failing tests.** One per bullet above, including
  `parseRegisterKeyResponse(200,'<html>')` → 53, and
  `parseRegisterKeyResponse(302,'')` throws `SessionExpiredError`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(core): Steam registerkey result codes`.

### Task 9: Review list builder

**Files:**
- Create: `src/core/review.ts`
- Test: `test/core/review.test.ts`

**Interfaces:**
- Consumes: `classifyOwnershipIndexed` and `buildTitleIndex` (Task 7);
  `outcomeForCode` and `isRetryableError` (Task 8).
- Produces: `buildReviewList(keys: HumbleKey[], owned: OwnedData, records: Map<string, KeyRecord>): ReviewItem[]`.
  Only `isSteam` keys are included.

Rules, applied in order for each key:
1. Record outcome `redeemed` or `owned` → `done_before`, unticked, not tickable.
2. Record outcome `error`:
   - Terminal → `failed_before`, unticked, not tickable, reason `terminal_error`.
   - Retryable → `failed_before`, unticked, tickable, reason `retryable_error`.
3. Record outcome `pending` → `will_redeem`, ticked (crash recovery).
4. By ownership:
   - `owned` → group `owned`, unticked, tickable.
   - `maybe` → `maybe_owned`, unticked, tickable, with `matchedName`.
   - `not_owned` → `will_redeem`, ticked.
5. Duplicates within `will_redeem`, matched by the same non-null `steamAppId` or
   the same `normalizeTitle(...).join(' ')`: keep one ticked and untick the
   rest, adding reason `duplicate`. Prefer a revealed key to keep, to save gift
   links; otherwise keep the first in input order.
6. Add reason `unrevealed` when `revealedKey === null`.
7. Output order: group order as in `ReviewGroup`, then name A→Z (`localeCompare`).

- [ ] **Step 1: Write failing tests**, one per rule. Plus:
  - The duplicate pair (an unrevealed key first, a revealed key second) keeps
    the revealed one ticked.
  - **Review Focus 2:** 3,000 synthetic keys against 3,000 owned names, with
    names from a seeded generator, complete in under 2,000 ms
    (`performance.now()`).
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(core): review list grouping`.

### Task 10: Humble Choice parsing

**Files:**
- Create: `src/core/choice.ts`
- Test: `test/core/choice.test.ts`, `test/fixtures/hand/choice-v2.html`,
  `test/fixtures/hand/choice-v3.html`, `test/fixtures/hand/choice-orders.json`

**Interfaces:**
- Produces: `type ChoiceOrder = { gamekey: string; name: string; choiceUrl: string; created: string; choicesRemaining: number; isV3: boolean; chosenMachineNames: Set<string> }`
- Produces: `findChoiceOrders(orders: unknown[]): ChoiceOrder[]`.
  - Keeps orders with `product.category === 'subscriptioncontent'` and a string
    `product.choice_url`, where `choices_remaining > 0` or
    `product.is_subs_v3_product`.
  - Sorted by `created` ascending.
  - `chosenMachineNames` holds every `machine_name` under the order's
    `tpkd_dict`.
- Produces: `parseMonthPage(html: string): unknown`. Extracts the JSON inside
  `<script id="webpack-monthly-product-data" type="application/json">` and returns
  `.contentChoiceOptions`. If the script is missing or the JSON is invalid, it
  throws `ServiceChangedError('humble','choice page')`.
- Produces: `buildChoiceMonth(order: ChoiceOrder, options: unknown): ChoiceMonth | null`.
  - Returns null if `canRedeemGames === false`.
  - Game source and `parentIdentifier` follow the spec, section 4.
  - Removes games whose own `machine_name`s intersect `chosenMachineNames`.
  - Returns null if no games are left.
  - Throws `ServiceChangedError` if the expected containers are missing.
  - For v3, `choicesRemaining` equals the number of remaining games.

- [ ] **Step 1: Write the fixtures:**
  - A v2 page with `usesChoices: true` and `contentChoiceData.initial.content_choices`:
    3 games, one already chosen, one without `tpkds`, ratings on two.
  - A v3 page with `usesChoices: false` and `game_data`.
  - An orders file with one v2 month (`choices_remaining: 2`), one v3 month, and
    one fully chosen month.
- [ ] **Step 2: Write failing tests:**
  - `findChoiceOrders` returns 2 orders, sorted.
  - The v2 month has 2 games, one `claimable: false`, and
    `parentIdentifier === 'initial'`.
  - `rating` equals `{ text: 'Very Positive', percent: 0.93 }` (from
    `review_text` with underscores turned into spaces, and
    `steam_percent|decimal`).
  - The v3 month has `usesChoices: false` and `choicesRemaining` equal to the
    game count.
  - `parseMonthPage('<html></html>')` throws `ServiceChangedError`.
  - `canRedeemGames: false` → null.
- [ ] **Step 3–5:** Run (FAIL), implement, run (PASS).
- [ ] **Step 6: Commit:** `feat(core): Humble Choice parsing`.

### Task 11: CSV export

**Files:**
- Create: `src/core/export.ts`
- Test: `test/core/export.test.ts`

**Interfaces:**
- Produces: `selectExportKeys(keys: HumbleKey[], opts: ExportOptions): HumbleKey[]`
- Produces: `toExportCsv(keys: HumbleKey[], ownership: Map<string, Ownership> | null): string`
  - Header: `name,key,is_gift,key_type,is_expired,steam_owned`.
  - `steam_owned` is `yes`, `maybe` or `no`. It's empty when `ownership` is null
    or the key isn't a Steam key.
  - RFC 4180: quote a field when it contains `,`, `"`, CR or LF, and double the
    inner quotes. Lines end with CRLF.
  - Prefix a UTF-8 BOM so Excel reads it correctly.

- [ ] **Step 1: Write failing tests:**
  - Filter combinations.
  - **Review Focus 4:** the name `Tom Clancy's "Rainbow", Six\nSiege™` round-trips
    through a minimal RFC 4180 parser written in the test.
  - The header line is exact.
  - Booleans are written as `true` or `false`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(core): RFC 4180 CSV export`.

### Task 12: Local stores

**Files:**
- Create: `src/main/store/atomicJson.ts`, `src/main/store/keyStore.ts`,
  `src/main/store/settingsStore.ts`, `src/main/store/secretCodec.ts`
- Test: `test/main/stores.test.ts`, using a temp directory per test via `fs.mkdtemp(os.tmpdir())`

**Interfaces:**
- Produces: `writeJsonAtomic(path: string, data: unknown): Promise<void>`. Writes
  `path.tmp`, fsyncs, then renames. `readJson<T>(path: string): Promise<T | null>`
  returns null when the file is missing.
- Produces: `interface SecretCodec { readonly encrypted: boolean; encode(s: string): string; decode(s: string): string }`.
  Also `plaintextCodec: SecretCodec`, and `createSafeStorageCodec(): SecretCodec`.
  The safeStorage codec uses base64 of `safeStorage.encryptString`. It falls back
  to `plaintextCodec` when `!safeStorage.isEncryptionAvailable()`, or when on
  Linux `safeStorage.getSelectedStorageBackend() === 'basic_text'`.
- Produces: `class KeyStore`:
  - `static open(dir: string, codec: SecretCodec): Promise<KeyStore>`
  - `get(id): KeyRecord | undefined`
  - `all(): Map<string, KeyRecord>`
  - `upsert(r: KeyRecord): Promise<void>`
  - `deleteAll(): Promise<void>`
  - File: `keys.json`, `{ version: 1, encrypted: boolean, records: Record<string, StoredRecord> }`,
    where `revealedKey` is stored encoded.
  - Writes are serialized through a promise chain: `upsert` resolves only after
    the atomic write completes.
- Produces: `class SettingsStore`:
  - `static open(dir: string): Promise<SettingsStore>`
  - `get(): Settings`
  - `update(patch: Partial<Settings>): Promise<Settings>`
  - File: `settings.json`, with missing fields filled from `DEFAULT_SETTINGS`.

- [ ] **Step 1: Write failing tests:**
  - After an upsert, a reopened store returns an equal record.
  - Using a fake codec that reverses strings, the raw `keys.json` doesn't contain
    the plaintext key.
  - 50 concurrent upserts all persist.
  - A leftover `keys.json.tmp` from a simulated crash doesn't corrupt the open.
  - `deleteAll` removes the file.
  - Settings defaults are applied to a partial file.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(main): durable local stores with keychain encryption`.

---

## Phase 2: Service integration

### Task 13: HttpClient and HumbleApi

**Files:**
- Create: `src/main/net/httpClient.ts`, `src/main/humble/humbleApi.ts`
- Test: `test/main/humbleApi.test.ts`, using a `FakeHttpClient` that serves
  fixtures

**Interfaces:**
- Produces:
  ```ts
  interface HttpClient {
    get(url: string): Promise<{ status: number; body: string }>;
    postForm(url: string, form: [string, string][], headers?: Record<string, string>): Promise<{ status: number; body: string }>;
    getCookie(url: string, name: string): Promise<string | undefined>;
  }
  ```
  - Implement whichever transport Task 5 chose: `SessionHttpClient(partition)`
    using `ses.fetch` with `redirect: 'manual'`, or `WindowHttpClient(partition)`.
  - **Both** implementations call `isAllowedUrl` before every request and throw
    if it fails.
  - A shared `requireAllowed(url)` helper is unit-tested: a disallowed URL
    rejects, and no fetch happens.
- Produces: `class HumbleApi` (constructed with `http: HttpClient`):
  - `listOrderGamekeys(): Promise<string[]>`
  - `getOrders(gamekeys: string[], opts?: { concurrency?: number; retries?: number }): Promise<{ orders: unknown[]; failed: string[] }>`.
    Defaults: concurrency 15, retries 3. Backoff `2s * attempt`, made
    injectable through a `sleep` constructor option so tests don't wait.
  - `revealKey(k: HumbleKey): Promise<string | null>`. `POST /humbler/redeemkey`
    with form `keytype`, `key` and `keyindex`, and header
    `CSRF-Prevention-Token` set to the `csrf_cookie` cookie.
  - `getChoiceMonth(order: ChoiceOrder): Promise<ChoiceMonth | null>`
  - `chooseContent(gamekey: string, parentIdentifier: string, identifier: string): Promise<boolean>`
  - Responses are validated with zod. A shape mismatch throws
    `ServiceChangedError('humble', <endpoint>)`.
  - A 3xx/401/403 status, or a body that is the login page, throws
    `SessionExpiredError('humble')`.

- [ ] **Step 1: Write failing tests:**
  - **Review Focus 5:** 20 gamekeys where two fail every time → `orders.length === 18`
    and `failed.length === 2`, with no throw.
  - One gamekey fails once then succeeds → it's in `orders`.
  - `revealKey` sends the exact form and CSRF header; `success: false` → null.
  - `chooseContent` sends the form `gamekey`, `parent_identifier`,
    `chosen_identifiers[]` and `is_multikey_and_from_choice_modal=false`.
  - A 302 → `SessionExpiredError`.
  - The orders endpoint returning `{}` → `ServiceChangedError`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(main): Humble API client`.

### Task 14: SteamApi and owned-names source

**Files:**
- Create: `src/main/steam/steamApi.ts`, `src/main/steam/ownedNames.ts`
- Test: `test/main/steamApi.test.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 13), `parseRegisterKeyResponse` (Task 8).
- Produces: `interface OwnedNamesSource { fetch(): Promise<Map<number, string>> }`,
  with only the implementation Task 5 chose (`WebTokenOwnedNames`,
  `CommunityPageOwnedNames` or `ApiKeyOwnedNames`).
- Produces: `class SteamApi` (constructed with `http: HttpClient` and
  `names: OwnedNamesSource`):
  - `getOwned(): Promise<OwnedData>`. Gets IDs from `dynamicstore/userdata`,
    `rgOwnedApps ∪ rgOwnedPackages`. If the names source fails, it returns an
    empty `names` map and does not throw.
  - `registerKey(key: string): Promise<number>`. `POST ajaxregisterkey` with
    `product_key` and `sessionid` from the `store.steampowered.com` cookie.
  - A missing `sessionid` cookie throws `SessionExpiredError('steam')`.

- [ ] **Step 1: Write failing tests:**
  - `getOwned` merges apps and packages.
  - When the names source throws, `names.size === 0` and the IDs are still present.
  - `registerKey` sends the exact form.
  - **Review Focus 1:** a 302 response → `SessionExpiredError` (not 53).
  - An empty `rgOwnedApps` key missing from userdata → `ServiceChangedError('steam', ...)`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(main): Steam API client and owned-names source`.

### Task 15: Redeem runner

**Files:**
- Create: `src/core/runner.ts`
- Test: `test/core/runner.test.ts`

**Interfaces:**
- Consumes: the `HumbleApi.revealKey` and `SteamApi.registerKey` signatures, and
  the Task 8 codes. The store is typed structurally, as defined below, so
  `src/core` never imports from `src/main`.
- Produces:
  ```ts
  type Clock = { now(): Date; sleepUntil(t: Date, signal: AbortSignal): Promise<void> };
  class RedeemRunner {
    constructor(deps: {
      reveal: (k: HumbleKey) => Promise<string | null>;
      register: (key: string) => Promise<number>;
      store: { get(id: string): KeyRecord | undefined; upsert(r: KeyRecord): Promise<void> };
      clock: Clock; rateLimitWaitMs?: number; // default 3_600_000
      onEvent: (e: RunEvent) => void;
    });
    run(keys: HumbleKey[], runId: string): Promise<RunSummary>;
    stop(): void;
  }
  ```

Behaviour per key, in order:
1. Emit `key-start`.
2. If there's no `revealedKey` (on the key or in the stored record): emit
   `revealing` and call `reveal`.
   - On null → persist `error` with `REVEAL_FAILED` and continue.
   - Otherwise **persist the record with `revealedKey` and `outcome: 'pending'`
     before calling Steam**.
3. A bad format → persist `error` with `BAD_FORMAT`.
4. Call `register`. While the code is 53:
   - Set `resumeAt = now + rateLimitWaitMs`, emit `rate-limited` with an attempt
     counter, then `sleepUntil(resumeAt)`. The real clock implementation must
     re-check the wall clock every 30 s or less, so a sleep past `resumeAt`
     resumes promptly.
   - Retry. There's no cap.
5. Persist the outcome from `outcomeForCode`, and emit `key-done`.
6. If `reveal` or `register` throws `SessionExpiredError`: leave the record
   `pending`, emit `stopped` with `reason: steam-signed-out` or
   `humble-signed-out`, and return.
7. `stop()` aborts the sleep and stops before the next key, emitting `stopped`
   with `user`.
8. When done, emit `finished` with the summary.

- [ ] **Step 1: Write failing tests**, using a fake clock and in-memory store:
  - The happy path counts correctly.
  - The reveal result is persisted before `register` is called (assert the
    call order through the store's upsert log).
  - A reveal returning null → `error`/-1, and the run continues.
  - A 53 then 0 → one `rate-limited` event, with `resumeAt` one hour after the
    fake now.
  - **Review Focus 3:** the fake clock jumps 2 h during the sleep → it resumes
    immediately, with no second wait.
  - **Review Focus 1:** `register` throws `SessionExpiredError` → `stopped`
    with `steam-signed-out`, the record stays `pending`, and later keys are
    untouched.
  - `stop()` during the rate-limit sleep → `stopped` with `user`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(core): redeem runner with durable progress and rate-limit waits`.

### Task 16: Fixture capture and parser confirmation

**Files:**
- Create: `src/core/sanitize.ts`, `src/main/dev/capture.ts`, and the
  `npm run capture` script (`GIZMO_CAPTURE=1`, like the probe).
- Test: `test/core/sanitize.test.ts`, then `test/core/captured.test.ts` once the
  fixtures exist

**Interfaces:**
- Produces: `sanitize(value: unknown, salt: string): unknown`. Deep-copies, and
  replaces:
  - Any string matching the Steam key format → a stable fake
    `FAKE1-xxxxx-xxxxx`, derived from a hash of salt and value.
  - The values of `gamekey`, `email`, `steamid` and any `*token*` or `*cookie*`
    property → stable fakes.
  - 17-digit numbers starting `7656119` → a fake steamid.
  - Email-shaped strings → `user@example.com`.
  - Game titles and app IDs are kept.

Capture writes these, sanitized, to `test/fixtures/captured/`: the orders list
(first 30), 30 order details including at least one Choice month, one Choice
month page (the JSON only), userdata, and the owned-names response.

- [ ] **Step 1: Write failing sanitize tests:** each replacement rule, and that
  the same input gives the same fake.
- [ ] **Step 2–4:** Run (FAIL), implement `sanitize` and `capture.ts`, run (PASS).
- [ ] **Step 5 (owner and orchestrator):**
  - The owner runs `npm run capture` at a desktop.
  - The orchestrator greps the output for
    `[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}` (excluding `FAKE`), `@` (excluding
    `example.com`), and `7656119`. It reads samples by eye before anything is
    committed.
- [ ] **Step 6:** Write `captured.test.ts`. `extractKeys`, `findChoiceOrders`,
  `parseMonthPage`/`buildChoiceMonth` and the zod schemas from Tasks 13–14 must
  all accept the captured fixtures. Fix any parser that fails. Real shapes win
  over hand fixtures.
- [ ] **Step 7: Commit:** `test: sanitized captured fixtures and parser confirmation`.

### Task 17: IPC bridge, main wiring and app shell

**Files:**
- Create: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/App.tsx`
- Create: `src/renderer/screens/` stubs (`Welcome.tsx`, `SignIn.tsx`,
  `Review.tsx`, `Run.tsx`, `Choice.tsx`, `History.tsx`, `Settings.tsx`), each
  exporting a default component that renders its title
- Test: `test/main/handlers.test.ts`, `test/renderer/App.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `registerHandlers(ctx: AppContext): void`, where
  `AppContext = { humble: HumbleApi; steam: SteamApi; keys: KeyStore; settings: SettingsStore; getWindow(): BrowserWindow | null }`.
  - One `ipcMain.handle('gizmo:<method>')` per `GizmoApi` method.
  - Run events are sent as `webContents.send('gizmo:run-event', e)`.
- `startRun` validates that every ID is currently tickable in the last built
  review, ignores the rest, and starts a `powerSaveBlocker('prevent-app-suspension')`
  for the run's duration.
- The library cache lives in main memory, refreshed on `loadLibrary`.
- `exportCsv`:
  - With `revealAll`: reveal each selected unrevealed key through
    `humble.revealKey`, and persist it to `KeyStore` (outcome `pending`, unless a
    record already exists) **before** writing the CSV. Spec, "Settled", item 8.
  - With `withOwnership`: compute `classifyOwnership` per Steam key.
  - Then show `dialog.showSaveDialog` (default name `humble-keys-YYYYMMDD-HHMMSS.csv`)
    and write the file.
- `claimChoices` calls `humble.chooseContent` per identifier, then re-fetches
  that month's order so the next `buildReview` includes the new keys.
- `ServiceChangedError` and `SessionExpiredError` cross IPC by `name`. Handlers
  rethrow them as `Error` objects whose `name` field is preserved; the renderer
  branches on `err.name`.
- `src/main/index.ts`:
  - `app.requestSingleInstanceLock()`; quit if not acquired.
  - `installAppSessionGuard` on the default session.
  - Open the stores in `app.getPath('userData')`.
- Preload: `contextBridge.exposeInMainWorld('gizmo', api satisfies GizmoApi)`.
- App shell routing:
  - If `!settings.consentShown` → Welcome.
  - Else if signed out → SignIn.
  - Else → Review, with nav links to Choice, History and Settings.

- [ ] **Step 1: Write failing tests.** Handlers are tested with a fake
  `ipcMain` that records handlers, against fake APIs:
  - Every `GizmoApi` key has a handler.
  - `startRun` with an untickable ID drops it.
  - `App.test.tsx` with a mocked `window.gizmo` (`consentShown: false`) renders Welcome.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS). `npm run dev` shows the
  shell.
- [ ] **Step 5: Commit:** `feat: IPC bridge and app shell`.

---

## Phase 3: UI

### Task 18: CHECKPOINT: visual design (main agent + owner)

UI design stays with the main agent (owner's global rule). It can happen any time
after Task 1.

- [ ] **Step 1:** The main agent drafts the look: type, colour tokens with light
  and dark themes, spacing, and the layout of each screen in Tasks 19–23. It
  shares this with the owner as mockups. The owner works over SSH, so use a
  published page or screenshots, not a local browser tab.
- [ ] **Step 2:** After owner approval, commit `docs/design/ui.md` with the
  tokens and screen layouts, plus `src/renderer/theme.css` with the tokens as
  CSS variables. Bundled fonts only; nothing remote.
- [ ] **Step 3: Commit:** `docs: approved UI design`.

Tasks 19–23 implement against `docs/design/ui.md`. The main agent compares each
screen to it before accepting. Every screen test mocks `window.gizmo`.

### Task 19: Welcome (privacy) and Settings screens

**Files:**
- Modify: `src/renderer/screens/Welcome.tsx`, `src/renderer/screens/Settings.tsx`
- Test: `test/renderer/Welcome.test.tsx`, `test/renderer/Settings.test.tsx`

Welcome renders `PRIVACY_TITLE`, `PRIVACY_LINE_1`, `PRIVACY_LINE_2`, and an
unchecked `UPDATE_TOGGLE` checkbox labelled with `UPDATE_TOGGLE_NOTE`.
"Continue" calls `setSettings({ consentShown: true, autoUpdate: <checkbox> })`.

Settings has:
- The same update toggle and copy.
- `CHECK_UPDATES_NOW`, which calls `checkForUpdatesNow` and shows the result.
- Schedule: "Off" or every 6, 12 or 24 hours.
- "Keep running in background"; "Launch at login".
- `steamApiKey` only if Task 5 chose `ApiKeyOwnedNames`.
- Sign out of Humble / Steam.
- "Delete all local data", which needs a confirm dialog.
- `NO_KEYRING_NOTICE` when `storageEncrypted()` is false.
- `NOT_AFFILIATED` in the About section.

- [ ] **Step 1: Write failing tests:**
  - The checkbox is unchecked by default.
  - Continue without ticking → `setSettings` called with `autoUpdate: false`.
  - The exact copy strings are present.
  - Delete requires confirmation (cancel → `deleteAllData` not called).
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(ui): privacy welcome and settings`.

### Task 20: Sign-in and library loading screen

**Files:**
- Modify: `src/renderer/screens/SignIn.tsx`
- Test: `test/renderer/SignIn.test.tsx`

The screen shows two cards, Humble and Steam, each with its status from
`status()` and a "Sign in" button that calls `signIn(service)`. When both are
signed in, it calls `loadLibrary()` with a spinner. On completion it shows
"Found N Steam keys", plus "Couldn't load K orders — try again later" when
`failedOrders > 0`, and then navigates to Review.

A `ServiceChangedError` surfaced from IPC shows `serviceChanged('Humble' | 'Steam')`
and a link that calls `openExternal` with the Releases page.

- [ ] **Step 1: Write failing tests:**
  - Both sign-in buttons are enabled independently of each other.
  - `failedOrders: 2` shows the warning.
  - A rejected `loadLibrary` with name `ServiceChangedError` shows the
    `serviceChanged` copy.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(ui): sign-in and library loading`.

### Task 21: Review and Run screens

**Files:**
- Modify: `src/renderer/screens/Review.tsx`, `src/renderer/screens/Run.tsx`
- Create: `src/renderer/components/ReviewGroup.tsx`
- Test: `test/renderer/Review.test.tsx`, `test/renderer/Run.test.tsx`

**Review:**
- Groups are in `ReviewGroup` order, with `GROUP_LABELS`. `will_redeem` is
  expanded; the others are collapsed.
- Each row has a checkbox (disabled when `!tickable`), the name,
  `UNREVEALED_LABEL` when the `unrevealed` reason is present, "duplicate" when
  the `duplicate` reason is present, `matchedName` as "matches <name>" in
  `maybe_owned`, and the `CODE_LABELS` text in `failed_before`.
- An "untick all" control per group.
- The header shows "Ready to redeem N games" and a `[Redeem N]` button, with N
  the ticked count. Clicking it calls `startRun(tickedIds)` and goes to Run.
- Rows are virtualized, rendering only the visible rows plus a small buffer.
  The implementer may hand-roll this with a fixed row height, or use
  `@tanstack/react-virtual`.

**Run:**
- Subscribes with `onRunEvent`. It shows a live list of finished keys with their
  outcome label, and counts of redeemed, owned and errors.
- On `rate-limited`, it shows `rateLimitMessage(<resumeAt formatted with toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})>)`.
- On `stopped` with a signed-out reason, it shows "Sign in to Steam again" or
  "Sign in to Humble again", with a button.
- "Stop" calls `stopRun`.

- [ ] **Step 1: Write failing tests:**
  - 2,000 items render fewer than 100 row elements.
  - Unticking changes the button to `Redeem N-1`.
  - An untickable row's checkbox is disabled.
  - A `rate-limited` event with `resumeAt = 2026-01-01T15:42:00` local shows the
    message containing `3:42`.
  - A `stopped`/`steam-signed-out` event shows the re-sign-in prompt.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(ui): review list and live run`.

### Task 22: Humble Choice screen

**Files:**
- Modify: `src/renderer/screens/Choice.tsx`
- Test: `test/renderer/Choice.test.tsx`

The screen lists months from `listChoiceMonths()`. Each game shows its title and
rating ("Very Positive · 93%").
- For classic months, ticking is capped at `choicesRemaining`, and the header
  shows "Pick up to N (k picked)".
- There's a "Claim all" control, shown when `!usesChoices` or when
  `choicesRemaining >= games.length`.
- Non-claimable games show "Claim on Humble", which calls `openExternal` with
  `https://www.humblebundle.com/subscription/<choiceUrl>/<identifier>`.
- "Claim" opens a confirm dialog: "Claiming can't be undone. Claim K games from
  <month>?". It then calls `claimChoices` and shows per-game failures.
- On success, show "Claimed. New keys will appear in your review list."; the next
  `buildReview` includes them, because `claimChoices` refreshes the library in
  main.

- [ ] **Step 1: Write failing tests:**
  - With `choicesRemaining: 2`, a third tick is prevented.
  - Claim requires confirmation.
  - A failure list is shown.
  - "Claim on Humble" calls `openExternal` with the exact URL.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(ui): Humble Choice picker`.

### Task 23: History and Export screen

**Files:**
- Modify: `src/renderer/screens/History.tsx`
- Test: `test/renderer/History.test.tsx`

**History:** a table from `history()` (name, outcome label, date), newest first.

**Export panel:**
- Checkboxes: Steam keys only, Include revealed, Include unrevealed, Add
  "already owned on Steam" column.
- If neither revealed nor unrevealed is ticked, the button is disabled with
  "Nothing to export".
- The "Reveal all unrevealed keys first" checkbox is enabled only when unrevealed
  keys are included. When ticked, export requires a typed confirmation: the user
  types `REVEAL`, under the copy "This reveals every unrevealed key on Humble. It
  can't be undone and uses up their gift links."
- Then it calls `exportCsv`. Main shows the save dialog.

- [ ] **Step 1: Write failing tests:**
  - The disabled state.
  - Reveal-all requires the typed `REVEAL`.
  - `exportCsv` receives the exact options.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat(ui): history and CSV export`.

---

## Phase 4: Background, updates, release

### Task 24: Scheduled checks, tray, notifications, launch at login

**Files:**
- Create: `src/main/scheduler.ts`, `src/main/tray.ts`
- Modify: `src/main/index.ts`
- Test: `test/main/scheduler.test.ts`

**Interfaces:**
- Produces:
  ```ts
  startScheduler(opts: {
    getHours(): number | null;
    check(): Promise<number>; // count of new will_redeem keys not seen in previous check
    notify(n: number): void;
    notifySignedOut(s: Service): void;
    setTimer: typeof setTimeout;
  }): { stop(): void; reschedule(): void }
  ```
- `check()` runs `loadLibrary` and `buildReview` in main, and counts `will_redeem`
  IDs not present in the previous check's set. It **never** calls `startRun`.
- `notify` shows `new Notification({ title: 'Humble Gizmo', body: newKeysNotification(n) })`.
  Clicking it focuses the window and navigates to Review.
- `SessionExpiredError` → `notifySignedOut`.
- Tray: when `keepInBackground`, closing the window hides it, and the tray menu
  has "Open" and "Quit". On Linux it's best-effort: wrap in try/catch and fall
  back to quitting on close.
- `launchAtLogin` → `app.setLoginItemSettings({ openAtLogin })` on macOS and
  Windows. On Linux, write or remove an XDG autostart `.desktop` file in
  `~/.config/autostart`.

- [ ] **Step 1: Write failing tests** with a fake timer:
  - `getHours() === null` → no timer.
  - 6 → a timer of `6*3600*1000`.
  - `check` returning 0 → no notify; 3 → `notify(3)`.
  - `check` throwing `SessionExpiredError('steam')` → `notifySignedOut('steam')`.
  - A test spy asserts the scheduler module never imports or calls the runner.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat: opt-in scheduled checks that never redeem`.

### Task 25: Opt-in updates

**Files:**
- Create: `src/main/updater.ts`
- Modify: `src/main/index.ts`
- Test: `test/main/updater.test.ts`

**Interfaces:**
- Produces: `initUpdater(deps: { settings: SettingsStore; updater: Pick<AppUpdater,'checkForUpdates'|'downloadUpdate'|'quitAndInstall'|'on'>; setUpdatesAllowed(b: boolean): void; askInstall(version: string): Promise<boolean> })`,
  which returns `{ checkNow(): Promise<'none'|'available'|'error'> }`.
- `autoUpdater.autoDownload = false` and `autoInstallOnAppQuit = false`. The
  provider is GitHub, `bobbyrc/humble-gizmo`.
- On startup, check only if `settings.autoUpdate`, then every 24 h while it stays
  on.
- `checkNow` sets `setUpdatesAllowed(true)` for the duration of one check, then
  restores it from settings.
- When an update is available, the app always asks before downloading and
  installing.
- Linux non-AppImage installs: show "A new version is available" and link to
  Releases.

- [ ] **Step 1: Write failing tests** with a fake updater:
  - `autoUpdate: false` → `checkForUpdates` is never called at init.
  - `checkNow` calls it exactly once and toggles `setUpdatesAllowed(true)` then
    `(false)`.
  - If `askInstall` resolves false, `downloadUpdate` is not called.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit:** `feat: opt-in self-update via GitHub Releases`.

### Task 26: Packaging, release CI and download page

**Files:**
- Create: `electron-builder.yml`, `.github/workflows/release.yml`,
  `docs/RELEASING.md`
- Modify: `README.md` (download page)

`electron-builder.yml`:
- `appId: io.bcraig.humblegizmo`, `productName: Humble Gizmo`.
- Windows: NSIS x64.
- macOS: universal DMG, `hardenedRuntime: true`, `notarize: true`.
- Linux: AppImage x64.
- `publish: github`, `bobbyrc/humble-gizmo`.

`release.yml`:
- On a `v*` tag, a matrix of macos-latest, windows-latest and ubuntu-latest runs
  `npm ci && npm test && npx electron-builder --publish always`.
- macOS secrets: `CSC_LINK` (base64 Developer ID Application .p12),
  `CSC_KEY_PASSWORD`, `APPLE_API_KEY` (.p8 contents, written to a file in the
  job), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`.
- `GH_TOKEN` is `secrets.GITHUB_TOKEN`.

`docs/RELEASING.md` lists exactly those secrets and how to export each one from
the owner's Apple account.

`README.md`:
- One download link per OS (latest release asset URLs).
- Windows SmartScreen steps: "More info → Run anyway", with screenshot
  placeholders the owner fills in.
- The privacy promise in the same words as `src/shared/copy.ts`.
- `NOT_AFFILIATED`.
- No badges or images from third-party hosts.

- [ ] **Step 1:** `npx electron-builder --dir` on the local machine produces an
  unpacked app that launches.
- [ ] **Step 2:** Validate the workflow YAML with `actionlint`. Don't push the
  tag: releasing is outward-facing and needs the owner's go-ahead.
- [ ] **Step 3: Commit:** `build: packaging and release workflow`.

### Task 27: Smoke checklist and final verification (orchestrator)

**Files:**
- Create: `docs/SMOKE.md`

- [ ] **Step 1:** Write `docs/SMOKE.md`. It's a checklist per OS:
  - Install, first-run privacy screen, sign in to both services, load the library.
  - Review groups look right.
  - **[IRREVERSIBLE: the owner names the key]** redeem one named key.
  - **[IRREVERSIBLE: the owner names the month]** claim one named Choice game.
  - Export without reveal.
  - Scheduled check notification, with the schedule set to the smallest option
    via a dev override.
  - Sign out.
  - Delete data.
  - Network check: with update checks off, run a full session while capturing
    the default session's `webRequest` host log, and confirm that only allowlisted
    hosts appear.
- [ ] **Step 2:** On the settled tree, the orchestrator runs
  `npm ci && npm run typecheck && npm run lint && npm test && npx electron-builder --dir`,
  and shares the output.
- [ ] **Step 3:** The orchestrator requests a whole-branch defect review from a
  fresh agent, giving it the diff and the spec only. It confirms each finding
  before acting on it.
- [ ] **Step 4:** Ask the owner to run `docs/SMOKE.md`, naming the irreversible
  targets, and to approve the first tag `v0.1.0`.
