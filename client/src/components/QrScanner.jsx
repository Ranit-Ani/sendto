import { useEffect, useRef, useState } from 'react';

/** Pulls a 6-digit code out of a scanned QR: a SendTo link (?code=123456) or bare digits. */
export function extractCode(text) {
  try {
    const url = new URL(text);
    const fromUrl = (url.searchParams.get('code') || '').replace(/\D/g, '');
    if (fromUrl.length === 6) return fromUrl;
  } catch {
    /* not a URL, fall through to plain digits */
  }
  const digits = String(text).replace(/\D/g, '');
  return digits.length === 6 ? digits : '';
}

/** Full-screen camera scanner. Calls onCode(code) once, then the parent closes it. */
export default function QrScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('Point the camera at the QR code.');

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let frame = 0;

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not available here. Open SendTo over HTTPS, or type the code instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch {
        setError('Camera permission was denied. Allow it in your browser, or type the code instead.');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play().catch(() => {});

      const { default: jsQR } = await import('jsqr');
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth) {
          // Scan a downscaled frame: fast enough on phones, plenty for a QR.
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
          if (result) {
            const code = extractCode(result.data);
            if (code) {
              stopped = true;
              onCodeRef.current(code);
              return;
            }
            setHint('That QR code is not a SendTo code. Try another one.');
          }
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Scan QR code" onClick={onClose}>
      <div className="modal__panel" onClick={(event) => event.stopPropagation()}>
        <h2>Scan QR code</h2>
        {error ? (
          <div className="notice notice--error" role="alert">
            {error}
          </div>
        ) : (
          <>
            <div className="scanner">
              <video ref={videoRef} className="scanner__video" muted playsInline></video>
              <div className="scanner__frame" aria-hidden="true"></div>
            </div>
            <p className="card__lead">{hint}</p>
          </>
        )}
        <canvas ref={canvasRef} hidden></canvas>
        <button className="btn btn--secondary btn--block" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
