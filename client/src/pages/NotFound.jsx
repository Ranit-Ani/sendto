import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>Page not found</h1>
        <p>That link does not lead anywhere. Start from the home page.</p>
      </div>

      <section className="card center">
        <Link className="btn btn--blue btn--lg" to="/">
          Go to Home
        </Link>
      </section>
    </main>
  );
}
