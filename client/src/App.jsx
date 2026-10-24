import { useGameSocket } from './useGameSocket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';

// App only decides WHICH screen to show. All socket logic lives in useGameSocket.
export default function App() {
  const s = useGameSocket();

  if (!s.connected) {
    return <main className="container"><h1>Skribbl Clone</h1><p>Connecting to server...</p></main>;
  }

  const inGame = s.room && (s.room.phase === 'playing' || s.room.phase === 'ended');

  return (
    <main className={inGame ? 'container wide' : 'container'}>
      <h1>Skribbl Clone</h1>
      {!s.room && <Home onEnter={s.enterRoom} />}
      {s.room && s.room.phase === 'lobby' && <Lobby room={s.room} playerId={s.playerId} />}
      {inGame && s.game && <Game {...s} />}
    </main>
  );
}
