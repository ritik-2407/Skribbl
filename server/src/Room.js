import { Player } from './Player.js';
import { DrawingBoard } from './DrawingBoard.js';

// A Room owns: its players, its settings, and its phase.
// It also knows how to broadcast to everyone inside it.
// (In v3 a Game object will live inside the Room and own rounds/scoring.)
export class Room {
  constructor(io, code, settings, hostId) {
    this.io = io;
    this.code = code;
    this.settings = settings;
    this.hostId = hostId;
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'ended'
    this.players = new Map(); // socket.id -> Player (Map keeps insertion order = join order)
    this.drawerId = null; // who may draw right now (v3 rotates this per round)
    this.board = new DrawingBoard();
    this.game = null; // created when the host starts the game
  }

  get isFull() {
    return this.players.size >= this.settings.maxPlayers;
  }

  get isEmpty() {
    return this.players.size === 0;
  }

  addPlayer(id, name) {
    const player = new Player(id, name);
    this.players.set(id, player);
    return player;
  }

  // Returns true if a player was actually removed.
  removePlayer(id) {
    const removed = this.players.delete(id);
    // If the host leaves, the next-oldest player becomes host.
    if (removed && id === this.hostId && !this.isEmpty) {
      this.hostId = this.players.keys().next().value;
    }
    return removed;
  }

  // Names must be unique per room (case-insensitive), otherwise the scoreboard and chat are ambiguous.
  hasName(name) {
    const n = name.toLowerCase();
    return [...this.players.values()].some((p) => p.name.toLowerCase() === n);
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  playersPublic() {
    return [...this.players.values()].map((p) => p.toPublic(this.hostId));
  }

  // Everything a client needs to render the lobby.
  toPublic() {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      drawerId: this.drawerId,
      settings: this.settings,
      players: this.playersPublic(),
    };
  }

  // A SMALL summary for the public room browser. Deliberately leaves out player names
  // and everything else a stranger doesn't need before joining.
  toListing() {
    return {
      code: this.code,
      hostName: this.players.get(this.hostId)?.name ?? 'Unknown',
      playerCount: this.players.size,
      maxPlayers: this.settings.maxPlayers,
      rounds: this.settings.rounds,
      drawTime: this.settings.drawTime,
    };
  }

  // Joinable by a stranger browsing: public, still in the lobby, and has space.
  get isListable() {
    return !this.settings.isPrivate && this.phase === 'lobby' && !this.isFull && !this.isEmpty;
  }

  // Everyone has pressed ready except the host (host starts the game).
  allGuestsReady() {
    return [...this.players.values()].every((p) => p.id === this.hostId || p.isReady);
  }

  // Send to ONE player (a socket always has a private room named after its own id).
  emitTo(playerId, event, payload) {
    this.io.to(playerId).emit(event, payload);
  }

  broadcastPlayers() {
    this.broadcast('players_update', { players: this.playersPublic(), hostId: this.hostId });
  }

  // "Play again": back to a clean lobby with the same players.
  resetToLobby() {
    this.game?.destroy();
    this.game = null;
    this.phase = 'lobby';
    this.drawerId = null;
    this.board.clear();
    for (const p of this.players.values()) {
      p.score = 0;
      p.isReady = false;
    }
  }

  // Send to every socket that has joined this room's Socket.IO "room".
  broadcast(event, payload) {
    this.io.to(this.code).emit(event, payload);
  }
}
