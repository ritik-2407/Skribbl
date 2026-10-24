import { pickWords } from './words.js';
import { matchGuess } from './wordMatch.js';

const CHOOSE_SECONDS = 15;
const ROUND_END_SECONDS = Number(process.env.ROUND_END_SECONDS) || 5;
const MAX_MESSAGE_LENGTH = 100;

// The game state machine for ONE room. The server owns all of this state;
// clients only send intentions (pick word, guess) and render what we broadcast.
//
//   choosing -> drawing -> round_end -> (next turn: choosing ...) -> ended
//
// Terminology: a "round" = every player draws once. A "turn" = one player drawing.
export class Game {
  constructor(room) {
    this.room = room;
    this.phase = 'idle';
    this.round = 1;
    this.queue = []; // players who still have to draw in the current round
    this.drawerId = null;
    this.word = null;
    this.wordOptions = [];
    this.hint = []; // e.g. ['_', '_', 'a', ' ', '_']
    this.hintTimes = []; // elapsed-seconds at which to reveal a letter
    this.hintsGiven = 0;
    this.timeLeft = 0;
    this.guessed = new Map(); // playerId -> points earned this turn
    this.usedWords = new Set();
    this.timer = null; // setInterval: ticks every second
    this.timeout = null; // setTimeout: delay between turns
    this.destroyed = false;
  }

  get settings() {
    return this.room.settings;
  }

  presentIds() {
    return [...this.room.players.keys()];
  }

  guesserIds() {
    return this.presentIds().filter((id) => id !== this.drawerId);
  }

  // ---------------------------------------------------------------- lifecycle

  start() {
    this.round = 1;
    this.queue = this.presentIds();
    this.nextTurn();
  }

  // MUST be called when the room is deleted, otherwise the interval keeps
  // running forever (a classic memory/CPU leak).
  destroy() {
    this.destroyed = true;
    this.stopTimers();
  }

  stopTimers() {
    clearInterval(this.timer);
    clearTimeout(this.timeout);
    this.timer = null;
    this.timeout = null;
  }

  startTimer(seconds) {
    clearInterval(this.timer);
    this.timeLeft = seconds;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  // ---------------------------------------------------------------- turns

  nextTurn() {
    if (this.destroyed) return;
    this.stopTimers();

    this.queue = this.queue.filter((id) => this.room.players.has(id)); // skip people who left
    if (this.queue.length === 0) {
      if (this.round >= this.settings.rounds) return this.endGame();
      this.round += 1;
      this.queue = this.presentIds();
    }
    if (this.room.players.size < 2) return this.endGame();

    this.drawerId = this.queue.shift();
    this.room.drawerId = this.drawerId; // drawing events are authorized against this
    this.phase = 'choosing';
    this.word = null;
    this.guessed = new Map();
    this.hint = [];
    this.hintTimes = [];
    this.hintsGiven = 0;
    this.room.board.clear();
    this.room.broadcast('canvas_clear');

    this.wordOptions = pickWords(this.settings.wordCount, this.settings.wordMode, this.usedWords);

    // Only the drawer receives the word choices.
    for (const id of this.presentIds()) {
      this.room.emitTo(id, 'round_start', {
        drawerId: this.drawerId,
        round: this.round,
        totalRounds: this.settings.rounds,
        drawTime: this.settings.drawTime,
        wordOptions: id === this.drawerId ? this.wordOptions : null,
      });
    }
    this.startTimer(CHOOSE_SECONDS);
    this.emitStates();
  }

  // Called when the drawer picks (validated) or when the choose-timer runs out.
  beginDrawing(word) {
    this.word = word;
    this.usedWords.add(word);
    this.phase = 'drawing';
    this.hint = [...word].map((ch) => (ch === ' ' ? ' ' : '_'));

    const letters = this.hint.filter((c) => c === '_').length;
    // Reveal at most half of the letters, however many hints the host configured.
    const hintCount =
      this.settings.wordMode === 'hidden' ? 0 : Math.min(this.settings.hints, Math.floor(letters / 2));
    const { drawTime } = this.settings;
    this.hintTimes = Array.from({ length: hintCount }, (_, i) =>
      Math.floor((drawTime * (i + 1)) / (hintCount + 1))
    );
    this.startTimer(drawTime);
    this.emitStates();
  }

  chooseWord(playerId, word) {
    if (this.phase !== 'choosing' || playerId !== this.drawerId) return false;
    if (!this.wordOptions.includes(word)) return false; // can't invent your own word
    this.beginDrawing(word);
    return true;
  }

  tick() {
    this.timeLeft -= 1;
    this.room.broadcast('timer', { timeLeft: this.timeLeft });

    if (this.phase === 'drawing') {
      const elapsed = this.settings.drawTime - this.timeLeft;
      if (this.hintsGiven < this.hintTimes.length && elapsed >= this.hintTimes[this.hintsGiven]) {
        this.hintsGiven += 1;
        this.revealLetter();
        this.emitStates();
      }
    }

    if (this.timeLeft <= 0) {
      if (this.phase === 'choosing') {
        const options = this.wordOptions;
        this.beginDrawing(options[Math.floor(Math.random() * options.length)]); // auto-pick
      } else if (this.phase === 'drawing') {
        this.endTurn();
      }
    }
  }

  revealLetter() {
    const hidden = this.hint.map((c, i) => (c === '_' ? i : -1)).filter((i) => i !== -1);
    if (hidden.length === 0) return;
    const i = hidden[Math.floor(Math.random() * hidden.length)];
    this.hint[i] = this.word[i];
  }

  endTurn() {
    if (this.phase !== 'drawing') return;
    this.stopTimers();

    // Drawer earns the AVERAGE of what guessers earned (guessers who failed count as 0),
    // so drawing something guessable fast is rewarded, drawing nonsense is not.
    const guessers = this.guesserIds().length;
    const total = [...this.guessed.values()].reduce((a, b) => a + b, 0);
    const drawerPoints = guessers > 0 ? Math.round(total / guessers) : 0;
    const drawer = this.room.getPlayer(this.drawerId);
    if (drawer) drawer.score += drawerPoints;

    const gained = new Map(this.guessed);
    if (drawer && drawerPoints > 0) gained.set(this.drawerId, drawerPoints);

    this.phase = 'round_end';
    const scores = [...this.room.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score, gained: gained.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);

    this.room.broadcast('round_end', { word: this.word, scores, nextDrawer: this.peekNextDrawer() });
    this.room.broadcastPlayers();
    this.emitStates();
    this.timeout = setTimeout(() => this.nextTurn(), ROUND_END_SECONDS * 1000);
  }

  peekNextDrawer() {
    const id = this.queue.find((pid) => this.room.players.has(pid));
    const p = id && this.room.getPlayer(id);
    return p ? { id: p.id, name: p.name } : null;
  }

  endGame() {
    if (this.phase === 'ended') return;
    this.stopTimers();
    this.phase = 'ended';
    this.room.phase = 'ended';
    this.room.drawerId = null;

    const leaderboard = [...this.room.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const winner = leaderboard[0] ?? null;
    const isTie = leaderboard.length > 1 && leaderboard[0].score === leaderboard[1].score;
    this.emitStates();
    this.room.broadcast('game_over', { winner, isTie, leaderboard });
  }

  // ---------------------------------------------------------------- players leaving

  onPlayerLeft(id) {
    if (this.phase === 'ended' || this.destroyed) return;
    if (this.room.players.size < 2) return this.endGame();

    if (id === this.drawerId) {
      if (this.phase === 'drawing') this.endTurn(); // reveal word, no points for the missing drawer
      else if (this.phase === 'choosing') this.nextTurn();
      return;
    }
    // A guesser left: maybe everyone remaining has already guessed.
    this.guessed.delete(id);
    if (this.phase === 'drawing' && this.allGuessed()) this.endTurn();
  }

  allGuessed() {
    const guessers = this.guesserIds();
    return guessers.length > 0 && guessers.every((id) => this.guessed.has(id));
  }

  // ---------------------------------------------------------------- chat & guessing

  // Single entry point for the 'guess' and 'chat' events, so the SERVER decides
  // what a message is, never the client.
  handleMessage(player, rawText) {
    const text = typeof rawText === 'string' ? rawText.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
    if (!text) return;

    if (this.phase === 'drawing') {
      const isDrawer = player.id === this.drawerId;
      if (!isDrawer && !this.guessed.has(player.id)) return this.processGuess(player, text);

      // Drawer + people who already guessed chat privately, so they can't leak the word.
      for (const id of [this.drawerId, ...this.guessed.keys()]) {
        this.room.emitTo(id, 'chat_message', {
          playerId: player.id,
          playerName: player.name,
          text,
          private: true,
        });
      }
      return;
    }
    this.room.broadcast('chat_message', { playerId: player.id, playerName: player.name, text });
  }

  processGuess(player, text) {
    const verdict = matchGuess(text, this.word);

    if (verdict === 'correct') {
      // Faster guess = more points: 100 base + up to 400 for time remaining.
      const ratio = Math.max(0, this.timeLeft) / this.settings.drawTime;
      const points = 100 + Math.round(400 * ratio);
      player.score += points;
      this.guessed.set(player.id, points);

      // Note: we announce WHO guessed, never the text.
      this.room.broadcast('guess_result', {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points,
      });
      this.room.broadcastPlayers();
      this.emitStates(); // so clients know who has guessed
      if (this.allGuessed()) this.endTurn();
      return;
    }

    // Wrong guesses are visible to everyone as chat (that's how skribbl works).
    this.room.broadcast('chat_message', { playerId: player.id, playerName: player.name, text });
    if (verdict === 'close') {
      this.room.emitTo(player.id, 'guess_result', {
        correct: false,
        close: true,
        playerId: player.id,
        playerName: player.name,
        points: 0,
      });
    }
  }

  // ---------------------------------------------------------------- state sync

  // What THIS player is allowed to know. The secret word only goes to the drawer
  // (or to everyone once the turn is over).
  stateFor(playerId) {
    const isDrawer = playerId === this.drawerId;
    const revealed = this.phase === 'round_end' || this.phase === 'ended';
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: this.settings.rounds,
      drawerId: this.drawerId,
      timeLeft: this.timeLeft,
      word: isDrawer || revealed ? this.word : null,
      hint: this.settings.wordMode === 'hidden' ? null : this.hint,
      guessed: [...this.guessed.keys()],
    };
  }

  emitStates() {
    for (const id of this.presentIds()) this.room.emitTo(id, 'game_state', this.stateFor(id));
  }
}
