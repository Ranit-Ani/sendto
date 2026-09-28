import { useCallback, useEffect, useRef, useState } from 'react';
import { upload, formatBytes } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { FileIcon, TrashIcon, UploadCloudIcon } from '../lib/icons.jsx';
import OptionsFields, { EMPTY_OPTIONS } from '../components/OptionsFields.jsx';
import BusyButton from '../components/BusyButton.jsx';
import ResultCard from '../components/ResultCard.jsx';
import InfoBlocks from '../components/InfoBlocks.jsx';

const MAX_FILES = 10;
const MAX_SIZE = 100 * 1024 * 1024; // keep in step with MAX_FILE_SIZE on the server

const INFO_ITEMS = [
  {
    icon: '🚀',
    title: 'How to Send Files?',
    body: (
      <ol className="info-steps">
        <li>Drag &amp; drop files, or choose them from your device.</li>
        <li>
          Set an optional <strong>password</strong>, download limit, or expiry timer.
        </li>
        <li>
          Tap <strong>Send Files</strong> to upload.
        </li>
        <li>Share the 6-digit code with your recipient.</li>
      </ol>
    )
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    body: (
      <p>
        Files travel over encrypted connections and are <span className="accent">automatically deleted</span> after
        24 hours — or sooner if you set a stricter download limit or expiry.
      </p>
    )
  },
  {
    icon: '📁',
    title: 'Supported File Types',
    body: (
      <p>
        Send almost anything, up to <span className="accent">{MAX_FILES} files</span> at a time and{' '}
        <span className="accent">100 MB</span> each: images, documents, videos, archives, and code files.
      </p>
    )
  }
];

export default function SendFiles() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [selected, setSelected] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null); // null = hidden
  const [formError, setFormError] = useState('');
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [share, setShare] = useState(null);

  // Stop the browser from opening a file dropped outside the zone.
  useEffect(() => {
    const preventDefault = (event) => event.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const addFiles = useCallback(
    (fileList) => {
      setFormError('');
      const incoming = Array.from(fileList);
      const rejected = [];

      setSelected((current) => {
        const next = [...current];
        for (const file of incoming) {
          if (file.size > MAX_SIZE) {
            rejected.push(`${file.name} is larger than ${formatBytes(MAX_SIZE)}`);
            continue;
          }
          if (next.length >= MAX_FILES) {
            rejected.push(`${file.name} did not fit — ${MAX_FILES} files maximum`);
            continue;
          }
          const duplicate = next.some((existing) => existing.name === file.name && existing.size === file.size);
          if (!duplicate) next.push(file);
        }
        if (rejected.length) setFormError(rejected.join('. ') + '.');
        return next;
      });
    },
    []
  );

  function removeFile(index) {
    setSelected((current) => current.filter((_, i) => i !== index));
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function handleDropzoneKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  async function send() {
    if (sending) return;

    if (!selected.length) {
      setFormError('Choose at least one file before sending.');
      return;
    }

    const form = new FormData();
    selected.forEach((file) => form.append('files', file));
    Object.entries(options).forEach(([key, value]) => form.append(key, value));

    setSending(true);
    setFormError('');
    setProgress(0);

    try {
      const result = await upload('/api/shares/files', form, (percent) => setProgress(percent));
      setShare(result);
      toast('Files sent. Share the code.', 'success');
    } catch (error) {
      setFormError(error.message);
      toast(error.message, 'error');
    } finally {
      setSending(false);
      setProgress(null);
    }
  }

  function resetForm() {
    setSelected([]);
    setOptions(EMPTY_OPTIONS);
    setShare(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const sendLabel = selected.length > 1 ? `Send ${selected.length} Files` : 'Send Files';

  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>Send Files</h1>
        <p>Upload, get a 6-digit code, hand it over.</p>
      </div>

      {!share && (
        <section className="card" id="compose-card">
          {formError && (
            <div className="notice notice--error" role="alert">
              {formError}
            </div>
          )}

          <div
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            id="dropzone"
            role="button"
            tabIndex={0}
            aria-label="Choose files or drop them here"
            onClick={openPicker}
            onKeyDown={handleDropzoneKeyDown}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="dropzone__icon">
              <UploadCloudIcon />
            </div>
            <p className="dropzone__title">Drag &amp; drop your files here</p>
            <p className="dropzone__hint">
              or pick them from your device — up to {MAX_FILES} files, {formatBytes(MAX_SIZE)} each
            </p>
            <span className="btn btn--secondary btn--sm">Choose Files</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {selected.length > 0 ? (
            <ul className="file-list">
              {selected.map((file, index) => (
                <li className="file-row" key={`${file.name}-${file.size}-${index}`}>
                  <span className="file-row__icon">
                    <FileIcon />
                  </span>
                  <span className="file-row__body">
                    <span className="file-row__name">{file.name}</span>
                    <span className="file-row__meta">{formatBytes(file.size)}</span>
                  </span>
                  <button
                    className="link-btn file-row__action"
                    type="button"
                    aria-label="Remove file"
                    onClick={() => removeFile(index)}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No files chosen yet.</p>
          )}

          {progress !== null && (
            <div className="progress" id="progress">
              <div className="progress__track">
                <div className="progress__bar" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="progress__label">{progress < 100 ? `Uploading… ${progress}%` : 'Finishing up…'}</span>
            </div>
          )}

          <OptionsFields options={options} onChange={setOptions} />

          <BusyButton
            className="btn btn--blue btn--lg btn--block"
            busy={sending}
            busyLabel="Sending…"
            type="button"
            onClick={send}
          >
            {sendLabel}
          </BusyButton>
        </section>
      )}

      {share && (
        <ResultCard
          share={share}
          title="Files sent"
          lead="Give this code to whoever needs the files."
          accentClass="btn--blue"
          sendAnotherLabel="Send More Files"
          openElsewhereLabel="Open Receive Files"
          openElsewhereTo="/receive-files"
          onSendAnother={resetForm}
        />
      )}

      <InfoBlocks items={INFO_ITEMS} />
    </main>
  );
}