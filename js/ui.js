/* ui.js — health, minimap, inventory, menus and messages.
   Everything is drawn into the same canvas so the whole game is one surface. */

const MINIMAP = { w: 214, h: 158, pad: 14, scale: 4.2 };

const UI = {

  /* ---------- primitives ---------- */

  font(size, weight) {
    return `${weight || 'normal'} ${size}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`;
  },

  text(ctx, str, x, y, opt) {
    const o = opt || {};
    ctx.save();
    ctx.font = this.font(o.size || 14, o.weight);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = o.color || C.ui;
    ctx.fillText(str, x, y);
    ctx.restore();
  },

  panel(ctx, x, y, w, h, opt) {
    const o = opt || {};
    ctx.save();
    ctx.fillStyle = o.fill || C.panel;
    roundRect(ctx, x, y, w, h, o.radius || 4);
    ctx.fill();
    ctx.strokeStyle = o.edge || C.panelEdge;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, o.radius || 4);
    ctx.stroke();
    // inner hairline, for a slightly engraved look
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x + 3.5, y + 3.5, w - 7, h - 7, 3);
    ctx.stroke();
    ctx.restore();
  },

  /* ---------- head-up display ---------- */

  drawHud(ctx, game) {
    const p = game.player;
    const x = 16, y = 14, w = 268, h = 74;
    this.panel(ctx, x, y, w, h);

    // health bar
    const bx = x + 14, by = y + 30, bw = w - 28, bh = 16;
    ctx.fillStyle = C.hpBack;
    roundRect(ctx, bx, by, bw, bh, 3); ctx.fill();

    const frac = clamp(p.hp / p.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    const low = frac < 0.3;
    grad.addColorStop(0, low ? C.hpFillLow : '#c0303a');
    grad.addColorStop(1, low ? '#8d2417' : C.hpFill);
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, Math.max(2, bw * frac), bh, 3); ctx.fill();

    // ten-point notches so the numbers have a shape
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const nx = Math.round(bx + (bw * i) / 10) + 0.5;
      ctx.beginPath();
      ctx.moveTo(nx, by + 2);
      ctx.lineTo(nx, by + bh - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 3); ctx.stroke();

    this.text(ctx, 'HEALTH', bx, y + 22, { size: 13, color: C.uiDim, weight: '600' });
    this.text(ctx, `${p.hpShown} / ${p.maxHp}`, bx + bw, y + 22,
      { size: 14, color: low ? '#ff8a76' : C.ui, align: 'right', weight: '600' });

    // satchel tally and the shield light
    Sprites.itemIcon(ctx, 'coins', bx + 8, y + 60, 16);
    this.text(ctx, `${Inventory.coins}`, bx + 20, y + 65, { size: 13, color: C.gold });
    Sprites.itemIcon(ctx, 'potion', bx + 62, y + 60, 16);
    this.text(ctx, `${Inventory.count('potion')}`, bx + 74, y + 65, { size: 13, color: C.ui });

    const guarding = p.blocking;
    ctx.save();
    ctx.globalAlpha = guarding ? 1 : 0.3;
    Sprites.shield(ctx, bx + 116, y + 58, 0.9);
    ctx.restore();
    this.text(ctx, guarding ? (p.blockTimer <= PLAYER.parryWindow ? 'PARRY!' : 'GUARD') : 'GUARD',
      bx + 128, y + 65, { size: 12, color: guarding ? '#dbe6ff' : C.uiDim });

    // where the knight is standing
    this.text(ctx, game.regionLabel.toUpperCase(), x + w + 16, y + 26,
      { size: 15, color: C.uiDim, weight: '600' });
    if (World.inSafeZone(p.x, p.y)) {
      this.text(ctx, 'sanctuary — wounds are closing', x + w + 16, y + 46,
        { size: 13, color: '#8fb08a' });
    }
  },

  /* Small bar over a monster's head. */
  drawEnemyBar(ctx, e) {
    if (e.dead || e.dying) return;
    const w = 26, h = 4;
    const x = Math.round(e.x - w / 2);
    const y = Math.round(e.y - (e.type === 'ghost' ? 30 : 24));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#2a1418';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = e.type === 'ghost' ? '#7fa6c9' : '#c8434a';
    ctx.fillRect(x, y, Math.max(1, w * (e.hp / e.maxHp)), h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, 1);
  },

  /* ---------- minimap ---------- */

  drawMinimap(ctx, game) {
    const w = MINIMAP.w, h = MINIMAP.h;
    const x = VIEW_W - w - MINIMAP.pad;
    const y = VIEW_H - h - MINIMAP.pad;
    const s = MINIMAP.scale;
    const p = game.player;

    this.panel(ctx, x - 6, y - 20, w + 12, h + 32, { fill: 'rgba(8,9,13,0.9)' });
    this.text(ctx, game.regionLabel, x + w / 2, y - 6, { size: 12, color: C.uiDim, align: 'center' });

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#06070a';
    ctx.fillRect(x, y, w, h);

    // the window of tiles immediately around the knight
    const cxT = p.x / TILE, cyT = p.y / TILE;
    const halfW = w / (2 * s), halfH = h / (2 * s);
    const t0x = Math.floor(cxT - halfW) - 1, t1x = Math.ceil(cxT + halfW) + 1;
    const t0y = Math.floor(cyT - halfH) - 1, t1y = Math.ceil(cyT + halfH) + 1;
    const px = (tx) => x + w / 2 + (tx - cxT) * s;
    const py = (ty) => y + h / 2 + (ty - cyT) * s;

    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        ctx.fillStyle = MINI_COLORS[World.get(tx, ty)] || '#101319';
        ctx.fillRect(Math.floor(px(tx)), Math.floor(py(ty)), Math.ceil(s), Math.ceil(s));
      }
    }

    // the cottage's safe circle
    const hx = px(World.home.cx / TILE), hy = py(World.home.cy / TILE);
    ctx.strokeStyle = 'rgba(130,180,220,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hx, hy, (World.home.radius / TILE) * s, 0, Math.PI * 2);
    ctx.stroke();

    // unopened chests nearby
    for (const ch of game.chests) {
      if (ch.opened) continue;
      const mx = px(ch.x / TILE), my = py(ch.y / TILE);
      if (mx < x || mx > x + w || my < y || my > y + h) continue;
      ctx.fillStyle = C.gold;
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    // monsters that have noticed the knight
    for (const e of game.enemies) {
      if (e.dead || e.dying) continue;
      const mx = px(e.x / TILE), my = py(e.y / TILE);
      if (mx < x || mx > x + w || my < y || my > y + h) continue;
      ctx.fillStyle = e.type === 'ghost' ? '#a8c4dd' : '#d0555c';
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // the knight, and the way they are travelling
    const cx = x + w / 2, cy = y + h / 2;
    const d = DIRS[game.travelDir];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(d.y, d.x));
    ctx.fillStyle = '#f2f5ff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, -4.5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(242,245,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // compass
    ctx.save();
    this.text(ctx, 'N', x + w - 12, y + 14, { size: 12, color: 'rgba(200,215,240,0.8)', align: 'center' });
    ctx.strokeStyle = 'rgba(200,215,240,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y + 18);
    ctx.lineTo(x + w - 12, y + 28);
    ctx.stroke();
    ctx.restore();
  },

  /* ---------- messages and pickups ---------- */

  drawMessages(ctx, game) {
    let y = VIEW_H - 26;
    for (let i = game.messages.length - 1; i >= 0; i--) {
      const m = game.messages[i];
      const alpha = clamp(m.life, 0, 1);
      this.text(ctx, m.text, 18, y, { size: 14, color: `rgba(200,208,224,${alpha})` });
      y -= 20;
    }
  },

  drawPickup(ctx, game) {
    const pk = game.pickup;
    if (!pk || pk.life <= 0) return;
    const alpha = clamp(pk.life, 0, 1);
    const w = 290, h = 74;
    const x = (VIEW_W - w) / 2;
    const y = 60 - (1 - Math.min(1, pk.age * 4)) * 16;

    ctx.save();
    ctx.globalAlpha = alpha;
    this.panel(ctx, x, y, w, h, { fill: 'rgba(14,12,10,0.92)', edge: '#6a5628' });
    Sprites.itemIcon(ctx, pk.id, x + 40, y + 38, 40);
    this.text(ctx, 'FOUND', x + 76, y + 26, { size: 12, color: C.gold, weight: '600' });
    this.text(ctx, ITEMS[pk.id].name, x + 76, y + 46, { size: 19, color: '#efe6d0' });
    this.text(ctx, ITEMS[pk.id].note, x + 76, y + 63, { size: 12, color: C.uiDim });
    ctx.restore();
  },

  drawFloaters(ctx, game) {
    for (const f of game.floaters) {
      const alpha = clamp(f.life / f.max, 0, 1);
      this.text(ctx, f.text, f.x, f.y, {
        size: f.size || 14,
        color: f.color.replace('ALPHA', alpha.toFixed(2)),
        align: 'center',
        weight: '600'
      });
    }
  },

  /* ---------- inventory ---------- */

  drawInventory(ctx, game) {
    const w = 420, h = 300;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(4,5,8,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(ctx, x, y, w, h);

    this.text(ctx, 'SATCHEL', x + 24, y + 34, { size: 20, color: '#e2d9c4', weight: '600' });
    ctx.strokeStyle = C.panelEdge;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 46);
    ctx.lineTo(x + w - 20, y + 46);
    ctx.stroke();

    const rows = Inventory.rows();
    const rowH = 44;
    rows.forEach((row, i) => {
      const ry = y + 60 + i * rowH;
      const chosen = i === Inventory.selected;
      if (chosen) {
        ctx.fillStyle = 'rgba(201,162,39,0.12)';
        roundRect(ctx, x + 16, ry - 4, w - 32, rowH - 6, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,162,39,0.45)';
        ctx.stroke();
      }
      Sprites.itemIcon(ctx, row.id, x + 44, ry + 16, 28);
      this.text(ctx, row.name, x + 72, ry + 14, { size: 16, color: chosen ? '#f3ecd9' : C.ui });
      this.text(ctx, row.note, x + 72, ry + 30, { size: 12, color: C.uiDim });
      this.text(ctx, `×${row.qty}`, x + w - 30, ry + 22, { size: 16, color: C.gold, align: 'right' });
    });

    if (rows.length === 1) {
      this.text(ctx, 'Nothing else but coins and cold air.', x + 44, y + 60 + rowH + 20,
        { size: 13, color: C.uiDim });
    }

    this.text(ctx, '↑ ↓ choose   ·   S use   ·   W close', x + w / 2, y + h - 20,
      { size: 13, color: C.uiDim, align: 'center' });
  },

  /* ---------- menus ---------- */

  drawMenu(ctx, game, title, subtitle, options, index, footer) {
    const w = 380;
    const h = 120 + options.length * 44;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(3,4,7,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(ctx, x, y, w, h);

    this.text(ctx, title, VIEW_W / 2, y + 46, { size: 30, color: '#e6dcc4', align: 'center', weight: '600' });
    if (subtitle) {
      this.text(ctx, subtitle, VIEW_W / 2, y + 70, { size: 13, color: C.uiDim, align: 'center' });
    }

    options.forEach((opt, i) => {
      const oy = y + 104 + i * 44;
      const chosen = i === index;
      if (chosen) {
        ctx.fillStyle = 'rgba(201,162,39,0.12)';
        roundRect(ctx, x + 30, oy - 22, w - 60, 34, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,162,39,0.5)';
        ctx.stroke();
      }
      this.text(ctx, opt.label, VIEW_W / 2, oy, {
        size: 17,
        color: opt.disabled ? '#4d5464' : (chosen ? '#f6efdc' : C.ui),
        align: 'center'
      });
    });

    this.text(ctx, footer || '↑ ↓ choose   ·   Space confirm', VIEW_W / 2, y + h - 20,
      { size: 12, color: C.uiDim, align: 'center' });
  },

  drawTitleArt(ctx, time) {
    // a cold moon over a black treeline
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#101828');
    grad.addColorStop(0.55, '#0e1420');
    grad.addColorStop(1, '#151b24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // a few cold stars
    for (let i = 0; i < 60; i++) {
      const sx = hash2(i * 13, 3) * VIEW_W;
      const sy = hash2(7, i * 29) * VIEW_H * 0.6;
      const tw = 0.25 + Math.abs(Math.sin(time * 0.8 + i)) * 0.45;
      ctx.fillStyle = `rgba(210,225,255,${tw * 0.5})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // the moon
    const mx = VIEW_W * 0.74, my = 122;
    const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
    halo.addColorStop(0, 'rgba(200,220,255,0.22)');
    halo.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 150, my - 150, 300, 300);
    ctx.fillStyle = 'rgba(232,240,255,0.92)';
    ctx.beginPath();
    ctx.arc(mx, my, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,170,205,0.35)';
    ctx.beginPath();
    ctx.arc(mx - 14, my - 8, 9, 0, Math.PI * 2);
    ctx.arc(mx + 12, my + 14, 6, 0, Math.PI * 2);
    ctx.fill();

    // mist over the far treeline
    ctx.fillStyle = 'rgba(150,170,200,0.06)';
    ctx.fillRect(0, VIEW_H - 300, VIEW_W, 120);

    // two ranks of black firs
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer === 0 ? '#080c13' : '#020407';
      const base = VIEW_H - (layer === 0 ? 170 : 90);
      const step = layer === 0 ? 34 : 26;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      for (let x = -step; x <= VIEW_W + step; x += step) {
        const h = (layer === 0 ? 80 : 120) + hash2(x, layer * 5 + 7) * 90;
        ctx.lineTo(x, base);
        ctx.lineTo(x + step / 2, base - h);
        ctx.lineTo(x + step, base);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
  }
};

const MINI_COLORS = {
  [T.GRASS]: '#212e24',
  [T.TALLGRASS]: '#26362a',
  [T.BUSH]: '#1b2a20',
  [T.DIRT]: '#3b3128',
  [T.TREE]: '#131f18',
  [T.ROCK]: '#474e5b',
  [T.WATER]: '#16233a',
  [T.SHORE]: '#3d3728',
  [T.DOCK]: '#4d3c2c',
  [T.WALL]: '#5c6472',
  [T.DOOR]: '#7a5c3e',
  [T.FLOOR]: '#6b523c',
  [T.GRAVE]: '#3f4550'
};
