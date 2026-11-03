# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A foosball score-tracking system made of two independent npm packages under `packages/` (no root `package.json` or workspace tooling, so run commands inside each package directory). Develop on **Node 24** (`.nvmrc`). game-app requires it; game-tracker's runtime only needs Node 22.12+, because the Pi Zero W tables can't run Node 24 (no ARMv6 build). Its tests still need Node 24.9+, which Jest requires to load MSW's ESM-only dependencies. Don't use Node 24-only APIs in game-tracker runtime code.

- **`packages/game-tracker`**: a Node (CommonJS) process that runs on a Raspberry Pi. It reads hardware sensors (RFID badge reader, break-beam goal sensors, vibration sensor, buzzer), runs the game as an XState v5 machine, and saves players and games to the AWS AppSync GraphQL API through Amplify v6.
- **`packages/game-app`**: a React 19 web app (Vite, MUI 9, @tanstack/react-query 5, react-router 8) for viewing games, players and competitions from the same API, including live score updates through GraphQL subscriptions.

Both packages talk to the same Amplify Gen 1 backend (`gameservice`, region us-west-2). The source of truth for the API schema is `packages/game-app/amplify/backend/api/gameservice/schema.graphql`.

## Commands

### game-tracker (`cd packages/game-tracker`)
- `npm start`: runs `node src` (needs Pi GPIO/SPI hardware and a TTY, since stdin is put in raw mode)
- `npm test` / `npm run test:watch`: Jest 30. The script sets `--experimental-vm-modules` because MSW 2 pulls in ESM-only deps, so run tests through `npm test -- <args>` rather than bare `npx jest`.
- Single test: `npm test -- src/state/config.test.js` or `npm test -- -t "test name"`
- `npm run scoreboard:test` (on the Pi): draws a test pattern on the LED matrix to check wiring and orientation. Correct a rotated, mirrored or swapped display with `SCOREBOARD_ORIENTATION` (0/90/180/270), `SCOREBOARD_MIRROR=1` and `SCOREBOARD_REVERSE=1`. `SCOREBOARD_INTENSITY` (0-15) sets brightness.
- Pi setup (OS, Comitup Wi-Fi, Node 22, autostart on tty1, calibration) is in `packages/game-tracker/SETUP.md`; wiring is in `pin-mapping.txt`. `setup.sh` does all of it on a fresh Pi (idempotent) and makes `~/.bash_profile` run `start.sh` on tty1, which loads per-table settings from the gitignored `tracker.env` and restarts `node src` when it exits.
- Hardware packages (`onoff`, `mfrc522-rpi`, `rpi-softspi`) are `optionalDependencies`, so `npm install` works off-Pi. An `overrides` entry forces `rpio@^2`, because the `rpio@1` that `mfrc522-rpi` asks for doesn't compile on Node 24.

### game-app (`cd packages/game-app`)
- `npm run dev` (alias `npm start`): Vite dev server on port 3000. `npm run build` outputs to `dist/`, and `npm run preview` serves it.
- `npm test`: Vitest (jsdom, globals). Single file: `npx vitest run src/utils/competition-helpers.test.js`
- `npm run lint`: ESLint flat config. The Amplify-generated `src/graphql/{queries,mutations,subscriptions}.js` are ignored.

### Amplify config
`src/aws-exports.js` is gitignored in both packages and required at runtime (game-app's build needs it too). Generate it with `amplify pull` (Amplify CLI, installed globally, not a project dependency). It is emitted as an ES module, so the tracker's `require()` unwraps `.default`. The tracker's tests do **not** need it: `src/setupTests.js` configures Amplify against a fake endpoint that MSW intercepts. After schema changes, run `amplify push` / `amplify codegen` from `game-app` to regenerate `src/graphql/{queries,mutations,subscriptions}.js` and `schema.json`.

## Architecture

### Data model (`schema.graphql`)
- `Player` is keyed by `fobId` (the RFID badge ID). `Game` holds `sideAPoints`/`sideBPoints`, `startedAt`, and `endedAt` (null/absent means the game is active). The two are linked many-to-many through `PlayerGames`.
- **`competitionId`** identifies a matchup and is built the same way in both packages: a team is a single fobId or two sorted fobIds joined with `::`, and the two teams are sorted and joined with `V` (e.g. `1V2`, `1::2V3`, `1::2V3::4`). Games can have 2, 3 or 4 players; teams follow scan order (first two scanned are a team, so with 3 players the third plays alone). See `formatTeams` / `toCompetitionId` in `game-tracker/src/utils/helpers.js`. The `byCompetition` index looks up past or unfinished games for a matchup.
- Every record has a constant `type` field ("Player"/"Game"). It exists only as a GSI partition key so lists can be sorted (`playersByAlias`, `gamesByStartedAt`). Always set it when creating records.
- Auth is currently `allow: public` (testing-only global rule).
- Access is by AppSync **API key** (365-day expiry, set in `amplify/backend/api/gameservice/cli-inputs.json`; the current key expires 2027-10-31). AppSync deletes expired keys, and any later push that touches the key then fails with `API key not found` (this happened in 2022 and again in 2026). To replace a missing or expired key, set `"CreateAPIKey": 0` in `api/gameservice/parameters.json` and push, then set it back to `1` and push again; after that, copy the regenerated `aws-exports.js` into game-tracker.

### API access (both packages)
Each package has a single `utils/api.js` built on Amplify v6 `generateClient()` (created lazily, after `Amplify.configure`). Calls go through `executeRequest(query, variables)` and mostly use the hand-written documents in `src/graphql/custom.js`, which select nested relations.

### game-tracker flow
- `src/index.js` wires everything together: it `fork`s each sensor script in `src/utils/deviceHandlers/` as a child process (`utils/child-process.js`, which resolves paths relative to the cwd, so run from the package root). Children report over IPC with `process.send`, and their messages become machine events (`actor.send({ type, ... })`). Break-beam index 0/1 is a goal for side A/B; higher indices send `INITIATE_GAME`. Keyboard input supplies CONFIRM/DENY and alias typing during registration. Vibration inactivity triggers `WARN_PAUSE` → `PAUSE`.
- `src/state/config.js` exports `gameMachine` (built with `setup({ actions, actors, guards })`) and `initialContext`. Its states are `inactive → findPlayer/registration → pending → shouldResume/active → pauseWarning → complete`. Implementations live in `actions.js` (context updates use `assign`, while side effects such as prompts and API saves are plain functions), `services.js` (`fromPromise` actors) and `guards.js`. Event names are in `actionTypes.js`. The machine's `input` is merged into the initial context.
- Non-obvious: the `findOrCreateGame` actor **rejects** with an existing unfinished `Game` on purpose, routing to `shouldResume` through `onError`. `setGame` reads `event.output ?? event.error`. Likewise `findPlayer` rejects with `{ id }` for unknown badges, which leads to `registration`.
- `src/models/game.js` is a closure-based Game object that mutates its own score and saves itself through `src/sync`. Score saves are fire-and-forget (not awaited by the machine).
- **Offline-first sync (`src/sync`)**: the tracker never writes to the API directly. Players, games and score updates are recorded in `data/sync.json` (gitignored; `TRACKER_DATA_DIR` overrides the location) and queued in an outbox that `sync.js` sends in order, retrying with backoff while offline. Games get client-generated ids (PlayerGames ids are `<gameId>::<playerId>`), so resent creates are harmless: a `ConditionalCheckFailed` error counts as sent. Errors without an AppSync `errorType` (network, HTTP, expired key) are retried indefinitely; AppSync rejections are retried a few times, then moved to `failed`. Lookups (`findPlayer`, `findUnfinishedGame`) try the API with a timeout and fall back to the local player cache and unsent games, and never throw for network errors. A game's local copy is dropped once nothing about it is queued.
- The win condition is hard-coded in `state/guards.js` (`gameComplete`: first to 5).
- The LED-matrix scoreboard (two MAX7219 8x8 modules) is wired to the tracker Pi and driven by the forked `deviceHandlers/scoreboard.js`, which bit-bangs three GPIO pins through onoff. Every onoff pin goes through `pin()` in `utils/gpio.js`, which adds the sysfs base of the Pi's GPIO controller (512 rather than 0 on newer kernels). `index.js` sends it `{ view }` messages whenever `scoreboardView(snapshot)` changes. The rendering, driver and the 30s hold of a final score are pure modules in `utils/scoreboard/`, testable off the Pi. `pin-mapping.txt` documents the GPIO wiring. `display.py` (an I2C OLED) is not wired into the tracker.

### game-tracker tests
- MSW 2 (`src/mocks/handlers.js`) intercepts AppSync GraphQL operations **by operation name** (e.g. `GetPlayer`, `GameByCompetition`), with `onUnhandledRequest: "error"`. If you add or rename a query in `src/graphql/custom.js`, update the handlers to match.
- Machine tests start actors with `createActor(gameMachine, { input })`, or jump to a state with `gameMachine.resolveState(...)`, and wait for async states with xstate's `waitFor`. Each test calls `sync.init({ autoFlush: false })` for a fresh in-memory sync that queues writes without sending them; assert on `sync.pending()`. Reads still go through MSW. `src/sync/sync.test.js` tests the outbox against a fake `api` and a temp data dir. A request that outlives its test isn't matched by MSW, which causes unhandled rejections.
- `__mocks__/onoff.js` stubs GPIO so tests run off-device.

### game-app
- `@` is aliased to `src/` (`vite.config.js`). Files containing JSX must use the `.jsx` extension. The entry point is `src/main.jsx`, loaded from the root `index.html`.
- Containers in `src/containers/` are route pages (see `src/main.jsx` / `utils/routes.js`); `src/components/` holds shared UI.
- Component tests mock `@/utils/api` with `vi.mock` and render through `renderRoute` in `src/test-utils.jsx`, which wraps pages in `MemoryRouter` and `QueryClientProvider`.
- The Game page subscribes to `onUpdateGame` and merges updates into the `["game", id]` query cache. `onUpdateGame` returns an unsubscribe function used as the effect cleanup.
