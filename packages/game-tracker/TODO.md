# game-tracker follow-ups

Known bugs and edge cases, ranked by impact (most severe first). Found in a code review on 2026-10-31.

## High: breaks or wedges a game

1. **A sensor error starts a game.** `scorePoint.js` sends `"POINT ERROR: ..."` strings over the same IPC channel as goal indexes, and `onBreakBeam` handles any value that isn't `<= 1` as `INITIATE_GAME`. Fix: send errors in a separate shape (e.g. `{ error }`) and ignore anything that isn't a number.

## Medium: reliability over long uptimes

2. **The buzzer leaks a file descriptor on every beep.** `beep.js` creates a new `Gpio` on every call and never `unexport()`s it. `readCard` beeps every 500 ms while a card is on the reader, so the Pi eventually fails with EMFILE (too many open files). Fix: create the `Gpio` once per process and reuse it.
3. **Crashed sensor processes go unnoticed.** `child-process.js` listens for `'error'` but not `'exit'`, so a crashed sensor process silently stops reporting. Only Ctrl-C kills the child processes; SIGTERM leaves them running and holding the GPIO pins. Fix: log or restart on exit, and kill the children on SIGTERM/SIGINT.

## Low: data correctness edge cases

4. **Resumed games can give points to the wrong team.** Scores are stored per physical side (A/B), `switched` is always `false`, and team order follows scan order. If teams resume on opposite sides, or scan in a different order, the old points go to the wrong team.
5. **`getCurrentGame` combines `limit: 1` with a filter** (`src/utils/api.js`). DynamoDB applies the limit before the filter, so only the latest game for a matchup is checked; an older unfinished game is never found. Either drop the limit or make the "latest game only" behavior intentional and drop the filter.
6. **Badge reader edge cases** (`readCard.js`). 7-byte card UIDs go past 2^53, so `cardId` loses precision and two cards can map to the same id (use a hex string instead). The id is also only sent if authenticating block 8 with the default key succeeds, which ignores cards with custom keys even though their UID was read. `stopCrypto()` is skipped on the early-return paths.
7. **`Game` model problems** (`src/models/game.js`). `!t1 && !t2` should be `||`. `completed` returns `true` for new games, because `endedAt` is `undefined`, not `null` (currently unused). `bestOfLimit` in the context is unused.
