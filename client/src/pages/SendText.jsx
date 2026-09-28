import { useState } from 'react';
import { api } from '../lib/api.js';
import { useLimits, formatDuration } from '../lib/limits.js';
import { useToast } from '../context/ToastContext.jsx';
import OptionsFields, { EMPTY_OPTIONS } from '../components/OptionsFields.jsx';
import BusyButton from '../components/BusyButton.jsx';
import ResultCard from '../components/ResultCard.jsx';
import InfoBlocks from '../components/InfoBlocks.jsx';

const buildInfoItems = ({ maxTextLength, defaultExpiryMinutes }) => [
  {
    icon: '🚀',
    title: 'How to Send Text?',
    body: (
      <ol className="info-steps">
        <li>Paste your text, notes, or a code snippet.</li>
        <li>
          Set an optional <strong>password</strong> or expiry timer.
        </li>
        <li>
          Tap <strong>Send Text Now</strong> to publish it.
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
        Your text is stored securely and <span className="accent">automatically deleted</span> after{' '}
        {formatDuration(defaultExpiryMinutes)} — or sooner if you set a stricter limit.
      </p>
    )
  },
  {
    icon: '📝',
    title: 'Good to Know',
    body: (
      <p>
        Great for sharing <span className="accent">passwords, config snippets, code, or quick notes</span>. You can
        share up to <span className="accent">{maxTextLength.toLocaleString()} characters</span>, and formatting is
        preserved exactly as pasted.
      </p>
    )
  }
];

export default function SendText() {
  const toast = useToast();
  const limits = useLimits();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [share, setShare] = useState(null);

  async function send() {
    if (sending) return;

    if (!text.trim()) {
      setFormError('Add some text before sending.');
      return;
    }
    if (text.length > limits.maxTextLength) {
      setFormError(`That text is too long. The limit is ${limits.maxTextLength.toLocaleString()} characters.`);
      return;
    }

    setSending(true);
    setFormError('');

    try {
      const result = await api('/api/shares/text', {
        method: 'POST',
        body: { text, ...options }
      });
      setShare(result);
      toast('Text sent. Share the code.', 'success');
    } catch (error) {
      setFormError(error.message);
      toast(error.message, 'error');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send();
  }

  function resetForm() {
    setText('');
    setOptions(EMPTY_OPTIONS);
    setShare(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const count = text.length;

  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>Send Text</h1>
        <p>Paste anything and get a 6-digit code to hand over.</p>
      </div>

      {!share && (
        <section className="card" id="compose-card">
          {formError && (
            <div className="notice notice--error" role="alert">
              {formError}
            </div>
          )}

          <label className="field">
            <span className="field__label">Your text</span>
            <textarea
              className="textarea"
              placeholder="Paste your text, code snippets, or notes here..."
              spellCheck="false"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFormError('');
              }}
              onKeyDown={handleKeyDown}
            ></textarea>
            <span className="field__hint">
              {count.toLocaleString()} / {limits.maxTextLength.toLocaleString()} character{count === 1 ? '' : 's'}
            </span>
          </label>

          <OptionsFields options={options} onChange={setOptions} />

          <BusyButton
            className="btn btn--green btn--lg btn--block"
            busy={sending}
            busyLabel="Sending…"
            type="button"
            onClick={send}
          >
            Send Text Now
          </BusyButton>
        </section>
      )}

      {share && (
        <ResultCard
          share={share}
          title="Text sent"
          lead="Give this code to whoever needs the text."
          accentClass="btn--green"
          sendAnotherLabel="Send More Text"
          openElsewhereLabel="Open Receive Text"
          openElsewhereTo="/receive-text"
          onSendAnother={resetForm}
        />
      )}

      <InfoBlocks items={buildInfoItems(limits)} />
    </main>
  );
}
