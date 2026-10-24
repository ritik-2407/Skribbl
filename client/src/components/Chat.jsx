import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

export default function Chat({ messages, game, isDrawer, hasGuessed }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The client only picks a label; the SERVER decides whether it's really a guess.
  const isGuessing = game.phase === 'drawing' && !isDrawer && !hasGuessed;

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit(isGuessing ? 'guess' : 'chat', { text });
    setText('');
  };

  return (
    <div className="chat card">
      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={m.system ? `msg system ${m.kind ?? ''}` : m.private ? 'msg private' : 'msg'}>
            {m.system ? m.text : <><b>{m.playerName}:</b> {m.text}</>}
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <input
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          placeholder={isGuessing ? 'Type your guess...' : isDrawer ? 'Chat (only guessers who got it see this)' : 'Chat...'}
        />
      </form>
    </div>
  );
}
