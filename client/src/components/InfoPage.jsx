import { useEffect } from 'react';
import { LAST_UPDATED } from '../lib/site.js';

/** Shared layout for the About / Help / Privacy / Terms / Contact pages. */
export default function InfoPage({ title, lead, updated = false, children }) {
  useEffect(() => {
    document.title = `${title} — SendTo`;
    window.scrollTo({ top: 0 });
    return () => {
      document.title = 'SendTo — share files and text with a 6-digit code';
    };
  }, [title]);

  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      <article className="card prose">
        {children}
        {updated && <p className="prose__meta">Last updated: {LAST_UPDATED}</p>}
      </article>
    </main>
  );
}
