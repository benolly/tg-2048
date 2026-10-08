(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Game2048 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 4;
  const WIN = 2048;
  const VECTORS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  let lastId = 0;

  function makeTile(value, r, c) {
    return { id: ++lastId, value, r, c, isNew: false, mergedFrom: null };
  }

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function tiles(state) {
    return state.grid.flat().filter(Boolean);
  }

  function spawn(state, rng) {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!state.grid[r][c]) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return null;

    const [r, c] = empty[Math.floor(rng() * empty.length)];
    const tile = makeTile(rng() < 0.9 ? 2 : 4, r, c);
    tile.isNew = true;
    state.grid[r][c] = tile;
    return tile;
  }

  function canMove(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = grid[r][c];
        if (!t) return true;
        const right = c + 1 < SIZE && grid[r][c + 1];
        const down = r + 1 < SIZE && grid[r + 1][c];
        if ((right && right.value === t.value) || (down && down.value === t.value)) return true;
      }
    }
    return false;
  }

  function create(rng = Math.random) {
    const state = { grid: emptyGrid(), score: 0, won: false, over: false };
    spawn(state, rng);
    spawn(state, rng);
    return state;
  }

  // Ход меняет state на месте. Плитки сохраняют id, чтобы интерфейс мог их анимировать:
  // у сдвинутой плитки меняются r/c, у слитой появляется mergedFrom с двумя исходными.
  function move(state, dir, rng = Math.random) {
    const vec = VECTORS[dir];
    if (!vec || state.over) return { moved: false, gained: 0 };

    const [dr, dc] = vec;
    const order = [0, 1, 2, 3];
    const rows = dr === 1 ? [...order].reverse() : order;
    const cols = dc === 1 ? [...order].reverse() : order;

    for (const t of tiles(state)) {
      t.isNew = false;
      t.mergedFrom = null;
    }

    const grid = emptyGrid();
    let gained = 0;
    let moved = false;
    let reachedWin = false;

    for (const r of rows) {
      for (const c of cols) {
        const tile = state.grid[r][c];
        if (!tile) continue;

        let nr = r;
        let nc = c;
        while (inside(nr + dr, nc + dc) && !grid[nr + dr][nc + dc]) {
          nr += dr;
          nc += dc;
        }

        const tr = nr + dr;
        const tc = nc + dc;
        const other = inside(tr, tc) ? grid[tr][tc] : null;

        if (other && other.value === tile.value && !other.mergedFrom) {
          const merged = makeTile(tile.value * 2, tr, tc);
          merged.mergedFrom = [other, tile];
          grid[tr][tc] = merged;
          tile.r = tr;
          tile.c = tc;
          gained += merged.value;
          if (merged.value === WIN) reachedWin = true;
          moved = true;
        } else {
          grid[nr][nc] = tile;
          if (nr !== r || nc !== c) moved = true;
          tile.r = nr;
          tile.c = nc;
        }
      }
    }

    if (!moved) return { moved: false, gained: 0 };

    state.grid = grid;
    state.score += gained;
    const spawned = spawn(state, rng);
    const justWon = reachedWin && !state.won;
    if (justWon) state.won = true;
    state.over = !canMove(state.grid);

    return { moved: true, gained, spawned, justWon };
  }

  function serialize(state) {
    return {
      cells: state.grid.map((row) => row.map((t) => (t ? t.value : 0))),
      score: state.score,
      won: state.won,
    };
  }

  function restore(data) {
    if (!data || !Array.isArray(data.cells) || data.cells.length !== SIZE) return null;

    const state = { grid: emptyGrid(), score: Number(data.score) || 0, won: !!data.won, over: false };
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = Array.isArray(data.cells[r]) ? data.cells[r][c] : 0;
        if (Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0) state.grid[r][c] = makeTile(v, r, c);
      }
    }
    if (tiles(state).length === 0) return null;

    state.over = !canMove(state.grid);
    return state;
  }

  return { SIZE, WIN, create, move, tiles, canMove, serialize, restore };
});
