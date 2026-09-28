import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage.jsx';

export default function Terms() {
  return (
    <InfoPage title="Terms of Use" lead="The rules for using SendTo." updated>
      <h2>Using SendTo</h2>
      <p>
        By using SendTo you agree to these terms. SendTo is a temporary sharing tool, not a place to store files
        permanently or keep the only copy of something important.
      </p>

      <h2>What you may not share</h2>
      <ul>
        <li>Anything illegal, including content that exploits or endangers children.</li>
        <li>Malware, or anything meant to harm devices or steal information.</li>
        <li>Content you do not have the right to share, including material that infringes copyright.</li>
        <li>Harassing, threatening or hateful content.</li>
      </ul>
      <p>
        You are responsible for what you send. Content that breaks these rules may be removed without notice, and access
        may be blocked.
      </p>

      <h2>Availability and deletion</h2>
      <p>
        Shares are deleted automatically when they expire or reach their view limit, and cannot be recovered. The service
        is provided as is, without a promise that it will always be available or error free. Storage limits may apply, and
        uploads can be refused when storage is full.
      </p>

      <h2>Fair use</h2>
      <p>
        Do not try to guess codes, overload the service or get around its limits. Automated abuse may be blocked.
      </p>

      <h2>Privacy</h2>
      <p>
        How data is handled is described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </InfoPage>
  );
}
