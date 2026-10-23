// Ranges mirror the server's LIMITS (server re-validates anyway).
const FIELDS = [
  { key: 'maxPlayers', label: 'Max players', min: 2, max: 20 },
  { key: 'rounds', label: 'Rounds', min: 2, max: 10 },
  { key: 'drawTime', label: 'Draw time (sec)', min: 15, max: 240 },
  { key: 'wordCount', label: 'Word choices', min: 1, max: 5 },
  { key: 'hints', label: 'Hints', min: 0, max: 5 },
];

export default function SettingsForm({ settings, onChange }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });

  return (
    <div className="settings">
      {FIELDS.map((f) => (
        <label key={f.key}>
          {f.label}
          <input
            type="number"
            min={f.min}
            max={f.max}
            value={settings[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}
      <label>
        Word mode
        <select value={settings.wordMode} onChange={(e) => set('wordMode', e.target.value)}>
          <option value="normal">Normal</option>
          <option value="hidden">Hidden</option>
          <option value="combination">Combination</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.isPrivate}
          onChange={(e) => set('isPrivate', e.target.checked)}
        />
        Private room
      </label>
    </div>
  );
}
