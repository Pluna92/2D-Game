/* game.js — the loop, the camera, the state machine and all the glue.

   States: 'title' · 'play' · 'inventory' · 'pause' · 'dead'
*/

const Sound = {
  ctx: null,
  enabled: true,

  ensure() {
    if (this.ctx || !this.enabled) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    } catch (err) {
      this.enabled = false;
    }
  },

  /* One short shaped tone. Everything in the game is built from these. */
  blip(freq, duration, type, gain, slideTo) {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain || 0.06, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  },

  swing() { this.blip(420, 0.12, 'triangle', 0.05, 180); },
  hit() { this.blip(150, 0.14, 'square', 0.06, 70); },
  hurt() { this.blip(220, 0.22, 'sawtooth', 0.07, 80); },
  parry() { this.blip(900, 0.18, 'triangle', 0.07, 1500); },
  block() { this.blip(320, 0.10, 'square', 0.05, 240); },
  death() { this.blip(320, 0.5, 'sawtooth', 0.06, 60); },
  chest() { this.blip(640, 0.10, 'triangle', 0.06, 900); },
  pickup() { this.blip(880, 0.16, 'triangle', 0.06, 1320); },
  heal() { this.blip(520, 0.25, 'sine', 0.07, 780); },
  menu() { this.blip(500, 0.05, 'square', 0.035); },
  telegraph() { this.blip(180, 0.14, 'sine', 0.045, 260); }
};

const Game = {
  canvas: null,
  ctx: null,
  time: 0,
  state: 'title',

  player: Player,
  enemies: [],
  chests: [],

  camera: { x: 0, y: 0 },
  shake: 0,

  messages: [],
  floaters: [],
  particles: [],
  pickup: null,

  regionLabel: '',
  travelDir: 'down',

  menu: { options: [], index: 0, title: '', subtitle: '', footer: '' },

  /* ---------- boot ---------- */

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Input.init();
    World.generate();
    this.buildFog();
    this.showTitle();

    let last = performance.now();
    const frame = (now) => {
      // clamped so a backgrounded tab does not teleport everything on return
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.update(dt);
      this.draw();
      Input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  /* ---------- world lifecycle ---------- */

  spawnWorldEntities() {
    this.chests = World.chestSpots.map((spot, i) => makeChest(spot, i));
    this.enemies = World.enemySpawns.map((spawn, i) => createEnemy(spawn, i));
    this.floaters.length = 0;
    this.particles.length = 0;
    this.messages.length = 0;
    this.pickup = null;
    this.shake = 0;
  },

  newGame() {
    this.spawnWorldEntities();
    Inventory.reset();
    this.player.reset();
    this.state = 'play';
    this.snapCamera();
    this.say('You step out of the cottage. The woods are quiet — too quiet.');
    this.say('Arrows to walk · Space to slash · Shift to raise the shield.');
  },

  loadGame() {
    const data = SaveGame.read();
    if (!data) return false;
    this.spawnWorldEntities();
    Inventory.load(data.inv);
    this.player.load(data.player);
    (data.chests || []).forEach((opened, i) => {
      if (this.chests[i]) this.chests[i].opened = !!opened;
    });
    (data.enemies || []).forEach((state, i) => {
      if (this.enemies[i]) this.enemies[i].load(state);
    });
    this.state = 'play';
    this.snapCamera();
    this.say('The road is as you left it.');
    return true;
  },

  saveGame() {
    const ok = SaveGame.write({
      v: 1,
      ts: Date.now(),
      region: World.regionName(this.player.x, this.player.y),
      player: this.player.save(),
      inv: Inventory.save(),
      chests: this.chests.map((c) => c.opened),
      enemies: this.enemies.map((e) => e.save())
    });
    this.say(ok ? 'Journey recorded.' : 'This browser refuses to remember anything.');
    return ok;
  },

  /* ---------- menus ---------- */

  showTitle() {
    this.state = 'title';
    const saved = SaveGame.exists();
    this.menu = {
      title: 'ASHVALE',
      subtitle: 'a small, dark errand',
      index: saved ? 1 : 0,
      footer: saved ? SaveGame.describe() : '↑ ↓ choose · Space confirm',
      options: [
        { label: 'NEW GAME', action: () => this.newGame() },
        { label: 'CONTINUE', disabled: !saved, action: () => { if (!this.loadGame()) this.say('No journey to continue.'); } }
      ]
    };
  },

  showPause() {
    this.state = 'pause';
    this.menu = {
      title: 'PAUSED',
      subtitle: World.regionName(this.player.x, this.player.y),
      index: 0,
      footer: '↑ ↓ choose · Space confirm · Esc resume',
      options: [
        { label: 'RESUME', action: () => { this.state = 'play'; } },
        { label: 'SAVE GAME', action: () => { this.saveGame(); this.state = 'play'; } },
        {
          label: 'SAVE AND EXIT',
          action: () => { this.saveGame(); this.showTitle(); }
        },
        { label: 'EXIT WITHOUT SAVING', action: () => this.showTitle() }
      ]
    };
  },

  showDeath() {
    this.state = 'dead';
    Sound.death();
    const saved = SaveGame.exists();
    this.menu = {
      title: 'YOU HAVE FALLEN',
      subtitle: 'the dark keeps what it takes',
      index: 0,
      footer: '↑ ↓ choose · Space confirm',
      options: [
        {
          label: 'WAKE AT THE COTTAGE',
          action: () => {
            this.player.reset();
            this.player.hp = Math.round(PLAYER.maxHp * 0.5);
            this.state = 'play';
            this.snapCamera();
            this.say('You wake by the hearth, aching but alive.');
          }
        },
        { label: 'LOAD LAST SAVE', disabled: !saved, action: () => { if (!this.loadGame()) this.say('Nothing saved.'); } },
        { label: 'QUIT TO TITLE', action: () => this.showTitle() }
      ]
    };
  },

  updateMenu() {
    const m = this.menu;
    if (Input.pressed('up')) { this.moveMenu(-1); }
    if (Input.pressed('down')) { this.moveMenu(1); }
    if (Input.pressed('confirm')) {
      const opt = m.options[m.index];
      if (opt && !opt.disabled) {
        Sound.menu();
        opt.action();
      }
    }
  },

  moveMenu(delta) {
    const m = this.menu;
    const n = m.options.length;
    for (let i = 0; i < n; i++) {
      m.index = (m.index + delta + n) % n;
      if (!m.options[m.index].disabled) break;
    }
    Sound.menu();
  },

  /* ---------- update ---------- */

  update(dt) {
    this.decayEffects(dt);

    switch (this.state) {
      case 'title':
      case 'dead':
        this.updateMenu();
        break;

      case 'pause':
        this.updateMenu();
        if (Input.pressed('menu')) { this.state = 'play'; Sound.menu(); }
        break;

      case 'inventory':
        if (Input.pressed('up')) { Inventory.moveSelection(-1); Sound.menu(); }
        if (Input.pressed('down')) { Inventory.moveSelection(1); Sound.menu(); }
        if (Input.pressed('use')) {
          const chosen = Inventory.selectedUsable();
          if (chosen) this.useItem(chosen);
          else this.say('Coins are for spending, not drinking.');
        }
        if (Input.pressed('inventory') || Input.pressed('menu')) { this.state = 'play'; Sound.menu(); }
        break;

      case 'play':
        this.updatePlay(dt);
        break;
    }
  },

  updatePlay(dt) {
    if (Input.pressed('menu')) { this.showPause(); Sound.menu(); return; }
    if (Input.pressed('inventory')) {
      this.state = 'inventory';
      Inventory.selected = clamp(Inventory.selected, 0, Inventory.rows().length - 1);
      Sound.menu();
      return;
    }
    if (Input.pressed('use')) this.useItem(Inventory.firstUsable());

    this.player.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);

    for (const ch of this.chests) {
      if (ch.revealTimer > 0) ch.revealTimer -= dt;
    }

    if (this.player.dead) { this.showDeath(); return; }

    // where the knight is, and which way they are travelling (for the minimap)
    const axis = Input.moveAxis();
    this.travelDir = (axis.x || axis.y) ? vecToDir(axis.x, axis.y) : this.player.dir;
    this.regionLabel = World.regionName(this.player.x, this.player.y);

    this.followCamera(dt);
    this.ambientMotes(dt);
  },

  useItem(id) {
    if (!id) {
      this.say('Nothing in the satchel to use.');
      return;
    }
    const def = ITEMS[id];
    if (def.kind !== 'consumable') return;
    if (this.player.hp >= this.player.maxHp) {
      this.say('Your wounds are already closed.');
      return;
    }
    if (!Inventory.consume(id)) return;
    const healed = Math.round(this.player.heal(def.heal));
    this.floater(this.player.x, this.player.y - 30, `+${healed}`, '92,190,120');
    this.say(`${def.name} — restored ${healed} health.`);
    this.burst(this.player.x, this.player.y - 6, '#7fd39a', 14);
    Sound.heal();
  },

  /* ---------- combat callbacks ---------- */

  playSwing() { Sound.swing(); },

  telegraph(e) {
    this.floater(e.x, e.y - 34, '!', '255,120,90', 0.5, 16);
    Sound.telegraph();
  },

  onEnemyHit(e, damage) {
    this.floater(e.x, e.y - 26, `-${damage}`, '235,235,240');
    this.burst(e.x, e.y - 4, e.type === 'ghost' ? '#bcd4ea' : '#c8434a', 9);
    this.shake = Math.max(this.shake, 3);
    Sound.hit();
  },

  onEnemyDown(e) {
    this.say(`${e.name} destroyed.`);
    this.burst(e.x, e.y - 6, e.type === 'ghost' ? '#cfe2f5' : '#8c3a44', 20);
    Sound.death();
  },

  enemyStrikes(e, p) {
    const outcome = p.takeHit(e.def.damage, e.x, e.y, this);
    if (outcome === 'ignored' || outcome.result === undefined) return;

    if (outcome.result === 'parry') {
      e.stun(PLAYER.parryStun);
      this.floater(p.x, p.y - 34, 'PARRY', '255,225,150', 0.9, 16);
      this.say(`Parried the ${e.name}'s ${e.def.attackName} — it reels back.`);
      this.burst(p.x, p.y - 8, '#ffe9b0', 16);
      Sound.parry();
    } else if (outcome.result === 'block') {
      this.floater(p.x, p.y - 30, `-${outcome.dealt}`, '210,190,140');
      this.say(`Shield holds — ${e.name}'s ${e.def.attackName} mostly turned aside.`);
      this.shake = Math.max(this.shake, 3);
      Sound.block();
    } else {
      this.floater(p.x, p.y - 30, `-${outcome.dealt}`, '255,110,100', 1.1, 17);
      this.say(`${e.name} ${e.def.attackVerb} you for ${outcome.dealt}.`);
      this.burst(p.x, p.y - 8, '#8e2431', 12);
      this.shake = Math.max(this.shake, 7);
      Sound.hurt();
    }
  },

  openChest(ch) {
    if (ch.opened) return;
    ch.opened = true;
    ch.revealTimer = 2.4;
    const label = Inventory.add(ch.item);
    this.pickup = { id: ch.item, life: 2.6, age: 0 };
    this.say(`The lid splinters open — ${label}.`);
    this.burst(ch.x, ch.y - 8, '#ffd47a', 22);
    Sound.chest();
    window.setTimeout(() => Sound.pickup(), 140);
  },

  /* ---------- effects ---------- */

  say(text) {
    this.messages.push({ text, life: 5 });
    if (this.messages.length > 4) this.messages.shift();
  },

  floater(x, y, text, rgb, life, size) {
    this.floaters.push({
      x, y,
      text,
      color: `rgba(${rgb},ALPHA)`,
      life: life || 0.9,
      max: life || 0.9,
      size: size || 14
    });
    if (this.floaters.length > 24) this.floaters.shift();
  },

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        size: 1 + Math.random() * 2.2,
        color,
        gravity: 120
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  },

  /* Slow motes of ash and pollen, so the air is never quite still. */
  ambientMotes(dt) {
    if (Math.random() > dt * 8) return;
    this.particles.push({
      x: this.camera.x + Math.random() * VIEW_W,
      y: this.camera.y + Math.random() * VIEW_H,
      vx: -6 - Math.random() * 12,
      vy: -3 - Math.random() * 8,
      life: 3 + Math.random() * 3,
      max: 6,
      size: 1 + Math.random(),
      color: 'rgba(190,205,225,0.5)',
      gravity: -4
    });
  },

  decayEffects(dt) {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].life -= dt;
      if (this.messages[i].life <= 0) this.messages.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= dt * 26;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.pickup) {
      this.pickup.life -= dt;
      this.pickup.age += dt;
      if (this.pickup.life <= 0) this.pickup = null;
    }
    this.shake = Math.max(0, this.shake - dt * 22);
  },

  /* ---------- camera ---------- */

  snapCamera() {
    this.camera.x = clamp(this.player.x - VIEW_W / 2, 0, MAP_PX_W - VIEW_W);
    this.camera.y = clamp(this.player.y - VIEW_H / 2, 0, MAP_PX_H - VIEW_H);
    this.regionLabel = World.regionName(this.player.x, this.player.y);
    this.travelDir = this.player.dir;
  },

  followCamera(dt) {
    const tx = clamp(this.player.x - VIEW_W / 2, 0, MAP_PX_W - VIEW_W);
    const ty = clamp(this.player.y - VIEW_H / 2, 0, MAP_PX_H - VIEW_H);
    const k = 1 - Math.pow(0.0001, dt);
    this.camera.x = lerp(this.camera.x, tx, k);
    this.camera.y = lerp(this.camera.y, ty, k);
  },

  /* ---------- drawing ---------- */

  buildFog() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 30 + Math.random() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(150,170,195,0.055)');
      grad.addColorStop(1, 'rgba(150,170,195,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.fog = c;
  },

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.state === 'title') {
      UI.drawTitleArt(ctx, this.time);
      UI.drawMenu(ctx, this, this.menu.title, this.menu.subtitle, this.menu.options, this.menu.index, this.menu.footer);
      return;
    }

    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const camX = Math.round(this.camera.x + sx);
    const camY = Math.round(this.camera.y + sy);

    ctx.save();
    ctx.translate(-camX, -camY);
    this.drawWorld(ctx, camX, camY);
    ctx.restore();

    this.drawFog(ctx, camX, camY);
    this.drawLighting(ctx, camX, camY);

    // world-space overlays that should not be dimmed by the night
    ctx.save();
    ctx.translate(-camX, -camY);
    for (const e of this.enemies) {
      if (e.dead || e.dying) continue;
      if (e.hp < e.maxHp || e.state === 'chase' || e.state === 'windup' ||
          dist2(e.x, e.y, this.player.x, this.player.y) < 200 * 200) {
        UI.drawEnemyBar(ctx, e);
      }
    }
    UI.drawFloaters(ctx, this);
    ctx.restore();

    UI.drawHud(ctx, this);
    UI.drawMinimap(ctx, this);
    UI.drawMessages(ctx, this);
    UI.drawPickup(ctx, this);

    if (this.state === 'inventory') UI.drawInventory(ctx, this);
    if (this.state === 'pause' || this.state === 'dead') {
      UI.drawMenu(ctx, this, this.menu.title, this.menu.subtitle, this.menu.options, this.menu.index, this.menu.footer);
    }
  },

  drawWorld(ctx, camX, camY) {
    const t0x = Math.max(0, Math.floor(camX / TILE) - 1);
    const t1x = Math.min(MAP_W - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    const t0y = Math.max(0, Math.floor(camY / TILE) - 1);
    const t1y = Math.min(MAP_H - 1, Math.floor((camY + VIEW_H) / TILE) + 2);

    // pass 1 — flat ground
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const id = World.get(tx, ty);
        const px = tx * TILE, py = ty * TILE;
        if (id === T.TREE || id === T.ROCK || id === T.GRAVE || id === T.BUSH) {
          Sprites.grass(ctx, px, py, hash2(tx, ty));
        } else {
          Sprites.tile(ctx, id, tx, ty, px, py, this.time);
        }
      }
    }

    // the sanctuary ring, painted on the ground
    const home = World.home;
    if (Math.abs(home.cx - this.player.x) < VIEW_W && Math.abs(home.cy - this.player.y) < VIEW_H) {
      ctx.save();
      ctx.strokeStyle = `rgba(140,190,225,${0.10 + Math.sin(this.time * 1.4) * 0.03})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.arc(home.cx, home.cy, home.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // pass 2 — anything standing up, drawn back to front
    const standing = [];
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const id = World.get(tx, ty);
        if (id !== T.TREE && id !== T.ROCK && id !== T.GRAVE && id !== T.BUSH) continue;
        const px = tx * TILE, py = ty * TILE, n = hash2(tx, ty);
        const depth = py + (id === T.TREE ? 30 : 26);
        standing.push({
          depth,
          draw: (c) => {
            if (id === T.TREE) Sprites.tree(c, px, py, n, this.time);
            else if (id === T.ROCK) Sprites.rock(c, px, py, n);
            else if (id === T.GRAVE) Sprites.grave(c, px, py, n);
            else Sprites.bush(c, px, py, n);
          }
        });
      }
    }

    for (const prop of World.props) {
      if (prop.x < camX - 60 || prop.x > camX + VIEW_W + 60) continue;
      if (prop.y < camY - 80 || prop.y > camY + VIEW_H + 80) continue;
      standing.push({ depth: prop.y, draw: (c) => Sprites.prop(c, prop.kind, prop.x, prop.y, this.time) });
    }

    for (const ch of this.chests) {
      if (Math.abs(ch.x - camX - VIEW_W / 2) > VIEW_W || Math.abs(ch.y - camY - VIEW_H / 2) > VIEW_H) continue;
      standing.push({ depth: ch.y + 10, draw: (c) => Sprites.chest(c, ch, this.time) });
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      standing.push({ depth: e.y, draw: (c) => (e.type === 'ghost' ? Sprites.ghost(c, e, this.time) : Sprites.bat(c, e, this.time)) });
    }

    if (!this.player.dead) {
      standing.push({ depth: this.player.y, draw: (c) => Sprites.knight(c, this.player, this.time) });
    }

    standing.sort((a, b) => a.depth - b.depth);
    for (const item of standing) item.draw(ctx);

    // particles ride on top of the scene
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },

  drawFog(ctx, camX, camY) {
    if (!this.fog) return;
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 0.35 : 0.6;
      const ox = -((camX * speed + this.time * (layer ? 9 : 5)) % 256);
      const oy = -((camY * speed + this.time * (layer ? 3 : 2)) % 256);
      for (let y = oy - 256; y < VIEW_H + 256; y += 256) {
        for (let x = ox - 256; x < VIEW_W + 256; x += 256) {
          ctx.drawImage(this.fog, x, y);
        }
      }
    }
    ctx.restore();
  },

  /* Night falls off around the knight, and lanterns push it back. */
  drawLighting(ctx, camX, camY) {
    const px = this.player.x - camX, py = this.player.y - camY;

    const grad = ctx.createRadialGradient(px, py, 60, px, py, 480);
    grad.addColorStop(0, 'rgba(6,8,14,0)');
    grad.addColorStop(0.55, 'rgba(6,8,14,0.26)');
    grad.addColorStop(1, 'rgba(4,5,10,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const light of World.lights) {
      const lx = light.x - camX, ly = light.y - camY;
      if (lx < -light.r || lx > VIEW_W + light.r || ly < -light.r || ly > VIEW_H + light.r) continue;
      const flicker = 0.85 + Math.sin(this.time * 7 + light.x) * 0.1;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, light.r);
      lg.addColorStop(0, `rgba(${light.color},${light.power * 0.42 * flicker})`);
      lg.addColorStop(1, `rgba(${light.color},0)`);
      ctx.fillStyle = lg;
      ctx.fillRect(lx - light.r, ly - light.r, light.r * 2, light.r * 2);
    }
    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
};

window.addEventListener('load', () => Game.init());
