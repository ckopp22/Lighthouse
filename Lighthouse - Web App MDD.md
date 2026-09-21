# Lighthouse - Web App MDD

2026-09-20 · @Someone

A single-page HTML/CSS/JavaScript implementation of the push-your-luck dice game Lighthouse, installable as a PWA, built by Claude Code and deployed as a static site.

## 1. Overview & Objective

**Working title:** Lighthouse (Web)

**Elevator pitch:** A push-your-luck dice game for a group sharing one device. On a turn, the active player rolls three special dice and decides, roll after roll, whether to bank their accumulated points or keep pushing their luck — watching out for the Lighthouse face that can wipe out their turn, their whole score, or knock them out of the game entirely.

**Objective of the game:** Be the player with the highest score once someone passes 100 points, while avoiding the Lighthouses.

**Primary objective (build):** Ship a single, self-contained web app (HTML/CSS/JS, no backend, no build tooling) that Claude Code can generate, commit to a Git repo, and deploy as a static site. The app must also be installable as a PWA so it works offline once installed on a phone.

**Target platform:** Mobile-first responsive web, played on one shared device passed around the group; also usable on desktop/laptop browsers.

**Out of scope for v1:** accounts, networked multiplayer (separate devices), backend/database, native app store builds.

## 2. Dice & Scoring Rules

**The dice:** Three special six-sided dice are used. Each die has 5 numbered faces and 1 Lighthouse face (a lighthouse icon in place of one number — v1 assumption: faces are 2, 3, 4, 5, 6, and Lighthouse; this is a configurable assumption to confirm/adjust before build).

**Turn sequence:**

1. On a player's turn, they roll all three dice together.
2. **Zero Lighthouses rolled:** the numbers on all three dice are summed and added to the player's **turn total** (accumulated points for this turn only, not yet on the scoreboard). The player then chooses to:

- **Bank** — add the turn total to their game score and pass the dice to the next player, or
- **Roll again** — re-roll all three dice, adding more risk for more potential points.

3. **One Lighthouse rolled:** "Too close to the rocks" — the player immediately loses all points accumulated **this turn** (turn total resets to 0, game score is unaffected). Turn ends; dice pass to the next player.
4. **Two Lighthouses rolled:** "Risky water" — the player loses **all points in the game**, not just this turn: their game score resets to 0. Turn ends; dice pass to the next player.
5. **Three Lighthouses rolled:** "Shipwrecked" — the player loses all points (game score resets to 0, same as two Lighthouses) **and is eliminated from the game entirely** — they take no further turns.

**Winning the game:** Once any player's game score exceeds 100, that triggers the endgame: each remaining player gets one final turn (in turn order) to try to beat the leading score. After every remaining player has had their final turn, whoever has the highest score wins. (v1 assumption, standard for this style of push-your-luck game — confirm before build if a different ending is wanted, e.g. game ends immediately at 100 with no final round.)

**Elimination:** A player who is shipwrecked (three Lighthouses) is removed from the turn order for the rest of the game. If only one player remains after eliminations, that remaining player wins outright.

## 3. Core Gameplay Loop

1. **Main Menu** — PLAY, How to Play, Sound On/Off toggle.
2. **Player Setup** — Choose a mode: **Pass & Play** (2–6 players sharing the device, each optionally named) or **vs Bot** (one human against the computer opponent "Skipper"). "Start Game" begins with Player 1's turn.
3. **Play Screen (repeats each turn):**

- Current player's name/indicator is shown clearly at the top.
- Player taps "Roll" — all three dice animate and land on a result.
- The app evaluates the roll per the rules in Section 2 and updates the display:
- 0 Lighthouses: shows the roll total and running turn total; "Roll Again" and "Bank Score" buttons become available.
- 1 Lighthouse: shows a "Too close to the rocks!" message, turn total resets to 0, and the app auto-advances to the next player after a brief pause.
- 2 Lighthouses: shows a "Risky water!" message, that player's game score resets to 0, and the app auto-advances to the next player.
- 3 Lighthouses: shows a "Shipwrecked!" message, that player's game score resets to 0, they're marked eliminated, and the app auto-advances to the next active player.
- Tapping "Bank Score" adds the turn total to the player's game score and passes the dice to the next player.

4. **Endgame trigger:** the moment a player's game score exceeds 100, the app flags this and gives each remaining, non-eliminated player one final turn (in turn order) before ending the game.
5. **Scoreboard** — Final standings for all players sorted by score, winner highlighted, eliminated players clearly marked, "Play Again" (same players) and "Back to Menu" options.

## 4. Screens & UI

**A. Main Menu**

- Title/logo (lighthouse/nautical theme), "PLAY" primary button, "How to Play" secondary, sound on/off toggle icon.

**B. How to Play**

- Plain-language rules covering the roll/bank/continue loop and what 1, 2, and 3 Lighthouses each do, plus the win condition. "Back" button.

**C. Player Setup**

- Mode toggle (Pass & Play / vs Bot). In Pass & Play: number stepper for player count (2–6) and an optional name field per player. In vs Bot: a single name field for the human player; the opponent is the bot "Skipper" (marked with a robot icon). "Start Game" button.

**D. Play Screen (core screen)**

- Current player name/turn indicator, prominent.
- Three dice rendered visually (pips or icons; Lighthouse face shown as a distinct lighthouse icon), with a short roll animation on each roll.
- Running **turn total** displayed clearly, separate from the player's **game score**.
- Status/result banner area for messages ("Too close to the rocks!", "Risky water!", "Shipwrecked!"), with matching sound cue and device vibration (if sound is on and vibration is supported).
- "Roll" button (primary action), "Bank Score" button (enabled only when the turn total is above 0 and no bust just occurred).
- A compact scoreboard strip (name + current score per player) visible at all times, current player highlighted, eliminated players visually dimmed/marked.

**E. Scoreboard (end of game)**

- All players ranked by final score, winner highlighted, eliminated players marked, "Play Again" and "Back to Menu" buttons.

Layout must work in portrait and landscape; dice and buttons must stay comfortably tappable on a phone screen even with a scoreboard strip and status banner also on screen.

## 5. Technical Architecture

- **Stack:** Plain HTML5 + CSS3 + vanilla JavaScript. No framework, no bundler, no npm build step — deployable files are the built files.
- **Rendering:** Single-page app with JS-driven screen switching (show/hide `<section>`s or a small state machine) — no reload flicker mid-game.
- **Dice logic:** Each roll independently randomizes each of the 3 dice across its 6 faces (5 numbers + Lighthouse) using `Math.random()`; a short CSS animation (spin/shake) plays before the result is shown so it reads as a physical roll rather than an instant swap.
- **State management:** In-memory JS object holds current screen, player list (name, score, eliminated flag), current player index, current turn total, Lighthouse-count-so-far this roll, endgame-triggered flag + which players still owe a final turn, and sound-on/off setting. No backend, no database.
- **Bot opponent:** In vs Bot mode the bot plays its own turns automatically (with short pauses so its rolls can be read) while the Roll/Bank buttons are locked. Its decision rule lives in `botShouldRoll` in `script.js` and is pure: it rolls while the expected gain of one more roll is positive (computed from the die faces, dice count and its banked score at risk), banks as soon as banking would take it past the win target, and on a final-round turn keeps rolling until it is strictly ahead of the best other score. There are no difficulty levels in v1.
- **Persistence:** `localStorage` remembers the sound on/off preference between sessions; optionally remembers last-used player names/count.
- **Sound handling:** Short sound effects (dice roll, bust, bust-severe/reset, shipwreck, win) played via `<audio>` or Web Audio API, gated by the sound toggle, cached by the service worker for offline play.
- **Haptic feedback:** On devices/browsers that support it, a short vibration (via the Vibration API, `navigator.vibrate()`) fires alongside each sound cue for a bust (1 Lighthouse), score reset (2 Lighthouses), shipwreck (3 Lighthouses), and winning the game — a slightly longer/stronger pattern for the more severe events. Gated by the same sound toggle, with a silent no-op fallback where vibration isn't supported (e.g. desktop browsers, iOS Safari).
- **PWA support (v1 requirement):**
- `manifest.json` (name, short\_name, icons at 192px/512px, `start_url`, `display: standalone`, nautical color theme) so it's installable to a home screen.
- A service worker (`service-worker.js`) registered from `index.html` that caches the app shell (HTML/CSS/JS/sounds/icons) on install and serves from cache first, so the game works offline once installed/visited.
- Must pass basic installability checks (served over HTTPS, valid manifest, registered service worker) so browsers show an install/"Add to Home Screen" prompt.
- **Responsiveness:** CSS flexbox/grid, relative units, touch-friendly hit targets (min \~48px). Must support touch and mouse.
- **Browser support target:** Latest 2 versions of Chrome, Safari (iOS), Firefox, Edge.

## 6. Data Model

**Die face config** lives in a small data/constants file so the face set or win target can be tuned without touching game logic:

```json
{
 "dieFaces": [2, 3, 4, 5, 6, "LIGHTHOUSE"],
 "winTarget": 100,
 "diceCount": 3
}
```

**Runtime game state** (in-memory, not in the data file):

```json
{
 "players": [
 {"id": "p1", "name": "Alex", "isBot": false, "score": 0, "eliminated": false, "tookFinalTurn": false},
 {"id": "p2", "name": "Skipper", "isBot": true, "score": 0, "eliminated": false, "tookFinalTurn": false}
 ],
 "currentPlayerIndex": 0,
 "turnTotal": 0,
 "lastRoll": [4, "LIGHTHOUSE", 6],
 "endgameTriggered": false,
 "soundOn": true
}
```

**Rules encoded in data, not code:** the die face set and the win target, so either could be tweaked (e.g. a house-rule variant) without a code change. Turn/bust/elimination logic itself is game logic, since it's the core mechanic rather than content.

## 7. File Structure & Repo Layout

```
lighthouse/
├── index.html # markup + screen containers, registers the service worker
├── style.css # nautical-themed styling, responsive rules, dice roll animation
├── script.js # game logic, turn/bust/elimination rules, tap handlers
├── manifest.json # PWA manifest (name, icons, start_url, display: standalone)
├── service-worker.js # caches the app shell for offline/installed use
├── data/
│ └── config.js # exports dieFaces, winTarget, diceCount (see Data Model)
├── sounds/
│ ├── roll.mp3
│ ├── bust.mp3
│ ├── reset.mp3
│ ├── shipwreck.mp3
│ └── win.mp3
├── icons/
│ ├── icon-192.png
│ └── icon-512.png
└── README.md # how to run locally + how to tweak rules/config
```

Plain relative paths only so the same files work identically opened locally as `file://index.html` or served from a repo's Pages URL. Rules constants, game logic, and styling stay in separate files so a rule tweak (e.g. changing the win target) never touches unrelated code.

## 8. Deployment

1. **Build:** Claude Code writes `index.html`, `style.css`, `script.js`, `manifest.json`, `service-worker.js`, `data/config.js`, sound files, and icons directly per the File Structure section — no compilation step.
2. **Commit:** Files are committed and pushed to a Git repo (new or existing — e.g. `git add . && git commit -m "..." && git push`).
3. **Host:** The repo's static hosting (e.g. GitHub Pages, enabled on `main` or a `/docs` folder, or any static host pointed at the repo) serves `index.html` at the root, giving a public URL anyone can open to play.
4. **Update flow going forward:** Any future change (rule tweak, new sounds, UI polish) is a normal commit + push to the same repo; the live site updates automatically.
5. **PWA requirement:** hosting must serve over HTTPS (GitHub Pages does this automatically) for the service worker and install prompt to work.
6. **No environment variables or secrets** are needed since there's no backend or API calls.

## 9. Acceptance Criteria

- [ ] App loads on mobile and desktop browsers via a single static URL, no login.
- [ ] App is installable as a PWA (manifest + service worker pass installability checks; install prompt appears) and its shell loads offline once installed.
- [ ] Main menu → player setup → play → scoreboard all work with no page reloads.
- [ ] Player setup accepts 2–6 players with optional names.
- [ ] vs Bot mode: one human plays against the bot, which takes its own turns (rolling and banking) with the buttons locked, and follows all the same rules including elimination and the final round.
- [ ] Rolling animates all 3 dice and correctly randomizes each across the 5 numbers + Lighthouse face.
- [ ] Rolling 0 Lighthouses sums the numbers into the turn total and enables Roll Again / Bank Score.
- [ ] Rolling exactly 1 Lighthouse resets only the turn total to 0 and passes the turn.
- [ ] Rolling exactly 2 Lighthouses resets that player's full game score to 0 and passes the turn.
- [ ] Rolling exactly 3 Lighthouses resets that player's full game score to 0, eliminates them, and passes the turn to the next active player.
- [ ] Banking adds the turn total to the player's game score and passes the turn.
- [ ] The moment a player's score exceeds 100, every remaining non-eliminated player gets exactly one more turn before the game ends.
- [ ] Final scoreboard correctly ranks all players and highlights the winner (highest score after the final round).
- [ ] Eliminated players are skipped in turn order and clearly marked as out.
- [ ] Sound effects respect the sound on/off toggle, which persists between sessions.
  - [ ] Haptic buzz fires on supported devices for bust, score reset, shipwreck, and win events, and is silently skipped where vibration isn't supported.
- [ ] Works over touch and mouse input; layout holds up in portrait and landscape.

## 10. Future Enhancements (Out of Scope for v1)

- Configurable win target and die face set as an in-app settings option (rather than only editable via `data/config.js`).
- Alternate endgame variant (game ends the instant someone passes 100, no final round) as a toggle.
- Turn history/log so players can see recent rolls.
-
- Persistent multi-game leaderboard across sessions.
- Light/dark theme toggle alongside the nautical theme.
