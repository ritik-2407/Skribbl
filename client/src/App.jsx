import { Pencil } from 'lucide-react';
import { useGameSocket } from './useGameSocket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';

function Logo() {
  return (
    <h1 className="logo">
      <Pencil size={44} className="logo-ico" strokeWidth={2.5} /> Skribbl
    </h1>
  );
}

// App only decides WHICH screen to show. All socket logic lives in useGameSocket.
export default function App() {
  const s = useGameSocket();

  if (!s.connected) {
    return (
      <main className="container">
        <Logo />
        <div className="card"><p className="muted">Connecting to server...</p></div>
      </main>
    );
  }

  const inGame = s.room && (s.room.phase === 'playing' || s.room.phase === 'ended');

  return (
    <main className={inGame ? 'container wide' : 'container'}>
      {!inGame && <Logo />} {/* hidden in-game: vertical space goes to the canvas and tools */}
      {!s.room && <Home onEnter={s.enterRoom} notice={s.notice} onDismissNotice={s.dismissNotice} />}
      {s.room && s.room.phase === 'lobby' && (
        <Lobby room={s.room} playerId={s.playerId} onLeave={s.leaveRoom} onKick={s.kickPlayer} />
      )}
      {inGame && s.game && <Game {...s} />}
    </main>
  );
}
