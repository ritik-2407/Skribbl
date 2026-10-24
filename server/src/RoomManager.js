import { randomInt } from 'node:crypto';
import { Room } from './Room.js';

const MAX_PUBLIC_LISTING = 10;

// Registry of all live rooms. Lives in memory (so: run a single server instance).
export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // code -> Room
  }

  // 6-digit numeric code, e.g. "042917". Retry until unused.
  generateCode() {
    let code;
    do {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId, settings) {
    const code = this.generateCode();
    const room = new Room(this.io, code, settings, hostId);
    this.rooms.set(code, room);
    return room;
  }

  // Public rooms a stranger could join right now: fullest first (most active),
  // capped so the response stays small no matter how many rooms exist.
  listPublic(limit = MAX_PUBLIC_LISTING) {
    return [...this.rooms.values()]
      .filter((room) => room.isListable)
      .sort((a, b) => b.players.size - a.players.size)
      .slice(0, limit)
      .map((room) => room.toListing());
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }
}
