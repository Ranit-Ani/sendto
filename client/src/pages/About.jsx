import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage.jsx';

export default function About() {
  return (
    <InfoPage title="About SendTo" lead="Share files and text with a 6-digit code. No account needed.">
      <p>
        SendTo is a small tool for handing something to another person quickly. You upload files or paste text, get a
        6-digit code, and give that code to whoever needs it. They type it in (or scan the QR code) and get exactly what
        you sent.
      </p>

      <h2>What you can control</h2>
      <ul>
        <li>An optional password on any share.</li>
        <li>A view limit, so a code stops working after it has been opened a set number of times.</li>
        <li>An expiry timer. Everything is deleted automatically when it runs out.</li>
      </ul>

      <h2>How it works</h2>
      <p>
        Files are stored in a private folder and are never made public. The only way to download one is through SendTo
        with a valid code (and the password, if one was set). Read the <Link to="/privacy">Privacy Policy</Link> for
        the details.
      </p>

      <h2>Try it</h2>
      <p>
        <Link className="btn btn--blue" to="/send-files">
          Send Files
        </Link>{' '}
        <Link className="btn btn--green" to="/send-text">
          Send Text
        </Link>
      </p>
    </InfoPage>
  );
}
