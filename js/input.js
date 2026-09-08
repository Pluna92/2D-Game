/* input.js — keyboard state.
   `down()` answers "is it held right now", `pressed()` answers "was it struck
   this frame" and is cleared at the end of every frame by the game loop. */

const KEY_MAP = {
  ArrowUp: ['up'],
  ArrowDown: ['down'],
  ArrowLeft: ['left'],
  ArrowRight: ['right'],
  Space: ['attack', 'confirm'],
  Enter: ['confirm'],
  ShiftLeft: ['block'],
  ShiftRight: ['block'],
  KeyW: ['inventory'],
  KeyS: ['use'],
  Escape: ['menu']
};

const Input = {
  held: new Set(),
  hits: new Set(),

  init() {
    window.addEventListener('keydown', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      e.preventDefault();
      if (e.repeat) return;
      for (const a of actions) {
        this.held.add(a);
        this.hits.add(a);
      }
    });

    window.addEventListener('keyup', (e) => {
      const actions = KEY_MAP[e.code];
      if (!actions) return;
      e.preventDefault();
      for (const a of actions) this.held.delete(a);
    });

    // Losing focus mid-stride should not leave the knight sprinting into a tree.
    window.addEventListener('blur', () => {
      this.held.clear();
      this.hits.clear();
    });
  },

  down(action) { return this.held.has(action); },
  pressed(action) { return this.hits.has(action); },

  /* Axis of travel from the arrow keys, normalised so diagonals are not faster. */
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('left')) x -= 1;
    if (this.down('right')) x += 1;
    if (this.down('up')) y -= 1;
    if (this.down('down')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  },

  endFrame() { this.hits.clear(); }
};
