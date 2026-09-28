import { useEffect, useState } from 'react';

/** Renders a QR code for `value`. The generator is loaded on demand. */
export default function QrCode({ value, size = 176 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#0f172a', light: '#ffffff' } })
      )
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        /* the code and link are still shown, so a missing QR is not fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return null;
  return (
    <div className="qr">
      <img src={src} width={size} height={size} alt="QR code for the share link" />
      <p className="qr__hint">Scan to open on another device</p>
    </div>
  );
}
