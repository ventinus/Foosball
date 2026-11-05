# game-tracker follow-ups

Known bugs and edge cases, ranked by impact (most severe first). Found in a code review on 2026-10-31.

## Low: data correctness edge cases

1. **`getCurrentGame` combines `limit: 1` with a filter** (`src/utils/api.js`). DynamoDB applies the limit before the filter, so only the latest game for a matchup is checked; an older unfinished game is never found. Either drop the limit or make the "latest game only" behavior intentional and drop the filter.
2. **Badge reader edge cases** (`readCard.js`). 7-byte card UIDs go past 2^53, so `cardId` loses precision and two cards can map to the same id (use a hex string instead). The id is also only sent if authenticating block 8 with the default key succeeds, which ignores cards with custom keys even though their UID was read. `stopCrypto()` is skipped on the early-return paths.
3. **`Game` model problems** (`src/models/game.js`). `!t1 && !t2` should be `||`. `completed` returns `true` for new games, because `endedAt` is `undefined`, not `null` (currently unused). `bestOfLimit` in the context is unused.
4. **Vibration sensor errors count as activity.** `vibration.js` sends `"VIBRATION ERROR: ..."` strings over the same IPC channel as readings, and the tracker treats any message as table activity, so a failing sensor keeps a game from pausing. Fix: send `{ error }` as `scorePoint.js` does, and log it.
