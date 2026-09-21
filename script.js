/* Lighthouse — game rules + UI. Spec: "Lighthouse - Web App MDD.md".
 *
 * Section 1 (Rules) is pure: every function takes a state and returns a new
 * one, with no DOM access. Section 2 (UI) drives the screens and calls the
 * rules. tests.html exercises Section 1 through window.LighthouseRules.
 */
(function () {
  'use strict';

  const CONFIG = window.LIGHTHOUSE_CONFIG;
  const LIGHTHOUSE = 'LIGHTHOUSE';
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 6;

  /* ======================================================================
   * 1. Rules
   * ==================================================================== */

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function newGameState(names) {
    return {
      players: names.map((name, i) => ({
        id: 'p' + (i + 1),
        name: name,
        score: 0,
        eliminated: false,
        tookFinalTurn: false
      })),
      currentPlayerIndex: 0,
      turnTotal: 0,
      lastRoll: null,
      endgameTriggered: false,
      gameOver: false,
      winnerIds: []
    };
  }

  function rollDice() {
    const faces = [];
    for (let i = 0; i < CONFIG.diceCount; i++) {
      faces.push(CONFIG.dieFaces[Math.floor(Math.random() * CONFIG.dieFaces.length)]);
    }
    return faces;
  }

  // 0 Lighthouses = safe, 1 = bust, 2 = reset, 3+ = shipwreck.
  function evaluateRoll(faces) {
    let lighthouses = 0;
    let sum = 0;
    faces.forEach((f) => {
      if (f === LIGHTHOUSE) lighthouses++;
      else sum += f;
    });
    const type = lighthouses === 0 ? 'safe' : lighthouses === 1 ? 'bust' : lighthouses === 2 ? 'reset' : 'shipwreck';
    return { type: type, lighthouses: lighthouses, sum: sum };
  }

  // Applies a roll to the current player. Does NOT advance the turn: when
  // outcome.turnEnded is true the caller shows the result, then calls endTurn().
  function applyRoll(state, faces) {
    const s = clone(state);
    const player = s.players[s.currentPlayerIndex];
    const outcome = evaluateRoll(faces);
    outcome.lostTurnTotal = 0;
    outcome.turnEnded = outcome.type !== 'safe';
    s.lastRoll = faces;

    if (outcome.type === 'safe') {
      s.turnTotal += outcome.sum;
    } else {
      outcome.lostTurnTotal = s.turnTotal;
      s.turnTotal = 0;
      if (outcome.type === 'reset' || outcome.type === 'shipwreck') player.score = 0;
      if (outcome.type === 'shipwreck') player.eliminated = true;
    }
    return { state: s, outcome: outcome };
  }

  function canBank(state) {
    return !state.gameOver && state.turnTotal > 0;
  }

  // Adds the turn total to the score, flags the endgame if the target is
  // passed, and ends the turn.
  function applyBank(state) {
    const s = clone(state);
    const player = s.players[s.currentPlayerIndex];
    const banked = s.turnTotal;
    player.score += banked;
    let triggeredEndgame = false;
    if (!s.endgameTriggered && player.score > CONFIG.winTarget) {
      s.endgameTriggered = true;
      triggeredEndgame = true;
    }
    return { state: endTurn(s), banked: banked, triggeredEndgame: triggeredEndgame };
  }

  // Next player who still has a turn to take, or -1 if nobody does.
  function nextPlayerIndex(state) {
    const n = state.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (state.currentPlayerIndex + i) % n;
      const p = state.players[idx];
      if (!p.eliminated && !(state.endgameTriggered && p.tookFinalTurn)) return idx;
    }
    return -1;
  }

  // Finishes the current player's turn: passes the dice, or ends the game when
  // one ship is left afloat or every final turn has been taken.
  function endTurn(state) {
    const s = clone(state);
    const current = s.players[s.currentPlayerIndex];
    if (s.endgameTriggered) current.tookFinalTurn = true;
    s.turnTotal = 0;
    s.lastRoll = null;

    const active = s.players.filter((p) => !p.eliminated);
    const next = active.length > 1 ? nextPlayerIndex(s) : -1;
    if (next === -1) {
      const top = active.reduce((max, p) => Math.max(max, p.score), -1);
      s.gameOver = true;
      s.winnerIds = active.filter((p) => p.score === top).map((p) => p.id);
    } else {
      s.currentPlayerIndex = next;
    }
    return s;
  }

  // Ranked list of { player, rank }: active players by score (ties share a
  // rank), then eliminated players with rank null.
  function rankPlayers(state) {
    const active = state.players.filter((p) => !p.eliminated).sort((a, b) => b.score - a.score);
    const out = state.players.filter((p) => p.eliminated);
    const ranked = [];
    active.forEach((p, i) => {
      const rank = i > 0 && p.score === active[i - 1].score ? ranked[i - 1].rank : i + 1;
      ranked.push({ player: p, rank: rank });
    });
    out.forEach((p) => ranked.push({ player: p, rank: null }));
    return ranked;
  }

  window.LighthouseRules = {
    LIGHTHOUSE, newGameState, rollDice, evaluateRoll, applyRoll, applyBank,
    canBank, endTurn, nextPlayerIndex, rankPlayers
  };

  // Loaded by tests.html without the app markup: stop after the rules.
  if (!document.getElementById('menu')) return;

  /* ======================================================================
   * 2. UI
   * ==================================================================== */

  const SCREENS = ['menu', 'howto', 'setup', 'play', 'scoreboard'];
  const STORE = { sound: 'lighthouse.soundOn', players: 'lighthouse.players' };
  const TURN_END_PAUSE = 2300;

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  let state = null;       // current game (rules state)
  let names = [];         // names used for the current game, reused by Play Again
  let busy = false;       // true while a roll animates or a turn-end pause runs
  let gameId = 0;         // bumped when a game starts/quits so stale timers bail out
  let soundOn = load(STORE.sound, true) !== false;
  let playerCount = 2;
  let diceEls = [];

  const currentPlayer = () => state.players[state.currentPlayerIndex];

  /* ---------- Screens ---------- */

  function showScreen(name) {
    SCREENS.forEach((s) => { $(s).hidden = s !== name; });
    window.scrollTo(0, 0);
  }

  /* ---------- Sound + haptics ---------- */

  let audioCtx = null;

  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(ctx, o) {
    const t0 = ctx.currentTime + (o.start || 0);
    const to = o.to || o.from;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + o.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  function noise(ctx, o) {
    const t0 = ctx.currentTime + (o.start || 0);
    const length = Math.floor(ctx.sampleRate * o.dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = o.cutoff || 800;
    gain.gain.setValueAtTime(o.gain || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  // Synthesized cues (no audio files to ship or cache).
  const SOUNDS = {
    roll(ctx) {
      for (let i = 0; i < 7; i++) {
        tone(ctx, { type: 'square', from: 180 + Math.random() * 220, dur: 0.05, start: i * 0.08, gain: 0.07 });
      }
    },
    bank(ctx) {
      tone(ctx, { from: 660, dur: 0.12, gain: 0.15 });
      tone(ctx, { from: 990, dur: 0.25, start: 0.1, gain: 0.15 });
    },
    bust(ctx) {
      tone(ctx, { type: 'sawtooth', from: 340, to: 170, dur: 0.4, gain: 0.16 });
    },
    reset(ctx) {
      tone(ctx, { type: 'sawtooth', from: 300, to: 150, dur: 0.3, gain: 0.16 });
      tone(ctx, { type: 'sawtooth', from: 220, to: 70, dur: 0.45, start: 0.3, gain: 0.16 });
    },
    shipwreck(ctx) {
      tone(ctx, { type: 'sawtooth', from: 130, to: 40, dur: 1.2, gain: 0.2 });
      noise(ctx, { dur: 1.0, gain: 0.3, cutoff: 500 });
    },
    win(ctx) {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone(ctx, { type: 'triangle', from: f, dur: i === 3 ? 0.6 : 0.16, start: i * 0.15, gain: 0.2 });
      });
    }
  };

  const VIBRATIONS = {
    bust: [200],
    reset: [200, 100, 200],
    shipwreck: [400, 150, 400, 150, 600],
    win: [100, 60, 100, 60, 300]
  };

  function cue(name) {
    if (!soundOn) return;
    const ctx = getAudio();
    if (ctx && SOUNDS[name]) {
      try { SOUNDS[name](ctx); } catch (e) { /* audio is best-effort */ }
    }
    if (VIBRATIONS[name] && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(VIBRATIONS[name]); } catch (e) { /* unsupported */ }
    }
  }

  function renderSound() {
    document.querySelectorAll('.sound-toggle').forEach((btn) => {
      btn.textContent = soundOn ? '🔊' : '🔇';
      btn.setAttribute('aria-pressed', String(soundOn));
      btn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
    });
  }

  function toggleSound() {
    soundOn = !soundOn;
    save(STORE.sound, soundOn);
    renderSound();
    if (soundOn) cue('bank');
  }

  /* ---------- Dice ---------- */

  const PIP_CELLS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function lighthouseIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#lh');
    svg.appendChild(use);
    return svg;
  }

  function setFace(el, face) {
    el.replaceChildren();
    el.classList.toggle('is-lh', face === LIGHTHOUSE);
    el.classList.toggle('blank', face === null);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', face === null ? 'Not rolled yet' : face === LIGHTHOUSE ? 'Lighthouse' : String(face));

    if (face === null) {
      el.textContent = '?';
    } else if (face === LIGHTHOUSE) {
      el.appendChild(lighthouseIcon());
    } else if (PIP_CELLS[face]) {
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < 9; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip' + (PIP_CELLS[face].includes(i) ? '' : ' off');
        pips.appendChild(pip);
      }
      el.appendChild(pips);
    } else {
      const numeral = document.createElement('span');
      numeral.className = 'numeral';
      numeral.textContent = String(face);
      el.appendChild(numeral);
    }
  }

  function buildDice() {
    const container = $('dice');
    container.replaceChildren();
    diceEls = [];
    for (let i = 0; i < CONFIG.diceCount; i++) {
      const die = document.createElement('div');
      die.className = 'die';
      setFace(die, null);
      container.appendChild(die);
      diceEls.push(die);
    }
  }

  function clearDice() {
    diceEls.forEach((die) => {
      die.classList.remove('rolling', 'landed');
      setFace(die, null);
    });
  }

  // Tumbles the dice, settling them one by one on the pre-rolled faces.
  function animateDice(finalFaces, id) {
    const settleAt = reducedMotion() ? 150 : 650;
    const stagger = reducedMotion() ? 0 : 160;
    const start = performance.now();
    const settled = diceEls.map(() => false);
    diceEls.forEach((die) => { die.classList.remove('landed'); die.classList.add('rolling'); });

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        const elapsed = performance.now() - start;
        diceEls.forEach((die, i) => {
          if (settled[i]) return;
          if (id !== gameId || elapsed >= settleAt + i * stagger) {
            settled[i] = true;
            die.classList.remove('rolling');
            die.classList.add('landed');
            setFace(die, finalFaces[i]);
          } else {
            setFace(die, CONFIG.dieFaces[Math.floor(Math.random() * CONFIG.dieFaces.length)]);
          }
        });
        if (settled.every(Boolean)) {
          clearInterval(timer);
          resolve();
        }
      }, 70);
    });
  }

  /* ---------- Play screen rendering ---------- */

  function setBanner(title, detail, kind) {
    const banner = $('banner');
    banner.className = 'banner' + (kind ? ' ' + kind : '');
    banner.querySelector('.banner-title').textContent = title;
    banner.querySelector('.banner-detail').textContent = detail || '';
  }

  function topScoreExcept(id) {
    return state.players.reduce((max, p) => (p.id === id ? max : Math.max(max, p.score)), 0);
  }

  function turnStartBanner() {
    const p = currentPlayer();
    if (state.endgameTriggered) {
      setBanner(p.name + ', last chance!', 'Final turn. Beat ' + topScoreExcept(p.id) + ' to win.', 'warn');
    } else {
      setBanner(p.name + "'s turn", 'Tap Roll to throw the dice.', 'info');
    }
  }

  function updateButtons() {
    const rollBtn = $('btn-roll');
    rollBtn.disabled = busy || state.gameOver;
    rollBtn.textContent = state.turnTotal > 0 ? 'Roll Again' : 'Roll';
    $('btn-bank').disabled = busy || !canBank(state);
  }

  function renderStrip() {
    const strip = $('strip');
    strip.replaceChildren();
    state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'strip-player' + (i === state.currentPlayerIndex ? ' current' : '') + (p.eliminated ? ' out' : '');
      const name = document.createElement('span');
      name.className = 'strip-name';
      name.textContent = p.name;
      const score = document.createElement('span');
      score.className = 'strip-score';
      score.textContent = p.eliminated ? 'OUT' : String(p.score);
      chip.append(name, score);
      strip.appendChild(chip);
      if (i === state.currentPlayerIndex) chip.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  function renderFinalChip() {
    const chip = $('final-chip');
    chip.hidden = !state.endgameTriggered;
    if (state.endgameTriggered) {
      const leader = state.players.reduce((best, p) => (p.score > best.score ? p : best), state.players[0]);
      chip.textContent = 'Final round · ' + leader.name + ' leads with ' + leader.score;
    }
  }

  function renderPlay() {
    const p = currentPlayer();
    $('turn-name').textContent = p.name;
    $('turn-total').textContent = String(state.turnTotal);
    $('game-score').textContent = String(p.score);
    renderFinalChip();
    renderStrip();
    updateButtons();
  }

  /* ---------- Game flow ---------- */

  function startGame(playerNames) {
    gameId++;
    busy = false;
    names = playerNames;
    state = newGameState(names);
    buildDice();
    showScreen('play');
    renderPlay();
    turnStartBanner();
  }

  function quitToMenu() {
    gameId++;
    busy = false;
    showScreen('menu');
  }

  function finishGame() {
    showScreen('scoreboard');
    const winners = state.players.filter((p) => state.winnerIds.includes(p.id));
    const soleSurvivor = state.players.filter((p) => !p.eliminated).length === 1;

    $('result-title').textContent = winners.length > 1
      ? "It's a tie!"
      : (winners[0] ? winners[0].name + ' wins!' : 'Game over');
    $('result-detail').textContent = soleSurvivor
      ? 'Last ship afloat.'
      : 'Highest score after the final round.';

    const list = $('rank-list');
    list.replaceChildren();
    rankPlayers(state).forEach((entry) => {
      const p = entry.player;
      const isWinner = state.winnerIds.includes(p.id);
      const row = document.createElement('li');
      row.className = 'rank-row' + (isWinner ? ' winner' : '') + (p.eliminated ? ' out' : '');

      const pos = document.createElement('span');
      pos.className = 'rank-pos';
      pos.textContent = entry.rank === null ? '–' : String(entry.rank);
      const name = document.createElement('span');
      name.className = 'rank-name';
      name.textContent = p.name;
      row.append(pos, name);

      if (isWinner || p.eliminated) {
        const badge = document.createElement('span');
        badge.className = 'rank-badge';
        badge.textContent = isWinner ? 'Winner' : 'Shipwrecked';
        row.appendChild(badge);
      }
      const score = document.createElement('span');
      score.className = 'rank-score';
      score.textContent = String(p.score);
      row.appendChild(score);
      list.appendChild(row);
    });
    cue('win');
  }

  // Shows the next player's turn (or the scoreboard) after a turn ends.
  function afterTurn(bannerTitle, bannerDetail, bannerKind) {
    if (state.gameOver) {
      finishGame();
      return;
    }
    clearDice();
    renderPlay();
    if (bannerTitle) setBanner(bannerTitle, bannerDetail, bannerKind);
    else turnStartBanner();
  }

  const OUTCOME_COPY = {
    bust: { title: 'Too close to the rocks!', detail: (n, o) => n + ' loses ' + o.lostTurnTotal + ' points from this turn.', sound: 'bust' },
    reset: { title: 'Risky water!', detail: (n) => n + "'s score resets to 0.", sound: 'reset' },
    shipwreck: { title: 'Shipwrecked!', detail: (n) => n + ' is out of the game.', sound: 'shipwreck' }
  };

  async function doRoll() {
    if (busy || state.gameOver) return;
    const id = gameId;
    busy = true;
    updateButtons();
    cue('roll');

    const faces = rollDice();
    await animateDice(faces, id);
    if (id !== gameId) return;

    const player = currentPlayer();
    const result = applyRoll(state, faces);
    state = result.state;
    const outcome = result.outcome;
    renderPlay();

    if (outcome.type === 'safe') {
      setBanner('Rolled ' + outcome.sum + '!', 'Turn total ' + state.turnTotal + '. Bank it or roll again?', 'good');
      busy = false;
      updateButtons();
      return;
    }

    const copy = OUTCOME_COPY[outcome.type];
    setBanner(copy.title, copy.detail(player.name, outcome), 'bad');
    cue(copy.sound);
    await wait(TURN_END_PAUSE);
    if (id !== gameId) return;

    state = endTurn(state);
    busy = false;
    afterTurn();
  }

  function doBank() {
    if (busy || !canBank(state)) return;
    const player = currentPlayer();
    const result = applyBank(state);
    state = result.state;
    cue('bank');

    if (state.gameOver) {
      afterTurn();
      return;
    }
    const next = currentPlayer();
    if (result.triggeredEndgame) {
      afterTurn(
        player.name + ' passed ' + CONFIG.winTarget + '!',
        'Final round: ' + next.name + ', you get one last turn.',
        'warn'
      );
    } else {
      afterTurn(player.name + ' banked ' + result.banked, next.name + ", you're up!", 'good');
    }
  }

  /* ---------- Setup screen ---------- */

  function buildNameFields(savedNames) {
    const container = $('name-fields');
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 16;
      input.placeholder = 'Player ' + (i + 1);
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Name for player ' + (i + 1));
      input.value = savedNames[i] || '';
      label.appendChild(input);
      container.appendChild(label);
    }
  }

  function renderSetup() {
    $('player-count').textContent = String(playerCount);
    $('btn-fewer').disabled = playerCount <= MIN_PLAYERS;
    $('btn-more').disabled = playerCount >= MAX_PLAYERS;
    $('name-fields').querySelectorAll('label').forEach((label, i) => { label.hidden = i >= playerCount; });
  }

  function changePlayerCount(delta) {
    playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount + delta));
    renderSetup();
  }

  function startFromSetup() {
    const inputs = Array.from($('name-fields').querySelectorAll('input'));
    const entered = inputs.map((input) => input.value.trim());
    save(STORE.players, { count: playerCount, names: entered });
    startGame(entered.slice(0, playerCount).map((n, i) => n || 'Player ' + (i + 1)));
  }

  /* ---------- Init ---------- */

  function init() {
    document.querySelectorAll('[data-config]').forEach((el) => {
      el.textContent = String(CONFIG[el.dataset.config]);
    });

    const saved = load(STORE.players, {});
    const savedCount = Number(saved.count);
    if (savedCount >= MIN_PLAYERS && savedCount <= MAX_PLAYERS) playerCount = savedCount;
    buildNameFields(Array.isArray(saved.names) ? saved.names : []);
    renderSetup();
    renderSound();

    // Browsers only let audio start after a gesture.
    document.addEventListener('pointerdown', () => { if (soundOn) getAudio(); }, { once: true });

    document.querySelectorAll('.sound-toggle').forEach((btn) => btn.addEventListener('click', toggleSound));
    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.goto));
    });

    $('btn-play').addEventListener('click', () => showScreen('setup'));
    $('btn-howto').addEventListener('click', () => showScreen('howto'));
    $('btn-fewer').addEventListener('click', () => changePlayerCount(-1));
    $('btn-more').addEventListener('click', () => changePlayerCount(1));
    $('btn-start').addEventListener('click', startFromSetup);
    $('btn-roll').addEventListener('click', doRoll);
    $('btn-bank').addEventListener('click', doBank);
    $('btn-quit').addEventListener('click', () => {
      if (window.confirm('End this game and return to the menu?')) quitToMenu();
    });
    $('btn-again').addEventListener('click', () => startGame(names));
    $('btn-menu').addEventListener('click', quitToMenu);

    showScreen('menu');
  }

  init();
})();
