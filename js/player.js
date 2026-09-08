/* player.js — the knight: movement, the sword, the shield, and healing at home. */

const Player = {
  x: 0, y: 0,
  dir: 'down',
  hp: PLAYER.maxHp,
  maxHp: PLAYER.maxHp,
  radius: PLAYER.radius,

  moving: false,
  walkPhase: 0,

  attack: false,
  attackTime: 0,
  attackCooldown: 0,
  struck: null,          // things already bitten by the current swing

  blocking: false,
  blockTimer: 0,         // seconds the shield has been up (0 when lowered)

  iTimer: 0,             // invulnerable window after a wound
  hurtFlash: 0,
  parryFlash: 0,
  kx: 0, ky: 0,          // knockback velocity
  dead: false,

  reset() {
    this.x = World.home.spawnX;
    this.y = World.home.spawnY;
    this.dir = 'down';
    this.hp = PLAYER.maxHp;
    this.attack = false;
    this.attackTime = 0;
    this.attackCooldown = 0;
    this.struck = new Set();
    this.blocking = false;
    this.blockTimer = 0;
    this.iTimer = 0;
    this.hurtFlash = 0;
    this.parryFlash = 0;
    this.kx = this.ky = 0;
    this.dead = false;
  },

  update(dt, game) {
    this.iTimer = Math.max(0, this.iTimer - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.parryFlash = Math.max(0, this.parryFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // --- shield ---
    const wantsBlock = Input.down('block') && !this.attack;
    if (wantsBlock) {
      this.blockTimer = this.blocking ? this.blockTimer + dt : dt * 0.5;
      this.blocking = true;
    } else {
      this.blocking = false;
      this.blockTimer = 0;
    }

    // --- sword ---
    if (Input.pressed('attack') && !this.attack && this.attackCooldown <= 0) {
      this.attack = true;
      this.attackTime = 0;
      this.struck = new Set();
      game.playSwing();
    }
    if (this.attack) {
      this.attackTime += dt;
      const from = PLAYER.slashActiveFrom, to = PLAYER.slashActiveTo;
      if (this.attackTime >= from && this.attackTime - dt < to) this._resolveSwing(game);
      if (this.attackTime >= PLAYER.slashDuration) {
        this.attack = false;
        this.attackCooldown = PLAYER.slashCooldown;
      }
    }

    // --- movement ---
    const axis = Input.moveAxis();
    let speed = PLAYER.speed;
    if (this.blocking) speed *= 0.42;      // a raised shield is heavy
    if (this.attack) speed *= 0.45;

    this.moving = axis.x !== 0 || axis.y !== 0;
    if (this.moving && !this.attack) this.dir = vecToDir(axis.x, axis.y);
    if (this.moving) this.walkPhase += dt * 9;
    else this.walkPhase = 0;

    World.moveBody(this, axis.x * speed * dt + this.kx * dt, axis.y * speed * dt + this.ky * dt);
    this.kx *= Math.pow(0.0015, dt);        // knockback bleeds off fast
    this.ky *= Math.pow(0.0015, dt);

    // --- home is where wounds close ---
    if (World.insideHouse(this.x, this.y)) this.heal(PLAYER.regenInsideHome * dt);
    else if (World.inSafeZone(this.x, this.y)) this.heal(PLAYER.regenNearHome * dt);
  },

  /* An arc in front of the knight: everything inside the reach and within
     ~65 degrees of the facing takes the blow, once per swing. */
  _resolveSwing(game) {
    const d = DIRS[this.dir];
    const cx = this.x, cy = this.y - 4;

    const inArc = (tx, ty, extra) => {
      const dx = tx - cx, dy = ty - cy;
      const len = Math.hypot(dx, dy);
      if (len > PLAYER.reach + extra) return false;
      if (len < 1) return true;
      return (dx / len) * d.x + (dy / len) * d.y > 0.42;
    };

    for (const e of game.enemies) {
      if (e.dead || e.dying || this.struck.has(e)) continue;
      if (!inArc(e.x, e.y, e.radius)) continue;
      this.struck.add(e);
      e.takeHit(PLAYER.slashDamage, this.x, this.y, game);
    }

    for (const ch of game.chests) {
      if (ch.opened || this.struck.has(ch)) continue;
      if (!inArc(ch.x, ch.y, ch.radius)) continue;
      this.struck.add(ch);
      game.openChest(ch);
    }
  },

  /* Called by monsters. Returns 'parry', 'block', 'hit' or 'ignored'. */
  takeHit(damage, srcX, srcY, game) {
    if (this.dead || this.iTimer > 0) return 'ignored';

    const d = DIRS[this.dir];
    const dx = srcX - this.x, dy = srcY - this.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const facingSource = (dx / len) * d.x + (dy / len) * d.y > 0.15;

    let result = 'hit';
    let dealt = damage;

    if (this.blocking && facingSource) {
      if (this.blockTimer <= PLAYER.parryWindow) {
        result = 'parry';
        dealt = 0;
        this.parryFlash = 0.4;
      } else {
        result = 'block';
        dealt = Math.ceil(damage * PLAYER.blockReduction);
      }
    }

    if (dealt > 0) {
      this.hp = Math.max(0, this.hp - dealt);
      this.hurtFlash = 0.35;
      this.iTimer = PLAYER.invulnerable;
      const push = result === 'block' ? 60 : 190;
      this.kx = -(dx / len) * push;
      this.ky = -(dy / len) * push;
      if (this.hp <= 0) this.dead = true;
    } else if (result === 'parry') {
      this.iTimer = 0.25;
    }

    return { result, dealt };
  },

  heal(amount) {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  },

  /* Health is stored as a float so regen is smooth; show it as a whole number. */
  get hpShown() { return Math.ceil(this.hp); },

  save() {
    return { x: this.x, y: this.y, hp: this.hp, dir: this.dir };
  },

  load(data) {
    this.reset();
    if (!data) return;
    this.x = data.x;
    this.y = data.y;
    this.hp = clamp(data.hp, 1, PLAYER.maxHp);
    this.dir = DIRS[data.dir] ? data.dir : 'down';
  }
};
