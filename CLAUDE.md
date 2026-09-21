# CLAUDE.md

Lighthouse is a push-your-luck dice game for 2–6 players on one shared device. It is a static, installable PWA. The spec and source of truth is [Lighthouse - Web App MDD.md](<Lighthouse - Web App MDD.md>): check it before changing rules or screens, and update it if behavior intentionally changes.

## Hard constraints

- **Vanilla HTML/CSS/JS only.** No framework, bundler, npm or build step. The files in the repo are the files that get deployed.
- **Must work opened from `file://`**, not just over a server. So `data/config.js` is a classic script that sets `window.LIGHTHOUSE_CONFIG` (no `import`/`export`, no ES modules, no `fetch` of local files).
- **Plain relative paths** everywhere (needed for GitHub Pages subpaths). No leading `/`.
- No backend, accounts or secrets.

## Layout

| File | Role |
| --- | --- |
| `index.html` | All five screens as `<section>`s (`menu`, `howto`, `setup`, `play`, `scoreboard`), the shared lighthouse SVG `<symbol id="lh">`, service worker registration |
| `style.css` | Theme (CSS variables in `:root`), layout, dice animation, landscape rules at the bottom |
| `script.js` | Section 1: pure rules. Section 2: UI, audio, haptics, `localStorage` |
| `data/config.js` | `dieFaces`, `winTarget`, `diceCount` |
| `service-worker.js` | Cache-first app shell |
| `tests.html` | Browser test page for the rules |
| `tools/make_icons.py` | Regenerates `icons/*.png` (Pillow) |

## Conventions

- **Rules live in `script.js` Section 1 as pure functions** (`applyRoll`, `applyBank`, `endTurn`, `nextPlayerIndex`, `rankPlayers`, …). They take a state and return a new one, with no DOM access. Keep it that way: UI code calls them and never encodes rules. They are exposed as `window.LighthouseRules` for `tests.html`.
- **The bot** is a player with `isBot: true`. Its strategy is the pure `botShouldRoll(state)` (Section 1, tested in `tests.html`). Its turns are driven by `runBotTurn` in the UI, which reuses `performRoll`/`bankTurn` (the same code paths as a human) and keeps `busy` true so the buttons stay locked. `enterTurn` starts a bot's turn automatically. Don't add bot-specific rules to the rules functions.
- `applyRoll` deliberately does **not** advance the turn. The UI shows the outcome banner, waits, then calls `endTurn`.
- Rule decisions the MDD left open: the endgame triggers when a banked score is *strictly greater* than `winTarget`. Every other non-eliminated player then gets exactly one final turn. Ties share the win. The last non-eliminated player wins outright.
- Player names are user input: render with `textContent`/DOM APIs, never `innerHTML`.
- Sounds are synthesized (Web Audio) in `SOUNDS`; there are no audio files. Sound and vibration both respect the sound toggle.
- Async UI flows check `gameId` after every `await` so quitting mid-roll or mid-pause cannot touch a new game.
- Colors and sizes come from the `:root` variables in `style.css`. Keep touch targets ≥ 48px.

## Shipping changes

**Bump `CACHE_VERSION` in `service-worker.js` whenever any cached file changes**, and add any new shell file to `APP_SHELL`. Otherwise installed/returning users keep the old version.

## Running and testing

There is no build. To run:

```sh
python3 -m http.server 8000   # http://localhost:8000
```

- Rules tests: open `tests.html` (all tests should show PASS). Headless: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --allow-file-access-from-files --virtual-time-budget=3000 --dump-dom file://$PWD/tests.html` and look for "ALL n TESTS PASSED" in the title.
- Add a test to `tests.html` for any rule change.
- UI: walk menu → setup → play → scoreboard in both portrait and landscape (DevTools device mode). Check PWA installability under DevTools → Application.
- Real-device-only checks: iOS "Add to Home Screen", haptics on Android.
