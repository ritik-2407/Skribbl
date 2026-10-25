import { Timer, LogOut } from 'lucide-react';
import { socket } from '../socket.js';
import Canvas from './Canvas.jsx';
import Chat from './Chat.jsx';
import Scoreboard from './Scoreboard.jsx';
import GameOver from './GameOver.jsx';

function Hint({ game, isDrawer }) {
  if (game.phase === 'choosing') return <span>{isDrawer ? 'Choose a word!' : 'Waiting for the drawer to choose...'}</span>;
  if (game.word) return <strong className="word">{game.word}</strong>; // drawer, or revealed at round end
  if (!game.hint) return <span>Hidden word mode - good luck!</span>;
  return (
    <span className="hint">
      {game.hint.map((c, i) => (
        <span key={i} className={c === ' ' ? 'gap' : 'letter'}>{c === ' ' ? '' : c}</span>
      ))}
      <small> ({game.hint.filter((c) => c !== ' ').length})</small>
    </span>
  );
}

export default function Game({ room, playerId, game, messages, wordOptions, roundEnd, gameOver, leaveRoom, kickPlayer }) {
  if (game.phase === 'ended' && gameOver) {
    return <GameOver gameOver={gameOver} room={room} playerId={playerId} onLeave={leaveRoom} />;
  }

  const isHost = room.hostId === playerId;

  // Leaving mid-game ends your turn in the game and drops you from the scoreboard, so confirm first.
  const leave = () => {
    if (window.confirm('Leave the game? You will lose your place and score.')) leaveRoom();
  };
  const kick = (p) => {
    if (!window.confirm(`Remove ${p.name} from the game?`)) return;
    kickPlayer(p.id, (res) => {
      if (!res?.ok) window.alert(res?.error ?? 'Could not remove player');
    });
  };

  const isDrawer = game.drawerId === playerId;
  const hasGuessed = game.guessed.includes(playerId);
  const drawer = room.players.find((p) => p.id === game.drawerId);
  const canDraw = isDrawer && game.phase === 'drawing';

  return (
    <div className="game">
      <div className="game-top card">
        <span>Round {game.round}/{game.totalRounds}</span>
        <Hint game={game} isDrawer={isDrawer} />
        <span className={game.timeLeft <= 10 ? 'timer low' : 'timer'}><Timer size={18} className="ico" /> {Math.max(0, game.timeLeft)}s</span>
        <button type="button" className="tab" onClick={leave}><LogOut size={16} /> Leave</button>
      </div>

      <div className="game-body">
        <Scoreboard
          players={room.players}
          drawerId={game.drawerId}
          guessed={game.guessed}
          playerId={playerId}
          canKick={isHost}
          onKick={kick}
        />

        <div className="stage card">
          <p className="muted">{isDrawer ? 'You are drawing!' : `${drawer?.name ?? 'Someone'} is drawing`}</p>
          <div className="stage-canvas">
            <Canvas isDrawer={canDraw} />

            {game.phase === 'choosing' && (
              <div className="overlay">
                {isDrawer && wordOptions ? (
                  <>
                    <h3>Pick a word to draw</h3>
                    <div className="row">
                      {wordOptions.map((w) => (
                        <button key={w} onClick={() => socket.emit('word_chosen', { word: w })}>{w}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <h3>{drawer?.name} is choosing a word...</h3>
                )}
              </div>
            )}

            {game.phase === 'round_end' && roundEnd && (
              <div className="overlay">
                <h3>The word was <span className="word">{roundEnd.word}</span></h3>
                <ul className="players">
                  {roundEnd.scores.map((s) => (
                    <li key={s.id}>{s.name}: {s.score} {s.gained > 0 && <b className="ok">+{s.gained}</b>}</li>
                  ))}
                </ul>
                <p className="muted">{roundEnd.nextDrawer ? `Next up: ${roundEnd.nextDrawer.name}` : 'Next round / results coming up...'}</p>
              </div>
            )}
          </div>
        </div>

        <Chat messages={messages} game={game} isDrawer={isDrawer} hasGuessed={hasGuessed} />
      </div>
    </div>
  );
}
