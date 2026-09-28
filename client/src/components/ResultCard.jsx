import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon } from '../lib/icons.jsx';
import { copyText, formatRemaining } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ResultCard({
  share,
  title,
  lead,
  accentClass,
  sendAnotherLabel,
  openElsewhereLabel,
  openElsewhereTo,
  onSendAnother
}) {
  const toast = useToast();
  const cardRef = useRef(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [share.code]);

  async function handleCopyCode() {
    const ok = await copyText(share.code);
    toast(ok ? 'Code copied.' : 'Copy failed — select the code and copy it manually.', ok ? 'success' : 'error');
  }

  async function handleCopyLink() {
    const ok = await copyText(share.link);
    toast(ok ? 'Share link copied.' : 'Copy failed — select the link and copy it manually.', ok ? 'success' : 'error');
  }

  return (
    <section className="card result" id="result-card" ref={cardRef}>
      <div className="result__badge">
        <CheckIcon strokeWidth="2.5" />
      </div>
      <h2 className="result__title">{title}</h2>
      <p className="result__lead">{lead}</p>

      <div className="code-display">
        <p className="code-display__label">Your share code</p>
        <div className="code-display__value" id="result-code">
          {share.code}
        </div>
      </div>

      <div className="result__meta" id="result-meta">
        <span className="pill">Expires in {formatRemaining(share.expiresAt)}</span>
        {share.passwordProtected && <span className="pill pill--warn">Password protected</span>}
        <span className="pill">
          {share.maxViews ? `${share.maxViews} view${share.maxViews > 1 ? 's' : ''} allowed` : 'Unlimited views'}
        </span>
      </div>

      <div className="result__actions">
        <button className={`btn ${accentClass}`} id="copy-code" type="button" onClick={handleCopyCode}>
          Copy Code
        </button>
        <button className="btn btn--secondary" id="copy-link" type="button" onClick={handleCopyLink}>
          Copy Share Link
        </button>
      </div>

      <div className="share-link">
        <input
          className="input"
          id="share-link"
          type="text"
          readOnly
          aria-label="Share link"
          value={share.link}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <div className="result__actions mt-lg">
        <button className="btn btn--secondary" id="send-another" type="button" onClick={onSendAnother}>
          {sendAnotherLabel}
        </button>
        <Link className="btn btn--ghost" to={openElsewhereTo}>
          {openElsewhereLabel}
        </Link>
      </div>
    </section>
  );
}
