# CUBESTRIKE: RIO

Browser tactical FPS (Counter-Strike 1.6 homage, Brazil-themed). Vanilla ES modules +
three.js from a CDN. No build step, no dependencies, no asset files — all geometry is
in-code, all audio is synthesized at runtime.

## Layout

- `index.html` — canvas, HUD markup, menu overlays
- `js/game.js` — everything live: renderer, map build, player physics, shooting,
  grenades, viewmodels, bot AI, round state machine, HUD, input
- `js/config.js` — all tunable data: `WEAPONS`, `BUY_ITEMS`, economy, bhop, map
  blockout (`MAP_BOXES`), bot nav graph (`WAYPOINTS`/`WAY_EDGES`), spawns
- `js/audio.js` — WebAudio synth (`sfx.*`); no audio files ever
- `js/net.js` — PeerJS/WebRTC transport. Host-authoritative: host runs
  bots/rounds/damage; guests simulate their own movement, report `state` at
  ~16Hz, and puppet everything else from host `snap` messages. Round flow on
  guests is event-driven (`round`/`live`/`end`/`match`) — every round-deciding
  code path in game.js must stay gated on `net.isGuest`. Joiners alternate
  teams starting with T (PvP via the `pvp`/`dmg` messages; `myTeam` makes HUD,
  hitscan, and round results team-relative). Friendly fire is off everywhere.
  The only external dependency is the free PeerJS signaling cloud.
- `style.css` — HUD theme via CSS variables (`--hud` yellow, `--hud-dim` green)

## Conventions

- Data goes in `config.js`, behavior in `game.js`. New weapons are a `WEAPONS` entry
  plus a viewmodel branch in `buildViewModel()`; flags on the spec (`melee`,
  `grenade`, `auto`) pick the fire path.
- Map = axis-aligned boxes `[x, z, w, d, h, baseY, kind]`. `kind` picks a color from
  `KIND_PALETTE` (cycled deterministically). Kinds in `DECAL_KINDS` (court, line,
  padCT, padT) render but don't collide. Everything else lands in `WALLS`, which is
  the single source of truth for player collision, bullet raycasts, grenade bounces,
  and bot line-of-sight.
- Jump reaches ~1.2m: 1.1 boxes are jumpable steps, 2.2 is standing cover,
  step-stacks 1.1 → 2.2 → 3.4 make "stairs" onto walkable roofs. The court fence is
  1.3: see/shoot over it, vault it from an adjacent crate. There are no ladder or
  stair mechanics.
- `WAY_EDGES` must be straight lines clear of all solid boxes — bots walk them
  blindly. When editing the map, re-check every edge that passes near a new box.
  Never leave a clear eye-height sightline between the two spawns (bots will stand
  and snipe instead of pathing).
- Weapon/round text the player sees is Portuguese-flavored (RODADA, LOJA, VAI VAI
  VAI); code and comments are English.
- Names: weapons carry a `name` + exotic `skin` (HUD shows the skin); when
  `skin === name` the buy menu hides the duplicate.

## Testing in the headless preview

Pointer lock doesn't exist headless. To drive the game from `preview_eval`:

1. Wait for the module: poll `typeof window.cs_give === 'function'`.
2. Spoof lock: `Object.defineProperty(Document.prototype, 'pointerLockElement',
   { configurable: true, get: () => document.getElementById('game') })`, then
   `document.dispatchEvent(new Event('pointerlockchange'))` — this starts the match.
3. If the preview window is occluded, Chrome throttles/suspends rAF and the game
   freezes (timer stuck, `paused` still false). Shim it:
   `window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)`.
4. Input is synthetic `MouseEvent`/`KeyboardEvent` dispatches on `document`. Respect
   `switchT` (~0.35s) after equipping before firing.
5. Cheats: `impulse101()` (max money), `cs_give(id)` (any weapon, repeatable).
6. The AFK player dies fast — bots cross the map in ~20s. Do fragile checks during
   the 6s buy phase, or expect round churn.

## Deploys

- Repo: `LUCASDREYER/cubestrike-rio` (GitHub Pages, legacy build from `main` root).
  Live at https://lucasdreyer.github.io/cubestrike-rio/ — a push to `main` deploys.
- `LUCASDREYER/cubestrike` is the ORIGINAL pre-Rio game in a separate repo. Never
  push Rio changes there.
- Local dev server: `npx serve --listen 4173 .` (see `.claude/launch.json`).
