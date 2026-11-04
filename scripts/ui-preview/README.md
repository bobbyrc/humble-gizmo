Browser preview of the renderer with fake data: `npx vite --config scripts/ui-preview/vite.config.ts`, then open http://localhost:5199/?s=<scenario>.
Scenarios: review (default), review-warn, empty, review-error, welcome, signin, run-done, settings-nokeyring.
Review/signin/run scenarios: click Start in Review to see a run that ends rate-limited; run-done ends finished.
Humble Choice, History and Settings are reached via the nav buttons.
Add `&go=<label>` to click the first nav item or button whose text starts with that label (e.g. `&go=History`), or `&go=run` to click the screen's primary header action once it is enabled (waits up to 5s).
Dev-only; excluded from the packaged app.
