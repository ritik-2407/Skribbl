import { randomInt } from 'node:crypto';
import { Room } from './Room.js';

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

  getRoom(code) {
    return this.rooms.get(code);
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }
}
