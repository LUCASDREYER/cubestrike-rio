// Peer-to-peer co-op transport: PeerJS over WebRTC data channels.
// Host-authoritative — the host browser runs bots, rounds, and damage; guests
// run their own movement and report it. No game server: only PeerJS's free
// signaling cloud is used, so the game still deploys as a static site.
import * as PeerNS from 'peerjs';

const Peer = PeerNS.Peer ?? PeerNS.default;
const PREFIX = 'cubestrike-rio-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

// STUN gets most real-world pairs connected (different machines/networks).
// It fails between different browsers on ONE machine and behind strict NATs —
// those need a TURN relay, and free keyless TURN no longer exists. To add one:
// create a free Metered account (https://www.metered.ca/tools/openrelay/,
// 20GB/month), then paste your credentials URL below, e.g.
// 'https://yourapp.metered.live/api/v1/turn/credentials?apiKey=YOUR_KEY'
const TURN_CREDENTIALS_URL = '';

let iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];
const iceReady = (async () => {
  if (!TURN_CREDENTIALS_URL) return;
  try {
    const res = await fetch(TURN_CREDENTIALS_URL);
    const servers = await res.json();
    if (Array.isArray(servers) && servers.length) iceServers = servers;
  } catch { /* keep STUN-only */ }
})();

const peerOpts = () => ({ config: { iceServers } });

export const net = {
  role: 'off', // 'off' | 'host' | 'guest'
  peer: null,
  conns: new Map(), // host: peerId -> DataConnection
  hostConn: null,   // guest: connection to the host
  handlers: {},
  get active() { return this.role !== 'off'; },
  get isHost() { return this.role === 'host'; },
  get isGuest() { return this.role === 'guest'; },
  get myId() { return this.peer?.id ?? null; },

  // handlers receive (msg, fromPeerId); 'join'/'leave'/'connected'/'hostlost'
  // are synthetic connection events, everything else is a wire message
  on(type, fn) { this.handlers[type] = fn; },
  _route(msg, fromId) { this.handlers[msg.t]?.(msg, fromId); },

  async host(onCode, onError) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    await iceReady;
    this.peer = new Peer(PREFIX + code, peerOpts());
    this.peer.on('open', () => { this.role = 'host'; onCode(code); });
    this.peer.on('error', (e) => onError(e.type));
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        this._route({ t: 'join' }, conn.peer);
      });
      conn.on('data', (msg) => this._route(msg, conn.peer));
      conn.on('close', () => {
        if (this.conns.delete(conn.peer)) this._route({ t: 'leave' }, conn.peer);
      });
    });
  },

  async join(code, onError, onProgress = () => {}) {
    await iceReady;
    this.peer = new Peer(peerOpts());
    this.peer.on('error', (e) => onError(e.type));
    this.peer.on('open', () => {
      onProgress('signaling');
      const conn = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      this.hostConn = conn;
      let opened = false;
      conn.on('iceStateChanged', (s) => { if (!opened) onProgress(s); });
      conn.on('error', (e) => onError(e.type ?? 'connection'));
      setTimeout(() => { if (!opened && this.role !== 'guest') onError('timeout'); }, 25000);
      conn.on('open', () => {
        opened = true;
        this.role = 'guest';
        this._route({ t: 'connected' }, 'host');
      });
      conn.on('data', (msg) => this._route(msg, 'host'));
      conn.on('close', () => {
        if (this.role === 'guest') { this.role = 'off'; this._route({ t: 'hostlost' }, 'host'); }
      });
    });
  },

  toHost(msg) { if (this.hostConn?.open) this.hostConn.send(msg); },
  toGuest(id, msg) { const c = this.conns.get(id); if (c?.open) c.send(msg); },
  broadcast(msg, exceptId = null) {
    for (const [id, c] of this.conns) if (id !== exceptId && c.open) c.send(msg);
  },
};
