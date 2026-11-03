# Captured fixtures

Real responses from Humble Bundle and Steam, saved by `npm run capture` (`src/main/dev/capture.ts`)
and passed through `sanitize` (`src/core/sanitize.ts`) before being written.

- `orders.json`: order details for the first 30 orders, plus a Choice (subscriptioncontent) order if
  none was among them.
- `choice-month.json`: the parsed `contentChoiceOptions` of one Choice month.
- `userdata.json`: Steam `dynamicstore/userdata`.
- `owned-names.json`: Steam `GetOwnedGames` response (app ids and names).

Sanitized means: Steam keys (and any text containing one), `redeemed_key_val`, gamekeys, emails,
Steam ids and token/cookie values are replaced with stable fakes (`FAKE1-...`, `user@example.com`).
The salt that derives the fakes is random per run and never saved. Game titles and app ids are
kept. Review the files by eye before committing them.

`test/core/captured.test.ts` runs against these files and is skipped while none exist.
