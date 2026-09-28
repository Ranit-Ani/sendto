import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';

const PRODUCT_LINKS = [
  { label: 'Upload Files', href: '/send-files' },
  { label: 'Access Files', href: '/receive-files' },
  { label: 'Share Text', href: '/send-text' },
  { label: 'Receive Text', href: '/receive-text' }
];

const SUPPORT_LINKS = ['About', 'Help Center', 'Contact Us', 'Privacy Policy'];

export default function Footer() {
  const toast = useToast();
  const year = new Date().getFullYear();

  function handlePlaceholder(event) {
    event.preventDefault();
    toast("This page isn't built yet.", 'info');
  }

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
              {SUPPORT_LINKS.map((label) => (
                <li key={label}>
                  <a href="#" onClick={handlePlaceholder}>
                    {label}
                  </a>
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
