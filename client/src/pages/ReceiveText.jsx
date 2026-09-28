import { useEffect, useState } from 'react';
import { useReceiveFlow } from '../hooks/useReceiveFlow.js';
import { api, copyText, formatRemaining } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import BusyButton from '../components/BusyButton.jsx';
import InfoBlocks from '../components/InfoBlocks.jsx';

const INFO_ITEMS = [
  {
    icon: '🚀',
    title: 'How to Receive Text?',
    body: (
      <ol className="info-steps">
        <li>
          Get the <strong>6-digit code</strong> from the sender.
        </li>
        <li>Enter it in the box above.</li>
        <li>
          If it's private, enter the <strong>password</strong>.
        </li>
        <li>Copy the text, or download it in your preferred format.</li>
      </ol>
    )
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    body: (
      <p>
        Text is transferred over encrypted connections and automatically{' '}
        <span className="accent">permanently deleted</span> after 24 hours (or sooner if the sender set a limit).
      </p>
    )
  },
  {
    icon: '📝',
    title: 'Download Formats',
    body: (
      <p>
        Save shared text as plain <span className="accent">.txt</span>, or another supported format — pick the
        option from the dropdown before downloading.
      </p>
    )
  }
];

export default function ReceiveText() {
  const toast = useToast();
  const [payload, setPayload] = useState(null);
  const [formats, setFormats] = useState([{ id: 'txt', label: 'Plain text', extension: 'txt' }]);
  const [format, setFormat] = useState('txt');

  const {
    step,
    codeValue,
    setCodeValue,
    codeError,
    passwordValue,
    setPasswordValue,
    passwordError,
    checking,
    unlocking,
    lookup,
    unlock,
    reset
  } = useReceiveFlow({
    type: 'text',
    otherTypePath: '/receive-files',
    onOpen: (data) => {
      setPayload(data);
      toast('Text unlocked.', 'success');
    }
  });

  useEffect(() => {
    let cancelled = false;
    api('/api/formats')
      .then(({ formats: list }) => {
        if (!cancelled && list && list.length) {
          setFormats(list);
          setFormat(list[0].id);
        }
      })
      .catch(() => {
        /* keep the plain-text fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleReload() {
    window.location.reload();
  }

  async function handleCopyText() {
    if (!payload) return;
    const ok = await copyText(payload.text);
    toast(ok ? 'Text copied.' : 'Copy failed — select the text and copy it manually.', ok ? 'success' : 'error');
  }

  function handleDownload() {
    if (!payload) return;
    const url = `/api/shares/${payload.code}/export?format=${format}&token=${encodeURIComponent(payload.token)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast(`Preparing your .${format} download…`, 'info', 2500);
  }

  const lines = payload ? payload.text.split('\n').length : 0;
  const textLead = payload
    ? `${payload.text.length.toLocaleString()} characters across ${lines.toLocaleString()} line${lines === 1 ? '' : 's'}.`
    : '';

  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>Receive Text</h1>
        <p>Enter your 6-digit code</p>
      </div>

      {step === 'code' && (
        <section className="card" id="code-card">
          {codeError && (
            <div className="notice notice--error" role="alert">
              {codeError.html ? <span dangerouslySetInnerHTML={{ __html: codeError.html }} /> : codeError.message}
            </div>
          )}

          <label className="field">
            <span className="sr-only">6-digit code</span>
            <input
              className="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              aria-label="6-digit code"
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookup();
              }}
              autoFocus
            />
          </label>

          <BusyButton
            className="btn btn--green btn--lg btn--block"
            busy={checking}
            busyLabel="Checking…"
            type="button"
            onClick={() => lookup()}
          >
            Receive Text
          </BusyButton>
        </section>
      )}

      {step === 'password' && (
        <section className="card" id="password-card">
          <h2>Enter Password</h2>
          <p className="card__lead">This share is password protected.</p>

          {passwordError && (
            <div className="notice notice--error" role="alert">
              {passwordError}
            </div>
          )}

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') unlock();
              }}
              autoFocus
            />
          </label>

          <BusyButton
            className="btn btn--green btn--lg btn--block"
            busy={unlocking}
            busyLabel="Opening…"
            type="button"
            onClick={unlock}
          >
            Continue
          </BusyButton>
          <button
            className="btn btn--ghost btn--block mt-lg"
            type="button"
            onClick={() => {
              setPayload(null);
              reset();
            }}
          >
            Use a different code
          </button>
        </section>
      )}

      {step === 'content' && payload && (
        <section className="card" id="text-card">
          <h2>Shared text</h2>
          <p className="card__lead">{textLead}</p>

          <div className="stat-row">
            <span className="pill">Expires in {formatRemaining(payload.expiresAt)}</span>
            {payload.viewsLeft !== null && payload.viewsLeft !== undefined && (
              <span className={`pill${payload.viewsLeft > 0 ? '' : ' pill--warn'}`}>
                {payload.viewsLeft > 0
                  ? `${payload.viewsLeft} view${payload.viewsLeft > 1 ? 's' : ''} left`
                  : 'Last view — save it now'}
              </span>
            )}
          </div>

          <div className="text-viewer">
            <pre>{payload.text}</pre>
          </div>

          <div className="viewer-toolbar">
            <button className="btn btn--green btn--sm" type="button" onClick={handleCopyText}>
              Copy Text
            </button>
            <select
              className="select"
              aria-label="Download format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {formats.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.label} (.{f.extension})
                </option>
              ))}
            </select>
            <button className="btn btn--secondary btn--sm" type="button" onClick={handleDownload}>
              Download
            </button>
          </div>

          <button className="btn btn--ghost btn--block mt-lg" type="button" onClick={handleReload}>
            Receive another code
          </button>
        </section>
      )}

      <InfoBlocks items={INFO_ITEMS} />
    </main>
  );
}
