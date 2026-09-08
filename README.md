# Ashvale — a dark fantasy 2D action/adventure

A browser game: a knight with a sword and shield, a cottage to heal at, woods
full of chests, a pasture, a lake with a dock, and things in the dark that bite.

No build step, no dependencies. Open `index.html` in any modern browser and play
(or serve the folder — `npx serve .` — if you prefer).

## Controls

| Key | Action |
| --- | --- |
| Arrow keys | Walk (up, down, left, right) |
| Space | Slash — also opens chests, and confirms in menus |
| Shift (hold) | Raise the shield. Raise it *as* a blow lands and you parry |
| W | Open / close the satchel (inventory) |
| S | Use an item — the selected one in the satchel, else the first potion |
| Esc | Pause menu: resume, save, save and exit, exit without saving |

## The knight

- 100 health points, shown as a bar with the exact numbers in the top-left.
- **Slash** takes 10 health points off whatever it hits.
- **Shield**: holding Shift blocks blows that come from the front and lets only
  a quarter of the damage through. Raising it within 0.22s of a blow landing is
  a **parry** — no damage at all, and the attacker reels back stunned for 1.3s.
  Monsters telegraph their attack (eyes flare, a `!` appears) so a parry is a
  timing decision, not a guess.
- Standing in the cottage yard restores 3.5 health a second; standing inside by
  the fire restores 9 a second. Nothing hostile will enter the safe circle.

## The monsters

| | Health | Attack | Damage | Behaviour |
| --- | --- | --- | --- | --- |
| **Ghost** | 30 | Scratch | 20 | Patrols a small square, drifts through stone, chases within 150px |
| **Bat** | 20 | Bite | 11 | Patrols a small square, flies over water, weaves in fast and bites |

Each carries a small health bar above its head. A slain monster stays dead for
30 seconds and only creeps back once the knight is well away.

## The map

One fixed, seeded map, about 2880 × 2240 pixels, four regions joined by roads:

- **The cottage** (west) — a stone-walled house you can walk into, with a bed, a
  table and a lit fireplace. Safe ground, and where health comes back.
- **Ashvale Woods** (north) — dense trees, winding paths, glades to find, and
  most of the chests.
- **Gallow Pasture** (centre) — open grazing land, with boulder fields and
  hedgerows that break it into lanes and pockets to explore.
- **Mirrormere** (south-east) — a lake with a wooden dock and a lantern. Purely
  scenery: the water cannot be entered, fished or swum.
- **The Barrow Moor** (south-west) — leaning headstones and dead trees.

## Loot

Chests sit in the world and are opened by hitting them with the sword (Space).
The prize is named and pictured on a card when it is found.

- **Coin Bag** — 10 coins, tallied in the satchel and the HUD.
- **Ember Potion** — restores 50 health points. Press S to drink one.

Press W for the satchel: a list of what is carried, with counts; ↑↓ to choose,
S to use, W to close.

## Head-up display

- Health bar (current / maximum) with a shield indicator that lights while
  guarding and reads `PARRY!` during the parry window.
- Coin and potion counts.
- Minimap, bottom-right: the immediate landscape around the knight, their
  position, an arrow showing the direction of travel, a compass, nearby chests
  in gold, monsters in red or pale blue, and the cottage's safe circle.

## Saving

One save slot, kept in the browser's `localStorage` (position, health,
satchel, which chests are open, which monsters are down). Esc → `SAVE GAME` or
`SAVE AND EXIT`; the title screen's `CONTINUE` picks it back up.

## Source layout

```
index.html      page and script order
css/style.css   the frame around the canvas
js/core.js      tuning values, tile ids, palette, math helpers
js/input.js     keyboard state
js/sprites.js   every sprite, drawn with canvas primitives (no image assets)
js/world.js     map generation, collision, regions
js/player.js    the knight: movement, sword, shield, healing
js/enemies.js   ghost and bat behaviour
js/loot.js      items, chests, the satchel
js/ui.js        HUD, minimap, inventory, menus
js/save.js      localStorage save slot
js/game.js      loop, camera, state machine, lighting, effects, audio
```

Balance numbers all live in `js/core.js`.
