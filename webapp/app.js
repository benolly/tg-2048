(function () {
  'use strict';

  const G = window.Game2048;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const supports = (version) => inTelegram && tg.isVersionAtLeast(version);

  const MOVE_MS = 110;
  const SWIPE_PX = 24;

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const cellsEl = $('cells');
  const tilesEl = $('tiles');
  const scoreEl = $('score');
  const scoreBox = $('score-box');
  const bestEl = $('best');
  const overlayEl = $('overlay');

  const botName = (() => {
    const name = new URLSearchParams(location.search).get('bot');
    return name && /^[A-Za-z0-9_]{4,32}$/.test(name) ? name : null;
  })();

  // Хранилище: облако Telegram внутри клиента, localStorage в обычном браузере.
  const storage = {
    get(key) {
      const read = new Promise((resolve) => {
        if (supports('6.9')) {
          tg.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value || null));
        } else {
          try {
            resolve(localStorage.getItem(key));
          } catch {
            resolve(null);
          }
        }
      });
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
      return Promise.race([read, timeout]);
    },
    set(key, value) {
      if (supports('6.9')) {
        tg.CloudStorage.setItem(key, value);
        return;
      }
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };

  function haptic(type, style) {
    if (!supports('6.1')) return;
    if (type === 'impact') tg.HapticFeedback.impactOccurred(style);
    else tg.HapticFeedback.notificationOccurred(style);
  }

  // Цвета берутся из темы Telegram, плитки окрашиваются оттенками цвета кнопок.
  const FALLBACK = {
    light: {
      bg_color: '#ffffff',
      secondary_bg_color: '#f0f0f3',
      text_color: '#111111',
      hint_color: '#8e8e93',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
    },
    dark: {
      bg_color: '#17212b',
      secondary_bg_color: '#232e3c',
      text_color: '#f5f5f5',
      hint_color: '#708499',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
    },
  };

  let palette;

  function parseHex(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  const mix = (a, b, t) => a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));
  const rgb = (c) => `rgb(${c.join(',')})`;

  function applyTheme() {
    const dark = inTelegram ? tg.colorScheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const base = FALLBACK[dark ? 'dark' : 'light'];
    const params = inTelegram ? tg.themeParams || {} : {};
    const pick = (key) => parseHex(params[key]) || parseHex(base[key]);

    palette = {
      bg: pick('bg_color'),
      board: pick('secondary_bg_color'),
      text: pick('text_color'),
      hint: pick('hint_color'),
      accent: pick('button_color'),
      accentText: pick('button_text_color'),
    };

    const s = document.documentElement.style;
    s.setProperty('--bg', rgb(palette.bg));
    s.setProperty('--board', rgb(palette.board));
    s.setProperty('--cell', rgb(mix(palette.text, palette.board, dark ? 0.07 : 0.06)));
    s.setProperty('--text', rgb(palette.text));
    s.setProperty('--hint', rgb(palette.hint));
    s.setProperty('--accent', rgb(palette.accent));
    s.setProperty('--accent-text', rgb(palette.accentText));
    s.setProperty('--veil', `rgba(${palette.board.join(',')},0.93)`);

    for (const [id, el] of tileEls) {
      const tile = state && G.tiles(state).find((t) => t.id === id);
      if (tile) paint(el, tile.value);
    }
  }

  function tileColors(value) {
    const level = Math.log2(value);
    const bg = level <= 11
      ? mix(palette.accent, palette.board, 0.2 + (0.8 * (level - 1)) / 10)
      : mix(palette.text, palette.accent, Math.min(0.55, (level - 11) * 0.12));
    return { bg: rgb(bg), fg: rgb(level >= 6 ? palette.accentText : palette.text) };
  }

  // Отрисовка

  const tileEls = new Map();

  function buildCells() {
    for (let r = 0; r < G.SIZE; r++) {
      for (let c = 0; c < G.SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'pos cell';
        cell.style.setProperty('--r', r);
        cell.style.setProperty('--c', c);
        cellsEl.appendChild(cell);
      }
    }
  }

  function trackBoardSize() {
    const update = () => boardEl.style.setProperty('--u', `${boardEl.clientWidth / 100}px`);
    update();
    if (window.ResizeObserver) new ResizeObserver(update).observe(boardEl);
    else window.addEventListener('resize', update);
  }

  function place(el, tile) {
    el.style.setProperty('--r', tile.r);
    el.style.setProperty('--c', tile.c);
  }

  function paint(el, value) {
    const inner = el.firstChild;
    const colors = tileColors(value);
    inner.textContent = value;
    inner.dataset.len = String(value).length;
    inner.style.background = colors.bg;
    inner.style.color = colors.fg;
  }

  function createTileEl(tile, kind) {
    const el = document.createElement('div');
    el.className = kind ? `pos tile ${kind}` : 'pos tile';
    el.appendChild(document.createElement('div')).className = 'tile-inner';
    place(el, tile);
    paint(el, tile.value);
    tilesEl.appendChild(el);
    tileEls.set(tile.id, el);
    return el;
  }

  function render(animate) {
    const alive = new Set();

    for (const tile of G.tiles(state)) {
      alive.add(tile.id);

      if (tile.mergedFrom) {
        for (const src of tile.mergedFrom) {
          const el = tileEls.get(src.id);
          if (!el) continue;
          tileEls.delete(src.id);
          el.classList.remove('new', 'merged');
          el.classList.add('leaving');
          place(el, tile);
          setTimeout(() => el.remove(), MOVE_MS + 20);
        }
      }

      const el = tileEls.get(tile.id);
      if (el) {
        el.classList.remove('new', 'merged');
        place(el, tile);
      } else {
        const kind = !animate ? '' : tile.mergedFrom ? 'merged' : 'new';
        createTileEl(tile, kind);
      }
    }

    for (const [id, el] of tileEls) {
      if (!alive.has(id)) {
        el.remove();
        tileEls.delete(id);
      }
    }
  }

  function clearTiles() {
    for (const el of tileEls.values()) el.remove();
    tileEls.clear();
    tilesEl.replaceChildren();
  }

  function updateStats() {
    scoreEl.textContent = state.score;
    bestEl.textContent = best;
  }

  function showGain(points) {
    const plus = document.createElement('span');
    plus.className = 'plus';
    plus.textContent = `+${points}`;
    scoreBox.appendChild(plus);
    setTimeout(() => plus.remove(), 700);
  }

  // Оверлей конца игры и победы

  let overlayOpen = false;

  function showOverlay(title, text, actions) {
    $('overlay-title').textContent = title;
    $('overlay-text').textContent = text;
    $('overlay-actions').replaceChildren(
      ...actions.map(([label, onClick, primary]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = primary ? 'btn' : 'btn ghost';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
      }),
    );
    overlayOpen = true;
    overlayEl.hidden = false;
    void overlayEl.offsetWidth; // применить display до смены opacity, иначе не будет плавного появления
    overlayEl.classList.add('show');
  }

  function hideOverlay() {
    overlayOpen = false;
    overlayEl.classList.remove('show');
    overlayEl.hidden = true;
  }

  function showGameOver() {
    const record = state.score > bestAtStart && state.score > 0;
    const actions = [['Ещё раз', newGame, true]];
    if (botName) actions.push(['Поделиться', share, false]);
    showOverlay('Ходов нет', record ? `Новый рекорд: ${state.score}` : `Счёт: ${state.score}`, actions);
  }

  function showWin() {
    showOverlay('2048', 'Плитка собрана. Можно играть дальше.', [
      ['Продолжить', hideOverlay, true],
      ['Заново', newGame, false],
    ]);
  }

  function share() {
    const text = `Мой счёт в 2048: ${state.score}. Сможешь больше?`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botName}`)}&text=${encodeURIComponent(text)}`;
    if (supports('6.1')) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  }

  // Игра

  let state = null;
  let best = 0;
  let bestAtStart = 0;
  let saveTimer = 0;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      storage.set('game', JSON.stringify({ ...G.serialize(state), prevBest: bestAtStart }));
    }, 300);
  }

  function newGame() {
    hideOverlay();
    clearTiles();
    state = G.create();
    bestAtStart = best;
    render(true);
    updateStats();
    save();
  }

  function confirmRestart() {
    if (!state || state.score === 0 || state.over) {
      newGame();
      return;
    }
    if (supports('6.2')) {
      tg.showConfirm('Начать новую игру? Текущий счёт пропадёт.', (ok) => ok && newGame());
    } else if (window.confirm('Начать новую игру?')) {
      newGame();
    }
  }

  function go(dir) {
    if (!state || overlayOpen) return;

    const res = G.move(state, dir);
    if (!res.moved) return;

    render(true);

    if (res.gained) {
      showGain(res.gained);
      haptic('impact', 'medium');
    } else {
      haptic('impact', 'light');
    }

    if (state.score > best) {
      best = state.score;
      storage.set('best', String(best));
    }
    updateStats();
    save();

    if (res.justWon) {
      haptic('notify', 'success');
      setTimeout(showWin, MOVE_MS + 250);
    } else if (state.over) {
      haptic('notify', 'error');
      setTimeout(showGameOver, MOVE_MS + 350);
    }
  }

  // Управление: свайпы, мышь, клавиатура

  function bindInput() {
    const KEYS = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    };
    document.addEventListener('keydown', (e) => {
      const dir = KEYS[e.key] || KEYS[e.code];
      if (!dir) return;
      e.preventDefault();
      go(dir);
    });

    let start = null;
    document.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.target.closest('button')) {
        start = null;
        return;
      }
      start = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener('pointerup', (e) => {
      if (!start || !e.isPrimary) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? 'right' : 'left');
      else go(dy > 0 ? 'down' : 'up');
    });
    document.addEventListener('pointercancel', () => {
      start = null;
    });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    $('restart').addEventListener('click', confirmRestart);
  }

  async function init() {
    if (inTelegram) {
      tg.expand();
      if (supports('7.7')) tg.disableVerticalSwipes();
      if (supports('6.1')) {
        tg.setHeaderColor('bg_color');
        tg.setBackgroundColor('bg_color');
      }
      tg.onEvent('themeChanged', applyTheme);
    } else {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    }

    applyTheme();
    buildCells();
    trackBoardSize();
    bindInput();

    const [savedGame, savedBest] = await Promise.all([storage.get('game'), storage.get('best')]);
    best = Number(savedBest) || 0;

    let saved = null;
    try {
      saved = JSON.parse(savedGame);
    } catch {}
    const restored = G.restore(saved);

    if (restored && !restored.over) {
      state = restored;
      best = Math.max(best, state.score);
      bestAtStart = Number.isFinite(saved.prevBest) ? saved.prevBest : best;
      render(false);
      updateStats();
    } else {
      newGame();
    }

    if (tg) tg.ready();
  }

  init();
})();
