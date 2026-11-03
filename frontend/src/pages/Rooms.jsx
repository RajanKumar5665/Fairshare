import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatINR } from '../utils/money';
import { openRazorpaySubscriptionCheckout } from '../utils/razorpay';
import {
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineUserAdd,
  HiOutlineKey,
  HiOutlineUserGroup,
  HiDuplicate,
  HiCheck,
  HiOutlineLockClosed,
  HiOutlineBadgeCheck,
  HiOutlineHome,
  HiOutlineLocationMarker,
  HiOutlineCurrencyRupee,
  HiOutlineDocumentText,
  HiOutlineExternalLink,
  HiOutlineCheckCircle,
} from 'react-icons/hi';
import { SiWhatsapp, SiRazorpay } from 'react-icons/si';
import { MdOutlinePayment } from 'react-icons/md';
import { RiShieldCheckLine } from 'react-icons/ri';

export default function Rooms() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [rooms, setRooms] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [roomSubscription, setRoomSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [inviteModalRoom, setInviteModalRoom] = useState(null);
  const [inviteToken, setInviteToken] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Fast Join
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);

  // Payment state
  const [payingWithRazorpay, setPayingWithRazorpay] = useState(false);
  const [paymentStep, setPaymentStep] = useState('idle'); // 'idle' | 'processing' | 'success'

  // Create Room Form
  const [form, setForm] = useState({ name: '', description: '', address: '', monthlyRent: '' });

  async function load() {
    try {
      const data = await api('/api/rooms');
      setRooms(data.rooms || []);
      setIsSubscribed(Boolean(data.isSubscribed));
      setRoomSubscription(data.roomSubscription || null);
    } catch (err) {
      toast.error(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Click "Create Room" → show payment modal first if not subscribed
function handleCreateClick() {
  setShowCreateModal(true);
}

  async function handleRazorpayPayment() {
    setPayingWithRazorpay(true);
    setPaymentStep('processing');
    try {
      const orderRes = await api('/api/subscription/create-order', {
        method: 'POST',
        body: JSON.stringify({ plan: 'starter_1rs' }),
      });

      await openRazorpaySubscriptionCheckout({
        orderData: orderRes,
        user,
        onSuccess: async (razorpayResponse) => {
          try {
            const verifyRes = await api('/api/subscription/verify-payment', {
              method: 'POST',
              body: JSON.stringify(razorpayResponse),
            });
            setPaymentStep('success');
            toast.success(verifyRes.message || 'Payment successful! Room creation unlocked.');
            setIsSubscribed(true);
            await refreshUser?.();
            await load();
            // After 1.8s show create room modal
            setTimeout(() => {
              setShowPaymentModal(false);
              setPaymentStep('idle');
              setPayingWithRazorpay(false);
              setShowCreateModal(true);
            }, 1800);
          } catch (err) {
            toast.error(err.message || 'Payment verification failed');
            setPayingWithRazorpay(false);
            setPaymentStep('idle');
          }
        },
        onError: (err) => {
          toast.error(err?.description || err?.message || 'Payment was not completed');
          setPayingWithRazorpay(false);
          setPaymentStep('idle');
        },
        onDismiss: () => {
          toast('Payment was cancelled. Subscription not activated.');
          setPayingWithRazorpay(false);
          setPaymentStep('idle');
        },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to initiate checkout');
      setPayingWithRazorpay(false);
      setPaymentStep('idle');
    }
  }

  async function onSubmitRoom(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Room name is required'); return; }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
      };
      if (form.monthlyRent && Number(form.monthlyRent) > 0) {
        payload.monthlyRent = Number(form.monthlyRent);
      }
      const res = await api('/api/rooms', { method: 'POST', body: JSON.stringify(payload) });
      setShowCreateModal(false);
      setForm({ name: '', description: '', address: '', monthlyRent: '' });
      await load();

      const createdRoom = res.room;
      const token = res.inviteToken || createdRoom?.inviteToken;
      if (createdRoom && token) {
        openInviteModal({ ...createdRoom, inviteToken: token });
      } else if (createdRoom?._id) {
        navigate(`/rooms/${createdRoom._id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }

  function extractToken(str) {
    if (!str) return '';
    const trimmed = str.trim();
    if (trimmed.includes('token=')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `http://x.com/${trimmed}`);
        return url.searchParams.get('token') || trimmed;
      } catch {
        const m = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
        return m ? m[1] : trimmed;
      }
    }
    return trimmed;
  }

  async function handleFastJoin(e) {
    e.preventDefault();
    const token = extractToken(joinInput);
    if (!token) { toast.error('Please enter a valid invite code or link'); return; }
    setJoining(true);
    try {
      const res = await api('/api/rooms/join', { method: 'POST', body: JSON.stringify({ token }) });
      toast.success('Joined room successfully!');
      setJoinInput('');
      navigate(`/rooms/${res.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to join room. Check the invite link.');
    } finally {
      setJoining(false);
    }
  }

  async function openInviteModal(room) {
    setInviteModalRoom(room);
    setGeneratingInvite(true);
    setInviteToken('');
    try {
      if (room.inviteToken) {
        setInviteToken(room.inviteToken);
      } else {
        const res = await api(`/api/rooms/${room._id}/invitations`, {
          method: 'POST',
          body: JSON.stringify({ expiresInDays: 30 }),
        });
        setInviteToken(res.token);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate invite link');
    } finally {
      setGeneratingInvite(false);
    }
  }

  function copyToClipboard(text, field, msg) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(msg || 'Copied!');
    setTimeout(() => setCopiedField((p) => (p === field ? null : p)), 2200);
  }

  const myOwnedRooms = rooms.filter((r) => r.myRole === 'owner');
  const otherRooms = rooms.filter((r) => r.myRole !== 'owner');
  const inviteUrl = inviteToken ? `${window.location.origin}/join?token=${inviteToken}` : '';

  const isFirstTime = !roomSubscription?.amountPaid || roomSubscription.amountPaid === 0;
  const priceDisplay = isFirstTime ? '₹1' : '₹50';
  const validUntilDate = roomSubscription?.validUntil
    ? new Date(roomSubscription.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <>
      {/* ── Page Header ─────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800 }}>{t('roomsTitle')}</h1>
          <p className="muted subtitle" style={{ marginTop: 4 }}>{t('roomsSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isSubscribed && (
            <button className="btn-ghost" onClick={() => setShowPaymentModal(true)} style={{ gap: 6 }}>
              <RiShieldCheckLine size={16} />
              Activate Plan
            </button>
          )}
          {isSubscribed && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', background: 'var(--success-soft)', padding: '4px 10px', borderRadius: 20 }}>
              <HiOutlineCheckCircle size={14} />
              Plan Active
            </span>
          )}
          <button id="create-room-btn" className="btn-primary" onClick={handleCreateClick} style={{ gap: 6 }}>
            <HiOutlinePlus size={18} />
            {t('createRoomBtn')}
          </button>
        </div>
      </div>

      {/* ── Locked Warning Banner ────────────────────────── */}
      {false && (
        <div style={{ background: 'linear-gradient(135deg,var(--warn-soft) 0%,#fff9f0 100%)', border: '1.5px solid var(--warn)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--warn-soft)', border: '1.5px solid var(--warn)', display: 'grid', placeItems: 'center', color: 'var(--warn)', flexShrink: 0 }}>
              <HiOutlineLockClosed size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--warn)' }}>Room creation is locked</div>
              <div className="muted text-xs" style={{ marginTop: 2 }}>
                Activate your plan for {isFirstTime ? '₹1 (first month)' : '₹50/month'} to create rooms
              </div>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowPaymentModal(true)} style={{ flexShrink: 0, gap: 6 }}>
            <MdOutlinePayment size={16} />
            Activate for {priceDisplay}
          </button>
        </div>
      )}

      {/* ── Active Plan Banner ───────────────────────────── */}
      {isSubscribed && validUntilDate && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <HiOutlineBadgeCheck size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.88rem', color: 'var(--success)', fontWeight: 600 }}>
            Room Plan Active — valid until {validUntilDate}
          </span>
        </div>
      )}

      {/* ── Join Room Card ───────────────────────────────── */}
      <section className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 220px' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--brand-soft)', display: 'grid', placeItems: 'center', color: 'var(--brand)', flexShrink: 0 }}>
            <HiOutlineKey size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Join a Room</div>
            <div className="muted text-xs" style={{ marginTop: 2 }}>Paste an invite link or code</div>
          </div>
        </div>
        <form className="fast-join-form" onSubmit={handleFastJoin} style={{ display: 'flex', gap: 8, flex: '1 1 300px', maxWidth: 480 }}>
          <input
            id="fast-join-input"
            style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.92rem', color: 'var(--ink)' }}
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste invite link or code..."
            aria-label="Invite link or code"
          />
          <button type="submit" className="btn-primary" disabled={joining || !joinInput.trim()} style={{ flexShrink: 0, minHeight: 44, padding: '0 20px' }}>
            {joining ? 'Joining…' : t('joinBtn')}
          </button>
        </form>
        <Link to="/join" style={{ color: 'var(--brand)', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          Full page →
        </Link>
      </section>

      {/* ── Room List ────────────────────────────────────── */}
      {loading ? (
        <div className="app-card muted" style={{ padding: 48, textAlign: 'center' }}>
          <span className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Loading rooms...</div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="app-card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <HiOutlineUserGroup size={30} />
          </div>
          <h3 style={{ marginBottom: 8, fontSize: '1.3rem' }}>{t('noRoomsTitle')}</h3>
          <p className="muted text-sm" style={{ maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.65 }}>{t('noRoomsDesc')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={handleCreateClick} style={{ gap: 6 }}>
              <HiOutlinePlus size={16} />
              {t('createFirstRoomBtn')}
            </button>
            <Link className="btn-ghost" to="/join" style={{ gap: 6 }}>
              <HiOutlineKey size={16} />
              Join via link
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 28 }}>
          {myOwnedRooms.length > 0 && (
            <section className="stack" style={{ gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{t('myRoomsLabel') || 'Rooms you manage'}</h2>
                <span className="badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 700 }}>
                  {myOwnedRooms.length} {myOwnedRooms.length === 1 ? 'room' : 'rooms'}
                </span>
              </div>
              <div className="room-card-grid">
                {myOwnedRooms.map((room) => (
                  <RoomCard key={room._id} room={room} role="owner" onInvite={() => openInviteModal(room)} />
                ))}
              </div>
            </section>
          )}
          {otherRooms.length > 0 && (
            <section className="stack" style={{ gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{t('joinedRoomsLabel') || 'Rooms you joined'}</h2>
                <span className="badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 700 }}>
                  {otherRooms.length} {otherRooms.length === 1 ? 'room' : 'rooms'}
                </span>
              </div>
              <div className="room-card-grid">
                {otherRooms.map((room) => (
                  <RoomCard key={room._id} room={room} role="member" onInvite={() => openInviteModal(room)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          STEP 1: PAYMENT / SUBSCRIPTION MODAL
      ════════════════════════════════════ */}
      {showPaymentModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={() => !payingWithRazorpay && setShowPaymentModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)', overflow: 'hidden', maxHeight: '95vh', overflowY: 'auto' }}
          >
            {paymentStep === 'success' ? (
              /* Success State */
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
                  <HiOutlineCheckCircle size={36} style={{ color: 'var(--success)' }} />
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>Payment Successful!</h2>
                <p className="muted text-sm" style={{ margin: '0 0 6px' }}>Room creation is now unlocked.</p>
                <p className="muted text-xs">Opening room creation form...</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 4 }}>
                      Step 1 of 2 — Activate Plan
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Activate Your Room Plan</h2>
                    <p className="muted text-xs" style={{ margin: '4px 0 0' }}>Required to create shared rooms</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !payingWithRazorpay && setShowPaymentModal(false)}
                    disabled={payingWithRazorpay}
                    aria-label="Close"
                    style={{ background: 'var(--bg-3)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--ink)' }}
                  >
                    <HiOutlineX size={16} />
                  </button>
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                  {/* Price Card */}
                  <div style={{ background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)', borderRadius: 16, padding: '20px 22px', color: '#fff', marginBottom: 20 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      {isFirstTime ? 'First Month Special Offer' : 'Monthly Renewal'}
                    </div>
                    <div style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>
                      {priceDisplay}
                      <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.8 }}>
                        {isFirstTime ? ' / first month' : ' / month'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                      {isFirstTime ? 'Then ₹50/month • Cancel anytime' : 'Room plan monthly subscription'}
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      What you get
                    </div>
                    {[
                      'Create unlimited shared rooms',
                      'Invite flatmates & split expenses',
                      'Track rent, groceries & bills',
                      'Full expense history & balances',
                    ].map((item) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <HiOutlineCheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.88rem' }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Razorpay Info */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#072654', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <SiRazorpay size={14} color="#fff" />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Razorpay Checkout</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 20 }}>
                        Trusted & Secure
                      </span>
                    </div>
                    <p className="muted text-xs" style={{ margin: 0, lineHeight: 1.5 }}>
                      {t('razorpayMethodDesc')}
                    </p>
                  </div>

                  <button
                    id="razorpay-pay-btn"
                    type="button"
                    className="btn-primary"
                    disabled
                    style={{ width: '100%', justifyContent: 'center', padding: '15px 18px', fontSize: '1.05rem', fontWeight: 800, marginBottom: 12, gap: 8 }}
                  >
                    Coming Soon
                  </button>

                  {/* Trust line */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: '0.73rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><RiShieldCheckLine size={11} /> Encrypted</span>
                    <span>•</span>
                    <span>UPI · Cards · NetBanking</span>
                    <span>•</span>
                    <span>Instant activation</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          STEP 2: CREATE ROOM MODAL
      ════════════════════════════════════ */}
      {showCreateModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={() => !busy && setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)', overflow: 'hidden', maxHeight: '95vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: 4 }}>
                  Step 2 of 2 — Create Room
                </div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Create Your Room</h2>
                <p className="muted text-xs" style={{ margin: '4px 0 0' }}>Set up your flat, PG, or hostel room</p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setShowCreateModal(false)}
                disabled={busy}
                aria-label="Close create room dialog"
                style={{ background: 'var(--bg-3)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--ink)' }}
              >
                <HiOutlineX size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmitRoom} style={{ padding: '20px 24px 24px' }}>
              <div className="stack" style={{ gap: 16 }}>
                {/* Room Name */}
                <div>
                  <label htmlFor="create-room-name" style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <HiOutlineHome size={14} style={{ color: 'var(--brand)' }} />
                    Room / Flat Name *
                  </label>
                  <input
                    id="create-room-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                    placeholder="e.g. Sharma Flat, 3BHK Koramangala"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.95rem', color: 'var(--ink)', outline: 'none' }}
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="create-room-address" style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <HiOutlineLocationMarker size={14} style={{ color: 'var(--brand)' }} />
                    Address <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    id="create-room-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="e.g. 12, MG Road, Bangalore"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.95rem', color: 'var(--ink)', outline: 'none' }}
                  />
                </div>

                {/* Monthly Rent */}
                <div>
                  <label htmlFor="create-room-rent" style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <HiOutlineCurrencyRupee size={14} style={{ color: 'var(--brand)' }} />
                    Monthly Rent (₹) <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    id="create-room-rent"
                    type="number"
                    min="0"
                    value={form.monthlyRent}
                    onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                    placeholder="e.g. 8000"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.95rem', color: 'var(--ink)', outline: 'none' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="create-room-desc" style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <HiOutlineDocumentText size={14} style={{ color: 'var(--brand)' }} />
                    Description <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    id="create-room-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Short note about this room..."
                    rows={3}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.95rem', color: 'var(--ink)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    id="confirm-create-room-btn"
                    type="submit"
                    className="btn-primary"
                    disabled={busy || !form.name.trim()}
                    style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                  >
                    {busy ? (<><span className="spinner" /> Creating…</>) : (<><HiOutlinePlus size={16} /> {t('createRoomBtn')}</>)}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Invite Roommates Modal ───────────────────────── */}
      {inviteModalRoom && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', padding: 16 }}
          onClick={() => setInviteModalRoom(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)', overflow: 'hidden', maxHeight: '95vh', overflowY: 'auto' }}
          >
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{t('inviteModalTitle')}</h2>
                <p className="muted text-xs" style={{ margin: '4px 0 0' }}>{inviteModalRoom.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalRoom(null)}
                aria-label="Close"
                style={{ background: 'var(--bg-3)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' }}
              >
                <HiOutlineX size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              {generatingInvite ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <span className="spinner" />
                  <p className="muted text-xs" style={{ marginTop: 10 }}>Generating secure invite code…</p>
                </div>
              ) : (
                <div className="stack" style={{ gap: 16 }}>
                  {/* Invite Code */}
                  <div style={{ background: 'var(--brand-soft)', border: '1.5px dashed var(--brand)', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand)' }}>
                        {t('inviteCodeLabel')}
                      </span>
                      <span className="text-xs muted">Click to copy</span>
                    </div>
                    <div
                      onClick={() => copyToClipboard(inviteToken, 'code', 'Invite code copied!')}
                      title="Click to copy"
                      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'center', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em' }}
                    >
                      {inviteToken || 'Generating…'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => copyToClipboard(inviteToken, 'code', 'Invite code copied!')}
                        style={{ gap: 6, fontWeight: 700, background: copiedField === 'code' ? '#10b981' : undefined }}
                      >
                        {copiedField === 'code' ? <><HiCheck size={14} /> Copied!</> : <><HiDuplicate size={14} /> Copy Code</>}
                      </button>
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 8 }}>Shareable Link</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        readOnly
                        value={inviteUrl}
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--bg-2)', fontSize: '0.8rem', color: 'var(--muted)', cursor: 'pointer', minWidth: 0 }}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => copyToClipboard(inviteUrl, 'link', 'Link copied!')}
                        style={{ flexShrink: 0, gap: 6, background: copiedField === 'link' ? '#10b981' : undefined, color: copiedField === 'link' ? '#fff' : undefined }}
                      >
                        {copiedField === 'link' ? <><HiCheck size={14} /> Copied!</> : <><HiDuplicate size={14} /> Copy</>}
                      </button>
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <button
                    type="button"
                    className="btn-whatsapp"
                    onClick={() => {
                      const text = encodeURIComponent(`Bhai, "${inviteModalRoom.name}" flat ka expense track karne ke liye FairShare room join kar le:\n\nJoin Link: ${inviteUrl}\nInvite Code: ${inviteToken}`);
                      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                    }}
                    style={{ gap: 8 }}
                  >
                    <SiWhatsapp size={18} />
                    Share on WhatsApp
                  </button>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                      onClick={() => { const id = inviteModalRoom._id; setInviteModalRoom(null); if (id) navigate(`/rooms/${id}`); }}
                    >
                      <HiOutlineExternalLink size={16} />
                      {t('goToDashboardBtn')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setInviteModalRoom(null)} style={{ gap: 6 }}>
                      <HiOutlineX size={16} />
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Room Card Component ─────────────────────────────────────── */
function RoomCard({ room, role, onInvite }) {
  return (
    <article
      style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between', minHeight: 170, transition: 'box-shadow 0.18s, transform 0.18s' }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.3 }}>{room.name}</h3>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, padding: '3px 9px', borderRadius: 20, background: role === 'owner' ? 'var(--brand-soft)' : 'var(--bg-3)', color: role === 'owner' ? 'var(--brand)' : 'var(--muted)' }}>
            {role === 'owner' ? 'Owner' : 'Member'}
          </span>
        </div>
        {room.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <HiOutlineLocationMarker size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <p className="muted text-xs" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.address}</p>
          </div>
        )}
        {room.monthlyRent > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <HiOutlineCurrencyRupee size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <p className="text-xs" style={{ margin: 0, fontWeight: 600 }}>
              <span className="muted" style={{ fontWeight: 400 }}>Rent: </span>
              {formatINR(room.monthlyRent)}
            </p>
          </div>
        )}
        {room.memberCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <HiOutlineUserGroup size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <p className="text-xs muted" style={{ margin: 0 }}>{room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}</p>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Link className="btn-primary" to={`/rooms/${room._id}`} style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: '0.88rem' }}>
          <HiOutlineExternalLink size={14} />
          Open Room
        </Link>
        <button type="button" className="btn-ghost" onClick={onInvite} style={{ flex: 1, justifyContent: 'center', gap: 6, fontSize: '0.88rem' }}>
          <HiOutlineUserAdd size={14} />
          Invite
        </button>
      </div>
    </article>
  );
}
