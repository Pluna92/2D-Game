/* save.js — one slot, kept in localStorage.
   Every read is defensive: a browser with storage disabled should still play. */

const SAVE_KEY = 'ashvale.save.v1';

const SaveGame = {
  read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.v === 1 ? data : null;
    } catch (err) {
      return null;
    }
  },

  exists() { return this.read() !== null; },

  write(data) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  },

  clear() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (err) { /* nothing to do */ }
  },

  /* "Gallow Pasture · 12 Sep, 21:04" for the title screen. */
  describe() {
    const data = this.read();
    if (!data) return '';
    const when = new Date(data.ts || Date.now());
    const stamp = when.toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    return `${data.region || 'Ashvale'} · ${stamp}`;
  }
};
