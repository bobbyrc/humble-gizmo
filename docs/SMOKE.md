# Manual smoke checklist (before v0.1.0)

Run this at a desktop before tagging v0.1.0. Tick each box as you go. If a step fails, stop and
note what you saw.

Rules for this checklist:

- Items marked **[IRREVERSIBLE — owner names the target]** change real accounts (Steam keys,
  Humble Choice claims). Name the exact target to yourself before you run them. Never use a
  key or game you have not named.
- Use a throwaway account or a key you are happy to lose where possible.
- Never paste keys, cookies or passwords into chat, logs or issues.

## 1. Setup

- [ ] Run `npm ci`. It finishes with no errors.
- [ ] Run `npm run dev`. The app window opens.
- [ ] Open DevTools (View, Toggle Developer Tools). The Console has no CSP (Content Security
      Policy, the browser rule that blocks unapproved scripts) errors and no "preamble" errors.

## 2. Spikes (run these first)

These decide how the app talks to Humble and Steam. Do them before anything else in this list.

- [ ] Run `npm run probe`. Open `probe-report.json`. Confirm it holds only statuses, counts and
      true/false values. No keys, cookies, emails, or response bodies.
- [ ] Decide the transport (the network method used to reach Humble) and where the owned-game
      list comes from.
  - If H1 (the first option) fails but H2 (the second option) works, set
    `HUMBLE_TRANSPORT='window'` in `src/main/net/transportConfig.ts`.
  - Once you know which one works, delete the unused transport and the unused owned-names source.
- [ ] Run `npm run capture`. This saves real responses into `test/fixtures/captured`.
- [ ] Check the captured files for private data. Run these greps and confirm each one is clean
      or only shows fake data:
  - [ ] Real keys: `grep -rE '[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}' test/fixtures/captured`.
        Ignore lines where the key starts with `FAKE`.
  - [ ] Email addresses: `grep -rn '@' test/fixtures/captured`. Only `@example.com` is allowed.
  - [ ] Steam IDs: `grep -rnE '7656119[1-9]' test/fixtures/captured`. Any hit is a real ID.
  - [ ] Card data: `grep -rniE 'card|last4' test/fixtures/captured`.
  - [ ] PayPal: `grep -rni 'paypal' test/fixtures/captured`.
  - [ ] Addresses: `grep -rniE 'address|street|postal' test/fixtures/captured`.
- [ ] Open the captured files by eye. Remove anything private that grep missed.
- [ ] Run `npm test`. The captured-fixture tests must now run and pass. If a parser fails on the
      real data, fix the parser, then run `npm test` again.
- [ ] Only then commit the fixtures.

## 3. First run and privacy

- [ ] On first launch, the Welcome screen shows the intended copy. Read it against the spec.
- [ ] The update box on Welcome is unchecked.
- [ ] Turn updates off. Run a whole session: sign in, load the library, redeem nothing, quit.
- [ ] Watch the main-process log. Every request goes to Humble or Steam only. Any blocked host
      in the log is a bug to note.
- [ ] Optional: run a firewall or proxy such as Little Snitch or LuLu. Confirm the same result.

## 4. Sign-in

Note: the Sign-in screen (Task 20) was not built because of an agent permission block. Until it
lands, sign in through the account rows in the sidebar.

Humble:

- [ ] Sign in with a password and Humble Guard (the emailed or app code). The flow completes.
- [ ] Sign in with "Sign in with Google". Check whether the Google flow finishes inside the app
      window. Check whether any popup opens and whether it closes on its own.
- [ ] Optional: try Apple and Facebook the same way. Note any that fail.

Steam:

- [ ] Sign in with a password and Steam Guard. The flow completes.
- [ ] Sign in with the QR code. The flow completes after you approve it in the Steam mobile app.

## 5. Library and review

- [ ] Load the library. It finishes without errors.
- [ ] Check the group counts. Each count matches what you see on the Humble site.
- [ ] Items you might already own show "matches …" (the reason the app thinks you own them).
- [ ] Unrevealed keys show the gift-link label instead of a key.

## 6. Redeem

- [ ] **[IRREVERSIBLE — owner names the target]** Name one key to redeem: `__________`.
      Untick every other item. Redeem only that one.
- [ ] Check the result in Steam (the game is in your library).
- [ ] Check the result in the app's History. It shows the same outcome.
- [ ] **[IRREVERSIBLE — owner names the target]** Name a second key to redeem: `__________`.
      Start the run. Quit the app while it is still running.
- [ ] Relaunch the app. The progress is kept. The second key is not redeemed twice.

## 7. Humble Choice

- [ ] **[IRREVERSIBLE — owner names the target]** Name one game and its month: `__________`.
      Claim only that game.
- [ ] The claimed game appears in review.

## 8. Export

- [ ] Export the library to CSV without reveal. The file opens in Excel or Numbers. The columns
      are in the right order and the values line up.
- [ ] Do NOT run reveal-all, except on a throwaway key you have named here: `__________`.

## 9. Background

- [ ] Set the schedule to 6 hours. For testing, shorten it with a dev override if you need to.
- [ ] Turn on "Keep running in background". Close the window. The app stays in the tray.
- [ ] Tray menu: "Open" brings the window back. "Quit" closes the app fully.
- [ ] Trigger a notification. Click it. The app window opens.
- [ ] Turn on "Launch at login" and check the autostart entry for each OS:
  - [ ] macOS: a login item (or launch agent) exists.
  - [ ] Windows: the startup entry exists in the registry or Startup folder.
  - [ ] Linux: the autostart `.desktop` file exists in `~/.config/autostart`.
- [ ] Turn "Launch at login" off. Confirm each entry is removed.

## 10. Updates (packaged build only)

Run these against a packaged build, not `npm run dev`.

- [ ] With auto-update off, click "Check for updates now". The app makes one request only.
- [ ] Toggle auto-update on, then off. The setting saves and stays after a restart.

## 11. Settings

- [ ] Sign out of Humble. The account row clears.
- [ ] Sign out of Steam. The account row clears.
- [ ] **[IRREVERSIBLE — owner names the target]** "Delete all local data". Confirm the prompt.
      The app returns to Welcome. The schedule stops. The tray icon is gone.

## 12. Packaging

- [ ] Run `npx electron-builder --dir`. The build finishes without errors.
- [ ] On Windows, open the built app. The window loads. (The file:// allowlist must accept the
      Windows paths.)
- [ ] Mac notarization runs in CI. It needs the secrets listed in `docs/RELEASING.md`. Check each
      one is set in the repository.
- [ ] Run `actionlint .github/workflows/*.yml`. It reports no errors.

## 13. Release

- [ ] Bump the version in `package.json` to `0.1.0`.
- [ ] **[IRREVERSIBLE — owner names the target]** Tag `v0.1.0` and push the tag. Owner only.
      Name the repository and remote you are pushing to: `__________`.
- [ ] On the release page, check the assets are attached (installers for each OS).
- [ ] Check `latest*.yml` (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) is attached. Its
      version reads `0.1.0`.
