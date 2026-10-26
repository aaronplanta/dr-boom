const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the same deferred, dependency-free scripts that index.html loads.
const context = vm.createContext({ console, Math, Set, Map });
for (const file of ['Constants', 'Player', 'Bomb', 'Enemy', 'Explosion', 'Map', 'Game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', `${file}.js`), 'utf8'), context);
}
const api = vm.runInContext(`({
  Game: typeof Game === 'undefined' ? null : Game,
  GameMap: typeof GameMap === 'undefined' ? null : GameMap,
  Bomb: typeof Bomb === 'undefined' ? null : Bomb,
  Enemy: typeof Enemy === 'undefined' ? null : Enemy,
  Explosion: typeof Explosion === 'undefined' ? null : Explosion
})`, context);

function newGame() {
  assert.equal(typeof api.Game, 'function', 'Game implementation must be available');
  const game = new api.Game({ width: 600, height: 520, getContext: () => ({}) });
  game.reset();
  return game;
}

function openArena(game) {
  game.map.grid = Array.from({ length: 13 }, (_, row) =>
    Array.from({ length: 15 }, (_, col) => row === 0 || row === 12 || col === 0 || col === 14 ? 1 : 0));
  game.player.col = 1;
  game.player.row = 1;
  game.enemies = [new api.Enemy(13, 11, 0)];
}

function cellSet(cells) {
  return new Set(Array.from(cells, cell => `${cell.col},${cell.row}`));
}

test('the map protects its border and leaves spawn escape routes open', () => {
  const game = newGame();
  assert.equal(game.map.grid.length, 13);
  assert.equal(game.map.grid[0].length, 15);
  for (let col = 0; col < 15; col++) {
    assert.equal(game.map.getTile(col, 0), 1);
    assert.equal(game.map.getTile(col, 12), 1);
  }
  for (let row = 0; row < 13; row++) {
    assert.equal(game.map.getTile(0, row), 1);
    assert.equal(game.map.getTile(14, row), 1);
  }
  for (const [col, row] of [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [13, 1], [13, 11], [1, 11]]) {
    assert.equal(game.map.getTile(col, row), 0, `spawn/escape cell ${col},${row}`);
  }
  assert.equal(game.map.getTile(-1, 3), 1);
  assert.equal(game.map.getTile(99, 3), 1);
});

test('movement is blocked by solid walls and destructible blocks', () => {
  const game = newGame();
  assert.equal(game.player.tryMove(-1, 0, game), false);
  assert.equal(game.player.col, 1);
  game.map.grid[1][2] = 2;
  assert.equal(game.player.tryMove(1, 0, game), false);
  game.map.grid[1][2] = 0;
  assert.equal(game.player.tryMove(1, 0, game), true);
  assert.equal(game.player.col, 2);
  assert.equal(game.player.row, 1);
});

test('holding a movement key advances on the grid and stops at a wall', () => {
  const game = newGame();
  openArena(game);
  game.map.grid[1][4] = 1;
  game.keys.add('ArrowRight');
  for (let i = 0; i < 60; i++) game.player.update(1 / 60, game);
  assert.equal(game.player.col, 3);
  assert.equal(game.player.row, 1);
});

test('a bomb can be exited but cannot be walked back onto', () => {
  const game = newGame();
  assert.equal(game.placeBomb(), true);
  assert.equal(game.player.tryMove(1, 0, game), true);
  assert.equal(game.player.tryMove(-1, 0, game), false);
});

test('bomb placement rejects duplicates and enforces the two-bomb capacity', () => {
  const game = newGame();
  assert.equal(game.placeBomb(), true);
  assert.equal(game.placeBomb(), false);
  game.player.col = 2;
  assert.equal(game.placeBomb(), true);
  game.player.col = 3;
  assert.equal(game.placeBomb(), false);
  assert.equal(game.bombs.length, 2);
});

test('blast cells form a cross without diagonal fire', () => {
  const game = newGame();
  openArena(game);
  assert.deepEqual(cellSet(game.map.getBlastCells(5, 5, 2)), new Set([
    '5,5', '4,5', '3,5', '6,5', '7,5', '5,4', '5,3', '5,6', '5,7'
  ]));
});

test('fire excludes solid walls and ends at the first destructible block', () => {
  const game = newGame();
  openArena(game);
  game.map.grid[5][6] = 1;
  game.map.grid[5][4] = 2;
  const cells = cellSet(game.map.getBlastCells(5, 5, 3));
  assert.equal(cells.has('6,5'), false);
  assert.equal(cells.has('7,5'), false);
  assert.equal(cells.has('4,5'), true);
  assert.equal(cells.has('3,5'), false);
});

test('detonation removes a crate, preserves walls, and scores it once', () => {
  const game = newGame();
  openArena(game);
  game.map.grid[5][6] = 2;
  game.map.grid[4][5] = 1;
  const bomb = new api.Bomb(5, 5);
  game.bombs.push(bomb);
  game.detonateBombs([bomb]);
  assert.equal(game.map.getTile(6, 5), 0);
  assert.equal(game.map.getTile(5, 4), 1);
  assert.equal(game.score, 25);
  assert.equal(game.bombs.length, 0);
  game.detonateBombs([bomb]);
  assert.equal(game.score, 25);
  assert.equal(game.explosions.length, 1);
});

test('a bomb only detonates after its accumulated fuse time', () => {
  const game = newGame();
  openArena(game);
  game.bombs.push(new api.Bomb(7, 7));
  game.update(2.39);
  assert.equal(game.bombs.length, 1);
  game.update(0.02);
  assert.equal(game.bombs.length, 0);
  assert.equal(game.explosions.length, 1);
});

test('fire instantly triggers adjacent bombs as one chain reaction', () => {
  const game = newGame();
  openArena(game);
  const first = new api.Bomb(5, 5);
  const second = new api.Bomb(7, 5);
  game.bombs.push(first, second);
  game.detonateBombs([first]);
  assert.equal(game.bombs.length, 0);
  assert.equal(game.explosions.length, 2);
  assert.ok(game.explosions.some(fire => fire.contains(9, 5)));
});

test('a destroyed crate still blocks other rays in the same detonation batch', () => {
  const game = newGame();
  openArena(game);
  game.map.grid[5][6] = 2;
  const first = new api.Bomb(5, 5, 4);
  const second = new api.Bomb(4, 5, 4);
  game.bombs.push(first, second);
  game.detonateBombs([first]);
  assert.equal(game.map.getTile(6, 5), 0);
  assert.equal(game.explosions.some(fire => fire.contains(7, 5)), false);
});

test('a crate shields a bomb behind it from a chain reaction', () => {
  const game = newGame();
  openArena(game);
  game.map.grid[5][6] = 2;
  const first = new api.Bomb(5, 5);
  const shielded = new api.Bomb(7, 5);
  game.bombs.push(first, shielded);
  game.detonateBombs([first]);
  assert.equal(game.bombs.length, 1);
  assert.equal(game.bombs[0], shielded);
});

test('fire kills enemies, scores once, and wins when the last hostile is gone', () => {
  const game = newGame();
  openArena(game);
  game.enemies[0].col = 5;
  game.enemies[0].row = 5;
  game.explosions.push(new api.Explosion([{ col: 5, row: 5 }]));
  game.checkHazards();
  assert.equal(game.enemies.length, 0);
  assert.equal(game.score, 200);
  assert.equal(game.state, 'won');
  game.checkHazards();
  assert.equal(game.score, 200);
});

test('self damage takes precedence over killing the last hostile', () => {
  const game = newGame();
  openArena(game);
  game.explosions.push(new api.Explosion([{ col: 1, row: 1 }, { col: 13, row: 11 }]));
  game.checkHazards();
  assert.equal(game.state, 'lost');
});

test('touching a hostile ends the round', () => {
  const game = newGame();
  game.enemies[0].col = 1;
  game.enemies[0].row = 1;
  game.checkHazards();
  assert.equal(game.state, 'lost');
});

test('pause freezes simulation, rejects bomb placement, and clears held keys', () => {
  const game = newGame();
  game.placeBomb();
  game.keys.add('ArrowRight');
  game.togglePause();
  const remaining = game.bombs[0].remaining;
  game.update(1);
  assert.equal(game.state, 'paused');
  assert.equal(game.elapsed, 0);
  assert.equal(game.bombs[0].remaining, remaining);
  assert.equal(game.keys.size, 0);
  assert.equal(game.placeBomb(), false);
  game.togglePause();
  assert.equal(game.state, 'running');
});

test('timeout ends the round', () => {
  const game = newGame();
  game.elapsed = 179.99;
  game.update(0.02);
  assert.equal(game.state, 'lost');
});

test('restart restores the arena and clears bombs, flames, keys, and score', () => {
  const game = newGame();
  game.placeBomb();
  game.explosions.push(new api.Explosion([{ col: 7, row: 7 }]));
  game.keys.add('KeyW');
  game.score = 500;
  game.elapsed = 42;
  game.reset();
  assert.equal(game.bombs.length, 0);
  assert.equal(game.explosions.length, 0);
  assert.equal(game.keys.size, 0);
  assert.equal(game.score, 0);
  assert.equal(game.elapsed, 0);
  assert.equal(game.enemies.length, 3);
  assert.equal(game.player.col, 1);
  assert.equal(game.state, 'running');
});

test('enemies cannot pass through walls, crates, or bombs', () => {
  const game = newGame();
  openArena(game);
  const enemy = new api.Enemy(5, 5, 0);
  game.enemies = [enemy];
  game.map.grid[5][4] = 1;
  game.map.grid[4][5] = 2;
  game.map.grid[6][5] = 1;
  game.bombs.push(new api.Bomb(6, 5));
  for (let i = 0; i < 20; i++) enemy.update(0.1, game);
  assert.equal(enemy.col, 5);
  assert.equal(enemy.row, 5);
});

test('lingering fire expires and no longer harms the player', () => {
  const game = newGame();
  openArena(game);
  game.explosions.push(new api.Explosion([{ col: 5, row: 5 }]));
  game.update(0.6);
  assert.equal(game.explosions.length, 0);
  game.player.col = 5;
  game.player.row = 5;
  game.checkHazards();
  assert.equal(game.state, 'running');
});
