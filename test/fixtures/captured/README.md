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
kept. `capture` also refuses to write a file if a replaced original, an IPv4 address, a real-looking
Steam id, key or email is still in it.

These files still contain the owner's library, purchase dates and amounts. They go into a public
repository, so eyeball them before committing, and grep for `card`, `last4`, `paypal`, `address`
and `@`.

`test/core/captured.test.ts` runs against these files and is skipped while none exist.
