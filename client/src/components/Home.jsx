import { useState } from 'react';
import { socket } from '../socket.js';
import SettingsForm from './SettingsForm.jsx';
import BrowseRooms from './BrowseRooms.jsx';
import { Plus, LogIn, Globe } from 'lucide-react';
import '../moderation.css';

// [id, label, icon]. Labels name the PLACE (a tab); the big button inside names the ACTION.
const MODES = [
  ['create', 'Create', Plus],
  ['join', 'Join', LogIn],
  ['browse', 'Browse', Globe],
];

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

export default function Home({ onEnter, notice, onDismissNotice }) {
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
    <>
      {/* Separate bar ABOVE the card: it navigates between modes, the card below is the active mode's form. */}
      <nav className="mode-nav" role="tablist">
        {MODES.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={mode === id ? 'tab active' : 'tab'}
            onClick={() => { setMode(id); setError(''); }}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

    <div className="card">
      {notice && (
        <div className="notice bad">
          <span>{notice}</span>
          <button type="button" className="tab" onClick={onDismissNotice}>OK</button>
        </div>
      )}
      <label>
        Your name
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ritik" />
      </label>

      {mode === 'create' && (
        <form onSubmit={handleCreate}>
          <p className="muted mode-help">Set up a new game and invite your friends.</p>
          <SettingsForm settings={settings} onChange={setSettings} />
          <button type="submit" className="cta" disabled={busy}>
            <Plus size={20} /> {busy ? 'Creating...' : 'Create room'}
          </button>
        </form>
      )}

      {mode === 'browse' && (
        <BrowseRooms busy={busy} onJoin={(roomCode) => submit('join_room', { roomId: roomCode, playerName: name })} />
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin}>
          <p className="muted mode-help">Enter the 6-digit code your friend shared.</p>
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
          <button type="submit" className="cta" disabled={busy}>
            <LogIn size={20} /> {busy ? 'Joining...' : 'Join room'}
          </button>
        </form>
      )}

      {error && <p className="bad">{error}</p>}
    </div>
    </>
  );
}
