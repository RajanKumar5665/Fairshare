import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatINR } from '../utils/money';
import { openRazorpaySubscriptionCheckout } from '../utils/razorpay';
import { GROUP_TYPES, typeMeta } from './room/roomUtils';
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
  HiOutlineChevronRight,
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

  // Payment state
  const [payingWithRazorpay, setPayingWithRazorpay] = useState(false);
  const [paymentStep, setPaymentStep] = useState('idle'); // 'idle' | 'processing' | 'success'

  // Create Room Form
  const EMPTY_FORM = { type: 'room', name: '', description: '', address: '', monthlyRent: '', startDate: '', endDate: '', requireApproval: true };
  const [form, setForm] = useState(EMPTY_FORM);

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
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        settings: { requireApproval: form.requireApproval },
      };
      if (form.type === 'room' && form.monthlyRent && Number(form.monthlyRent) > 0) {
        payload.monthlyRent = Number(form.monthlyRent);
      }
      if (form.type === 'trip') {
        if (form.startDate) payload.startDate = form.startDate;
        if (form.endDate) payload.endDate = form.endDate;
      }
      const res = await api('/api/rooms', { method: 'POST', body: JSON.stringify(payload) });
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      toast.success(`${form.name.trim()} created — now invite your friends`);
      // Open the new group with the invite sheet ready to share in WhatsApp
      if (res.room?._id) navigate(`/rooms/${res.room._id}?invite=1`);
    } catch (err) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }

  const myOwnedRooms = rooms.filter((r) => r.myRole === 'owner');
  const otherRooms = rooms.filter((r) => r.myRole !== 'owner');

  const isFirstTime = !roomSubscription?.amountPaid || roomSubscription.amountPaid === 0;
  const priceDisplay = isFirstTime ? '₹1' : '₹50';
  const validUntilDate = roomSubscription?.validUntil
    ? new Date(roomSubscription.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="d-page">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>{t('roomsTitle')}</h1>
          <p className="muted subtitle">{t('roomsSubtitle')}</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* ── Groups list ───────────────────────────────────── */}
      {loading ? (
        <div className="gx-list">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="d-empty">
          <div className="d-empty-ico">
            <HiOutlineUserGroup size={28} />
          </div>
          <h3>No groups yet</h3>
          <p className="muted">Create one for your flat, a trip or any group of friends — then share the link with everyone.</p>
          <button type="button" className="btn-primary" onClick={handleCreateClick}>
            <HiOutlinePlus size={16} /> Create a group
          </button>
          <p className="muted text-xs" style={{ margin: '14px 0 0' }}>
            Got an invite? Open <Link to="/join">Join</Link> from the menu.
          </p>
        </div>
      ) : (
        <div className="gx-list">
          {[...myOwnedRooms, ...otherRooms].map((room) => (
            <GroupRow key={room._id} room={room} />
          ))}
        </div>
      )}

      {/* ════════════════════════════════════
          STEP 1: PAYMENT / SUBSCRIPTION MODAL
      ════════════════════════════════════ */}
      {showPaymentModal && (
        <div
          className="modal-overlay"
          onClick={() => !payingWithRazorpay && setShowPaymentModal(false)}
        >
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
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
        <div className="modal-overlay" onClick={() => !busy && setShowCreateModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-group-title">
            <div className="d-sheet-grip" />
            <div className="d-sheet-head">
              <h2 id="create-group-title">Create a group</h2>
              <button type="button" className="modal-close-button" onClick={() => !busy && setShowCreateModal(false)} disabled={busy} aria-label="Close">
                <HiOutlineX size={16} />
              </button>
            </div>
            <p className="muted d-sheet-note">Add everyone with one link, add expenses, and the app tells you who pays whom.</p>

            <form onSubmit={onSubmitRoom} className="d-form">
              <div className="rx-type-grid" role="radiogroup" aria-label="Group type">
                {GROUP_TYPES.map((gt) => (
                  <button
                    key={gt.id}
                    type="button"
                    role="radio"
                    aria-checked={form.type === gt.id}
                    className={`rx-type ${form.type === gt.id ? 'on' : ''}`}
                    onClick={() => setForm({ ...form, type: gt.id })}
                  >
                    <span className="rx-type-emoji">{gt.emoji}</span>
                    <strong>{gt.label}</strong>
                    <small>{gt.hint}</small>
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="create-room-name">Name *</label>
                <input
                  id="create-room-name"
                  className="d-input"
                  value={form.name}
                  maxLength={50}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                  placeholder={form.type === 'trip' ? 'e.g. Goa Trip 2026' : form.type === 'group' ? 'e.g. Office lunch gang' : 'e.g. Flat 302, Koramangala'}
                />
              </div>

              {form.type !== 'group' && (
                <div>
                  <label htmlFor="create-room-address">{form.type === 'trip' ? 'Destination' : 'Address'} (optional)</label>
                  <input
                    id="create-room-address"
                    className="d-input"
                    value={form.address}
                    maxLength={200}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={form.type === 'trip' ? 'e.g. North Goa' : 'e.g. 12, MG Road, Bengaluru'}
                  />
                </div>
              )}

              {form.type === 'room' && (
                <div>
                  <label htmlFor="create-room-rent">Monthly rent ₹ (optional)</label>
                  <input
                    id="create-room-rent"
                    className="d-input"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.monthlyRent}
                    onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                    placeholder="e.g. 24000"
                  />
                </div>
              )}

              {form.type === 'trip' && (
                <div className="rx-form-row rx-form-row-2">
                  <div>
                    <label htmlFor="create-trip-start">From (optional)</label>
                    <input id="create-trip-start" className="d-input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="create-trip-end">To (optional)</label>
                    <input id="create-trip-end" className="d-input" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
              )}

              <label className="rx-check">
                <input type="checkbox" checked={form.requireApproval} onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })} />
                <span>
                  <strong>Friends approve each expense</strong>
                  <small className="muted">An expense counts only after everyone in it says OK. You can change this later.</small>
                </span>
              </label>

              <div className="d-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button id="confirm-create-room-btn" type="submit" className="btn-primary" disabled={busy || !form.name.trim()} style={{ flex: 1, justifyContent: 'center' }}>
                  {busy ? (<><span className="spinner" /> Creating…</>) : (<><HiOutlinePlus size={16} /> Create {typeMeta(form.type).noun}</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Group row ───────────────────────────────────────────────── */
function GroupRow({ room }) {
  const meta = typeMeta(room.type);
  const pending = room.myPendingApprovals || 0;
  return (
    <Link to={`/rooms/${room._id}`} className="gx-row">
      <span className={`gx-ico ${room.type || 'room'}`} aria-hidden="true">
        {meta.emoji}
      </span>
      <span className="gx-main">
        <strong className="gx-name">{room.name}</strong>
        <span className="gx-meta">
          {meta.label}
          {' · '}
          {room.memberCount} {room.memberCount === 1 ? 'person' : 'people'}
          {room.myRole === 'owner' ? ' · You created it' : ''}
          {room.isClosed ? ' · Finished' : ''}
        </span>
      </span>
      {pending > 0 && (
        <span className="gx-pending" title={`${pending} waiting for your approval`}>
          {pending}
        </span>
      )}
      <HiOutlineChevronRight size={18} className="gx-chev" />
    </Link>
  );
}
