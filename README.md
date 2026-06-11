# CUBESTRIKE: RIO

A Counter-Strike 1.6–style tactical FPS homage with a Rio de Janeiro twist, running
entirely in the browser.
No engine download, no install, no build step — one HTML file, a few JS modules, and
[three.js](https://threejs.org) from a CDN.

**▶ Play it: https://lucasdreyer.github.io/cubestrike-rio/** (desktop + mouse required)

## What's in the box

- **Pointer-lock FPS movement** — WASD, jump, real AABB collision, you can hop up onto the low crates
- **Bunny hopping** — keep moving and hold Space: each hop chained within 0.25s of landing banks speed, up to 1.9× (a speedometer fades in under the crosshair). Airborne spread triples, so it's speed *or* accuracy
- **Game feel** — walk bob with camera sway, viewmodel wobble, per-shot visual recoil (muzzle rise), and a subtle FOV stretch at bhop speed
- **A favela-painted blockout map** — mid doors, two side lanes, crates, and long sightlines under a tropical sky, ringed by green morros (and one Sugarloaf-shaped one)
- **5 weapons + knife + HE grenade** — pistol, hand cannon, SMG, auto rifle, a bolt sniper with a working scope (RMB), and a throwable HE shaped like a coxinha: it arcs, bounces, stands up on its flat base, then detonates
- **Exotic gun skins** — every weapon wears a Destiny-inspired (but original) exotic frame with glowing energy accents; tracers and muzzle flash match each weapon's energy color
- **The CS economy** — $800 pistol round, kill rewards ($300 rifle / $600 SMG / $1500 knife / $100 sniper), win and loss bonuses, $16,000 cap
- **Buy menu** — press the number keys during the buy phase, just like 1.6
- **Round system** — first to 8 rounds wins the match; survive and you keep your guns, die and you're back on pistol
- **Bots** — 5 terrorists with waypoint navigation, line-of-sight checks, reaction time, and aim that gets worse with distance
- **Headshots** — 4× damage, separate head hitbox
- **Synthesized audio** — every sound is generated with WebAudio at runtime; there are zero asset files in this repo

## The armory

| Weapon | Exotic skin | Energy |
|---|---|---|
| P9 Sidearm | Canarinho | Seleção yellow |
| Big Iron | Pé de Ferro | Amber |
| Wasp SMG | Carnaval | Carnival magenta |
| Bulldog AR | Verde-Amarela | Flag green |
| Long Tom | Cristo Redentor | Dawn-sky blue |
| Knife | Jaguara | Jungle green |
| HE Grenade | Coxinha | Deep-fried golden-brown |

There are also console cheats in the spirit of `sv_cheats 1` — open devtools and try
`impulse101()` (max money) or `cs_give('rifle')`.

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Aim / LMB shoot |
| RMB | Scope (sniper) |
| Space | Jump (hold to bunny-hop) |
| R | Reload |
| B | Buy menu (during buy phase) |
| 1 / 2 / 3 / 4 | Primary / pistol / knife / grenade |
| Tab (hold) | Scoreboard |
| Esc | Pause |

## Run it locally

It's ES modules, so it needs any static file server (opening `index.html` directly via
`file://` won't work):

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## How it works

- `js/game.js` — renderer, player physics, hitscan shooting, bot AI, round state machine, HUD
- `js/config.js` — all the tunable data: weapon stats, map blockout boxes, bot nav graph, economy
- `js/audio.js` — WebAudio synth for gunshots, hitmarkers, and round jingles
- The map is a list of axis-aligned boxes; collision and bullet traces are slab-method ray/AABB tests against the same list
- Bots navigate a hand-placed waypoint graph with BFS and switch to engage mode when a wall raycast says they can see you

## Roadmap

- [ ] Bomb plant / defuse objective
- [ ] Radar
- [ ] Friendly CT bots
- [ ] WebRTC multiplayer (ambitious, but the hitscan model is server-friendly)

## A note on the homage

This is a from-scratch fan tribute to the *feel* of Counter-Strike 1.6. It contains no
Valve code, assets, models, sounds, maps, or names — everything is original and
synthesized. Counter-Strike is a trademark of Valve Corporation, which has nothing to
do with this project.

## License

[MIT](LICENSE)
