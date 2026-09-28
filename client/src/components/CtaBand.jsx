import { Link } from 'react-router-dom';

export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="cta-band__inner">
        <h2>Share Something in Seconds</h2>
        <p>Upload a file or send text instantly. No login required—just create a code and share it.</p>
        <div className="cta-band__actions">
          <Link className="btn btn--dark btn--lg" to="/send-files">
            Send a File
          </Link>
          <Link className="btn btn--outline btn--lg" to="/send-text">
            Send Text
          </Link>
        </div>
      </div>
    </section>
  );
}
