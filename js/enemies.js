/* enemies.js — ghosts and bats.

   Both patrol the perimeter of a small square, give chase when the knight
   strays too close, telegraph their blow (which is the window for a parry),
   then strike. Neither will set foot in the cottage's safe circle. */

function createEnemy(spawn, index) {
  const def = spawn.type === 'ghost' ? GHOST : BAT;
  const cx = (spawn.tx + 0.5) * TILE;
  const cy = (spawn.ty + 0.5) * TILE;
  const half = (spawn.box / 2) * TILE;

  const e = {
    index,
    type: spawn.type,
    def,
    name: def.name,
    x: cx, y: cy,
    homeX: cx, homeY: cy,
    half,
    radius: def.radius,
    maxHp: def.maxHp,
    hp: def.maxHp,
    dir: 'down',
    state: 'patrol',
    timer: 0,
    corner: 0,
    stuck: 0,
    hurtFlash: 0,
    dying: false,
    deathTimer: 0,
    dead: false,
    respawnTimer: 0,
    seen: false,          // has the knight ever wounded or been noticed by it
    seed: hash2(spawn.tx, spawn.ty),
    kx: 0, ky: 0,

    corners() {
      return [
        [this.homeX - this.half, this.homeY - this.half],
        [this.homeX + this.half, this.homeY - this.half],
        [this.homeX + this.half, this.homeY + this.half],
        [this.homeX - this.half, this.homeY + this.half]
      ];
    },

    update(dt, game) {
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);

      if (this.dead) {
        this.respawnTimer -= dt;
        const farOff = dist2(this.x, this.y, game.player.x, game.player.y) > 420 * 420;
        if (this.respawnTimer <= 0 && farOff) this.revive();
        return;
      }
      if (this.dying) {
        this.deathTimer -= dt;
        this.y -= dt * 12;                      // the shade lifts as it fades
        if (this.deathTimer <= 0) {
          this.dying = false;
          this.dead = true;
          this.respawnTimer = ENEMY_RESPAWN;
        }
        return;
      }

      const p = game.player;
      const toPlayer = dist(this.x, this.y, p.x, p.y);
      const leashed = dist(this.x, this.y, this.homeX, this.homeY) > this.def.leash;
      const playerSafe = World.inSafeZone(p.x, p.y) || p.dead;

      switch (this.state) {
        case 'stunned':
          this.timer -= dt;
          if (this.timer <= 0) this.state = 'chase';
          break;

        case 'windup':
          this.timer -= dt;
          this.faceTowards(p.x, p.y);
          if (this.timer <= 0) {
            if (dist(this.x, this.y, p.x, p.y) <= this.def.attackRange * 1.5 && !playerSafe) {
              game.enemyStrikes(this, p);
            }
            this.state = 'recover';
            this.timer = this.def.attackCooldown;
          }
          break;

        case 'recover':
          this.timer -= dt;
          this.drift(dt, p, -1, game);          // back off a little between blows
          if (this.timer <= 0) this.state = toPlayer < this.def.aggroRange ? 'chase' : 'patrol';
          break;

        case 'chase':
          if (playerSafe || leashed || toPlayer > this.def.aggroRange * 1.6) {
            this.state = 'return';
            break;
          }
          if (toPlayer <= this.def.attackRange) {
            this.state = 'windup';
            this.timer = this.def.windup;
            game.telegraph(this);
            break;
          }
          this.drift(dt, p, 1, game);
          break;

        case 'return': {
          const home = dist(this.x, this.y, this.homeX, this.homeY);
          if (home < 12) { this.state = 'patrol'; break; }
          this.stepToward(this.homeX, this.homeY, this.def.patrolSpeed, dt, game);
          if (!playerSafe && toPlayer < this.def.aggroRange * 0.7 && !leashed) this.state = 'chase';
          break;
        }

        default: {  // patrol the square
          const [tx, ty] = this.corners()[this.corner];
          const moved = this.stepToward(tx, ty, this.def.patrolSpeed, dt, game);
          this.stuck = moved ? 0 : this.stuck + dt;
          if (dist(this.x, this.y, tx, ty) < 8 || this.stuck > 0.9) {
            this.corner = (this.corner + 1) % 4;
            this.stuck = 0;
          }
          if (!playerSafe && toPlayer < this.def.aggroRange) {
            this.state = 'chase';
            this.seen = true;
          }
        }
      }

      // knockback settles
      if (this.kx || this.ky) {
        World.moveBody(this, this.kx * dt, this.ky * dt, this.def.passable);
        this.kx *= Math.pow(0.002, dt);
        this.ky *= Math.pow(0.002, dt);
        if (Math.abs(this.kx) < 4) this.kx = 0;
        if (Math.abs(this.ky) < 4) this.ky = 0;
      }
    },

    faceTowards(tx, ty) {
      this.dir = vecToDir(tx - this.x, ty - this.y);
    },

    /* Bats weave; ghosts glide straight. `way` is 1 to approach, -1 to retreat. */
    drift(dt, p, way, game) {
      const speed = this.def.chaseSpeed * (way > 0 ? 1 : 0.5);
      let dx = p.x - this.x, dy = p.y - this.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      dx /= len; dy /= len;
      if (this.type === 'bat') {
        const wobble = Math.sin(game.time * 6 + this.seed * 6.28) * 0.55;
        const nx = -dy, ny = dx;
        dx += nx * wobble;
        dy += ny * wobble;
      }
      this.moveGuarded(dx * speed * way * dt, dy * speed * way * dt, game);
      if (way > 0) this.faceTowards(p.x, p.y);
    },

    stepToward(tx, ty, speed, dt, game) {
      const dx = tx - this.x, dy = ty - this.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      this.faceTowards(tx, ty);
      return this.moveGuarded((dx / len) * speed * dt, (dy / len) * speed * dt, game);
    },

    /* Never cross into the cottage's safe circle. */
    moveGuarded(dx, dy, game) {
      const nx = this.x + dx, ny = this.y + dy;
      if (World.inSafeZone(nx, ny)) return false;
      return World.moveBody(this, dx, dy, this.def.passable);
    },

    takeHit(damage, srcX, srcY, game) {
      if (this.dead || this.dying) return;
      this.hp -= damage;
      this.hurtFlash = 0.18;
      this.seen = true;
      const dx = this.x - srcX, dy = this.y - srcY;
      // A light shove only — enough to sell the blow, not so much that the
      // next swing whiffs on a target that slid out of reach.
      const len = Math.max(1, Math.hypot(dx, dy));
      this.kx = (dx / len) * 55;
      this.ky = (dy / len) * 55;
      game.onEnemyHit(this, damage);
      if (this.hp <= 0) {
        this.hp = 0;
        this.dying = true;
        this.deathTimer = 0.5;
        game.onEnemyDown(this);
      } else if (this.state === 'patrol' || this.state === 'return') {
        this.state = 'chase';
      }
    },

    stun(seconds) {
      if (this.dead || this.dying) return;
      this.state = 'stunned';
      this.timer = seconds;
    },

    revive() {
      this.x = this.homeX;
      this.y = this.homeY;
      this.hp = this.maxHp;
      this.dead = false;
      this.dying = false;
      this.state = 'patrol';
      this.corner = 0;
      this.kx = this.ky = 0;
    },

    save() {
      return { hp: this.hp, dead: this.dead || this.dying, respawn: this.respawnTimer };
    },

    load(data) {
      if (!data) return;
      this.hp = clamp(data.hp, 0, this.maxHp);
      this.dying = false;
      this.dead = !!data.dead;
      this.respawnTimer = this.dead ? Math.max(2, data.respawn || ENEMY_RESPAWN) : 0;
      if (this.dead) this.hp = 0;
    }
  };

  return e;
}
