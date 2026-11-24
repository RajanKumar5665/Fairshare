import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineClipboardCopy,
  HiOutlineExclamationCircle,
  HiOutlinePhotograph,
  HiOutlineQrcode,
  HiOutlineX,
} from 'react-icons/hi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import QrScanner, { decodeQrFile } from '../components/QrScanner';
import { formatInviteCode } from './room/roomUtils';

/** Pull the invite code out of whatever was typed, pasted or scanned (code, link, or QR text). */
function cleanToken(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (trimmed.includes('token=')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `http://x.local/${trimmed}`);
      return url.searchParams.get('token') || '';
    } catch {
      const match = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : '';
    }
  }
  return trimmed.replace(/[\s-]/g, '').toUpperCase();
}

const TYPE_EMOJI = { trip: '✈️', group: '👥', room: '🏠' };

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [token, setToken] = useState(params.get('token') || '');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const fileRef = useRef(null);
  const resultRef = useRef(null);
  const autoTried = useRef(false);
  const autoJoin = params.get('auto') === '1';

  const code = cleanToken(token);
  const looksComplete = code.length >= 10;

  // Look the code up as soon as it is complete
  useEffect(() => {
    if (!looksComplete) {
      setPreview(null);
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const data = await api(`/api/rooms/invitations/info?token=${encodeURIComponent(code)}`);
        if (alive) setPreview(data);
      } catch {
        if (alive) setPreview({ valid: false, message: 'We could not check this code. Check your internet and try again.' });
      } finally {
        if (alive) setChecking(false);
      }
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code, looksComplete]);

  // Bring the "group found" card into view after a scan / paste on small screens
  useEffect(() => {
    if (preview) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [preview]);

  // Came from a QR (or back from sign-up / login): join without another tap.
  useEffect(() => {
    if (!user || !autoJoin || autoTried.current) return;
    const c = cleanToken(params.get('token') || '');
    if (!c) return;
    autoTried.current = true;
    sessionStorage.removeItem('pending_redirect');
    join(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, autoJoin, params]);

  /** Signed-out: go to sign-up / login, then come back here and join automatically. */
  function goAuth(page) {
    const back = `/join?token=${encodeURIComponent(code)}&auto=1`;
    sessionStorage.setItem('pending_redirect', back);
    navigate(`/${page}?redirect=${encodeURIComponent(back)}`);
  }

  async function join(c = code) {
    if (!c) return toast.error('Enter the group code first');
    if (!user) return goAuth('login');
    setBusy(true);
    try {
      const data = await api('/api/rooms/join', { method: 'POST', body: JSON.stringify({ token: c }) });
      toast.success('You joined the group!');
      navigate(`/rooms/${data.roomId}`, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Could not join. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  }

  function applyScanned(text) {
    const c = cleanToken(text);
    if (!c || c.length < 10 || c.length > 64) {
      toast.error('That QR is not a SplitCircle group invite');
      return;
    }
    setToken(c);
    toast.success('QR scanned');
  }

  function onScanned(text) {
    setScanning(false);
    applyScanned(text);
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReadingPhoto(true);
    try {
      const text = await decodeQrFile(file);
      if (text) applyScanned(text);
      else toast.error('No QR found in that photo. Try a clearer one.');
    } catch {
      toast.error('Could not read that image');
    } finally {
      setReadingPhoto(false);
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setToken(text.trim());
    } catch {
      toast.error('Could not read the clipboard — long-press the box and paste');
    }
  }

  const shownValue = token.includes('token=') ? token : formatInviteCode(code) || token;

  return (
    <div className="d-page join-page jx-page">
      <header className="jx-head">
        {user && (
          <button type="button" className="dx-chip jx-back" onClick={() => navigate('/rooms')}>
            <HiOutlineArrowLeft size={15} /> Groups
          </button>
        )}
        <h1>Join a group</h1>
        <p className="muted">Scan the QR your friend shared, or type their group code.</p>
      </header>

      {/* ── 1. Scan (main option) ─────────────────────────────── */}
      <button type="button" className="jx-scan" onClick={() => setScanning(true)} aria-label="Scan QR code with camera">
        <span className="jx-viewfinder" aria-hidden="true">
          <i className="tl" />
          <i className="tr" />
          <i className="bl" />
          <i className="br" />
          <HiOutlineQrcode className="jx-viewfinder-ico" />
          <span className="jx-viewfinder-line" />
        </span>
        <strong>Tap to scan QR</strong>
        <small>Opens your camera</small>
      </button>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <button type="button" className="jx-upload" onClick={() => fileRef.current?.click()} disabled={readingPhoto}>
        <HiOutlinePhotograph size={18} />
        {readingPhoto ? 'Reading photo…' : 'Got the QR as an image? Upload it'}
      </button>

      {/* ── 2. Or type the code ───────────────────────────────── */}
      <div className="gq-or" aria-hidden="true">
        <span>or enter the code</span>
      </div>

      <form
        className="jx-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (preview?.valid) join();
        }}
      >
        <label htmlFor="join-code" className="sr-only">
          Group code or invite link
        </label>
        <div className={`jx-input ${preview?.valid ? 'ok' : preview && preview.valid === false ? 'bad' : ''}`}>
          <input
            id="join-code"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCD-EFGH-JK"
            value={shownValue}
            onChange={(e) => setToken(e.target.value)}
          />
          {token ? (
            <button type="button" className="jx-input-btn" onClick={() => setToken('')} aria-label="Clear code">
              <HiOutlineX size={18} />
            </button>
          ) : (
            <button type="button" className="jx-input-btn text" onClick={paste}>
              <HiOutlineClipboardCopy size={16} /> Paste
            </button>
          )}
        </div>
        <small className="muted jx-input-hint">10 letters/numbers, or paste the whole invite link.</small>
      </form>

      {/* ── 3. Result ─────────────────────────────────────────── */}
      <div ref={resultRef}>
        {checking && (
          <div className="jx-result checking">
            <span className="spinner" style={{ width: 20, height: 20 }} /> Checking code…
          </div>
        )}

        {!checking && preview && preview.valid === false && (
          <div className="jx-result bad">
            <HiOutlineExclamationCircle size={22} />
            <div>
              <strong>This code doesn’t work</strong>
              <small>Check the code for typos, or ask the group owner to share the QR again — they may have reset it.</small>
            </div>
          </div>
        )}

        {!checking && preview?.valid && (
          <div className="jx-result ok">
            <div className="jx-found">
              <span className="jx-found-emoji">{TYPE_EMOJI[preview.roomType] || '👥'}</span>
              <div className="jx-found-main">
                <span className="jx-found-tag">
                  <HiOutlineCheckCircle size={14} /> Group found
                </span>
                <strong className="rx-ellipsis">{preview.roomName}</strong>
                <small className="muted">
                  {[
                    preview.inviterName && `Invited by ${preview.inviterName}`,
                    preview.memberCount > 0 && `${preview.memberCount} ${preview.memberCount === 1 ? 'member' : 'members'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
            </div>

            {user ? (
              <button type="button" className="btn-primary jx-cta" onClick={() => join()} disabled={busy}>
                {busy ? 'Joining…' : `Join ${preview.roomName}`}
              </button>
            ) : (
              <>
                <button type="button" className="btn-primary jx-cta" onClick={() => goAuth('register')}>
                  Create account &amp; join
                </button>
                <button type="button" className="btn-ghost jx-cta" onClick={() => goAuth('login')}>
                  I already have an account — Log in
                </button>
                <small className="muted jx-note">You’ll be added to the group right after.</small>
              </>
            )}
          </div>
        )}

        {user && autoJoin && busy && (
          <div className="jx-result checking">
            <span className="spinner" style={{ width: 20, height: 20 }} /> Adding you to the group…
          </div>
        )}
      </div>

      {/* ── How it works ──────────────────────────────────────── */}
      {!preview && (
        <ol className="jx-steps">
          <li>
            <span>1</span>
            <p>
              <strong>Scan</strong> The QR or enter the code
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              <strong>{user ? 'Check' : 'Sign up'}</strong> {user ? 'The group name' : 'Or log in'}
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              <strong>You’re in</strong> Start adding expenses
            </p>
          </li>
        </ol>
      )}

      {scanning && <QrScanner onResult={onScanned} onClose={() => setScanning(false)} />}
    </div>
  );
}
