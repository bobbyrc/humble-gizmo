# Captured fixtures

Responses from Humble Bundle and Steam, saved by `npm run capture` (`src/main/dev/capture.ts`)
and passed through `sanitize` (`src/core/sanitize.ts`) before being written.

- `orders.json`: order details for the first 30 orders, plus a Choice (subscriptioncontent) order if
  none was among them.
- `choice-month.json`: the parsed `contentChoiceOptions` of one Choice month.
- `userdata.json`: Steam `dynamicstore/userdata`.
- `owned-names.json`: Steam `GetOwnedGames` response (app ids and names).

Sanitized means: Steam keys (and any text containing one), `redeemed_key_val`, gamekeys, emails,
Steam ids and token/cookie values are replaced with stable fakes (`FAKE1-...`, `user@example.com`).
The salt that derives the fakes is random per run and never saved. Game titles and app ids are
kept. `capture` also refuses to write a file if a replaced original, an IPv4 address, a real-looking
Steam id, key or email is still in it.

The files are also trimmed by `src/main/dev/fixtureTrim.ts`, which runs before sanitizing. It keeps
only what the tests read. `orders.json` loses `path_ids`, and its `amount_spent` and `total` are set
to 0. Each `created` date is replaced by a synthetic date from 2015-01-01 onward, in the same order
as the originals. Everything else in an order, including the keys, stays. `userdata.json` keeps only
`rgOwnedApps` and `rgOwnedPackages`. `owned-names.json` keeps only `appid` and `name` per game, plus
`game_count`.

Dates and amounts in these files are therefore not real. Grep for `card`, `last4`, `paypal`,
`address` and `@` before committing anyway, because the trim does not look for them.

`test/core/captured.test.ts` runs against these files and is skipped while none exist.
