import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineKey,
  HiOutlineClipboardCopy,
  HiOutlineUserGroup,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineLightningBolt,
  HiOutlineCash,
  HiOutlineShieldCheck,
} from 'react-icons/hi';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [token, setToken] = useState(params.get('token') || '');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  function cleanToken(input) {
    if (!input) return '';
    const trimmed = input.trim();
    if (trimmed.includes('token=')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `http://dummy.com/${trimmed}`);
        return url.searchParams.get('token') || trimmed;
      } catch {
        const match = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : trimmed;
      }
    }
    return trimmed;
  }

  useEffect(() => {
    const rawToken = params.get('token') || token;
    const cleaned = cleanToken(rawToken);
    if (cleaned.length < 16) {
      setPreview(null);
      return undefined;
    }
    const timer = window.setTimeout(() => checkInvite(cleaned), 350);
    return () => window.clearTimeout(timer);
  }, [params, token]);

  async function checkInvite(code) {
    setChecking(true);
    try {
      const data = await api(`/api/rooms/invitations/info?token=${encodeURIComponent(code)}`);
      setPreview(data);
    } catch {
      setPreview({ valid: false, message: 'Could not verify invitation code' });
    } finally {
      setChecking(false);
    }
  }

  async function handlePaste() {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setToken(clipText.trim());
        toast.success('Pasted from clipboard!');
      }
    } catch {
      toast.error('Unable to access clipboard. Please paste manually.');
    }
  }

  async function onJoin(e) {
    if (e) e.preventDefault();
    const tokenToUse = cleanToken(token || params.get('token') || '');
    if (!tokenToUse) {
      toast.error('Please enter a valid invite code or paste the invite link');
      return;
    }

    if (!user) {
      const returnUrl = encodeURIComponent(`/join?token=${tokenToUse}`);
      sessionStorage.setItem('pending_redirect', `/join?token=${tokenToUse}`);
      navigate(`/login?redirect=${returnUrl}`);
      return;
    }

    setBusy(true);
    try {
      const data = await api('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ token: tokenToUse }),
      });
      toast.success('Joined room successfully!');
      navigate(`/rooms/${data.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to join room. Please check the invite link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      {/* ── Top Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ marginBottom: 14, gap: 6 }}
          onClick={() => navigate('/rooms')}
        >
          <HiOutlineArrowLeft size={15} /> Back to Rooms
        </button>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem' }}>Join a Room</h1>
        <p className="muted subtitle" style={{ margin: 0 }}>
          Enter the invitation link or code shared by your flatmate to access your shared expenses.
        </p>
      </div>

      {/* ── Main Invitation Card ───────────────────────────────── */}
      <div
        className="app-card stack"
        style={{
          gap: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--brand-soft)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--brand)',
              flexShrink: 0,
            }}
          >
            <HiOutlineKey size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Room Invitation Code</h2>
            <p className="muted text-xs" style={{ margin: '2px 0 0 0' }}>
              Paste your invite code or the full invitation link below
            </p>
          </div>
        </div>

        <form onSubmit={onJoin} className="stack" style={{ gap: 16 }}>
          <div>
            <label htmlFor="join-token-input" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, display: 'block' }}>
              Invite Code or Link
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  id="join-token-input"
                  type="text"
                  autoComplete="off"
                  placeholder="Paste invite code or link here…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid var(--line)',
                    background: 'var(--bg-2)',
                    color: 'var(--ink)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease',
                  }}
                />
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePaste}
                title="Paste from clipboard"
                style={{ flexShrink: 0, minHeight: 44, padding: '0 16px', gap: 6 }}
              >
                <HiOutlineClipboardCopy size={16} />
                Paste
              </button>
            </div>
          </div>

          {checking && (
            <div style={{ padding: '16px 20px', textAlign: 'center', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <span className="spinner" style={{ width: 22, height: 22, margin: '0 auto 8px' }} />
              <p className="muted text-xs" style={{ margin: 0 }}>Verifying invitation code…</p>
            </div>
          )}

          {preview && preview.valid === false && (
            <div className="alert warn" style={{ fontSize: '0.88rem' }}>
              {preview.message || 'Invitation is invalid or has expired'}
            </div>
          )}

          {preview && preview.valid && (
            <div
              className="stack"
              style={{
                gap: 14,
                background: 'var(--bg)',
                borderRadius: 14,
                padding: '18px 20px',
                border: '1.5px solid var(--brand)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="badge success" style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}>
                  <HiOutlineCheckCircle size={14} /> Valid Invitation
                </span>
                {preview.inviterName && (
                  <span className="text-xs muted">
                    Invited by <strong>{preview.inviterName}</strong>
                  </span>
                )}
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', color: 'var(--ink)' }}>
                  {preview.roomName}
                </h3>
                {preview.roomDescription && (
                  <p className="muted text-sm" style={{ margin: 0 }}>
                    {preview.roomDescription}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '10px 14px',
                  background: 'var(--card-bg)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ flex: 1, minWidth: 120 }}>
                  <span className="text-xs muted">Currency</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {preview.currency || 'INR (₹)'}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <span className="text-xs muted">Role upon joining</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand)' }}>
                    Room Member
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              id="join-room-submit-btn"
              className="btn-primary"
              type="submit"
              disabled={busy || !token.trim() || (preview && preview.valid === false)}
              style={{ flex: 1, justifyContent: 'center', minHeight: 44 }}
            >
              {busy ? 'Joining Room…' : preview?.valid ? `Join ${preview.roomName}` : 'Join Room'}
            </button>
            {token && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setToken('');
                  setPreview(null);
                }}
                style={{ minHeight: 44 }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Feature Highlights ─────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginTop: 20,
        }}
      >
        <div className="app-card">
          <div style={{ color: 'var(--brand)', marginBottom: 8 }}>
            <HiOutlineCash size={24} />
          </div>
          <strong style={{ display: 'block', fontSize: '0.96rem', marginBottom: 4 }}>
            Automatic Splitting
          </strong>
          <p className="muted text-xs" style={{ margin: 0, lineHeight: 1.5 }}>
            Room expenses are split equally among all members automatically.
          </p>
        </div>

        <div className="app-card">
          <div style={{ color: 'var(--brand)', marginBottom: 8 }}>
            <HiOutlineLightningBolt size={24} />
          </div>
          <strong style={{ display: 'block', fontSize: '0.96rem', marginBottom: 4 }}>
            Instant Settlement
          </strong>
          <p className="muted text-xs" style={{ margin: 0, lineHeight: 1.5 }}>
            Clear balances via UPI and settle accounts with one tap.
          </p>
        </div>

        <div className="app-card">
          <div style={{ color: 'var(--brand)', marginBottom: 8 }}>
            <HiOutlineShieldCheck size={24} />
          </div>
          <strong style={{ display: 'block', fontSize: '0.96rem', marginBottom: 4 }}>
            100% Transparent
          </strong>
          <p className="muted text-xs" style={{ margin: 0, lineHeight: 1.5 }}>
            Full history of who paid what and when for everyone in the room.
          </p>
        </div>
      </div>
    </div>
  );
}
