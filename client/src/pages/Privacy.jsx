import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage.jsx';
import { useLimits, formatDuration } from '../lib/limits.js';

export default function Privacy() {
  const limits = useLimits();

  return (
    <InfoPage title="Privacy Policy" lead="What SendTo stores, for how long, and why." updated>
      <h2>No accounts</h2>
      <p>SendTo does not ask for a name, email address or password to send or receive. There are no user profiles.</p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Files you send</strong>, in a private storage folder that is never shared publicly. Files are kept under
          random names.
        </li>
        <li>
          <strong>Text you send</strong>, in the database. It may be encrypted at rest.
        </li>
        <li>
          <strong>Details of each share</strong>: the 6-digit code, file names, types and sizes, the expiry time, the view
          limit, view and download counts, and timestamps.
        </li>
        <li>
          <strong>A password hash</strong>, if you set a password. The password itself is never stored, and it cannot be
          read back.
        </li>
      </ul>

      <h2>How long it is kept</h2>
      <p>
        Every share expires. If the sender does not choose a time, that is {formatDuration(limits.defaultExpiryMinutes)};
        the longest possible is {formatDuration(limits.maxExpiryMinutes)}. Expired shares, and shares that have reached
        their view limit, are deleted automatically, files and text included. The cleanup runs every few minutes, and an
        expired share is refused immediately even before it is removed.
      </p>

      <h2>Who can open a share</h2>
      <p>
        Anyone who has the code (and the password, if one is set). Treat the code like a key: share it only with the
        people who should have the content, and use a password for anything sensitive.
      </p>

      <h2>Network information</h2>
      <p>
        Your IP address is used temporarily in the server&apos;s memory to limit repeated requests and guessing of codes.
        It is not saved with your share. The hosting provider may keep ordinary server logs.
      </p>

      <h2>Camera</h2>
      <p>
        The QR scanner uses your camera only while the scanner is open, and only to read the code. Video is processed in
        your browser and is never uploaded.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        SendTo sets no cookies and uses no analytics or advertising trackers. Your browser stores only your light/dark
        theme choice.
      </p>

      <h2>Sharing with third parties</h2>
      <p>
        Content is not sold or shared. It is held by the storage and database providers that run the service, only to
        provide it.
      </p>

      <p>
        See also the <Link to="/terms">Terms of Use</Link>.
      </p>
    </InfoPage>
  );
}
