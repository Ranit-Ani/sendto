export default function OptionsFields({ options, onChange }) {
  function set(key, value) {
    onChange({ ...options, [key]: value });
  }

  return (
    <details className="options">
      <summary>Privacy &amp; Expiry Options (Optional)</summary>
      <div className="options__body">
        <label className="field">
          <span className="field__label">Password Protection:</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Set a password"
            value={options.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">View Limit:</span>
          <input
            className="input"
            type="number"
            min="1"
            max="10000"
            placeholder="Unlimited"
            aria-describedby="view-limit-hint"
            value={options.maxViews}
            onChange={(e) => set('maxViews', e.target.value)}
          />
          <span className="field__hint" id="view-limit-hint">
            How many times the code can be opened. Downloads after opening don&apos;t count.
          </span>
        </label>

        <div className="field">
          <span className="field__label">Expiration Timer:</span>
          <div className="options-grid">
            <input
              className="input"
              type="number"
              min="0"
              max="720"
              placeholder="Hrs"
              value={options.expiryHours}
              onChange={(e) => set('expiryHours', e.target.value)}
            />
            <input
              className="input"
              type="number"
              min="0"
              max="59"
              placeholder="Mins"
              value={options.expiryMinutes}
              onChange={(e) => set('expiryMinutes', e.target.value)}
            />
          </div>
        </div>
      </div>
    </details>
  );
}

export const EMPTY_OPTIONS = { password: '', maxViews: '', expiryHours: '', expiryMinutes: '' };