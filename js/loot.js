/* loot.js — items, chests and the knight's satchel. */

const ITEMS = {
  coin_bag: {
    id: 'coin_bag',
    name: 'Coin Bag',
    note: 'Ten tarnished coins.',
    kind: 'purse',
    coins: 10
  },
  potion: {
    id: 'potion',
    name: 'Ember Potion',
    note: 'Restores 50 health points.',
    kind: 'consumable',
    heal: 50
  }
};

function makeChest(spot, index) {
  return {
    index,
    x: (spot.tx + 0.5) * TILE,
    y: (spot.ty + 0.5) * TILE,
    item: spot.item,
    opened: false,
    radius: 14,
    seed: hash2(spot.tx, spot.ty),
    // set when opened, so the world can show the prize floating above the lid
    revealTimer: 0
  };
}

const Inventory = {
  coins: 0,
  items: [],          // [{ id, qty }]
  selected: 0,

  reset() {
    this.coins = 0;
    this.items = [];
    this.selected = 0;
  },

  /* Returns a short line describing what was gained, for the message log. */
  add(id) {
    const def = ITEMS[id];
    if (!def) return '';
    if (def.kind === 'purse') {
      this.coins += def.coins;
      return `${def.name} — ${def.coins} coins`;
    }
    const slot = this.items.find((s) => s.id === id);
    if (slot) slot.qty += 1;
    else this.items.push({ id, qty: 1 });
    return def.name;
  },

  count(id) {
    const slot = this.items.find((s) => s.id === id);
    return slot ? slot.qty : 0;
  },

  consume(id) {
    const i = this.items.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.items[i].qty -= 1;
    if (this.items[i].qty <= 0) this.items.splice(i, 1);
    this.selected = clamp(this.selected, 0, Math.max(0, this.rows().length - 1));
    return true;
  },

  /* Display rows: coins first (a tally, not usable), then carried items. */
  rows() {
    const rows = [{ id: 'coins', name: 'Coins', qty: this.coins, note: 'Spendable, one day.', usable: false }];
    for (const slot of this.items) {
      const def = ITEMS[slot.id];
      rows.push({ id: slot.id, name: def.name, qty: slot.qty, note: def.note, usable: def.kind === 'consumable' });
    }
    return rows;
  },

  moveSelection(delta) {
    const n = this.rows().length;
    this.selected = (this.selected + delta + n) % n;
  },

  /* The first usable thing in the bag — what S reaches for when the menu is shut. */
  firstUsable() {
    const slot = this.items.find((s) => ITEMS[s.id].kind === 'consumable');
    return slot ? slot.id : null;
  },

  selectedUsable() {
    const row = this.rows()[this.selected];
    return row && row.usable ? row.id : null;
  },

  save() {
    return { coins: this.coins, items: this.items.map((s) => ({ id: s.id, qty: s.qty })) };
  },

  load(data) {
    this.reset();
    if (!data) return;
    this.coins = data.coins || 0;
    this.items = (data.items || []).filter((s) => ITEMS[s.id]).map((s) => ({ id: s.id, qty: s.qty }));
  }
};
