# Milestone 1 (parity)

Plan: `docs/superpowers/plans/2026-11-02-humble-gizmo-parity.md` (step-level checkboxes live there)
Spec: `docs/superpowers/specs/2026-11-02-humble-gizmo-parity-design.md`

- [x] Phase 0: scaffold, allowlist, sign-in windows, probe (Tasks 1–4)
- [ ] Task 5 checkpoint: owner runs `npm run probe` at a desktop; transport and owned-names decisions recorded. Until then both transports and all three owned-names sources ship (Ruling R1).
- [x] Phase 1: pure core logic (Tasks 6–12)
- [x] Phase 2: Humble/Steam clients, runner, fixture capture tool, IPC shell (Tasks 13–17). The owner still needs to run `npm run capture` and confirm the parsers.
- [ ] Task 18 checkpoint: UI design drafted (`docs/design/ui.md`) and the built screens checked against it; owner approval pending
- [x] Phase 3: screens 19–23. Task 20 (sign-in) was re-dispatched with the owner's go-ahead on 2026-11-03 (a6ce9ae, review fix round 9fba244)
- [x] Phase 4: scheduler, updates, packaging (Tasks 24–26)
- [ ] Task 27: smoke checklist written (`docs/SMOKE.md`), final verification and whole-branch review done; owner smoke run and the v0.1.0 tag pending

## Review

- 34 test files, 431 tests passing (3 skipped until captured fixtures exist); typecheck, lint and prettier clean on `9fba244` (`electron-builder --dir` last run on `c5bb3db`).
- Dev mode now allows Vite's live-reload websocket (`ws://localhost`), so edits refresh the window.
- A whole-branch review (most capable model) found boundary bugs that per-task reviews could not see, notably error names lost over Electron's contextBridge and `session.fetch` throwing on redirects. Both were fixed with tests that mimic real Electron behaviour.
- Every decision made without the owner is in `docs/superpowers/rulings-2026-11-03.md`.
- Lesson: test doubles that are more permissive than Electron hide real bugs. Mimic the bridge and the fetch semantics in tests.
