import * as THREE from 'three';
import {
  WEAPONS, BUY_ITEMS, ECON, BHOP, MATCH_WIN_ROUNDS, BUY_TIME, ROUND_TIME,
  MAP_BOXES, WAYPOINTS, WAY_EDGES, PLAYER_SPAWN, BOT_SPAWNS, BOT_NAMES,
} from './config.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- DOM
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const els = {
  hud: $('hud'), scoreCT: $('scoreCT'), scoreT: $('scoreT'), timer: $('timer'),
  roundLabel: $('roundLabel'), enemies: $('enemies'), killfeed: $('killfeed'),
  hitmarker: $('hitmarker'), speedo: $('speedo'), banner: $('banner'), bannerMain: $('bannerMain'),
  bannerSub: $('bannerSub'), hp: $('hp'), armor: $('armor'), money: $('money'),
  weapon: $('weapon'), ammo: $('ammo'), buymenu: $('buymenu'),
  scoreboard: $('scoreboard'), vignette: $('vignette'), scope: $('scope'),
  overlay: $('overlay'), overlayMsg: $('overlayMsg'),
  matchOverlay: $('matchOverlay'), matchResult: $('matchResult'),
  matchScore: $('matchScore'), matchStats: $('matchStats'), againBtn: $('againBtn'),
};

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecae6);
scene.fog = new THREE.Fog(0x9fd4e8, 60, 210);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 300);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x55704a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
sun.position.set(35, 60, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 160;
scene.add(sun);

const muzzleLight = new THREE.PointLight(0xffc070, 0, 9);
scene.add(muzzleLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- map
function speckleTexture(base, speck, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = speck;
  for (let i = 0; i < 700; i++) {
    g.globalAlpha = Math.random() * 0.25;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(130, 94),
  new THREE.MeshLambertMaterial({ map: speckleTexture('#a89683', '#6e6052', 18) }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Favela palette: walls cycle through painted-house colors (deterministic per
// box index so the map looks the same every load); crates stay wood-toned.
const KIND_PALETTE = {
  wall:     [0xc96a45, 0xe3b54a, 0x6fbf8e, 0x5f9ec9, 0xd98a9e, 0xd9d08a],
  pillar:   [0x9c8a7a],
  crate:    [0x9a6a3a, 0xb07840, 0x7a5a32],
  crateLow: [0x7c7245, 0x8a8050],
  fence:    [0x4a7fb5],
  court:    [0xc9a83a],
  line:     [0xe8e8e0],
  padCT:    [0x5f7e9c],
  padT:     [0xa06a60],
};
// Painted ground decals: rendered, but no collision and no shadow casting.
const DECAL_KINDS = new Set(['court', 'line', 'padCT', 'padT']);
const WALLS = []; // { min:Vector3, max:Vector3 }

let boxIdx = 0;
for (const [x, z, w, d, h, y, kind] of MAP_BOXES) {
  const palette = KIND_PALETTE[kind];
  // the court gets worn, speckled concrete instead of a flat color
  const mat = kind === 'court'
    ? new THREE.MeshLambertMaterial({ map: speckleTexture('#c9a83a', '#85702e', 8) })
    : new THREE.MeshLambertMaterial({ color: palette[boxIdx++ % palette.length] });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = !DECAL_KINDS.has(kind);
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (DECAL_KINDS.has(kind)) continue;
  WALLS.push({
    min: new THREE.Vector3(x - w / 2, y, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
  });
}

// center circle on the court, futsal-style
const centerRing = new THREE.Mesh(
  new THREE.RingGeometry(3.4, 3.8, 32),
  new THREE.MeshLambertMaterial({ color: 0xe8e8e0 }),
);
centerRing.rotation.x = -Math.PI / 2;
centerRing.position.y = 0.06;
centerRing.receiveShadow = true;
scene.add(centerRing);

// Distant morros ringing the arena — scenery only, no collision. The tall
// gray one is the Sugarloaf nod; the rest are forested hills.
const MORROS = [
  // [x, z, radius, height, color]
  [10, -150, 42, 58, 0x8a8d92],
  [-80, -125, 55, 30, 0x3e7a4f],
  [95, -115, 48, 24, 0x46855a],
  [120, 30, 50, 26, 0x3e7a4f],
  [-125, -10, 52, 28, 0x46855a],
  [70, 140, 58, 32, 0x3e7a4f],
  [-75, 135, 50, 26, 0x46855a],
];
for (const [x, z, r, h, color] of MORROS) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.scale.y = h / r;
  m.position.set(x, 0, z);
  scene.add(m);
}

// ---------------------------------------------------------------- set dressing
// Quadra Tavares Bastos flavor: goals and banners on the court, murals, rooftop
// clutter, and the favela climbing the hillsides beyond the walls. All of it is
// generated geometry + canvas textures — scenery only, no collision, no files.

const seededRnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function bannerTexture(text, bg, fg, w = 256, fontPx = 22) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, 64);
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(4, 4, w - 8, 56);
  g.fillStyle = fg;
  g.font = `bold ${fontPx}px Verdana`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 34);
  return new THREE.CanvasTexture(c);
}

// futsal goals on the north/south ends of the court
const goalMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
for (const zs of [-12.4, 12.4]) {
  const goal = new THREE.Group();
  for (const xs of [-1.5, 1.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), goalMat);
    post.position.set(xs, 0.65, 0);
    goal.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.12, 8), goalMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.3;
  goal.add(bar);
  goal.position.set(0, 0, zs);
  scene.add(goal);
}

// sponsor-style banners zip-tied to the fence, murals on the buildings
const FLAT_DECOR = [
  // [text, bg, fg, w, h, x, y, z, rotY, canvasW, fontPx]
  ['TAVARES BASTOS', '#1c4e9c', '#f6d23a', 4.4, 1.0, -8, 0.62, -12.62, 0, 256, 22],
  ['FUTEBOL DE RUA', '#149b44', '#f6d23a', 4.4, 1.0, 8, 0.62, -12.62, 0, 256, 22],
  ['RIO DE JANEIRO', '#b3402f', '#f2e8c8', 4.4, 1.0, -8, 0.62, 12.62, Math.PI, 256, 22],
  ['VAI BRASIL', '#f6d23a', '#149b44', 4.4, 1.0, 8, 0.62, 12.62, Math.PI, 256, 22],
  ['★ QUADRA TAVARES BASTOS ★', '#7a3f8c', '#ffd23a', 18, 3, 0, 2.4, -19.46, 0, 512, 34],
  ['FUTEBOL DE RUA ★ RIO', '#2f6f86', '#f2e8c8', 18, 3, 0, 2.4, 19.46, Math.PI, 512, 34],
];
for (const [text, bg, fg, w, h, x, y, z, ry, cw, fpx] of FLAT_DECOR) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: bannerTexture(text, bg, fg, cw, fpx) }),
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
}

// blue water tanks on the rooftops
const tankMat = new THREE.MeshLambertMaterial({ color: 0x2a6db8 });
for (const [x, z] of [[-36, -21], [6, -21], [-28, 21], [12, 21], [36, 21], [-38, 1], [38, -2]]) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 10), tankMat);
  t.position.set(x, 4.95, z);
  t.castShadow = true;
  scene.add(t);
}

// Brazil-flag painted roof on the northeast building (visible from the rooftops)
const flagGreen = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 3), new THREE.MeshLambertMaterial({ color: 0x149b44 }));
flagGreen.position.set(32, 4.53, -21);
scene.add(flagGreen);
const flagDiamond = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.9), new THREE.MeshLambertMaterial({ color: 0xf6d23a }));
flagDiamond.rotation.y = Math.PI / 4;
flagDiamond.position.set(32, 4.57, -21);
scene.add(flagDiamond);
const flagCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), new THREE.MeshLambertMaterial({ color: 0x1c4e9c }));
flagCircle.position.set(32, 4.61, -21);
scene.add(flagCircle);

// the favela climbing the hillsides beyond the east and north walls
const housePalette = KIND_PALETTE.wall;
function hillsideHouse(x, y, z, i) {
  const w = 5 + seededRnd() * 5;
  const d = 5 + seededRnd() * 4;
  const h = 3 + seededRnd() * 3;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: housePalette[i % housePalette.length] }),
  );
  m.position.set(x, y + h / 2, z);
  scene.add(m);
  if (seededRnd() < 0.3) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 8), tankMat);
    t.position.set(x, y + h + 0.45, z);
    scene.add(t);
  }
}
for (let tier = 0; tier < 4; tier++) {
  for (let i = 0; i < 12; i++) {
    // east hillside, behind Team 2 spawn
    hillsideHouse(64 + tier * 8 + seededRnd() * 3, tier * 2.6, -50 + i * 9 + seededRnd() * 4, i * 3 + tier);
    // north hillside
    hillsideHouse(-60 + i * 10 + seededRnd() * 4, tier * 2.6, -47 - tier * 8 - seededRnd() * 3, i * 5 + tier * 2);
  }
}

// clotheslines strung across the flank lanes
const clothPalette = [0xe3b54a, 0x6fbf8e, 0xd98a9e, 0xeef2ff, 0x5f9ec9];
function clothesline(x1, y1, z1, x2, y2, z2, n) {
  const a = new THREE.Vector3(x1, y1, z1);
  const b = new THREE.Vector3(x2, y2, z2);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineBasicMaterial({ color: 0x44403a }),
  );
  scene.add(line);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.7),
      new THREE.MeshLambertMaterial({ color: clothPalette[i % clothPalette.length], side: THREE.DoubleSide }),
    );
    cloth.position.lerpVectors(a, b, t);
    cloth.position.y -= 0.38;
    cloth.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    scene.add(cloth);
  }
}
clothesline(-32, 4.4, -22.6, -32, 4.8, -40.8, 4);
clothesline(8, 4.4, 22.6, 8, 4.8, 40.8, 5);

// Ray vs AABB (slab method). Returns distance along dir, or null.
function rayBox(o, d, box, maxT) {
  let t0 = 0;
  let t1 = maxT;
  for (const a of ['x', 'y', 'z']) {
    const inv = 1 / d[a];
    let ta = (box.min[a] - o[a]) * inv;
    let tb = (box.max[a] - o[a]) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return t0 > 0.001 ? t0 : null;
}

function rayWalls(o, d, maxT) {
  let best = null;
  for (const w of WALLS) {
    const t = rayBox(o, d, w, maxT);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

const _vs = new THREE.Vector3();
function raySphere(o, d, c, r) {
  const oc = _vs.copy(o).sub(c);
  const b = oc.dot(d);
  const disc = b * b - (oc.lengthSq() - r * r);
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0.001 ? t : null;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// ---------------------------------------------------------------- particles
const PARTICLE_N = 320;
const pPos = new Float32Array(PARTICLE_N * 3);
const pCol = new Float32Array(PARTICLE_N * 3);
const pVel = new Float32Array(PARTICLE_N * 3);
const pLife = new Float32Array(PARTICLE_N);
pPos.fill(-999);
const pGeom = new THREE.BufferGeometry();
pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeom, new THREE.PointsMaterial({
  size: 0.14, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
}));
points.frustumCulled = false;
scene.add(points);
let pNext = 0;

function spawnParticles(p, color, count, speed) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const j = pNext;
    pNext = (pNext + 1) % PARTICLE_N;
    pPos[j * 3] = p.x; pPos[j * 3 + 1] = p.y; pPos[j * 3 + 2] = p.z;
    pVel[j * 3] = (Math.random() - 0.5) * speed;
    pVel[j * 3 + 1] = Math.random() * speed * 0.8;
    pVel[j * 3 + 2] = (Math.random() - 0.5) * speed;
    pCol[j * 3] = c.r; pCol[j * 3 + 1] = c.g; pCol[j * 3 + 2] = c.b;
    pLife[j] = 0.35 + Math.random() * 0.25;
  }
}

function updateParticles(dt) {
  for (let j = 0; j < PARTICLE_N; j++) {
    if (pLife[j] <= 0) continue;
    pLife[j] -= dt;
    if (pLife[j] <= 0) { pPos[j * 3 + 1] = -999; continue; }
    pVel[j * 3 + 1] -= 9 * dt;
    pPos[j * 3] += pVel[j * 3] * dt;
    pPos[j * 3 + 1] += pVel[j * 3 + 1] * dt;
    pPos[j * 3 + 2] += pVel[j * 3 + 2] * dt;
  }
  pGeom.attributes.position.needsUpdate = true;
  pGeom.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------- tracers
const tracers = [];
function spawnTracer(from, to, color = 0xffd27a) {
  const geom = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geom, mat);
  scene.add(line);
  tracers.push({ line, t: 0.07 });
}

function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= dt;
    if (tr.t <= 0) {
      scene.remove(tr.line);
      tr.line.geometry.dispose();
      tr.line.material.dispose();
      tracers.splice(i, 1);
    } else {
      tr.line.material.opacity = tr.t / 0.07;
    }
  }
}

// ---------------------------------------------------------------- player
const GRAVITY = -12;
const PLAYER_HALF = 0.42;
const PLAYER_HEIGHT = 1.8;
const EYE = 1.62;

const player = {
  pos: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
  vy: 0, yaw: PLAYER_SPAWN.yaw, pitch: 0, grounded: true,
  hp: 100, armor: 0, money: ECON.start, alive: true, speedMult: 1,
  load: { primary: null, secondary: null, knife: { id: 'knife' }, nade: null },
  cur: 'secondary',
  cooldown: 0, reloading: 0, switchT: 0, zoomed: false,
  kills: 0, deaths: 0, shots: 0, hits: 0,
};

function freshInst(id) {
  return { id, mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
}

function resetLoadout() {
  player.load.primary = null;
  player.load.secondary = freshInst('pistol');
  player.load.nade = null;
  player.cur = 'secondary';
}

function curInst() { return player.load[player.cur]; }
function curSpec() { return WEAPONS[curInst().id]; }

function switchSlot(slot) {
  if (!player.load[slot] || player.cur === slot) return;
  player.cur = slot;
  player.reloading = 0;
  player.switchT = 0.35;
  setZoom(false);
  buildViewModel(curInst().id);
  updateHUD();
}

function giveWeapon(id) {
  const slot = WEAPONS[id].slot;
  player.load[slot] = freshInst(id);
  player.cur = slot;
  player.switchT = 0.35;
  setZoom(false);
  buildViewModel(id);
}

function playerOverlap(box) {
  const p = player.pos;
  return p.x + PLAYER_HALF > box.min.x && p.x - PLAYER_HALF < box.max.x
    && p.z + PLAYER_HALF > box.min.z && p.z - PLAYER_HALF < box.max.z
    && p.y + PLAYER_HEIGHT > box.min.y && p.y < box.max.y;
}

function resolveAxis(axis) {
  for (const box of WALLS) {
    if (!playerOverlap(box)) continue;
    const center = (box.min[axis] + box.max[axis]) / 2;
    if (player.pos[axis] < center) player.pos[axis] = box.min[axis] - PLAYER_HALF;
    else player.pos[axis] = box.max[axis] + PLAYER_HALF;
  }
}

function resolveVertical() {
  for (const box of WALLS) {
    if (!playerOverlap(box)) continue;
    if (player.vy <= 0 && player.pos.y > box.max.y - 0.7) {
      player.pos.y = box.max.y;
      player.vy = 0;
      player.grounded = true;
    } else if (player.vy > 0) {
      player.pos.y = box.min.y - PLAYER_HEIGHT;
      player.vy = 0;
    }
  }
}

const keys = {};
let mouseDown = false;
let deathT = 0;
let groundTime = 0;
let bobPhase = 0;
let bobAmp = 0;
let vmPitchKick = 0;

function updatePlayer(dt) {
  const canMove = state === 'live' || state === 'over';
  let f = 0;
  let r = 0;
  if (player.alive && canMove) {
    f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const len = Math.hypot(f, r) || 1;
    const speed = (curSpec().melee ? 7.6 : 6.8) * player.speedMult;
    const sy = Math.sin(player.yaw);
    const cy = Math.cos(player.yaw);
    const dx = (f / len) * -sy + (r / len) * cy;
    const dz = (f / len) * -cy + (r / len) * -sy;
    player.pos.x += dx * speed * dt;
    resolveAxis('x');
    player.pos.z += dz * speed * dt;
    resolveAxis('z');
    if (keys.Space && player.grounded) {
      // bhop: a hop chained inside the window banks speed; holding Space re-hops on landing
      if (groundTime < BHOP.window) player.speedMult = Math.min(BHOP.cap, player.speedMult * BHOP.gain);
      player.vy = 5.4;
      player.grounded = false;
    }
  }
  player.vy += GRAVITY * dt;
  player.pos.y += player.vy * dt;
  player.grounded = false;
  resolveVertical();
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vy = 0;
    player.grounded = true;
  }
  groundTime = player.grounded ? groundTime + dt : 0;
  if (groundTime > BHOP.window) player.speedMult = Math.max(1, player.speedMult - dt * 2.5);

  // weapon timers
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.switchT = Math.max(0, player.switchT - dt);
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      player.reloading = 0;
      const inst = curInst();
      const spec = WEAPONS[inst.id];
      const take = Math.min(spec.mag - inst.mag, inst.reserve);
      inst.mag += take;
      inst.reserve -= take;
      updateHUD();
    }
  }

  if (mouseDown && player.alive && state === 'live' && curSpec().auto) fire();

  // walk wobble: bob phase advances with footsteps, amplitude eases in/out
  const isMoving = player.alive && (f !== 0 || r !== 0);
  bobAmp += ((isMoving && player.grounded ? 1 : 0) - bobAmp) * Math.min(1, dt * 8);
  if (isMoving && player.grounded) bobPhase += dt * 6.5 * player.speedMult;

  // camera
  if (player.alive) {
    camera.position.set(
      player.pos.x,
      player.pos.y + EYE + Math.sin(bobPhase * 2) * 0.035 * bobAmp,
      player.pos.z,
    );
    camera.rotation.set(player.pitch, player.yaw, Math.sin(bobPhase) * 0.005 * bobAmp);
    if (!player.zoomed) {
      // subtle fov stretch sells bhop speed
      const tf = 74 + (player.speedMult - 1) * 10;
      if (Math.abs(camera.fov - tf) > 0.05) {
        camera.fov += (tf - camera.fov) * Math.min(1, dt * 8);
        camera.updateProjectionMatrix();
      }
    }
  } else {
    deathT = Math.min(1, deathT + dt * 2.2);
    camera.position.set(player.pos.x, player.pos.y + EYE - deathT * 1.1, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, deathT * 0.5);
  }

  // decay effects
  vmKick = Math.max(0, vmKick - dt * 0.6);
  vmPitchKick *= Math.pow(0.002, dt);
  muzzleLight.intensity *= Math.pow(0.0001, dt);
  if (muzzleLight.intensity < 0.05) muzzleLight.intensity = 0;
  vignetteFlash = Math.max(0, vignetteFlash - dt * 1.8);
  if (player.alive) els.vignette.style.opacity = vignetteFlash;

  // viewmodel: recoil kick + walk sway
  if (vmGroup.visible) {
    vmGroup.position.set(
      0.3 + Math.sin(bobPhase) * 0.015 * bobAmp,
      -0.3 - Math.abs(Math.sin(bobPhase * 2)) * 0.012 * bobAmp + (player.grounded ? 0 : 0.012),
      vmBaseZ + vmKick,
    );
    vmGroup.rotation.set(vmPitchKick, 0, Math.sin(bobPhase) * 0.03 * bobAmp);
  }

  // bhop speedometer
  setText(els.speedo, `≫ ${player.speedMult.toFixed(2)}×`);
  els.speedo.style.opacity = player.speedMult > 1.02 ? 0.9 : 0;
}

let vignetteFlash = 0;

function damagePlayer(d) {
  if (!player.alive) return;
  if (player.armor > 0) {
    player.hp -= Math.round(d * 0.55);
    player.armor = Math.max(0, player.armor - Math.round(d * 0.5));
  } else {
    player.hp -= Math.round(d);
  }
  vignetteFlash = 0.75;
  sfx.damage();
  if (player.hp <= 0) {
    player.hp = 0;
    playerDie();
  }
  updateHUD();
}

function playerDie() {
  player.alive = false;
  player.deaths++;
  deathT = 0;
  setZoom(false);
  vmGroup.visible = false;
  els.vignette.classList.add('dead');
  addKillfeed('Terrorists ⟶ you', true);
  banner('VOCÊ MORREU', '', true);
  setTimeout(() => { if (state === 'live') endRound(false); }, 1700);
}

// ---------------------------------------------------------------- viewmodel
const vmGroup = new THREE.Group();
camera.add(vmGroup);
let vmKick = 0;
const vmBaseZ = -0.55;

function vmMat(color, glow = 0) {
  const m = new THREE.MeshLambertMaterial({ color });
  if (glow) {
    m.emissive.setHex(color);
    m.emissiveIntensity = glow;
    m.color.setHex(0x15151a);
  }
  return m;
}

function vmBox(g, w, h, d, x, y, z, color, glow = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vmMat(color, glow));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// r2 tapers the far end (muzzle side for axis 'z', bottom for axis 'y')
function vmCyl(g, r, len, x, y, z, color, { glow = 0, seg = 12, axis = 'z', r2 = r } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), vmMat(color, glow));
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  else if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ring in the vertical plane along the barrel (trigger guards, sight rings)
function vmTorus(g, r, tube, x, y, z, color, { glow = 0, seg = 14 } = {}) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, seg), vmMat(color, glow));
  m.rotation.y = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

const GUNMETAL = 0x23252b;
const PLATE = 0x3a3d45;
const GOLD = 0xc9a227;
const IVORY = 0xd8d2c2;

// Coxinha: deep golden-brown teardrop — flat rounded base (so it stands up),
// round belly, pointed tip. Lathe profile is [radius, height] pairs, base to tip.
const COXINHA_BROWN = 0xa9611e;
const COXINHA_GEO = new THREE.LatheGeometry(
  [[0, 0], [0.05, 0], [0.066, 0.025], [0.07, 0.06], [0.058, 0.1], [0.034, 0.14], [0.012, 0.175], [0, 0.19]]
    .map(([r, y]) => new THREE.Vector2(r, y)),
  20,
);

function coxinhaMesh(scale) {
  const m = new THREE.Mesh(COXINHA_GEO, new THREE.MeshLambertMaterial({ color: COXINHA_BROWN }));
  m.scale.setScalar(scale);
  m.castShadow = true;
  return m;
}

// Exotic skins: angular sci-fi frames with emissive energy accents per weapon.
function buildViewModel(id) {
  vmGroup.clear();
  vmGroup.position.set(0.3, -0.3, vmBaseZ);
  const energy = WEAPONS[id].energy;
  if (id === 'knife') {
    // Severance Edge — strand energy blade
    vmBox(vmGroup, 0.035, 0.05, 0.2, 0, -0.02, 0.1, GUNMETAL);
    vmBox(vmGroup, 0.07, 0.018, 0.04, 0, 0.005, -0.005, PLATE);            // guard
    vmBox(vmGroup, 0.014, 0.022, 0.3, 0, 0.028, -0.17, PLATE);             // spine
    vmBox(vmGroup, 0.01, 0.05, 0.3, 0, -0.005, -0.17, energy, 1.4);        // blade
  } else if (id === 'pistol') {
    // Oitão — snub-nose .38 revolver with wood grips, yawed so the profile reads
    const g = new THREE.Group();
    g.rotation.y = 0.18;
    g.scale.setScalar(0.85);
    g.position.z = -0.04;
    vmGroup.add(g);
    vmBox(g, 0.05, 0.07, 0.22, 0, 0.025, 0.0, GUNMETAL);                   // frame
    vmCyl(g, 0.038, 0.08, 0, 0.04, -0.06, PLATE, { seg: 14 });             // cylinder drum
    vmCyl(g, 0.017, 0.2, 0, 0.055, -0.2, GUNMETAL, { seg: 14, r2: 0.014 }); // tapered barrel
    vmBox(g, 0.012, 0.016, 0.18, 0, 0.075, -0.2, PLATE);                   // top rib
    vmCyl(g, 0.006, 0.14, 0, 0.03, -0.19, PLATE, { seg: 8 });              // ejector rod
    vmCyl(g, 0.014, 0.01, 0, 0.055, -0.295, energy, { glow: 1.3, seg: 12 }); // muzzle ring
    vmBox(g, 0.007, 0.016, 0.01, 0, 0.088, -0.275, energy, 1.2);           // front sight
    vmBox(g, 0.016, 0.03, 0.02, 0, 0.07, 0.1, GUNMETAL);                   // hammer
    vmTorus(g, 0.026, 0.006, 0, -0.022, 0.04, GUNMETAL);                   // trigger guard
    vmCyl(g, 0.025, 0.09, 0, -0.06, 0.08, 0x6b4226, { seg: 10, axis: 'y', r2: 0.031 })
      .rotation.x = -0.35;                                                 // wood grip, swept back
  } else if (id === 'deagle') {
    // Sundown Verdict — solar hand cannon
    vmBox(vmGroup, 0.07, 0.08, 0.32, 0, 0.035, -0.1, GUNMETAL);
    vmCyl(vmGroup, 0.026, 0.3, 0, 0.075, -0.16, PLATE, { seg: 8 });        // octagonal barrel
    vmCyl(vmGroup, 0.03, 0.02, 0, 0.075, -0.305, energy, { glow: 1.5 });   // muzzle ring
    vmCyl(vmGroup, 0.05, 0.055, 0, 0, 0, GUNMETAL, { axis: 'x' });         // cylinder drum
    vmCyl(vmGroup, 0.018, 0.06, 0, 0, 0, energy, { glow: 1.5, axis: 'x' }); // glowing chambers
    vmBox(vmGroup, 0.012, 0.05, 0.2, 0.042, 0.07, -0.12, GOLD);            // gold filigree
    vmBox(vmGroup, 0.012, 0.05, 0.2, -0.042, 0.07, -0.12, GOLD);
    vmBox(vmGroup, 0.02, 0.045, 0.02, 0, 0.09, 0.06, GOLD);                // hammer
    vmBox(vmGroup, 0.055, 0.14, 0.07, 0, -0.085, 0.07, IVORY);             // grip
  } else if (id === 'smg') {
    // Static Hymn — arc SMG
    vmBox(vmGroup, 0.075, 0.1, 0.42, 0, 0, -0.12, GUNMETAL);
    vmBox(vmGroup, 0.082, 0.05, 0.2, 0, 0.04, -0.32, PLATE);               // shroud
    vmCyl(vmGroup, 0.02, 0.18, 0.05, 0.04, -0.32, energy, { glow: 1.2 });  // arc coils
    vmCyl(vmGroup, 0.02, 0.18, -0.05, 0.04, -0.32, energy, { glow: 1.2 });
    vmCyl(vmGroup, 0.014, 0.08, 0, 0.04, -0.45, PLATE);                    // barrel
    vmBox(vmGroup, 0.078, 0.012, 0.3, 0, -0.048, -0.15, energy, 1.0);      // belly strip
    vmBox(vmGroup, 0.05, 0.16, 0.06, 0, -0.12, -0.02, PLATE);              // mag
    vmBox(vmGroup, 0.05, 0.07, 0.12, 0, -0.01, 0.12, GUNMETAL);            // stock
  } else if (id === 'rifle') {
    // Parafal — FAL silhouette: long tapered barrel, gas tube, wood furniture
    const WOOD = 0x5f452a;
    const g = new THREE.Group();
    g.rotation.y = 0.12;
    vmGroup.add(g);
    vmBox(g, 0.065, 0.09, 0.38, 0, 0, -0.04, GUNMETAL);                    // receiver
    vmCyl(g, 0.03, 0.28, 0, -0.005, -0.36, WOOD, { seg: 12, r2: 0.024 });  // wood handguard
    vmCyl(g, 0.012, 0.32, 0, 0, -0.63, GUNMETAL, { seg: 12, r2: 0.01 });   // long barrel
    vmCyl(g, 0.015, 0.09, 0, 0, -0.81, PLATE, { seg: 10 });                // muzzle brake
    vmCyl(g, 0.017, 0.012, 0, 0, -0.86, energy, { glow: 1.3, seg: 10 });   // muzzle glow
    vmCyl(g, 0.008, 0.26, 0, 0.045, -0.36, PLATE, { seg: 8 });             // gas tube
    vmBox(g, 0.012, 0.05, 0.012, 0, 0.07, -0.5, GUNMETAL);                 // front sight post
    vmBox(g, 0.014, 0.022, 0.05, 0, 0.058, 0.1, PLATE);                    // rear sight
    vmBox(g, 0.012, 0.008, 0.16, 0, 0.052, -0.04, energy, 0.9);            // receiver energy line
    vmBox(g, 0.042, 0.125, 0.055, 0, -0.1, -0.13, PLATE).rotation.x = 0.15; // 20-rd mag
    vmCyl(g, 0.02, 0.09, 0, -0.07, 0.05, WOOD, { seg: 8, axis: 'y', r2: 0.025 })
      .rotation.x = -0.45;                                                 // wood pistol grip
    const stock = vmCyl(g, 0.036, 0.2, 0, -0.01, 0.22, WOOD, { seg: 10, r2: 0.022 });
    stock.scale.x = 0.65;                                                  // flattened oval stock
    vmBox(g, 0.05, 0.085, 0.02, 0, -0.01, 0.325, GUNMETAL);                // butt plate
  } else if (id === 'sniper') {
    // Stargazer's Lament — stasis rail sniper
    vmBox(vmGroup, 0.08, 0.1, 0.6, 0, 0, -0.18, GUNMETAL);
    vmCyl(vmGroup, 0.016, 0.5, 0, 0.02, -0.68, PLATE);                     // rail barrel
    vmCyl(vmGroup, 0.034, 0.016, 0, 0.02, -0.52, energy, { glow: 1.4 });   // coil rings
    vmCyl(vmGroup, 0.034, 0.016, 0, 0.02, -0.66, energy, { glow: 1.4 });
    vmCyl(vmGroup, 0.034, 0.016, 0, 0.02, -0.8, energy, { glow: 1.4 });
    vmCyl(vmGroup, 0.036, 0.24, 0, 0.1, -0.16, PLATE);                     // scope
    vmCyl(vmGroup, 0.03, 0.012, 0, 0.1, -0.038, energy, { glow: 1.5 });    // lens
    vmBox(vmGroup, 0.012, 0.07, 0.1, 0.05, -0.02, 0.06, energy, 0.8);      // crystal fins
    vmBox(vmGroup, 0.012, 0.07, 0.1, -0.05, -0.02, 0.06, energy, 0.8);
    vmBox(vmGroup, 0.05, 0.09, 0.14, 0, -0.03, 0.1, PLATE);                // stock
  } else if (id === 'nade') {
    // Coxinha — the deep-fried HE, tilted back in the palm with the tip up
    const cox = coxinhaMesh(1.4);
    cox.position.set(0, -0.1, -0.02);
    cox.rotation.x = 0.3;
    vmGroup.add(cox);
  }
  vmGroup.visible = true;
}

function setZoom(on) {
  const can = on && curInst().id === 'sniper';
  player.zoomed = can;
  camera.fov = can ? 24 : 74;
  camera.updateProjectionMatrix();
  els.scope.classList.toggle('hidden', !can);
  vmGroup.visible = !can && player.alive;
}

// ---------------------------------------------------------------- shooting
function fire() {
  if (paused || state !== 'live' || !player.alive) return;
  if (player.cooldown > 0 || player.switchT > 0 || player.reloading > 0) return;
  const inst = curInst();
  const spec = WEAPONS[inst.id];

  if (spec.melee) {
    player.cooldown = 60 / spec.rpm;
    sfx.knife();
    vmKick = 0.1;
    vmPitchKick = -0.35;
    const dir = camera.getWorldDirection(_v2).clone();
    const origin = camera.position;
    const hit = hitScan(origin, dir, 2.6);
    if (hit && hit.bot) hurtBot(hit.bot, spec.dmg * (hit.head ? 4 : 1), hit.head, 'knife');
    return;
  }

  if (spec.grenade) {
    player.cooldown = 0.4;
    vmKick = 0.12;
    vmPitchKick = -0.3;
    throwGrenade(spec);
    player.load.nade = null;
    player.cur = player.load.primary ? 'primary' : 'secondary';
    player.switchT = 0.5;
    buildViewModel(curInst().id);
    updateHUD();
    return;
  }

  if (inst.mag <= 0) {
    sfx.dry();
    player.cooldown = 0.25;
    return;
  }

  inst.mag--;
  player.shots++;
  player.cooldown = 60 / spec.rpm;
  sfx.shot(inst.id);
  vmKick = 0.07;
  vmPitchKick = Math.min(0.3, vmPitchKick + 0.05 + spec.recoil * 0.03);
  muzzleLight.color.setHex(spec.energy);
  muzzleLight.intensity = 2.6;
  const fwd = camera.getWorldDirection(_v2).clone();
  muzzleLight.position.copy(camera.position).addScaledVector(fwd, 1.2);

  // spread grows when moving / airborne, shrinks scoped
  let sp = spec.spread;
  const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
  if (moving) sp *= 2.1;
  if (!player.grounded) sp *= 3;
  if (player.zoomed) sp *= 0.06;
  const dir = fwd.clone();
  dir.x += (Math.random() - 0.5) * 2 * sp;
  dir.y += (Math.random() - 0.5) * 2 * sp;
  dir.z += (Math.random() - 0.5) * 2 * sp;
  dir.normalize();

  const origin = camera.position;
  const hit = hitScan(origin, dir, 200);
  const end = _v1.copy(origin).addScaledVector(dir, hit ? hit.t : 200).clone();

  const tipStart = origin.clone().addScaledVector(fwd, 1.0).add(
    new THREE.Vector3(Math.cos(player.yaw) * 0.22, -0.18, -Math.sin(player.yaw) * 0.22),
  );
  spawnTracer(tipStart, end, spec.energy);

  if (hit && hit.bot) {
    hurtBot(hit.bot, spec.dmg * (hit.head ? 4 : 1), hit.head, inst.id);
    spawnParticles(end, 0x7a1f12, 6, 2.2);
  } else if (hit) {
    spawnParticles(end, 0xcbb088, 5, 1.8);
  }

  // recoil
  player.pitch = Math.min(1.55, player.pitch + spec.recoil * 0.012);
  player.yaw += (Math.random() - 0.5) * spec.recoil * 0.004;

  updateHUD();
}

// Nearest hit among walls and bots: { t, bot|null, head }
function hitScan(origin, dir, maxT) {
  let best = null;
  const wallT = rayWalls(origin, dir, maxT);
  if (wallT !== null) best = { t: wallT, bot: null, head: false };
  for (const bot of bots) {
    if (!bot.alive) continue;
    const headT = raySphere(origin, dir, _v1.set(bot.pos.x, 1.85, bot.pos.z), 0.3);
    const bodyBox = {
      min: _boxMin.set(bot.pos.x - 0.45, 0, bot.pos.z - 0.45),
      max: _boxMax.set(bot.pos.x + 0.45, 1.7, bot.pos.z + 0.45),
    };
    const bodyT = rayBox(origin, dir, bodyBox, maxT);
    let t = null;
    let head = false;
    if (headT !== null && (bodyT === null || headT < bodyT)) { t = headT; head = true; } else if (bodyT !== null) t = bodyT;
    if (t !== null && t < maxT && (best === null || t < best.t)) best = { t, bot, head };
  }
  return best;
}
const _boxMin = new THREE.Vector3();
const _boxMax = new THREE.Vector3();

function startReload() {
  const inst = curInst();
  const spec = WEAPONS[inst.id];
  if (spec.melee || player.reloading > 0 || inst.mag >= spec.mag || inst.reserve <= 0) return;
  player.reloading = spec.reload;
  setZoom(false);
  sfx.reload();
  updateHUD();
}

function hurtBot(bot, dmg, head, weaponId) {
  bot.hp -= dmg;
  bot.alert = true;
  player.hits++;
  sfx.hit(head);
  els.hitmarker.classList.add('show');
  els.hitmarker.classList.toggle('head', head);
  clearTimeout(hitmarkT);
  hitmarkT = setTimeout(() => els.hitmarker.classList.remove('show'), 90);
  bot.flash(0.1);
  if (bot.hp <= 0) killBot(bot, head, weaponId);
}
let hitmarkT = 0;

function killBot(bot, head, weaponId) {
  bot.die();
  player.kills++;
  const award = WEAPONS[weaponId]?.killAward ?? 300;
  player.money = Math.min(ECON.cap, player.money + award);
  sfx.kill();
  addKillfeed(`you ⟶ ${bot.name}${head ? ' [HEAD]' : ''}  +$${award}`);
  updateHUD();
  if (bots.every((b) => !b.alive) && state === 'live') endRound(true);
}

// ---------------------------------------------------------------- grenades
const grenades = [];
const NADE_R = 0.12;
const boomLight = new THREE.PointLight(0xffb060, 0, 26);
scene.add(boomLight);

function pointInWalls(p, r) {
  for (const b of WALLS) {
    if (p.x + r > b.min.x && p.x - r < b.max.x
      && p.y + r > b.min.y && p.y - r < b.max.y
      && p.z + r > b.min.z && p.z - r < b.max.z) return true;
  }
  return false;
}

function throwGrenade(spec) {
  const fwd = camera.getWorldDirection(_v2).clone();
  const mesh = coxinhaMesh(1.6);
  const pos = camera.position.clone().addScaledVector(fwd, 0.6);
  mesh.position.copy(pos);
  scene.add(mesh);
  grenades.push({
    mesh, spec, pos,
    vel: fwd.multiplyScalar(spec.throwSpeed).add(_v1.set(0, 2.5, 0)),
    fuse: spec.fuse,
    spin: 4 + Math.random() * 6,
  });
  sfx.toss();
}

function clearGrenades() {
  for (const g of grenades) scene.remove(g.mesh);
  grenades.length = 0;
  boomLight.intensity = 0;
}

function updateGrenades(dt) {
  boomLight.intensity *= Math.pow(0.0001, dt);
  if (boomLight.intensity < 0.05) boomLight.intensity = 0;
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.fuse -= dt;
    if (g.fuse <= 0) {
      grenades.splice(i, 1);
      explode(g);
      continue;
    }
    g.vel.y += GRAVITY * dt;
    // axis-by-axis move with bounce, same AABB list the bullets use
    g.pos.x += g.vel.x * dt;
    if (pointInWalls(g.pos, NADE_R)) { g.pos.x -= g.vel.x * dt; g.vel.x *= -0.45; }
    g.pos.z += g.vel.z * dt;
    if (pointInWalls(g.pos, NADE_R)) { g.pos.z -= g.vel.z * dt; g.vel.z *= -0.45; }
    g.pos.y += g.vel.y * dt;
    if (pointInWalls(g.pos, NADE_R)) { g.pos.y -= g.vel.y * dt; g.vel.y *= -0.5; g.vel.x *= 0.75; g.vel.z *= 0.75; }
    if (g.pos.y < NADE_R) {
      g.pos.y = NADE_R;
      g.vel.y *= -0.45;
      g.vel.x *= 0.72;
      g.vel.z *= 0.72;
      if (Math.abs(g.vel.y) < 0.8) g.vel.y = 0;
    }
    g.mesh.position.copy(g.pos);
    if (g.vel.lengthSq() > 1) {
      g.mesh.rotation.x += g.spin * dt;
      g.mesh.rotation.z += g.spin * 0.6 * dt;
    } else {
      // at rest a coxinha rights itself onto its base, as is proper
      g.mesh.rotation.x *= Math.pow(0.01, dt);
      g.mesh.rotation.z *= Math.pow(0.01, dt);
    }
  }
}

function explode(g) {
  scene.remove(g.mesh);
  const { dmg, radius } = g.spec;
  const px = g.pos.x;
  const py = g.pos.y + 0.2;
  const pz = g.pos.z;
  sfx.explode();
  boomLight.position.set(px, py + 0.5, pz);
  boomLight.intensity = 6;
  spawnParticles(g.pos, 0xffb347, 40, 9);
  spawnParticles(g.pos, 0x8a4a16, 26, 6); // fried crumbs
  spawnParticles(g.pos, 0xfff0c0, 12, 12);

  // linear falloff to the blast radius; walls soak most of it
  const blast = (tx, ty, tz) => {
    const d = Math.hypot(tx - px, ty - py, tz - pz);
    if (d > radius) return 0;
    let f = 1 - d / radius;
    if (d > 0.01) {
      const dir = _v1.set(tx - px, ty - py, tz - pz).normalize();
      if (rayWalls(_v2.set(px, py, pz), dir, d) !== null) f *= 0.35;
    }
    return dmg * f;
  };

  for (const bot of bots) {
    if (!bot.alive) continue;
    const d = blast(bot.pos.x, 1.0, bot.pos.z);
    if (d > 0) {
      bot.hp -= d;
      bot.alert = true;
      bot.flash(0.15);
      if (bot.hp <= 0) killBot(bot, false, 'nade');
    }
  }
  const pd = blast(player.pos.x, player.pos.y + 0.9, player.pos.z);
  if (pd > 0) damagePlayer(pd);
}

// ---------------------------------------------------------------- bots
const ADJ = WAYPOINTS.map(() => []);
for (const [a, b] of WAY_EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

function nearestWp(x, z) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = (WAYPOINTS[i][0] - x) ** 2 + (WAYPOINTS[i][1] - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function bfsPath(from, to) {
  if (from === to) return [to];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const q = [from];
  prev[from] = from;
  while (q.length) {
    const n = q.shift();
    for (const m of ADJ[n]) {
      if (prev[m] !== -1) continue;
      prev[m] = n;
      if (m === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) { cur = prev[cur]; path.unshift(cur); }
        return path;
      }
      q.push(m);
    }
  }
  return [from];
}

const botGeo = {
  torso: new THREE.BoxGeometry(0.85, 1.0, 0.45),
  leg: new THREE.BoxGeometry(0.3, 0.7, 0.3),
  head: new THREE.SphereGeometry(0.26, 12, 10),
  band: new THREE.BoxGeometry(0.56, 0.1, 0.56),
  gun: new THREE.BoxGeometry(0.09, 0.11, 0.85),
};

class Bot {
  constructor(name, x, z) {
    this.name = name;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = Math.atan2(-(PLAYER_SPAWN.x - x), -(PLAYER_SPAWN.z - z));
    this.hp = 100;
    this.alive = true;
    this.alert = false;
    this.hadLOS = false;
    this.reactT = 0;
    this.fireT = 0.6;
    this.repathT = 0;
    this.path = null;
    this.pathI = 0;
    this.strafePhase = Math.random() * 6;
    this.deadT = 0;
    this.flashT = 0;
    this.walkT = Math.random() * 6;

    const g = new THREE.Group();
    this.torsoMat = new THREE.MeshLambertMaterial({ color: 0x8f7a4e });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x4a4438 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xc8987a });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0xb03a2a });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x222220 });
    const torso = new THREE.Mesh(botGeo.torso, this.torsoMat);
    torso.position.y = 1.2;
    const legL = new THREE.Mesh(botGeo.leg, legMat);
    legL.position.set(-0.2, 0.35, 0);
    const legR = new THREE.Mesh(botGeo.leg, legMat);
    legR.position.set(0.2, 0.35, 0);
    const head = new THREE.Mesh(botGeo.head, headMat);
    head.position.y = 1.85;
    const band = new THREE.Mesh(botGeo.band, bandMat);
    band.position.y = 1.95;
    const gun = new THREE.Mesh(botGeo.gun, gunMat);
    gun.position.set(0.26, 1.32, -0.45);
    for (const m of [torso, legL, legR, head, band, gun]) m.castShadow = true;
    g.add(torso, legL, legR, head, band, gun);
    g.position.copy(this.pos);
    g.rotation.y = this.yaw;
    scene.add(g);
    this.mesh = g;
  }

  canSee() {
    if (!player.alive) return false;
    const from = new THREE.Vector3(this.pos.x, 1.78, this.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + EYE, player.pos.z);
    const d = to.sub(from);
    const dist = d.length();
    d.normalize();
    // ~200° awareness — only directly behind is a blind spot
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    if (fx * d.x + fz * d.z < -0.2) return false;
    const wallT = rayWalls(from, d, dist);
    return wallT === null;
  }

  flash(t) {
    this.flashT = t;
    this.torsoMat.emissive.setHex(0x661111);
  }

  die() {
    this.alive = false;
    this.deadT = 0;
  }

  fireAtPlayer() {
    const from = new THREE.Vector3(this.pos.x, 1.5, this.pos.z);
    const target = new THREE.Vector3(player.pos.x, player.pos.y + EYE - 0.25, player.pos.z);
    const dist = from.distanceTo(target);
    sfx.shot('enemy');
    const chance = Math.max(0.08, 0.55 - dist * 0.0055);
    if (Math.random() < chance) {
      spawnTracer(from, target, 0xffb060);
      damagePlayer(9 + Math.random() * 9);
    } else {
      const miss = target.clone();
      miss.x += (Math.random() - 0.5) * 3;
      miss.y += (Math.random() - 0.5) * 2;
      miss.z += (Math.random() - 0.5) * 3;
      spawnTracer(from, miss, 0xffb060);
    }
  }

  update(dt) {
    if (!this.alive) {
      this.deadT += dt;
      // crumple, then sink away
      this.mesh.rotation.x = -Math.PI / 2 * Math.min(1, this.deadT * 4);
      if (this.deadT > 2.5) this.mesh.position.y -= dt * 1.5;
      return;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.torsoMat.emissive.setHex(0x000000);
    }

    const los = this.canSee();
    if (los && !this.hadLOS) this.reactT = 0.45 + Math.random() * 0.3;
    this.hadLOS = los;

    if (los) {
      this.alert = true;
      const desired = Math.atan2(-(player.pos.x - this.pos.x), -(player.pos.z - this.pos.z));
      let dy = desired - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 10);
      if (this.reactT > 0) {
        this.reactT -= dt;
      } else {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireAtPlayer();
          this.fireT = 0.55 + Math.random() * 0.5;
        }
      }
      // strafe in place
      this.strafePhase += dt * 2.4;
      const px = Math.cos(this.yaw);
      const pz = -Math.sin(this.yaw);
      this.pos.x += px * Math.cos(this.strafePhase) * 2.0 * dt;
      this.pos.z += pz * Math.cos(this.strafePhase) * 2.0 * dt;
    } else {
      this.fireT = Math.max(this.fireT, 0.25);
      if (this.alert && player.alive) {
        this.repathT -= dt;
        if (this.repathT <= 0 || !this.path || this.pathI >= this.path.length) {
          this.path = bfsPath(nearestWp(this.pos.x, this.pos.z), nearestWp(player.pos.x, player.pos.z));
          this.pathI = 0;
          this.repathT = 2;
        }
      } else if (!this.path || this.pathI >= this.path.length) {
        const goal = Math.floor(Math.random() * WAYPOINTS.length);
        this.path = bfsPath(nearestWp(this.pos.x, this.pos.z), goal);
        this.pathI = 0;
      }
      if (this.path && this.pathI < this.path.length) {
        const [tx, tz] = WAYPOINTS[this.path[this.pathI]];
        const dx = tx - this.pos.x;
        const dz = tz - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.8) {
          this.pathI++;
        } else {
          const speed = this.alert ? 5.2 : 4.2;
          this.pos.x += (dx / dist) * speed * dt;
          this.pos.z += (dz / dist) * speed * dt;
          const desired = Math.atan2(-dx, -dz);
          let dy = desired - this.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          this.yaw += dy * Math.min(1, dt * 8);
          this.walkT += dt * 10;
        }
      }
    }

    this.mesh.position.set(this.pos.x, Math.abs(Math.sin(this.walkT)) * 0.05, this.pos.z);
    this.mesh.rotation.y = this.yaw;
  }

  dispose() {
    scene.remove(this.mesh);
    this.torsoMat.dispose();
  }
}

let bots = [];

function spawnBots() {
  for (const b of bots) b.dispose();
  bots = BOT_SPAWNS.map(([x, z], i) => new Bot(`Bot_${BOT_NAMES[i]}`, x, z));
}

// ---------------------------------------------------------------- rounds / economy
let state = 'menu'; // menu | buy | live | over | matchend
let paused = false;
let tState = 0;
let round = 0;
let ctScore = 0;
let tScore = 0;
let survivedLast = true;

function startMatch() {
  ctScore = 0;
  tScore = 0;
  round = 0;
  player.money = ECON.start;
  player.kills = 0;
  player.deaths = 0;
  player.shots = 0;
  player.hits = 0;
  player.armor = 0;
  survivedLast = false; // forces fresh pistol loadout
  els.hud.classList.remove('hidden');
  startRound();
}

function startRound() {
  round++;
  player.pos.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  player.yaw = PLAYER_SPAWN.yaw;
  player.pitch = 0;
  player.vy = 0;
  player.speedMult = 1;
  player.hp = 100;
  player.alive = true;
  player.cooldown = 0;
  player.reloading = 0;
  deathT = 0;
  els.vignette.classList.remove('dead');
  els.vignette.style.opacity = 0;
  if (!survivedLast) {
    resetLoadout();
    player.armor = 0;
  } else {
    for (const slot of ['primary', 'secondary']) {
      const inst = player.load[slot];
      if (inst) { inst.mag = WEAPONS[inst.id].mag; inst.reserve = WEAPONS[inst.id].reserve; }
    }
  }
  setZoom(false);
  buildViewModel(curInst().id);
  clearGrenades();
  spawnBots();
  state = 'buy';
  tState = BUY_TIME;
  openBuyMenu(true);
  sfx.roundStart();
  banner(`RODADA ${round}`, 'compre seu equipamento', false, 1.8);
  updateHUD();
}

function goLive() {
  state = 'live';
  tState = ROUND_TIME;
  openBuyMenu(false);
  banner('VAI VAI VAI', '', false, 1.2);
}

function endRound(win) {
  if (state !== 'live') return;
  state = 'over';
  tState = 3.2;
  survivedLast = player.alive;
  if (win) {
    ctScore++;
    player.money = Math.min(ECON.cap, player.money + ECON.win);
    banner('CONTRA-TERRORISTAS VENCEM', `+$${ECON.win}`);
    sfx.win();
  } else {
    tScore++;
    player.money = Math.min(ECON.cap, player.money + ECON.loss);
    banner('TERRORISTAS VENCEM', `+$${ECON.loss}`, true);
    sfx.lose();
  }
  updateHUD();
}

function matchEnd() {
  state = 'matchend';
  document.exitPointerLock();
  const won = ctScore > tScore;
  els.matchResult.textContent = won ? 'VITÓRIA!' : 'DERROTA';
  els.matchScore.textContent = `${ctScore} — ${tScore}`;
  const acc = player.shots ? Math.round((player.hits / player.shots) * 100) : 0;
  els.matchStats.textContent = `Kills ${player.kills} · Deaths ${player.deaths} · Accuracy ${acc}%`;
  els.matchOverlay.classList.remove('hidden');
  els.hud.classList.add('hidden');
}

// ---------------------------------------------------------------- HUD
const textCache = {};
function setText(el, v) {
  if (textCache[el.id] !== v) {
    textCache[el.id] = v;
    el.textContent = v;
  }
}

function updateHUD() {
  setText(els.hp, String(player.hp));
  els.hp.classList.toggle('low', player.hp <= 25);
  setText(els.armor, String(player.armor));
  setText(els.money, String(player.money));
  setText(els.scoreCT, `CT ${ctScore}`);
  setText(els.scoreT, `${tScore} T`);
  setText(els.roundLabel, `ROUND ${round}`);
  const alive = bots.filter((b) => b.alive).length;
  setText(els.enemies, `ENEMIES ${alive}/${bots.length || 5}`);
  const inst = curInst();
  const spec = WEAPONS[inst.id];
  setText(els.weapon, spec.skin.toUpperCase());
  setText(els.ammo, spec.melee ? '—' : spec.grenade ? `× ${inst.mag}` : `${inst.mag} / ${inst.reserve}`);
  els.ammo.classList.toggle('reloading', player.reloading > 0);
}

function updateTimer() {
  const t = Math.max(0, Math.ceil(tState));
  const m = Math.floor(t / 60);
  const s = String(t % 60).padStart(2, '0');
  setText(els.timer, `${m}:${s}`);
  els.timer.classList.toggle('low', state === 'live' && t <= 10);
}

let bannerT = 0;
function banner(main, sub = '', bad = false, dur = 2.6) {
  els.bannerMain.textContent = main;
  els.bannerMain.classList.toggle('bad', bad);
  els.bannerSub.textContent = sub;
  els.banner.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => els.banner.classList.remove('show'), dur * 1000);
}

function addKillfeed(text, bad = false) {
  const div = document.createElement('div');
  div.textContent = text;
  if (bad) div.classList.add('bad');
  els.killfeed.prepend(div);
  while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
  setTimeout(() => div.remove(), 4500);
}

// ---------------------------------------------------------------- buy menu
let buyOpen = false;

function openBuyMenu(open) {
  buyOpen = open && state === 'buy';
  els.buymenu.classList.toggle('hidden', !buyOpen);
  if (buyOpen) renderBuyMenu();
}

function renderBuyMenu() {
  const rows = BUY_ITEMS.map((item, i) => {
    const spec = item.id === 'armor' ? item : WEAPONS[item.id];
    const owned = item.id === 'armor'
      ? player.armor >= 100
      : (player.load[WEAPONS[item.id].slot]?.id === item.id);
    const afford = player.money >= spec.price;
    const skin = item.id === 'armor' || spec.skin === spec.name ? '' : ` <em>${WEAPONS[item.id].skin}</em>`;
    return `<div class="buy-item ${afford ? '' : 'dim'} ${owned ? 'owned' : ''}">
      <span class="key">${i + 1}</span><span class="name">${spec.name}${skin}</span>
      <span class="price">$${spec.price}</span></div>`;
  }).join('');
  els.buymenu.innerHTML = `<h2>LOJA</h2>${rows}
    <div class="foot">APERTE 1-${BUY_ITEMS.length} PARA COMPRAR · B PARA FECHAR</div>`;
}

function purchase(i) {
  const item = BUY_ITEMS[i];
  if (!item) return;
  const spec = item.id === 'armor' ? item : WEAPONS[item.id];
  if (player.money < spec.price) { sfx.dry(); return; }
  if (item.id === 'armor') {
    if (player.armor >= 100) return;
    player.armor = 100;
  } else {
    giveWeapon(item.id);
  }
  player.money -= spec.price;
  sfx.buy();
  renderBuyMenu();
  updateHUD();
}

// ---------------------------------------------------------------- scoreboard
function renderScoreboard() {
  const botRows = bots.map((b) => `<tr class="${b.alive ? '' : 'dead'}"><td>${b.name}</td><td>T</td><td>${b.alive ? 'alive' : 'dead'}</td></tr>`).join('');
  els.scoreboard.innerHTML = `<h2>QUADRA TAVARES BASTOS — CT ${ctScore} : ${tScore} T</h2>
    <table><tr><th>PLAYER</th><th>TEAM</th><th>STATUS</th></tr>
    <tr class="you"><td>you · ${player.kills}K / ${player.deaths}D</td><td>CT</td><td>${player.alive ? 'alive' : 'dead'}</td></tr>
    ${botRows}</table>`;
}

// ---------------------------------------------------------------- input
const SENS = 0.0022;

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || !player.alive) return;
  const s = player.zoomed ? SENS * 0.4 : SENS;
  player.yaw -= e.movementX * s;
  player.pitch -= e.movementY * s;
  player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
});

document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) {
    mouseDown = true;
    fire();
  } else if (e.button === 2) {
    setZoom(!player.zoomed);
  }
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (state !== 'menu' && state !== 'matchend') {
      renderScoreboard();
      els.scoreboard.classList.remove('hidden');
    }
    return;
  }
  keys[e.code] = true;
  if (document.pointerLockElement !== canvas) return;

  if (buyOpen && e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= BUY_ITEMS.length) purchase(n - 1);
    return;
  }
  switch (e.code) {
    case 'Digit1': switchSlot('primary'); break;
    case 'Digit2': switchSlot('secondary'); break;
    case 'Digit3': switchSlot('knife'); break;
    case 'Digit4': switchSlot('nade'); break;
    case 'KeyR': if (state === 'live') startReload(); break;
    case 'KeyB': openBuyMenu(!buyOpen); break;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    els.scoreboard.classList.add('hidden');
  }
  keys[e.code] = false;
});

// ---------------------------------------------------------------- pointer lock / overlays
els.overlay.addEventListener('click', () => {
  sfx.unlock();
  canvas.requestPointerLock();
});

els.againBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sfx.unlock();
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    els.overlay.classList.add('hidden');
    els.matchOverlay.classList.add('hidden');
    if (state === 'menu' || state === 'matchend') startMatch();
    paused = false;
  } else if (state !== 'menu' && state !== 'matchend') {
    paused = true;
    mouseDown = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    els.overlayMsg.textContent = 'PAUSED — CLICK TO RESUME';
    els.overlay.classList.remove('hidden');
  }
});

// ---------------------------------------------------------------- main loop
let last = performance.now();
let orbitT = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'menu' || state === 'matchend') {
    // idle orbit camera as the menu background
    orbitT += dt * 0.1;
    camera.position.set(Math.sin(orbitT) * 42, 26, Math.cos(orbitT) * 42);
    camera.lookAt(0, 0, 0);
    vmGroup.visible = false;
  } else if (!paused) {
    updatePlayer(dt);
    updateGrenades(dt);
    if (state === 'buy') {
      tState -= dt;
      if (tState <= 0) goLive();
    } else if (state === 'live') {
      for (const bot of bots) bot.update(dt);
      tState -= dt;
      if (tState <= 0) endRound(true); // defenders held the site
    } else if (state === 'over') {
      for (const bot of bots) { if (!bot.alive) bot.update(dt); }
      tState -= dt;
      if (tState <= 0) {
        if (ctScore >= MATCH_WIN_ROUNDS || tScore >= MATCH_WIN_ROUNDS) matchEnd();
        else startRound();
      }
    }
    updateTimer();
    if (!els.scoreboard.classList.contains('hidden')) renderScoreboard();
  }

  updateParticles(dt);
  updateTracers(dt);
  renderer.render(scene, camera);
}

// Console cheats, in the spirit of sv_cheats 1. Open devtools and help yourself.
window.impulse101 = () => {
  player.money = ECON.cap;
  updateHUD();
  return `$${player.money}`;
};
window.cs_give = (id) => {
  if (!WEAPONS[id] || id === 'knife') return `usage: cs_give('${Object.keys(WEAPONS).filter((k) => k !== 'knife').join("' | '")}')`;
  giveWeapon(id);
  updateHUD();
  return WEAPONS[id].skin;
};
window.cs_tp = (x, z, yaw = player.yaw) => {
  player.pos.set(x, 0, z);
  player.vy = 0;
  player.yaw = yaw;
  player.pitch = 0;
  return `tp ${x}, ${z}`;
};

buildViewModel('pistol');
resetLoadout();
requestAnimationFrame(loop);
