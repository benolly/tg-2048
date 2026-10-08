const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../webapp/game');

// rng, который всегда выбирает последнюю пустую клетку и ставит туда 4.
const last = () => 0.999;

const board = (cells, extra = {}) => G.restore({ cells, score: 0, ...extra });
const values = (s) => s.grid.map((row) => row.map((t) => (t ? t.value : 0)));
const at = (s, r, c) => s.grid[r][c];

const E = [0, 0, 0, 0];

test('create puts two tiles on the board', () => {
  const s = G.create();
  assert.equal(G.tiles(s).length, 2);
  assert.equal(s.score, 0);
});

test('left merges pairs once per tile', () => {
  const s = board([[2, 2, 2, 2], E, E, E]);
  const res = G.move(s, 'left', last);
  assert.equal(res.moved, true);
  assert.equal(res.gained, 8);
  assert.deepEqual(values(s)[0], [4, 4, 0, 0]);
  assert.equal(s.score, 8);
});

test('a freshly merged tile does not merge again in the same move', () => {
  const s = board([[2, 2, 4, 0], E, E, E]);
  G.move(s, 'left', last);
  assert.deepEqual(values(s)[0], [4, 4, 0, 0]);
});

test('right, up and down slide to the matching edge', () => {
  const right = board([[2, 0, 0, 0], E, E, E]);
  G.move(right, 'right', last);
  assert.deepEqual(values(right)[0], [0, 0, 0, 2]);

  const up = board([E, E, E, [0, 2, 0, 0]]);
  G.move(up, 'up', last);
  assert.equal(at(up, 0, 1).value, 2);

  const down = board([[0, 2, 0, 0], E, E, E]);
  G.move(down, 'down', last);
  assert.equal(at(down, 3, 1).value, 2);
});

test('a blocked move changes nothing and spawns nothing', () => {
  const s = board([[2, 4, 8, 16], E, E, E]);
  const before = values(s);
  const res = G.move(s, 'left', last);
  assert.equal(res.moved, false);
  assert.deepEqual(values(s), before);
});

test('a sliding tile keeps its id so it can be animated', () => {
  const s = board([[0, 0, 0, 2], E, E, E]);
  const id = at(s, 0, 3).id;
  G.move(s, 'left', last);
  assert.equal(at(s, 0, 0).id, id);
  assert.equal(at(s, 0, 0).r, 0);
  assert.equal(at(s, 0, 0).c, 0);
});

test('a merged tile remembers both sources, moved onto its cell', () => {
  const s = board([[2, 0, 0, 2], E, E, E]);
  const ids = [at(s, 0, 0).id, at(s, 0, 3).id];
  G.move(s, 'left', last);

  const merged = at(s, 0, 0);
  assert.equal(merged.value, 4);
  assert.deepEqual(merged.mergedFrom.map((t) => t.id).sort(), ids.sort());
  for (const src of merged.mergedFrom) assert.deepEqual([src.r, src.c], [0, 0]);
});

test('a new tile appears after every real move', () => {
  const s = board([[2, 0, 0, 0], E, E, E]);
  const res = G.move(s, 'right', last);
  assert.ok(res.spawned);
  assert.equal(res.spawned.isNew, true);
  assert.equal(G.tiles(s).length, 2);
});

test('the game is over when the board is full and nothing merges', () => {
  const s = board([[2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [0, 16, 32, 64]]);
  G.move(s, 'left', () => 0.5);
  assert.equal(s.over, true);

  const res = G.move(s, 'up', last);
  assert.equal(res.moved, false);
});

test('reaching 2048 reports a win only once', () => {
  const s = board([[1024, 1024, 0, 0], [1024, 1024, 0, 0], E, E]);
  assert.equal(G.move(s, 'left', last).justWon, true);
  assert.equal(s.won, true);
  assert.equal(G.move(s, 'up', last).justWon, false);
});

test('serialize and restore keep the board, score and win flag', () => {
  const s = board([[2, 4, 0, 0], E, [0, 0, 8, 0], E], { score: 120, won: true });
  const copy = G.restore(JSON.parse(JSON.stringify(G.serialize(s))));
  assert.deepEqual(values(copy), values(s));
  assert.equal(copy.score, 120);
  assert.equal(copy.won, true);
});

test('restore rejects broken data', () => {
  assert.equal(G.restore(null), null);
  assert.equal(G.restore({ cells: 'x' }), null);
  assert.equal(G.restore({ cells: [E, E, E, E] }), null);
  assert.deepEqual(values(G.restore({ cells: [[3, 2, 0, 0], E, E, E] }))[0], [0, 2, 0, 0]);
});
