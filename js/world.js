/* world.js — the map of Ashvale.

   The map is generated from a fixed seed, so it is identical every session and
   saved coordinates always mean the same place. Four regions:

     · the knight's cottage (safe, health returns here)
     · Ashvale Woods, to the north — dense trees, clearings, chests
     · Gallow Pasture, in the middle — open ground fenced by trees and boulders
     · Mirrormere, to the south-east — a lake with a dock (scenery only)
     · the Barrow Moor, to the south-west — graves and dead trees
*/

const HOUSE = { x0: 8, y0: 34, x1: 14, y1: 38, doorX: 11, doorY: 38 };

const World = {
  w: MAP_W,
  h: MAP_H,
  tiles: new Uint8Array(MAP_W * MAP_H),

  home: {
    cx: (HOUSE.x0 + HOUSE.x1 + 1) / 2 * TILE,
    cy: (HOUSE.y0 + HOUSE.y1 + 1) / 2 * TILE,
    radius: 9 * TILE,
    spawnX: (HOUSE.doorX + 0.5) * TILE,
    spawnY: (HOUSE.doorY + 2.5) * TILE
  },

  props: [],
  lights: [],
  chestSpots: [],
  enemySpawns: [],

  /* ---------- grid access ---------- */

  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.TREE;
    return this.tiles[ty * MAP_W + tx];
  },

  set(tx, ty, id) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    this.tiles[ty * MAP_W + tx] = id;
  },

  tileAtPx(px, py) {
    return this.get(Math.floor(px / TILE), Math.floor(py / TILE));
  },

  /* ---------- generation ---------- */

  generate() {
    const rng = makeRng(0x5EED1A);
    this.tiles.fill(T.GRASS);
    this.props.length = 0;
    this.lights.length = 0;
    this.chestSpots.length = 0;
    this.enemySpawns.length = 0;

    this._woods(rng);
    this._pasture(rng);
    this._moor(rng);
    this._lake();
    this._clearings();
    this._paths();
    this._dock();
    this._cottage();
    this._border();
    this._scatter(rng);
    this._defineContents();
    this._clearAround();
  },

  _rect(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, id);
  },

  _disc(cx, cy, r, id, only) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (dist2(x, y, cx, cy) > r2) continue;
        if (only && !only.has(this.get(x, y))) continue;
        this.set(x, y, id);
      }
    }
  },

  /* Dense woodland across the north, plus a strip down the west flank that
     pens the cottage in. Density falls off at the southern hem so the treeline
     frays into the pasture instead of ending in a wall. */
  _woods(rng) {
    for (let y = 2; y <= 24; y++) {
      for (let x = 2; x <= 66; x++) {
        const edge = y > 19 ? (24 - y) / 5 : 1;
        if (rng() < 0.52 * edge) this.set(x, y, T.TREE);
        else if (rng() < 0.10) this.set(x, y, T.BUSH);
        else if (rng() < 0.08) this.set(x, y, T.TALLGRASS);
      }
    }
    for (let y = 6; y <= 32; y++) {
      for (let x = 2; x <= 7; x++) {
        if (rng() < 0.55) this.set(x, y, T.TREE);
      }
    }
  },

  /* Open grazing land. Boulder fields and treelines break it into lanes and
     pockets, which is what makes it worth walking through. */
  _pasture(rng) {
    const clusters = [
      [24, 30, 4], [34, 28, 3], [44, 34, 4], [30, 40, 3],
      [40, 46, 5], [22, 46, 3], [50, 42, 3], [52, 30, 4], [18, 38, 3]
    ];
    for (const [cx, cy, r] of clusters) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (dist2(x, y, cx, cy) > r * r) continue;
          const roll = rng();
          if (roll < 0.30) this.set(x, y, T.ROCK);
          else if (roll < 0.46) this.set(x, y, T.TREE);
          else if (roll < 0.62) this.set(x, y, T.TALLGRASS);
        }
      }
    }
    // hedgerows: long, gappy lines of trees that steer the walker
    const hedges = [[20, 34, 34, 34], [36, 38, 36, 50], [26, 52, 48, 52], [46, 26, 46, 32]];
    for (const [x0, y0, x1, y1] of hedges) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        if (rng() < 0.28) continue;          // gaps to slip through
        const x = Math.round(lerp(x0, x1, i / steps));
        const y = Math.round(lerp(y0, y1, i / steps));
        this.set(x, y, rng() < 0.7 ? T.TREE : T.ROCK);
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = 18 + Math.floor(rng() * 40);
      const y = 26 + Math.floor(rng() * 30);
      if (this.get(x, y) === T.GRASS) this.set(x, y, T.TALLGRASS);
    }
  },

  _moor(rng) {
    for (let y = 54; y <= 67; y++) {
      for (let x = 3; x <= 42; x++) {
        const roll = rng();
        if (roll < 0.05) this.set(x, y, T.ROCK);
        else if (roll < 0.09) this.set(x, y, T.TALLGRASS);
      }
    }
    // a barrow field of leaning headstones
    for (let i = 0; i < 16; i++) {
      const x = 8 + Math.floor(rng() * 22);
      const y = 57 + Math.floor(rng() * 8);
      if (this.get(x, y) === T.GRASS) this.set(x, y, T.GRAVE);
    }
    for (let i = 0; i < 10; i++) {
      const x = 6 + Math.floor(rng() * 32);
      const y = 55 + Math.floor(rng() * 11);
      if (this.get(x, y) === T.GRASS) this.props.push({ kind: 'deadtree', x: (x + 0.5) * TILE, y: (y + 0.7) * TILE });
    }
  },

  _lake() {
    const cx = 71, cy = 53, rx = 15, ry = 11;
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) {
      for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const v = dx * dx + dy * dy;
        if (v <= 1) this.set(x, y, T.WATER);
        else if (v <= 1.16) this.set(x, y, T.SHORE);
      }
    }
    // reeds along the northern bank
    for (let x = cx - rx; x <= cx + rx; x += 2) {
      for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
        if (this.get(x, y) === T.SHORE && hash2(x, y) > 0.62) this.set(x, y, T.TALLGRASS);
      }
    }
  },

  /* Glades in the woods — the places worth exploring. */
  _clearings() {
    const glades = [
      [14, 10, 4], [24, 6, 3.5], [36, 12, 4], [48, 7, 3.5],
      [58, 14, 4], [20, 18, 3], [44, 20, 3.5], [62, 6, 3]
    ];
    for (const [cx, cy, r] of glades) {
      this._disc(cx, cy, r, T.GRASS, new Set([T.TREE, T.BUSH, T.TALLGRASS]));
      this._disc(cx, cy, r * 0.45, T.DIRT);
    }
    // toadstool rings, purely for atmosphere
    for (const [cx, cy] of glades) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        this.props.push({
          kind: 'mushroom',
          x: (cx + 0.5 + Math.cos(a) * 2.2) * TILE,
          y: (cy + 0.5 + Math.sin(a) * 2.2) * TILE
        });
      }
    }
  },

  _carve(points, width) {
    const half = Math.floor(width / 2);
    const keep = new Set([T.WATER, T.WALL, T.DOOR, T.FLOOR, T.DOCK, T.SHORE]);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const cx = Math.round(lerp(x0, x1, s / steps));
        const cy = Math.round(lerp(y0, y1, s / steps));
        for (let y = cy - half; y <= cy + half; y++) {
          for (let x = cx - half; x <= cx + half; x++) {
            if (keep.has(this.get(x, y))) continue;
            this.set(x, y, T.DIRT);
          }
        }
      }
    }
  },

  _paths() {
    // the road out of the cottage, east across the pasture
    this._carve([[11, 40], [11, 44], [30, 44]], 3);
    // north into the woods and along the glades
    this._carve([[30, 44], [30, 26], [24, 20], [20, 18], [14, 10]], 3);
    this._carve([[30, 26], [36, 20], [36, 12], [48, 7], [62, 6]], 3);
    this._carve([[36, 12], [24, 6]], 2);
    this._carve([[36, 20], [44, 20], [58, 14]], 2);
    // south-east to the lakeshore and the dock
    this._carve([[30, 44], [42, 48], [50, 50], [55, 52]], 3);
    // south-west onto the moor
    this._carve([[11, 44], [11, 56], [16, 60], [26, 62]], 3);
  },

  _dock() {
    for (let x = 55; x <= 64; x++) {
      this.set(x, 52, T.DOCK);
      this.set(x, 53, T.DOCK);
    }
    this.props.push({ kind: 'post', x: 55 * TILE + 4, y: 52 * TILE + 2 });
    this.props.push({ kind: 'post', x: 55 * TILE + 4, y: 54 * TILE + 2 });
    this.props.push({ kind: 'post', x: 64 * TILE + 28, y: 52 * TILE + 2 });
    this.props.push({ kind: 'post', x: 64 * TILE + 28, y: 54 * TILE + 2 });
    this.props.push({ kind: 'lantern', x: 64 * TILE + 16, y: 52 * TILE + 26 });
    this.props.push({ kind: 'barrel', x: 56 * TILE + 10, y: 51 * TILE + 20 });
    this.lights.push({ x: 64 * TILE + 16, y: 52 * TILE + 12, r: 110, color: '255,190,110', power: 0.5 });
  },

  _cottage() {
    // a swept dirt yard, then the walls
    this._disc(HOUSE.doorX + 0.5, 37, 6, T.DIRT, new Set([T.GRASS, T.TALLGRASS, T.BUSH, T.TREE, T.ROCK]));
    this._rect(HOUSE.x0, HOUSE.y0, HOUSE.x1, HOUSE.y1, T.WALL);
    this._rect(HOUSE.x0 + 1, HOUSE.y0 + 1, HOUSE.x1 - 1, HOUSE.y1 - 1, T.FLOOR);
    this.set(HOUSE.doorX, HOUSE.doorY, T.DOOR);
    this.set(HOUSE.doorX, HOUSE.doorY - 1, T.FLOOR);

    this.props.push({ kind: 'bed', x: 9.5 * TILE, y: 36.2 * TILE });
    this.props.push({ kind: 'fireplace', x: 13 * TILE, y: 36 * TILE });
    this.props.push({ kind: 'table', x: 11.4 * TILE, y: 37 * TILE });
    this.props.push({ kind: 'lantern', x: (HOUSE.doorX + 1.6) * TILE, y: (HOUSE.doorY + 0.9) * TILE });
    this.props.push({ kind: 'barrel', x: (HOUSE.x0 - 0.6) * TILE, y: (HOUSE.y1 + 0.9) * TILE });
    this.props.push({ kind: 'signpost', x: (HOUSE.doorX + 0.5) * TILE, y: 42 * TILE });

    this.lights.push({ x: 13 * TILE, y: 36 * TILE, r: 150, color: '255,170,90', power: 0.85 });
    this.lights.push({ x: (HOUSE.doorX + 1.6) * TILE, y: (HOUSE.doorY + 0.6) * TILE, r: 120, color: '255,190,110', power: 0.6 });
  },

  _border() {
    this._rect(0, 0, MAP_W - 1, 1, T.TREE);
    this._rect(0, MAP_H - 2, MAP_W - 1, MAP_H - 1, T.TREE);
    this._rect(0, 0, 1, MAP_H - 1, T.TREE);
    this._rect(MAP_W - 2, 0, MAP_W - 1, MAP_H - 1, T.TREE);
  },

  _scatter(rng) {
    for (let i = 0; i < 200; i++) {
      const x = 2 + Math.floor(rng() * (MAP_W - 4));
      const y = 2 + Math.floor(rng() * (MAP_H - 4));
      if (this.get(x, y) !== T.GRASS) continue;
      this.set(x, y, rng() < 0.6 ? T.TALLGRASS : T.BUSH);
    }
  },

  /* Chests and monster nests. Kept as data so save files can refer to them by
     index and the game can rebuild the world identically. */
  _defineContents() {
    this.chestSpots = [
      { tx: 14, ty: 10, item: 'potion' },
      { tx: 24, ty: 6, item: 'coin_bag' },
      { tx: 36, ty: 12, item: 'coin_bag' },
      { tx: 48, ty: 7, item: 'potion' },
      { tx: 58, ty: 14, item: 'coin_bag' },
      { tx: 62, ty: 6, item: 'potion' },
      { tx: 26, ty: 50, item: 'potion' },
      { tx: 48, ty: 32, item: 'coin_bag' },
      { tx: 60, ty: 44, item: 'potion' },
      { tx: 10, ty: 60, item: 'coin_bag' },
      { tx: 20, ty: 18, item: 'coin_bag' },
      { tx: 44, ty: 20, item: 'potion' }
    ];

    this.enemySpawns = [
      { type: 'ghost', tx: 16, ty: 14, box: 6 },
      { type: 'ghost', tx: 34, ty: 8, box: 5 },
      { type: 'ghost', tx: 50, ty: 16, box: 6 },
      { type: 'ghost', tx: 14, ty: 62, box: 7 },
      { type: 'ghost', tx: 44, ty: 38, box: 5 },
      { type: 'ghost', tx: 24, ty: 58, box: 6 },
      { type: 'bat', tx: 22, ty: 10, box: 5 },
      { type: 'bat', tx: 42, ty: 18, box: 5 },
      { type: 'bat', tx: 30, ty: 34, box: 6 },
      { type: 'bat', tx: 36, ty: 50, box: 6 },
      { type: 'bat', tx: 58, ty: 58, box: 5 },
      { type: 'bat', tx: 60, ty: 8, box: 5 },
      { type: 'bat', tx: 50, ty: 46, box: 5 },
      { type: 'bat', tx: 20, ty: 44, box: 5 }
    ];
  },

  /* Make sure nothing important spawned inside a tree trunk. */
  _clearAround() {
    const clear = (tx, ty, r) => {
      for (let y = ty - r; y <= ty + r; y++) {
        for (let x = tx - r; x <= tx + r; x++) {
          const t = this.get(x, y);
          if (t === T.TREE || t === T.ROCK || t === T.GRAVE || t === T.BUSH) this.set(x, y, T.GRASS);
        }
      }
    };
    for (const c of this.chestSpots) clear(c.tx, c.ty, 1);
    for (const s of this.enemySpawns) clear(s.tx, s.ty, 1);
  },

  /* ---------- queries ---------- */

  isSolid(tx, ty, passable) {
    const t = this.get(tx, ty);
    if (passable && passable.has(t)) return false;
    return SOLID_TILES.has(t);
  },

  /* Is an axis-aligned body at (x, y) overlapping anything solid? */
  blocked(x, y, hw, hh, passable) {
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw) / TILE);
    const y0 = Math.floor((y - hh) / TILE), y1 = Math.floor((y + hh) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolid(tx, ty, passable)) return true;
      }
    }
    return false;
  },

  /* Move a body one axis at a time, so sliding along a wall feels right. */
  moveBody(body, dx, dy, passable) {
    const hw = body.radius, hh = body.radius * 0.85;
    let hit = false;
    if (dx !== 0) {
      const nx = clamp(body.x + dx, hw, MAP_PX_W - hw);
      if (!this.blocked(nx, body.y, hw, hh, passable)) body.x = nx;
      else hit = true;
    }
    if (dy !== 0) {
      const ny = clamp(body.y + dy, hh, MAP_PX_H - hh);
      if (!this.blocked(body.x, ny, hw, hh, passable)) body.y = ny;
      else hit = true;
    }
    return !hit;
  },

  insideHouse(px, py) {
    const t = this.tileAtPx(px, py);
    return t === T.FLOOR || t === T.DOOR;
  },

  inSafeZone(px, py) {
    return this.insideHouse(px, py) ||
      dist2(px, py, this.home.cx, this.home.cy) <= this.home.radius * this.home.radius;
  },

  regionName(px, py) {
    if (this.insideHouse(px, py)) return 'The Cottage';
    if (dist2(px, py, this.home.cx, this.home.cy) <= this.home.radius * this.home.radius) return 'Cottage Yard';
    const tx = px / TILE, ty = py / TILE;
    if (ty < 25) return 'Ashvale Woods';
    if (tx > 54 && ty > 40) return 'Mirrormere';
    if (ty > 54 && tx < 44) return 'The Barrow Moor';
    return 'Gallow Pasture';
  }
};
