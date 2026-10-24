import { useState } from 'react';
import { socket } from '../socket.js';
import SettingsForm from './SettingsForm.jsx';
import BrowseRooms from './BrowseRooms.jsx';

const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  isPrivate: true,
};

// Invite link: https://site/?room=482913 opens straight on the Join tab with the code filled in.
// Read once, validated (6 digits only) - never trust anything from the URL.
function codeFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('room') ?? '';
  return /^\d{6}$/.test(raw) ? raw : '';
}

export default function Home({ onEnter }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(codeFromUrl); // lazy init: runs once
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mode, setMode] = useState(() => (codeFromUrl() ? 'join' : 'create')); // 'create' | 'join' | 'browse'
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
        <button type="button" className={mode === 'join' ? 'tab active' : 'tab'} onClick={() => setMode('join')}>Join with code</button>
        <button type="button" className={mode === 'browse' ? 'tab active' : 'tab'} onClick={() => setMode('browse')}>Browse public</button>
      </div>

      {mode === 'create' && (
        <form onSubmit={handleCreate}>
          <SettingsForm settings={settings} onChange={setSettings} />
          <button type="submit" disabled={busy}>Create room</button>
        </form>
      )}

      {mode === 'browse' && (
        <BrowseRooms busy={busy} onJoin={(roomCode) => submit('join_room', { roomId: roomCode, playerName: name })} />
      )}

      {mode === 'join' && (
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
