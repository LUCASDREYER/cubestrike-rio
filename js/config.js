// Weapon, map, and bot data. Units are meters-ish; +x east, +z south.

// `skin` + `energy` drive the Destiny-style exotic viewmodels: skin is the name
// shown in the HUD, energy tints the glow accents, tracers, and muzzle flash.
export const WEAPONS = {
  knife:  { name: 'Knife',      skin: 'Jaguara',          energy: 0x35e06a, slot: 'knife',     price: 0,    dmg: 55,  rpm: 150, mag: Infinity, reserve: Infinity, spread: 0,     reload: 0,   auto: false, melee: true,  recoil: 0,   killAward: 1500 },
  pistol: { name: 'Oitão',      skin: 'Oitão',            energy: 0xffdf2e, slot: 'secondary', price: 0,    dmg: 26,  rpm: 360, mag: 12, reserve: 36,  spread: 0.014, reload: 1.9, auto: false, melee: false, recoil: 0.5, killAward: 300 },
  deagle: { name: 'Big Iron',   skin: 'Pé de Ferro',      energy: 0xffb030, slot: 'secondary', price: 650,  dmg: 54,  rpm: 240, mag: 7,  reserve: 35,  spread: 0.020, reload: 2.2, auto: false, melee: false, recoil: 1.6, killAward: 300 },
  smg:    { name: 'Wasp SMG',   skin: 'Carnaval',         energy: 0xff4fd8, slot: 'primary',   price: 1250, dmg: 17,  rpm: 780, mag: 25, reserve: 100, spread: 0.030, reload: 2.4, auto: true,  melee: false, recoil: 0.4, killAward: 600 },
  rifle:  { name: 'Parafal',    skin: 'Parafal',          energy: 0x21d34f, slot: 'primary',   price: 2700, dmg: 34,  rpm: 600, mag: 30, reserve: 90,  spread: 0.022, reload: 2.5, auto: true,  melee: false, recoil: 0.7, killAward: 300 },
  sniper: { name: 'Long Tom',   skin: 'Cristo Redentor',  energy: 0x8fd8ff, slot: 'primary',   price: 4750, dmg: 115, rpm: 41,  mag: 5,  reserve: 30,  spread: 0.050, reload: 3.2, auto: false, melee: false, recoil: 2.4, killAward: 100 },
  // HE grenade: `dmg` is at the blast center, falling off linearly to `radius`.
  nade:   { name: 'HE Grenade', skin: 'Coxinha',          energy: 0xe09a3a, slot: 'nade',      price: 300,  dmg: 95,  rpm: 60,  mag: 1,  reserve: 0,   spread: 0,     reload: 0,   auto: false, melee: false, recoil: 0,   killAward: 300, grenade: true, radius: 7, fuse: 1.6, throwSpeed: 16 },
};

// Buy menu rows, in key order (1..n). 'armor' is special-cased.
export const BUY_ITEMS = [
  { id: 'deagle' },
  { id: 'smg' },
  { id: 'rifle' },
  { id: 'sniper' },
  { id: 'nade' },
  { id: 'armor', name: 'Kevlar Vest', price: 650 },
];

export const ECON = { start: 800, win: 3250, loss: 1400, cap: 16000 };

// Bunny hopping: re-jumping within `window` seconds of landing multiplies move
// speed by `gain`, up to `cap`; staying grounded longer bleeds the bonus off.
export const BHOP = { gain: 1.12, cap: 1.9, window: 0.25 };

export const MATCH_WIN_ROUNDS = 8;
export const BUY_TIME = 6;
export const ROUND_TIME = 90;

// Map blockout: [x, z, width, depth, height, baseY, kind]
// "Quadra" — favela futsal-court map. Three east-west lanes: top lane (z<0),
// the fenced court as mid, bottom lane (z>0). Team 1 spawns west, Team 2 east.
// Kinds court/padCT/padT/line are painted ground decals — drawn but not solid.
export const MAP_BOXES = [
  // outer walls
  [0, -42, 124, 2, 5, 0, 'wall'],
  [0, 42, 124, 2, 5, 0, 'wall'],
  [-61, 0, 2, 86, 5, 0, 'wall'],
  [61, 0, 2, 86, 5, 0, 'wall'],

  // the court: painted slab + chain-link fence (1.3 high: see and shoot over,
  // vault from a crate). Entry gaps mid-west and mid-east carry the mid lane.
  [0, 0, 36, 26, 0.04, 0, 'court'],
  [0, 0, 36, 0.5, 0.02, 0.04, 'line'],           // halfway line
  // painted boundary + goal areas + penalty spots (futsal markings)
  [0, -12.6, 36, 0.4, 0.02, 0.04, 'line'],
  [0, 12.6, 36, 0.4, 0.02, 0.04, 'line'],
  [-17.6, 0, 0.4, 26, 0.02, 0.04, 'line'],
  [17.6, 0, 0.4, 26, 0.02, 0.04, 'line'],
  [0, -10, 8, 0.4, 0.02, 0.04, 'line'],
  [-4, -11.5, 0.4, 3, 0.02, 0.04, 'line'],
  [4, -11.5, 0.4, 3, 0.02, 0.04, 'line'],
  [0, 10, 8, 0.4, 0.02, 0.04, 'line'],
  [-4, 11.5, 0.4, 3, 0.02, 0.04, 'line'],
  [4, 11.5, 0.4, 3, 0.02, 0.04, 'line'],
  [0, -8, 0.5, 0.5, 0.02, 0.04, 'line'],
  [0, 8, 0.5, 0.5, 0.02, 0.04, 'line'],
  [0, -13, 36.6, 0.6, 1.3, 0, 'fence'],          // north fence
  [0, 13, 36.6, 0.6, 1.3, 0, 'fence'],           // south fence
  [-18, -7.75, 0.6, 10.5, 1.3, 0, 'fence'],      // west fence, gap at z -2.5..2.5
  [-18, 7.75, 0.6, 10.5, 1.3, 0, 'fence'],
  [18, -7.75, 0.6, 10.5, 1.3, 0, 'fence'],       // east fence, gap at z -2.5..2.5
  [18, 7.75, 0.6, 10.5, 1.3, 0, 'fence'],
  // court planters (low cover, mid corridor at z 0 stays clear)
  [-8, -6, 3, 3, 1.1, 0, 'crateLow'],
  [-8, 6, 3, 3, 1.1, 0, 'crateLow'],
  [8, -6, 3, 3, 1.1, 0, 'crateLow'],
  [8, 6, 3, 3, 1.1, 0, 'crateLow'],
  [0, -10, 3, 3, 1.1, 0, 'crateLow'],
  [0, 10, 3, 3, 1.1, 0, 'crateLow'],
  [-13, 4, 3, 3, 1.1, 0, 'crateLow'],
  [13, -4, 3, 3, 1.1, 0, 'crateLow'],

  // lane-divider building rows (gaps at x -20..-12 and 12..20 connect lanes)
  [-32, -21, 24, 3, 4.5, 0, 'wall'],
  [0, -21, 24, 3, 4.5, 0, 'wall'],
  [32, -21, 24, 3, 4.5, 0, 'wall'],
  [-32, 21, 24, 3, 4.5, 0, 'wall'],
  [0, 21, 24, 3, 4.5, 0, 'wall'],
  [32, 21, 24, 3, 4.5, 0, 'wall'],

  // walkable rooftops with crate steps (ground -> 1.1 -> 2.2 -> 3.4 roof)
  [-32, -35, 10, 5, 3.4, 0, 'pillar'],
  [-25.5, -35, 4, 4, 2.2, 0, 'crate'],
  [-21.5, -35, 3, 3, 1.1, 0, 'crateLow'],
  [32, 35, 10, 5, 3.4, 0, 'pillar'],
  [25.5, 35, 4, 4, 2.2, 0, 'crate'],
  [21.5, 35, 3, 3, 1.1, 0, 'crateLow'],

  // lane cover
  [-10, -36, 4, 4, 2.2, 0, 'crate'],
  [12, -27, 4, 4, 2.2, 0, 'crate'],
  [40, -36, 3, 3, 1.1, 0, 'crateLow'],
  [10, 36, 4, 4, 2.2, 0, 'crate'],
  [-12, 27, 4, 4, 2.2, 0, 'crate'],
  [-40, 36, 3, 3, 1.1, 0, 'crateLow'],

  // fence-vault crates (hop on, jump over the chain-link)
  [-10, -15.4, 3, 3, 1.1, 0, 'crateLow'],
  [10, 15.4, 3, 3, 1.1, 0, 'crateLow'],

  // spawn screens: buildings that break the spawn-to-spawn sightline down mid
  [-38, 0, 6, 12, 4.5, 0, 'wall'],
  [38, 0, 6, 12, 4.5, 0, 'wall'],

  // spawn plazas: painted pads + cover
  [-52, 0, 8, 10, 0.04, 0, 'padCT'],
  [52, 0, 8, 10, 0.04, 0, 'padT'],
  [-47, -14, 4, 4, 2.2, 0, 'crate'],
  [-47, 14, 4, 4, 2.2, 0, 'crate'],
  [47, -14, 4, 4, 2.2, 0, 'crate'],
  [47, 14, 4, 4, 2.2, 0, 'crate'],
];

// Bot navigation graph: [x, z] nodes + undirected edges (straight lines are clear).
export const WAYPOINTS = [
  [-52, 0],   // 0  Team 1 spawn (west)
  [-50, -31], // 1  west plaza, north
  [-50, 31],  // 2  west plaza, south
  [-30, -31], // 3  top lane west
  [0, -31],   // 4  top lane mid
  [30, -31],  // 5  top lane east
  [50, -31],  // 6  east plaza, north
  [52, 0],    // 7  Team 2 spawn (east)
  [50, 31],   // 8  east plaza, south
  [-30, 31],  // 9  bottom lane west
  [0, 31],    // 10 bottom lane mid
  [30, 31],   // 11 bottom lane east
  [-26, 0],   // 12 court west approach
  [-10, 0],   // 13 court inside west
  [10, 0],    // 14 court inside east
  [26, 0],    // 15 court east approach
  [-16, -21], // 16 north divider gap, west
  [16, -21],  // 17 north divider gap, east
  [-16, 21],  // 18 south divider gap, west
  [16, 21],   // 19 south divider gap, east
  [-38, -10], // 20 west spawn screen, north side
  [-38, 10],  // 21 west spawn screen, south side
  [38, -10],  // 22 east spawn screen, north side
  [38, 10],   // 23 east spawn screen, south side
];
export const WAY_EDGES = [
  [0, 1], [0, 2],
  [1, 3], [3, 4], [4, 5], [5, 6], [6, 7],
  [2, 9], [9, 10], [10, 11], [11, 8], [8, 7],
  [12, 13], [13, 14], [14, 15],
  [3, 16], [4, 16], [16, 12],
  [5, 17], [4, 17], [17, 15],
  [9, 18], [10, 18], [18, 12],
  [11, 19], [10, 19], [19, 15],
  [0, 20], [0, 21], [20, 12], [21, 12],
  [7, 22], [7, 23], [22, 15], [23, 15],
];

export const PLAYER_SPAWN = { x: -52, z: 0, yaw: -Math.PI / 2 };
export const BOT_SPAWNS = [[52, -10], [56, -5], [54, 0], [56, 5], [52, 10]];
export const BOT_NAMES = ['João', 'Thiago', 'Rafa', 'Cauã', 'Marquinhos'];
