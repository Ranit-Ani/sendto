import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../lib/site.js';

const PRODUCT_LINKS = [
  { label: 'Upload Files', href: '/send-files' },
  { label: 'Access Files', href: '/receive-files' },
  { label: 'Share Text', href: '/send-text' },
  { label: 'Receive Text', href: '/receive-text' }
];

const SUPPORT_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Help Center', href: '/help' },
  // Only shown once a contact address is set in lib/site.js
  ...(CONTACT_EMAIL ? [{ label: 'Contact Us', href: '/contact' }] : []),
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' }
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__col site-footer__col--brand">
            <p className="site-footer__logo">SendTo</p>
            <p className="site-footer__desc">
              <strong>Share files and text effortlessly</strong> with SendTo. No login, no app installation, and no complicated setup. Simply upload your content, get a unique 6-digit code, and share it instantly across mobile, desktop, and tablet.
            </p>
          </div>

          <nav className="site-footer__col" aria-label="Product">
            <p className="site-footer__heading">Product</p>
            <ul>
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="site-footer__col" aria-label="Support">
            <p className="site-footer__heading">Support</p>
            <ul>
              {SUPPORT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="site-footer__bottom">
          <p>&copy; {year} SendTo. All rights reserved.</p>
          <p>
            Version 1.0 &middot; Built by Ranit Pramanick
          </p>
        </div>
      </div>
    </footer>
  );
}
