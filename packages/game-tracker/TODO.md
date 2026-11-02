# game-tracker follow-ups

Known bugs and edge cases, ranked by impact (most severe first). Found in a code review on 2026-10-31.

## High: breaks or wedges a game

1. **Three players can start a game.** `canActivate` (`src/state/guards.js`) checks `players.length >= 2`. With 3 players, `formatTeams` returns `[undefined, undefined]`, a game is saved with `competitionId: "V"` and 3 PlayerGames, `Game()` returns `undefined`, and the `gameComplete` guard throws. Fix: require exactly 2 or 4 players.
2. **Real API errors are treated as expected rejections.** In `pending`, any error from `findOrCreateGame` goes to `shouldResume` and `setGame` stores the Error as `currentGame`, so the next guard check crashes. In `findPlayer`, a network error sends a known player to `registration` with `newPlayer.id = "undefined"`. Fix: check that the rejection is a `Game` or `{ id }`, and otherwise return to `inactive` with a message.
3. **The machine gets stuck in `complete` if `endGame` fails.** The `complete-game` invoke (`src/state/config.js`) has no `onError`, so the machine stays in `complete` and ignores every event until restart. Fix: add `onError` (log it, then go to `inactive`). An unfinished game is offered for resume later anyway.
4. **Punctuation keys crash registration.** readline sets `key.name` to `undefined` for keys like `-` and `.`, so `keyName.length` in `onInputKeypress` (`src/index.js`) throws. Fix: guard against a missing `keyName`.
5. **Registration has no way out.** `registration` only handles `CONFIRM`, which accepts an empty alias. An unknown badge leaves the table stuck until someone types a name. Fix: reject empty aliases, and add a cancel key (e.g. Esc) or a timeout back to `inactive`.
6. **A sensor error starts a game.** `scorePoint.js` sends `"POINT ERROR: ..."` strings over the same IPC channel as goal indexes, and `onBreakBeam` handles any value that isn't `<= 1` as `INITIATE_GAME`. Fix: send errors in a separate shape (e.g. `{ error }`) and ignore anything that isn't a number.

## Medium: reliability over long uptimes

7. **The buzzer leaks a file descriptor on every beep.** `beep.js` creates a new `Gpio` on every call and never `unexport()`s it. `readCard` beeps every 500 ms while a card is on the reader, so the Pi eventually fails with EMFILE (too many open files). Fix: create the `Gpio` once per process and reuse it.
8. **Crashed sensor processes go unnoticed.** `child-process.js` listens for `'error'` but not `'exit'`, so a crashed sensor process silently stops reporting. Only Ctrl-C kills the child processes; SIGTERM leaves them running and holding the GPIO pins. Fix: log or restart on exit, and kill the children on SIGTERM/SIGINT.

## Low: data correctness edge cases

9. **Resumed games can give points to the wrong team.** Scores are stored per physical side (A/B), `switched` is always `false`, and team order follows scan order. If teams resume on opposite sides, or scan in a different order, the old points go to the wrong team.
10. **`getCurrentGame` combines `limit: 1` with a filter** (`src/utils/api.js`). DynamoDB applies the limit before the filter, so only the latest game for a matchup is checked; an older unfinished game is never found. Either drop the limit or make the "latest game only" behavior intentional and drop the filter.
11. **Badge reader edge cases** (`readCard.js`). 7-byte card UIDs go past 2^53, so `cardId` loses precision and two cards can map to the same id (use a hex string instead). The id is also only sent if authenticating block 8 with the default key succeeds, which ignores cards with custom keys even though their UID was read. `stopCrypto()` is skipped on the early-return paths.
12. **`Game` model problems** (`src/models/game.js`). `!t1 && !t2` should be `||`. `completed` returns `true` for new games, because `endedAt` is `undefined`, not `null` (currently unused). `bestOfLimit` in the context is unused.
13. **Alias limit mismatch.** The alias prompt says "<10" but `appendCharacter` allows 10 characters.
