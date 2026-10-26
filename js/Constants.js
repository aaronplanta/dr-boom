"use strict";

const CONFIG = Object.freeze({
  COLS: 15,
  ROWS: 13,
  TILE_SIZE: 40,
  PLAYER_STEP: 0.14,
  ENEMY_STEP: 0.42,
  BOMB_FUSE: 2.4,
  BOMB_LIMIT: 2,
  BLAST_RANGE: 2,
  FIRE_DURATION: 0.55,
  ROUND_SECONDS: 180,
  CRATE_SCORE: 25,
  ENEMY_SCORE: 200,
  MAX_DELTA: 0.05
});

const TILE = Object.freeze({ EMPTY: 0, WALL: 1, BLOCK: 2 });
const COLORS = Object.freeze({
  floor: '#2c3426', floorAlt: '#2f3729', grid: '#37402e',
  wall: '#535f42', wallTop: '#64724f', wallEdge: '#3e4932',
  crate: '#907346', crateTop: '#b0925e', crateEdge: '#685333',
  player: '#76b0ed', playerLight: '#afd6ff', playerEdge: '#477aaf',
  enemy: '#db896b', enemyLight: '#f2b397', enemyEdge: '#a95c48',
  bomb: '#161a17', bombEdge: '#48513f', fire: '#f39b44', fireCore: '#ffe5a0'
});

const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 0 })
]);

const MOVEMENT_KEYS = Object.freeze({
  ArrowUp: DIRECTIONS[0], KeyW: DIRECTIONS[0],
  ArrowRight: DIRECTIONS[1], KeyD: DIRECTIONS[1],
  ArrowDown: DIRECTIONS[2], KeyS: DIRECTIONS[2],
  ArrowLeft: DIRECTIONS[3], KeyA: DIRECTIONS[3]
});

const INPUT_KEYS = Object.freeze({ BOMB: 'Space', START: 'Enter', PAUSE: 'KeyP', ESCAPE: 'Escape', RESTART: 'KeyR' });
