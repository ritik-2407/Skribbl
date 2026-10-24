import { useState } from 'react';
import { socket } from '../socket.js';

export default function GameOver({ gameOver, room, playerId }) {
  const [error, setError] = useState('');
  const isHost = room.hostId === playerId;
  const { winner, isTie, leaderboard } = gameOver;

  const playAgain = () =>
    socket.emit('play_again', {}, (res) => {
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="card">
      <h2>🏆 {isTie ? "It's a tie!" : `${winner?.name} wins!`}</h2>
      <ol className="players">
        {leaderboard.map((p) => (
          <li key={p.id}>
            <span>#{p.rank} {p.name}{p.id === playerId && ' (you)'}</span>
            <b>{p.score}</b>
          </li>
        ))}
      </ol>
      {isHost ? <button onClick={playAgain}>Play again</button> : <p className="muted">Waiting for the host to start a new game...</p>}
      {error && <p className="bad">{error}</p>}
    </div>
  );
}
