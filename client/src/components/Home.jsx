import { useState } from 'react';
import { socket } from '../socket.js';
import SettingsForm from './SettingsForm.jsx';

const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  isPrivate: true,
};

export default function Home({ onEnter }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Shared handler: emit an event, wait for the server's ack, then enter or show error.
  const submit = (event, payload) => {
    setError('');
    setBusy(true);
    socket.emit(event, payload, (res) => {
      setBusy(false);
      if (res.ok) onEnter(res);
      else setError(res.error);
    });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    submit('create_room', { hostName: name, settings });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    submit('join_room', { roomId: code, playerName: name });
  };

  return (
    <div className="card">
      <label>
        Your name
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ritik" />
      </label>

      <div className="tabs">
        <button type="button" className={mode === 'create' ? 'tab active' : 'tab'} onClick={() => setMode('create')}>Create room</button>
        <button type="button" className={mode === 'join' ? 'tab active' : 'tab'} onClick={() => setMode('join')}>Join room</button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate}>
          <SettingsForm settings={settings} onChange={setSettings} />
          <button type="submit" disabled={busy}>Create room</button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <label>
            Room code
            <input
              value={code}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 digits"
            />
          </label>
          <button type="submit" disabled={busy}>Join room</button>
        </form>
      )}

      {error && <p className="bad">{error}</p>}
    </div>
  );
}
