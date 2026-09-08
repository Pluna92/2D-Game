/* sprites.js — everything is drawn with canvas primitives, no image assets.
   Tiles take their variation from hash2() so the ground never shimmers. */

const Sprites = {

  /* ---------------- terrain ---------------- */

  tile(ctx, id, tx, ty, sx, sy, time) {
    const n = hash2(tx, ty);
    switch (id) {
      case T.GRASS: this.grass(ctx, sx, sy, n); break;
      case T.TALLGRASS: this.grass(ctx, sx, sy, n); this.tallGrass(ctx, sx, sy, n, time); break;
      case T.BUSH: this.grass(ctx, sx, sy, n); this.bush(ctx, sx, sy, n); break;
      case T.DIRT: this.dirt(ctx, sx, sy, n); break;
      case T.TREE: this.grass(ctx, sx, sy, n); this.tree(ctx, sx, sy, n, time); break;
      case T.ROCK: this.grass(ctx, sx, sy, n); this.rock(ctx, sx, sy, n); break;
      case T.WATER: this.water(ctx, sx, sy, n, time); break;
      case T.SHORE: this.shore(ctx, sx, sy, n); break;
      case T.DOCK: this.water(ctx, sx, sy, n, time); this.dock(ctx, sx, sy, n); break;
      case T.WALL: this.wall(ctx, sx, sy, n); break;
      case T.DOOR: this.floor(ctx, sx, sy, n); this.door(ctx, sx, sy); break;
      case T.FLOOR: this.floor(ctx, sx, sy, n); break;
      case T.GRAVE: this.grass(ctx, sx, sy, n); this.grave(ctx, sx, sy, n); break;
      default: this.grass(ctx, sx, sy, n);
    }
  },

  /* One flat base colour for every grass tile — the variation is all in the
     low-contrast blotches, which is what keeps the 32px grid from showing. */
  grass(ctx, x, y, n) {
    ctx.fillStyle = C.grass;
    ctx.fillRect(x, y, TILE, TILE);

    for (let i = 0; i < 4; i++) {
      const a = hash2(x * 7 + i * 53, y * 3 - i * 29);
      const b = hash2(y * 11 - i * 17, x * 5 + i * 41);
      ctx.fillStyle = a > 0.5 ? 'rgba(52,74,54,0.16)' : 'rgba(16,26,20,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 4 + a * 24, y + 4 + b * 24, 5 + a * 5, 4 + b * 4, a * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n < 0.07) {   // an occasional scorched, dry patch
      ctx.fillStyle = 'rgba(70,64,38,0.20)';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 16, 12, 9, n * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const h = hash2(x + i * 31, y - i * 17);
      const px = x + 3 + h * 26;
      const py = y + 5 + hash2(y + i, x - i) * 22;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (h > 0.5 ? 2 : -2), py - 4);
      ctx.stroke();
    }
  },

  tallGrass(ctx, x, y, n, time) {
    const sway = Math.sin(time * 1.6 + (x + y) * 0.05) * 2;
    ctx.strokeStyle = 'rgba(122,150,110,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const h = hash2(x * 3 + i, y * 5 - i);
      const px = x + 3 + h * 26;
      const py = y + 28 - h * 6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + sway * 0.5, py - 8, px + sway, py - 15);
      ctx.stroke();
    }
  },

  bush(ctx, x, y, n) {
    ctx.fillStyle = C.leaf;
    for (let i = 0; i < 4; i++) {
      const h = hash2(x + i * 7, y + i * 13);
      ctx.beginPath();
      ctx.arc(x + 8 + h * 16, y + 12 + hash2(i, x) * 12, 6 + h * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(90,130,95,0.18)';
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 5, 0, Math.PI * 2);
    ctx.fill();
  },

  dirt(ctx, x, y, n) {
    ctx.fillStyle = C.dirt;
    ctx.fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 3; i++) {
      const a = hash2(x * 13 + i * 7, y * 9 - i * 23);
      const b = hash2(y * 19 + i * 3, x * 29 - i * 11);
      ctx.fillStyle = a > 0.5 ? 'rgba(66,58,48,0.16)' : 'rgba(20,17,14,0.20)';
      ctx.beginPath();
      ctx.ellipse(x + 5 + a * 22, y + 5 + b * 22, 6 + a * 6, 5 + b * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 6; i++) {
      const h = hash2(x - i * 11, y + i * 19);
      ctx.fillRect(x + h * 30, y + hash2(i, y) * 30, 2, 2);
    }
  },

  tree(ctx, x, y, n, time) {
    const cx = x + TILE / 2;
    const sway = Math.sin(time * 0.8 + n * 6.28) * 1.2;
    // trunk
    ctx.fillStyle = C.trunk;
    ctx.fillRect(cx - 3, y + 14, 6, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx - 3, y + 14, 2, 18);
    // canopy — deliberately spills past the tile so the woods look continuous
    const k = 0.85 + n * 0.35;   // no two trees the same size
    const blobs = [
      [cx - 9 * k + sway, y + 8, 11 * k],
      [cx + 9 * k + sway, y + 10, 10 * k],
      [cx + sway, y + 1, 12 * k],
      [cx - 2 + sway, y + 14, 10 * k]
    ];
    ctx.fillStyle = n > 0.55 ? C.leaf : '#132018';
    for (const [bx, by, r] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = C.leafLight;
    ctx.beginPath();
    ctx.arc(cx - 4 + sway, y + 3, 6, 0, Math.PI * 2);
    ctx.fill();
    if (n > 0.93) {  // an occasional pale, sickly bough
      ctx.fillStyle = 'rgba(150,170,140,0.16)';
      ctx.beginPath();
      ctx.arc(cx + 5 + sway, y + 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* Boulders vary in size, lean and colour, and sometimes come as a pair —
     a field of identical domes reads as wallpaper. */
  rock(ctx, x, y, n) {
    const m = hash2(y * 3 + 11, x * 7 - 5);
    const cx = x + TILE / 2 + (n - 0.5) * 5;
    const cy = y + TILE / 2 + 3 + (m - 0.5) * 4;
    const boulder = (bx, by, w, tilt, shade) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 6, w, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(-w, 6);
      ctx.lineTo(-w * 0.72, -w * 0.55);
      ctx.lineTo(-w * 0.1, -w * 0.85);
      ctx.lineTo(w * 0.8, -w * 0.4);
      ctx.lineTo(w, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.72, -w * 0.55);
      ctx.lineTo(-w * 0.1, -w * 0.85);
      ctx.lineTo(w * 0.15, -w * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const shade = m > 0.66 ? '#3f4450' : (m > 0.33 ? '#343a45' : '#2c313b');
    if (n > 0.78) {                       // a pair of smaller stones
      boulder(cx - 6, cy + 2, 6 + m * 2, (m - 0.5) * 0.5, shade);
      boulder(cx + 6, cy - 2, 7 + n * 3, (n - 0.5) * 0.5, C.stone);
    } else {
      boulder(cx, cy, 10 + n * 5, (m - 0.5) * 0.35, shade);
    }
    if (m < 0.3) {                        // a little moss on the north face
      ctx.fillStyle = 'rgba(70,100,70,0.30)';
      ctx.beginPath();
      ctx.ellipse(cx - 3, cy - 3, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  water(ctx, x, y, n, time) {
    ctx.fillStyle = C.water;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(120,170,220,0.10)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const off = ((time * 8 + n * 40 + i * 16) % TILE);
      ctx.beginPath();
      ctx.moveTo(x + 3, y + off);
      ctx.quadraticCurveTo(x + TILE / 2, y + off - 3, x + TILE - 3, y + off);
      ctx.stroke();
    }
    if (n > 0.9) {  // a glint of moonlight
      ctx.fillStyle = 'rgba(180,210,255,0.10)';
      ctx.fillRect(x + 6, y + 12, 12, 2);
    }
  },

  shore(ctx, x, y, n) {
    ctx.fillStyle = C.shore;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    for (let i = 0; i < 4; i++) {
      const h = hash2(x + i * 23, y - i * 7);
      ctx.beginPath();
      ctx.arc(x + h * 30, y + hash2(i * 5, y) * 30, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  dock(ctx, x, y, n) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(x, y + 1, TILE, TILE - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 8);
      ctx.lineTo(x + TILE, y + i * 8);
      ctx.stroke();
    }
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(x, y + 1, TILE, 2);
  },

  wall(ctx, x, y, n) {
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = C.stone;
    for (let row = 0; row < 2; row++) {
      const offset = row % 2 === 0 ? 0 : 8;
      for (let col = 0; col < 2; col++) {
        const bx = x + col * 16 + offset - (offset ? 8 : 0);
        ctx.fillRect(bx + 1, y + row * 16 + 1, 14, 14);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, TILE, 2);
  },

  floor(ctx, x, y, n) {
    ctx.fillStyle = C.floor;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 11 + 5);
      ctx.lineTo(x + TILE, y + i * 11 + 5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,170,0.04)';
    ctx.fillRect(x, y, TILE, TILE);
  },

  door(ctx, x, y) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(x + 4, y + 2, 24, 28);
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(x + 6, y + 4, 20, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(x + 4.5, y + 2.5, 23, 27);
    ctx.fillStyle = C.steelLight;
    ctx.beginPath();
    ctx.arc(x + 22, y + 17, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  grave(ctx, x, y, n) {
    const cx = x + TILE / 2;
    ctx.save();
    ctx.translate(cx, y + 26);
    ctx.rotate((n - 0.5) * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.stone;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-7, -14);
    ctx.arc(0, -14, 7, Math.PI, 0);
    ctx.lineTo(7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(-3, -16, 6, 2);
    ctx.fillRect(-1, -20, 2, 8);
    ctx.restore();
  },

  /* ---------------- props ---------------- */

  prop(ctx, kind, x, y, time) {
    switch (kind) {
      case 'bed': {
        ctx.fillStyle = C.wood;
        roundRect(ctx, x - 12, y - 20, 24, 40, 3); ctx.fill();
        ctx.fillStyle = '#4a2b30';
        roundRect(ctx, x - 10, y - 10, 20, 28, 3); ctx.fill();
        ctx.fillStyle = '#c9c3b4';
        roundRect(ctx, x - 9, y - 18, 18, 10, 3); ctx.fill();
        break;
      }
      case 'fireplace': {
        ctx.fillStyle = C.stoneDark;
        ctx.fillRect(x - 16, y - 18, 32, 26);
        ctx.fillStyle = C.stone;
        ctx.fillRect(x - 16, y - 18, 32, 4);
        ctx.fillStyle = '#0b0906';
        ctx.fillRect(x - 10, y - 12, 20, 20);
        // flame
        const f = Math.sin(time * 9) * 0.5 + Math.sin(time * 13.7) * 0.5;
        ctx.fillStyle = C.ember;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 6);
        ctx.quadraticCurveTo(x - 5, y - 4 + f, x, y - 9 + f * 2);
        ctx.quadraticCurveTo(x + 5, y - 4 - f, x + 6, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath();
        ctx.moveTo(x - 2.5, y + 6);
        ctx.quadraticCurveTo(x, y - 2 + f, x + 2.5, y + 6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'table': {
        ctx.fillStyle = C.woodLight;
        roundRect(ctx, x - 13, y - 9, 26, 18, 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x - 13, y + 5, 26, 4);
        break;
      }
      case 'barrel': {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(x, y + 8, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.wood;
        roundRect(ctx, x - 9, y - 12, 18, 22, 4); ctx.fill();
        ctx.fillStyle = C.steel;
        ctx.fillRect(x - 9, y - 6, 18, 2);
        ctx.fillRect(x - 9, y + 3, 18, 2);
        break;
      }
      case 'lantern': {
        const glow = 0.6 + Math.sin(time * 4) * 0.12;
        ctx.fillStyle = C.trunk;
        ctx.fillRect(x - 1.5, y - 6, 3, 14);
        ctx.fillStyle = C.steel;
        roundRect(ctx, x - 5, y - 18, 10, 13, 2); ctx.fill();
        ctx.fillStyle = `rgba(255,190,90,${glow})`;
        ctx.fillRect(x - 3, y - 16, 6, 9);
        break;
      }
      case 'post': {  // dock piling
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(x, y + 4, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.wood;
        ctx.fillRect(x - 4, y - 16, 8, 20);
        ctx.fillStyle = C.woodLight;
        ctx.fillRect(x - 4, y - 16, 8, 3);
        break;
      }
      case 'deadtree': {
        ctx.strokeStyle = C.trunk;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x - 1, y - 16);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 1, y - 6); ctx.lineTo(x - 11, y - 16);
        ctx.moveTo(x - 1, y - 10); ctx.lineTo(x + 10, y - 20);
        ctx.moveTo(x - 1, y - 16); ctx.lineTo(x + 4, y - 26);
        ctx.stroke();
        break;
      }
      case 'signpost': {
        ctx.fillStyle = C.trunk;
        ctx.fillRect(x - 2, y - 14, 4, 22);
        ctx.fillStyle = C.wood;
        roundRect(ctx, x - 14, y - 24, 28, 12, 2); ctx.fill();
        ctx.fillStyle = 'rgba(220,215,200,0.35)';
        ctx.fillRect(x - 10, y - 20, 14, 2);
        ctx.fillRect(x - 10, y - 16, 9, 2);
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = 'rgba(180,172,155,0.75)';
        ctx.fillRect(x - 1, y - 3, 2, 4);
        ctx.fillStyle = '#5c2c37';
        ctx.beginPath();
        ctx.ellipse(x, y - 4, 3.6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  },

  /* ---------------- the knight ---------------- */

  knight(ctx, p, time) {
    const bob = p.moving ? Math.sin(p.walkPhase) * 1.4 : Math.sin(time * 1.6) * 0.6;
    const legSwing = p.moving ? Math.sin(p.walkPhase) * 3 : 0;
    const hurtFlash = p.hurtFlash > 0 && Math.floor(p.hurtFlash * 20) % 2 === 0;

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const facingSide = p.dir === 'left' || p.dir === 'right';
    if (p.dir === 'left') ctx.scale(-1, 1);

    // cloak, behind the body
    ctx.fillStyle = C.cloak;
    ctx.beginPath();
    ctx.moveTo(-7, -16 + bob);
    ctx.lineTo(7, -16 + bob);
    ctx.lineTo(9, 8);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-9, 4, 18, 4);

    // legs
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(-6, 2 + legSwing * 0.3, 5, 11 - legSwing * 0.3);
    ctx.fillRect(1, 2 - legSwing * 0.3, 5, 11 + legSwing * 0.3);

    // torso
    ctx.fillStyle = hurtFlash ? '#c9989a' : C.steel;
    roundRect(ctx, -8, -14 + bob, 16, 17, 4);
    ctx.fill();
    ctx.fillStyle = hurtFlash ? '#e9d0d0' : C.steelLight;
    roundRect(ctx, -8, -14 + bob, 16, 5, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-2, -9 + bob, 2, 12);

    // helm
    ctx.fillStyle = hurtFlash ? '#f0dede' : C.steelLight;
    roundRect(ctx, -7, -26 + bob, 14, 13, 5);
    ctx.fill();
    ctx.fillStyle = C.stoneDark;
    if (p.dir === 'down') {
      ctx.fillRect(-5, -20 + bob, 10, 3);        // visor slit
      ctx.fillRect(-1, -23 + bob, 2, 9);         // nose guard
    } else if (facingSide) {
      ctx.fillRect(0, -20 + bob, 7, 3);
    } else {
      ctx.fillRect(-6, -16 + bob, 12, 3);        // back of the helm
    }
    // plume
    ctx.fillStyle = C.cloak;
    ctx.beginPath();
    ctx.moveTo(0, -27 + bob);
    ctx.quadraticCurveTo(-6, -33 + bob, -9, -25 + bob);
    ctx.quadraticCurveTo(-4, -27 + bob, 0, -24 + bob);
    ctx.fill();

    // shield and sword, arranged by facing
    const blocking = p.blockTimer > 0;
    if (facingSide) {
      this.shield(ctx, blocking ? 12 : 8, -6 + bob, blocking ? 1.15 : 1);
      if (!p.attack) this.sword(ctx, -9, -4 + bob, -0.5);
    } else if (p.dir === 'down') {
      this.shield(ctx, blocking ? -11 : -12, -4 + bob, blocking ? 1.2 : 1);
      if (!p.attack) this.sword(ctx, 11, -4 + bob, 0.35);
    } else {
      if (!p.attack) this.sword(ctx, -11, -6 + bob, -0.35);
      this.shield(ctx, 11, -6 + bob, blocking ? 1.15 : 1);
    }

    ctx.restore();

    // the swing itself is drawn in world space, unmirrored
    if (p.attack) this.slash(ctx, p);
    if (p.parryFlash > 0) {
      ctx.strokeStyle = `rgba(220,235,255,${p.parryFlash * 2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 20 + (1 - p.parryFlash) * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  shield(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#39404d';
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(5, -8);
    ctx.lineTo(5, 4);
    ctx.quadraticCurveTo(0, 11, -5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.steelLight;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = C.cloak;
    ctx.fillRect(-1.2, -6, 2.4, 12);
    ctx.fillRect(-4, -2, 8, 2.4);
    ctx.restore();
  },

  sword(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = C.trunk;
    ctx.fillRect(-1.5, 0, 3, 7);       // grip
    ctx.fillStyle = C.gold;
    ctx.fillRect(-4, -1.5, 8, 3);      // crossguard
    const grad = ctx.createLinearGradient(0, -22, 0, -2);
    grad.addColorStop(0, '#e7edf7');
    grad.addColorStop(1, '#8d97a5');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(2, -2);
    ctx.lineTo(1.2, -20);
    ctx.lineTo(0, -24);
    ctx.lineTo(-1.2, -20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  slash(ctx, p) {
    const t = clamp(p.attackTime / PLAYER.slashDuration, 0, 1);
    const base = Math.atan2(DIRS[p.dir].y, DIRS[p.dir].x);
    const spread = 1.15;
    const angle = base - spread + t * spread * 2;
    const alpha = Math.sin(t * Math.PI);

    ctx.save();
    ctx.translate(p.x, p.y - 5);

    // the trailing arc
    ctx.strokeStyle = `rgba(215,232,255,${alpha * 0.55})`;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.reach - 6, base - spread, angle);
    ctx.stroke();

    // the blade at its current angle
    ctx.rotate(angle);
    ctx.strokeStyle = `rgba(245,250,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(PLAYER.reach + 2, 0);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.fillRect(4, -3, 3, 6);
    ctx.restore();
  },

  /* ---------------- monsters ---------------- */

  ghost(ctx, e, time) {
    const bob = Math.sin(time * 2 + e.seed * 6.28) * 3;
    const winding = e.state === 'windup';
    const alpha = e.dying ? e.deathTimer * 1.2 : 0.82;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(Math.round(e.x), Math.round(e.y) + bob);

    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 16 - bob, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // a cold halo, so the shade reads against dark trees
    const halo = ctx.createRadialGradient(0, -2, 2, 0, -2, 24);
    halo.addColorStop(0, 'rgba(150,185,215,0.28)');
    halo.addColorStop(1, 'rgba(150,185,215,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-24, -26, 48, 48);

    // tattered shroud
    const grad = ctx.createLinearGradient(0, -16, 0, 16);
    grad.addColorStop(0, e.hurtFlash > 0 ? '#ffffff' : '#c6d9ea');
    grad.addColorStop(0.55, C.ghost);
    grad.addColorStop(1, 'rgba(120,145,175,0.10)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -4, 12, Math.PI, 0);
    ctx.lineTo(12, 7);
    for (let i = 0; i < 3; i++) {
      const x0 = 12 - i * 8;
      ctx.quadraticCurveTo(x0 - 4, 16, x0 - 8, 7);
    }
    ctx.closePath();
    ctx.fill();

    // eyes
    ctx.fillStyle = winding ? '#ff6a52' : '#0a0f16';
    ctx.beginPath(); ctx.ellipse(-4, -6, 2.3, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -6, 2.3, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    if (winding) {
      ctx.strokeStyle = 'rgba(255,150,120,0.8)';
      ctx.lineWidth = 1.6;
      const d = DIRS[e.dir];
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(d.x * 8 + i * 3 * (1 - Math.abs(d.x)), d.y * 8 + i * 3 * (1 - Math.abs(d.y)));
        ctx.lineTo(d.x * 16 + i * 4 * (1 - Math.abs(d.x)), d.y * 16 + i * 4 * (1 - Math.abs(d.y)));
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  bat(ctx, e, time) {
    const flap = Math.sin(time * 16 + e.seed * 6.28);
    const bob = Math.sin(time * 5 + e.seed * 3) * 2.5;
    const alpha = e.dying ? e.deathTimer * 1.2 : 1;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(Math.round(e.x), Math.round(e.y) + bob);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15 - bob, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // wings
    ctx.fillStyle = e.hurtFlash > 0 ? '#e8dcef' : C.bat;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 3, -1);
      ctx.quadraticCurveTo(s * 12, -6 - flap * 5, s * 17, 2 + flap * 3);
      ctx.quadraticCurveTo(s * 11, 1 + flap * 2, s * 3, 5);
      ctx.closePath();
      ctx.fill();
    }
    // body
    ctx.fillStyle = e.hurtFlash > 0 ? '#f2e9f6' : '#3a3046';
    ctx.beginPath();
    ctx.ellipse(0, 1, 4.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.beginPath();
    ctx.moveTo(-3, -5); ctx.lineTo(-4.5, -10); ctx.lineTo(-0.5, -6);
    ctx.moveTo(3, -5); ctx.lineTo(4.5, -10); ctx.lineTo(0.5, -6);
    ctx.fill();
    // eyes
    ctx.fillStyle = e.state === 'windup' ? '#ff7a5c' : '#c8434a';
    ctx.fillRect(-2.5, -3, 1.8, 1.8);
    ctx.fillRect(0.7, -3, 1.8, 1.8);
    if (e.state === 'windup') {   // fangs out
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-1.6, 2, 1.2, 3);
      ctx.fillRect(0.4, 2, 1.2, 3);
    }
    ctx.restore();
  },

  /* ---------------- loot ---------------- */

  chest(ctx, ch, time) {
    const x = Math.round(ch.x), y = Math.round(ch.y);
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!ch.opened) {
      // an unopened chest breathes a faint gold hint so it can be found in the gloom
      const pulse = 0.25 + Math.sin(time * 2.2 + ch.seed * 6.28) * 0.12;
      ctx.strokeStyle = `rgba(201,162,39,${pulse})`;
      ctx.lineWidth = 2;
      roundRect(ctx, -14, -14, 28, 24, 3);
      ctx.stroke();
    }

    // body
    ctx.fillStyle = C.wood;
    roundRect(ctx, -12, -6, 24, 16, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-12, 6, 24, 4);

    if (ch.opened) {
      ctx.fillStyle = '#100d09';
      ctx.fillRect(-10, -6, 20, 6);
      const glow = 0.35 + Math.sin(time * 3 + ch.seed) * 0.1;
      ctx.fillStyle = `rgba(255,200,110,${glow})`;
      ctx.fillRect(-9, -5, 18, 4);
      // lid thrown back
      ctx.save();
      ctx.translate(0, -6);
      ctx.rotate(-1.15);
      ctx.fillStyle = C.woodLight;
      roundRect(ctx, -12, -8, 24, 9, 3); ctx.fill();
      ctx.fillStyle = C.steel;
      ctx.fillRect(-3, -8, 3, 9);
      ctx.restore();
    } else {
      ctx.fillStyle = C.woodLight;
      roundRect(ctx, -12, -14, 24, 10, 3); ctx.fill();
      ctx.fillStyle = C.steel;
      ctx.fillRect(-12, -6, 24, 2);
      ctx.fillRect(-3, -14, 3, 12);
      ctx.fillStyle = C.gold;
      ctx.fillRect(-2.5, -5, 5, 4);
    }
    ctx.restore();
  },

  itemIcon(ctx, id, x, y, size) {
    const s = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (id === 'coin_bag') {
      ctx.fillStyle = '#6b5330';
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.quadraticCurveTo(-11, 10, 0, 10);
      ctx.quadraticCurveTo(11, 10, 8, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4d3b22';
      ctx.fillRect(-6, -5, 12, 4);
      ctx.strokeStyle = '#8a6c3f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -5); ctx.lineTo(-2, -9);
      ctx.moveTo(4, -5); ctx.lineTo(2, -9);
      ctx.stroke();
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.arc(-2, 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, 5, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'potion') {
      ctx.fillStyle = '#2b2a33';
      ctx.fillRect(-2.5, -11, 5, 4);
      ctx.fillStyle = '#6b5330';
      ctx.fillRect(-3.5, -13, 7, 3);
      ctx.fillStyle = 'rgba(200,220,235,0.35)';
      ctx.beginPath();
      ctx.moveTo(-3, -7);
      ctx.quadraticCurveTo(-9, -2, -7, 6);
      ctx.quadraticCurveTo(-5, 11, 0, 11);
      ctx.quadraticCurveTo(5, 11, 7, 6);
      ctx.quadraticCurveTo(9, -2, 3, -7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b8323a';
      ctx.beginPath();
      ctx.moveTo(-6.4, 1);
      ctx.quadraticCurveTo(-6.6, 10, 0, 10);
      ctx.quadraticCurveTo(6.6, 10, 6.4, 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,180,140,0.5)';
      ctx.beginPath(); ctx.arc(-2, 4, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'coins') {
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6c1f';
      ctx.beginPath(); ctx.ellipse(0, 2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
};
