import { GridIcon, InboxIcon, SlidersIcon, SmartphoneIcon, UserOffIcon, ZapIcon } from '../lib/icons.jsx';

const FEATURES = [
  {
    icon: UserOffIcon,
    title: 'Share Without Login',
    body: 'No account, email, phone number, or password required. Open SendTo, upload your content, and start sharing instantly.'
  },
  {
    icon: ZapIcon,
    title: 'Instant 6-Digit Code',
    body: 'Every upload gets a unique 6-digit code. Share the code with anyone and let them access your files or text in seconds.'
  },
  {
    icon: SlidersIcon,
    title: 'Flexible Sharing Controls',
    body: 'Choose how your shared content works. Set a view limit, add a password, or control how long your files and text remain available.'
  },
  {
    icon: GridIcon,
    title: 'Scan & Receive',
    body: 'Use the built-in QR scanner or enter a 6-digit code to quickly receive shared files and text without extra apps.'
  },
  {
    icon: InboxIcon,
    title: 'Files & Text in One Place',
    body: 'Share documents, images, videos, and text effortlessly. Receivers can copy text or download shared files with ease.'
  },
  {
    icon: SmartphoneIcon,
    title: 'Works Everywhere',
    body: 'Send and receive content directly from your browser across phones, tablets, laptops, and desktops—no installation needed.'
  }
];

export default function UsageCard() {
  return (
    <section className="home-hero">
      <h2>Share in Seconds, Anywhere</h2>
      <p className="home-hero__subtitle">
        No accounts, no complicated setup. Just upload, get a code, and share.
      </p>
      <p className="home-hero__desc">
        SendTo makes sharing <strong>files and text</strong> simple. Upload anything you want to share and get a unique
        <strong> 6-digit code</strong>. Send the code to anyone, and they can instantly access your content from any
        device. You can also use a <strong>QR code</strong> for even faster sharing.
      </p>

      <div className="feature-grid">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div className="feature-card" key={title}>
            <div className="feature-card__icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
