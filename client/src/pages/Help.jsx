import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage.jsx';
import { useLimits, formatDuration } from '../lib/limits.js';
import { formatBytes } from '../lib/api.js';
import { CONTACT_EMAIL } from '../lib/site.js';

export default function Help() {
  const limits = useLimits();

  return (
    <InfoPage title="Help Center" lead="Answers to the most common questions.">
      <h2>How do I share something?</h2>
      <p>
        Go to <Link to="/send-files">Send Files</Link> or <Link to="/send-text">Send Text</Link>, add your content and
        press send. You get a 6-digit code, a link and a QR code. Give any of them to the receiver.
      </p>

      <h2>How do I receive something?</h2>
      <p>
        Open <Link to="/receive-files">Receive Files</Link> or <Link to="/receive-text">Receive Text</Link>, then type
        the code or tap <strong>Scan QR code</strong>. If the sender set a password, you will be asked for it.
      </p>

      <h2>What are the limits?</h2>
      <ul>
        <li>
          Up to {limits.maxFiles} files per share, {formatBytes(limits.maxFileSize)} each.
        </li>
        <li>Up to {limits.maxTextLength.toLocaleString()} characters per text share.</li>
        <li>
          Shares expire after {formatDuration(limits.defaultExpiryMinutes)} unless the sender picks another time (up to{' '}
          {formatDuration(limits.maxExpiryMinutes)}).
        </li>
      </ul>

      <h2>What does the view limit do?</h2>
      <p>
        It counts how many times the code is opened. Once the limit is reached, nobody can open it again. Downloading
        several files after opening still counts as one view, and the download links stay valid for 20 minutes.
      </p>

      <h2>My code says it has expired or was not found</h2>
      <p>
        The share has either passed its expiry time, reached its view limit, or the code was typed wrong. Ask the sender
        to create a new one.
      </p>

      <h2>The QR scanner does not open</h2>
      <p>
        The camera needs your permission and a secure (HTTPS) connection. If it is blocked, allow camera access for this
        site in your browser settings, or type the code instead.
      </p>

      <h2>Which download formats can shared text use?</h2>
      <p>Plain text, Markdown, web page, CSV, JSON, PDF and Word. Bengali text is supported in PDF.</p>

      {CONTACT_EMAIL && (
        <>
          <h2>Still stuck?</h2>
          <p>
            <Link to="/contact">Contact us</Link>.
          </p>
        </>
      )}
    </InfoPage>
  );
}
