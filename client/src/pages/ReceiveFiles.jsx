import { Suspense, lazy, useState } from 'react';
import { useReceiveFlow } from '../hooks/useReceiveFlow.js';
import { useLimits, formatDuration } from '../lib/limits.js';
import { formatBytes, formatRemaining } from '../lib/api.js';
import { DownloadIcon, FileIcon } from '../lib/icons.jsx';
import BusyButton from '../components/BusyButton.jsx';
import { ScanIcon } from '../lib/icons.jsx';
import InfoBlocks from '../components/InfoBlocks.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Loaded only when someone taps "Scan QR code", so the camera code stays out of the main bundle.
const QrScanner = lazy(() => import('../components/QrScanner.jsx'));

const buildInfoItems = ({ defaultExpiryMinutes }) => [
  {
    icon: '🚀',
    title: 'How to Download Files?',
    body: (
      <ol className="info-steps">
        <li>
          Get the <strong>6-digit code</strong> from the sender.
        </li>
        <li>Enter it in the search box above.</li>
        <li>
          If the files are private, enter the <strong>password</strong>.
        </li>
        <li>
          Preview images or click <strong>Download</strong> to save them.
        </li>
      </ol>
    )
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    body: (
      <p>
        Your privacy is our priority. Files are transferred over encrypted connections and automatically{' '}
        <span className="accent">permanently deleted</span> after {formatDuration(defaultExpiryMinutes)} (or sooner if the sender set a limit).
      </p>
    )
  },
  {
    icon: '📁',
    title: 'Supported File Types',
    body: (
      <p>
        You can receive almost anything! We support <span className="accent">Images (JPG, PNG)</span>,{' '}
        <span className="accent">Documents (PDF, DOCX)</span>, <span className="accent">Videos (MP4)</span>,{' '}
        <span className="accent">Archives (ZIP, RAR)</span>, and code files.
      </p>
    )
  }
];

export default function ReceiveFiles() {
  const toast = useToast();
  const limits = useLimits();
  const [payload, setPayload] = useState(null);
  const [scanning, setScanning] = useState(false);

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
    submitCode,
    unlock,
    reset
  } = useReceiveFlow({
    type: 'file',
    otherTypePath: '/receive-text',
    onOpen: (data) => {
      setPayload(data);
      toast('Files unlocked.', 'success');
    }
  });

  function handleReset() {
    setPayload(null);
    reset();
  }

  const totalSize = payload ? payload.files.reduce((sum, file) => sum + file.size, 0) : 0;
  const filesLead = payload
    ? payload.files.length === 1
      ? 'One file is ready to download.'
      : `${payload.files.length} files are ready — ${formatBytes(totalSize)} in total.`
    : '';

  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>Receive Files</h1>
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
            className="btn btn--blue btn--lg btn--block"
            busy={checking}
            busyLabel="Checking…"
            type="button"
            onClick={() => lookup()}
          >
            Receive Files
          </BusyButton>

          <button className="btn btn--secondary btn--block mt-lg" type="button" onClick={() => setScanning(true)}>
            <ScanIcon />
            <span>Scan QR code</span>
          </button>
          {scanning && (
            <Suspense fallback={null}>
              <QrScanner
                onClose={() => setScanning(false)}
                onCode={(scanned) => {
                  setScanning(false);
                  submitCode(scanned);
                }}
              />
            </Suspense>
          )}
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
            className="btn btn--blue btn--lg btn--block"
            busy={unlocking}
            busyLabel="Opening…"
            type="button"
            onClick={unlock}
          >
            Continue
          </BusyButton>
          <button className="btn btn--ghost btn--block mt-lg" type="button" onClick={handleReset}>
            Use a different code
          </button>
        </section>
      )}

      {step === 'content' && payload && (
        <section className="card" id="files-card">
          <h2>Your files</h2>
          <p className="card__lead">{filesLead}</p>

          <div className="stat-row">
            <span className="pill">Expires in {formatRemaining(payload.expiresAt)}</span>
            {payload.viewsLeft !== null && payload.viewsLeft !== undefined && (
              <span className={`pill${payload.viewsLeft > 0 ? '' : ' pill--warn'}`}>
                {payload.viewsLeft > 0
                  ? `${payload.viewsLeft} view${payload.viewsLeft > 1 ? 's' : ''} left`
                  : 'Last view — download now'}
              </span>
            )}
          </div>

          <ul className="file-list">
            {payload.files.map((file) => (
              <li className="file-row" key={file.id}>
                <span className="file-row__icon">
                  <FileIcon />
                </span>
                <span className="file-row__body">
                  <span className="file-row__name">{file.name}</span>
                  <span className="file-row__meta">{formatBytes(file.size)}</span>
                </span>
                <a
                  className="btn btn--blue btn--sm file-row__action"
                  download
                  href={`/api/shares/${payload.code}/files/${file.id}?token=${encodeURIComponent(payload.token)}`}
                >
                  <DownloadIcon />
                  <span>Download</span>
                </a>
              </li>
            ))}
          </ul>

          <button className="btn btn--ghost btn--block mt-lg" type="button" onClick={handleReset}>
            Receive another code
          </button>
        </section>
      )}

      <InfoBlocks items={buildInfoItems(limits)} />
    </main>
  );
}
