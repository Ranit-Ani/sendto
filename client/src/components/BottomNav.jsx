import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, UploadCloudIcon, DownloadIcon, PencilIcon, InboxIcon } from '../lib/icons.jsx';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', href: '/', icon: HomeIcon },
  { id: 'send-files', label: 'Send Files', href: '/send-files', icon: UploadCloudIcon },
  { id: 'receive-files', label: 'Receive', href: '/receive-files', icon: DownloadIcon },
  { id: 'send-text', label: 'Send Text', href: '/send-text', icon: PencilIcon },
  { id: 'receive-text', label: 'Receive Text', href: '/receive-text', icon: InboxIcon }
];

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/$/, '');

  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map(({ id, label, href, icon: Icon }) => {
        const active = currentPath === href;
        return (
          <Link
            key={id}
            to={href}
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="bottom-nav__icon" />
            <span className="bottom-nav__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
