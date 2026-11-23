import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { HiOutlinePhotograph, HiOutlineX } from 'react-icons/hi';

/** Read a QR from a canvas: the browser's fast built-in detector when there is one, otherwise jsQR. */
async function readQr(canvas, detector) {
  if (detector) {
    try {
      const codes = await detector.detect(canvas);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    } catch {
      /* fall through to jsQR */
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data || '';
}

async function makeDetector() {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats?.();
    if (formats && !formats.includes('qr_code')) return null;
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

/** Find a QR in a photo / screenshot. Resolves to the QR text, or '' if none was found. */
export async function decodeQrFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const detector = await makeDetector();
    // Try a few sizes: big photos are slow, tiny QRs need detail.
    for (const max of [1200, 2000, 800]) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
      const text = await readQr(c, detector);
      if (text) return text;
    }
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Full-screen camera scanner (Android, iPhone and desktop).
 * Also lets the person pick a photo / screenshot of the QR from the gallery.
 */
export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [status, setStatus] = useState('starting'); // starting | live | nocamera
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);

  // Close with the Escape key / Android back gesture feels natural
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;
    const canvas = document.createElement('canvas');

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('nocamera');
        setMessage(
          window.isSecureContext
            ? 'This browser can’t open the camera.'
            : 'The camera only works when the app is opened on a secure (https) address.',
        );
        return;
      }
      try {
        const detector = await makeDetector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('live');

        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);
            const text = await readQr(canvas, detector);
            if (text && !stopped) {
              stopped = true;
              navigator.vibrate?.(60);
              onResultRef.current(text);
              return;
            }
          }
          timer = window.setTimeout(tick, 200);
        };
        tick();
      } catch (err) {
        if (stopped) return;
        setStatus('nocamera');
        setMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera permission is blocked. Allow the camera for this site in your browser settings.'
            : err?.name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'The camera could not be started.',
        );
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const text = await decodeQrFile(file);
      if (text) onResultRef.current(text);
      else setMessage('No QR found in that photo. Try a clearer one where the whole QR is visible.');
    } catch {
      setMessage('Could not read that image. Try another photo.');
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="gq-cam" role="dialog" aria-modal="true" aria-label="Scan group QR">
      {status !== 'nocamera' && <video ref={videoRef} className="gq-cam-video" playsInline muted />}

      <div className="gq-cam-top">
        <button type="button" className="gq-cam-close" onClick={onClose} aria-label="Close scanner">
          <HiOutlineX size={22} />
        </button>
        <span>Scan group QR</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="gq-cam-middle">
        {status === 'nocamera' ? (
          <div className="gq-cam-nocam">
            <span className="gq-cam-nocam-ico">📷</span>
            <strong>Camera not available</strong>
            <p>{message}</p>
            <p>You can still join: pick a photo or screenshot of the QR below.</p>
          </div>
        ) : (
          <div className="gq-cam-frame">
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
            {status === 'live' && <span className="gq-cam-line" />}
            {status === 'starting' && (
              <span className="gq-cam-starting">
                <span className="spinner" style={{ width: 24, height: 24 }} />
                Starting camera…
              </span>
            )}
          </div>
        )}
      </div>

      <div className="gq-cam-bottom">
        {status !== 'nocamera' && <p className="gq-cam-hint">Fit the QR inside the box — it scans by itself.</p>}
        {status !== 'nocamera' && message && <p className="gq-cam-error">{message}</p>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
        <button type="button" className="gq-cam-upload" disabled={reading} onClick={() => fileRef.current?.click()}>
          <HiOutlinePhotograph size={20} />
          {reading ? 'Reading photo…' : 'Upload QR from gallery'}
        </button>
      </div>
    </div>
  );
}
