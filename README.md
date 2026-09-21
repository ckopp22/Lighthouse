# Lighthouse

A push-your-luck dice game for a group sharing one device. Roll three dice, then keep pushing your luck or bank your points, and avoid the Lighthouse faces that can wipe out your turn, your score, or your whole game.

Plain HTML, CSS and JavaScript. There is no framework, no build step and no backend. It works as a static site and installs as a PWA (offline-capable).

## How the game works

- Each die has the faces **2, 3, 4, 5, 6 and Lighthouse**. On your turn, roll all three.
- **0 Lighthouses:** the numbers go into your *turn total*. **Bank** it into your score and pass the device, or **Roll Again**.
- **1 Lighthouse (Too close to the rocks!):** you lose this turn's points. Turn over.
- **2 Lighthouses (Risky water!):** your whole game score resets to 0. Turn over.
- **3 Lighthouses (Shipwrecked!):** score resets to 0 and you're out of the game.
- Once someone banks their score **above 100**, everyone else gets one final turn. The highest score wins. If everyone else is shipwrecked, the last player afloat wins.

2–6 players. The full spec is in [Lighthouse - Web App MDD.md](<Lighthouse - Web App MDD.md>).

## Run it locally

Either open `index.html` directly in a browser (the game works from `file://`; the service worker only registers over http/https), or serve the folder, which you need to test the PWA/offline behavior:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tweak the rules

Edit [data/config.js](data/config.js):

| Setting | Default | Meaning |
| --- | --- | --- |
| `dieFaces` | `[2, 3, 4, 5, 6, 'LIGHTHOUSE']` | Faces on every die. Numbers 1–6 are drawn as pips, other numbers as digits. |
| `winTarget` | `100` | Passing this score starts the final round. |
| `diceCount` | `3` | Dice rolled per throw. |

The Lighthouse penalties themselves (1 = lose turn, 2 = lose score, 3 = eliminated) are game logic in `script.js`, not config.

## Project layout

```
index.html          markup for all five screens, service worker registration
style.css           nautical theme, responsive layout, dice animation
script.js           rules (pure functions) + UI, sound, vibration
data/config.js      dieFaces / winTarget / diceCount
manifest.json       PWA manifest
service-worker.js   offline cache of the app shell
icons/              PWA icons (regenerate with tools/make_icons.py)
tests.html          browser test page for the rules
```

Sound effects are synthesized with the Web Audio API, so there are no audio files to ship. Vibration uses `navigator.vibrate()` where supported (Android browsers; not iOS Safari). Both follow the sound toggle, which is remembered between sessions. On iPhones the ringer switch mutes web audio.

## Tests

Open `tests.html` in a browser (over `file://` or the local server). It runs the rules against the spec's scoring, elimination and final-round cases and shows a pass/fail list.

## Deploy (GitHub Pages)

1. Commit and push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages** and publish from the `main` branch, root folder.
3. Open the Pages URL. It's served over HTTPS, which the service worker and install prompt require.

All paths are relative, so the site works under a subpath like `https://<user>.github.io/<repo>/`.

### Shipping an update

The service worker serves files cache-first, so returning visitors keep the old version until the cache name changes. **Whenever you change any cached file, bump `CACHE_VERSION` in [service-worker.js](service-worker.js)** (e.g. `v1` → `v2`) before pushing.

While developing with the local server, tick **Update on reload** under DevTools → Application → Service Workers (or unregister the worker) to avoid stale files.

## Icons

`python3 tools/make_icons.py` redraws `icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` (needs Pillow). Swap in your own artwork any time, keeping the same file names and sizes.
