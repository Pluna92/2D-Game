/* core.js — tuning values, the palette, and small math helpers.
   Every other file reads its numbers from here so balance lives in one place. */

const TILE = 32;
const VIEW_W = 960;
const VIEW_H = 600;
const MAP_W = 90;
const MAP_H = 70;
const MAP_PX_W = MAP_W * TILE;
const MAP_PX_H = MAP_H * TILE;

/* Tile ids. Anything in SOLID_TILES stops a walking body. */
const T = {
  GRASS: 0,
  DIRT: 1,
  TREE: 2,
  ROCK: 3,
  WATER: 4,
  SHORE: 5,
  DOCK: 6,
  WALL: 7,
  DOOR: 8,
  FLOOR: 9,
  TALLGRASS: 10,
  BUSH: 11,
  GRAVE: 12
};

const SOLID_TILES = new Set([T.TREE, T.ROCK, T.WATER, T.WALL, T.GRAVE]);

const PLAYER = {
  maxHp: 100,
  speed: 122,
  slashDamage: 10,        // each slash takes 10 health points off an enemy
  slashDuration: 0.30,    // whole swing
  slashActiveFrom: 0.06,  // blade only bites during this window
  slashActiveTo: 0.19,
  slashCooldown: 0.14,
  reach: 40,              // how far in front of the knight the blade lands
  blockReduction: 0.25,   // a raised shield lets a quarter of the blow through
  parryWindow: 0.22,      // block raised this recently turns a hit into a parry
  parryStun: 1.3,
  invulnerable: 0.55,     // brief mercy after taking a wound
  regenNearHome: 3.5,     // health points per second inside the safe circle
  regenInsideHome: 9,
  radius: 9
};

const GHOST = {
  name: 'Ghost',
  maxHp: 30,
  damage: 20,             // scratch
  attackName: 'Scratch',
  attackVerb: 'scratches',
  patrolSpeed: 30,
  chaseSpeed: 58,
  aggroRange: 150,
  attackRange: 30,
  windup: 0.5,            // telegraph, so a parry is possible
  attackCooldown: 1.6,
  leash: 300,             // will not chase further than this from its patrol box
  radius: 11,
  passable: new Set([T.ROCK, T.GRAVE])   // drifts through stone
};

const BAT = {
  name: 'Bat',
  maxHp: 20,
  damage: 11,             // bite
  attackName: 'Bite',
  attackVerb: 'bites',
  patrolSpeed: 52,
  chaseSpeed: 84,
  aggroRange: 130,
  attackRange: 24,
  windup: 0.28,
  attackCooldown: 1.0,
  leash: 260,
  radius: 8,
  passable: new Set([T.WATER, T.ROCK, T.GRAVE])  // flies over water and stone
};

const ENEMY_RESPAWN = 30;   // seconds before a slain thing crawls back, if unseen

/* Dark fantasy palette: cold slate, bruised violet, sickly moss, ember accents. */
const C = {
  night: '#0a0c10',
  grass: '#1d2a22',
  grassAlt: '#213026',
  grassDry: '#2a2c1f',
  dirt: '#2e2823',
  dirtAlt: '#352e27',
  stone: '#3a3f4b',
  stoneLight: '#4d5462',
  stoneDark: '#22262f',
  trunk: '#2a2119',
  leaf: '#16241c',
  leafLight: '#1e3226',
  water: '#101a2a',
  waterLight: '#1a2b42',
  shore: '#3a3527',
  wood: '#3b2f24',
  woodLight: '#4d3d2e',
  floor: '#43342a',
  steel: '#454c59',
  steelLight: '#7c8595',
  cloak: '#5e1b22',
  ember: '#e08a2c',
  gold: '#c9a227',
  blood: '#8e2431',
  ghost: '#9fb4c9',
  bat: '#2b2333',
  ui: '#c3c9d6',
  uiDim: '#7b8296',
  panel: 'rgba(10,11,16,0.88)',
  panelEdge: '#3b4252',
  hpFill: '#a3252f',
  hpFillLow: '#d8452b',
  hpBack: '#241a1c'
};

/* ---------- math helpers ---------- */

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Deterministic per-tile noise, so grass tufts and rocks never shimmer. */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* Seeded RNG (mulberry32) — the map is generated the same way every session,
   which keeps saved coordinates meaningful. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

function vecToDir(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
