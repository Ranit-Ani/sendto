import { Link, useLocation } from 'react-router-dom';
import { LogoIcon, SunIcon, MoonIcon } from '../lib/icons.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const NAV_LINKS = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'send-files', label: 'Send Files', href: '/send-files' },
  { id: 'receive-files', label: 'Receive Files', href: '/receive-files' },
  { id: 'send-text', label: 'Send Text', href: '/send-text' },
  { id: 'receive-text', label: 'Receive Text', href: '/receive-text' }
];

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const location = useLocation();

  const currentPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '');

  function handleLogin(event) {
    event.preventDefault();
    toast('Accounts are optional and not built yet — sharing works without one.', 'info');
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/">
          <LogoIcon />
          <span>SendTo</span>
        </Link>

        <nav className="main-nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.id} to={link.href} aria-current={currentPath === link.href ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="icon-btn"
            id="theme-toggle"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <a className="btn btn--login" href="#" id="login-link" onClick={handleLogin}>
            Login
          </a>
        </div>
      </div>
    </header>
  );
}
