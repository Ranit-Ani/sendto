import { Link } from 'react-router-dom';
import { FileIcon, TextFileIcon } from '../lib/icons.jsx';
import UsageCard from '../components/UsageCard.jsx';
import CtaBand from '../components/CtaBand.jsx';

export default function Home() {
  return (
    <main className="page">
      <div className="page-head">
        <h3>What Would You Like to Share?</h3>
        <p>Send or receive files and text instantly using a simple 6-digit code.</p>
      </div>

      <div className="choice-grid">
        <section className="card choice-card">
          <div className="choice-card__icon choice-card__icon--file">
            <FileIcon />
          </div>
          <h2>Files</h2>
          <p>Send files instantly and get a unique 6-digit code to share with anyone.</p>

          <Link className="btn btn--blue btn--lg" to="/send-files">
            Send Files
          </Link>

          <Link className="btn btn--secondary btn--lg" to="/receive-files">
            Receive Files
          </Link>
        </section>

        <section className="card choice-card">
          <div className="choice-card__icon choice-card__icon--text">
            <TextFileIcon />
          </div>
          <h2>Text</h2>
          <p>Share text instantly with a 6-digit code. Receivers can copy it with one click.</p>

          <Link className="btn btn--green btn--lg" to="/send-text">
            Send Text
          </Link>

          <Link className="btn btn--secondary btn--lg" to="/receive-text">
            Receive Text
          </Link>
        </section>
      </div>

      <UsageCard />
      <CtaBand />
    </main>
  );
}
