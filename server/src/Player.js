// One connected person. id === socket.id, so we can map socket -> player instantly.
export class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.score = 0;
    this.isReady = false;
  }

  // Only what other clients are allowed to see. (Later: never leak private data here.)
  toPublic(hostId) {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isReady: this.isReady,
      isHost: this.id === hostId,
    };
  }
}
