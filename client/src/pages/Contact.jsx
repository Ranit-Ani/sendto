import InfoPage from '../components/InfoPage.jsx';
import { CONTACT_EMAIL } from '../lib/site.js';
import NotFound from './NotFound.jsx';

export default function Contact() {
  // The page only exists once a contact address is set in lib/site.js.
  if (!CONTACT_EMAIL) return <NotFound />;

  return (
    <InfoPage title="Contact Us" lead="Questions, problems, or content you want removed.">
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are reporting a share, include its 6-digit
        code.
      </p>
    </InfoPage>
  );
}
