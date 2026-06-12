// Peer-to-peer co-op transport: PeerJS over WebRTC data channels.
// Host-authoritative — the host browser runs bots, rounds, and damage; guests
// run their own movement and report it. No game server: only PeerJS's free
// signaling cloud is used, so the game still deploys as a static site.
import * as PeerNS from 'peerjs';

const Peer = PeerNS.Peer ?? PeerNS.default;
const PREFIX = 'cubestrike-rio-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

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

  host(onCode, onError) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    this.peer = new Peer(PREFIX + code);
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

  join(code, onError) {
    this.peer = new Peer();
    this.peer.on('error', (e) => onError(e.type));
    this.peer.on('open', () => {
      const conn = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => { this.role = 'guest'; this._route({ t: 'connected' }, 'host'); });
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
