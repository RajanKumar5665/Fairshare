import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatINR } from '../utils/money';
import {
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineUserAdd,
  HiOutlineArrowLeft,
  HiOutlineSave,
  HiDuplicate,
  HiCheck,
} from 'react-icons/hi';
import { SiWhatsapp } from 'react-icons/si';


export default function RoomDetail() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state: 'all' | 'me' | '<memberUserId>'
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Modals
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Add Expense Form
  const [form, setForm] = useState({
    title: '',
    amountRupees: '',
    category: 'groceries',
    receiptUrl: '',
  });

  async function loadData() {
    try {
      const [roomRes, membersRes, expensesRes] = await Promise.all([
        api(`/api/rooms/${roomId}`),
        api(`/api/rooms/${roomId}/members`),
        api(`/api/expenses/room/${roomId}`),
      ]);

      setRoom(roomRes.room);
      setMembers(membersRes.members || []);
      setExpenses(expensesRes.expenses || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load room details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [roomId]);

  // Calculations
  const totalRoomPaise = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
  }, [expenses]);

  const currentUserId = user?._id || user?.id;
  const roomOwnerId = room?.createdBy?._id || room?.createdBy;
  const isRoomOwner = roomOwnerId?.toString() === currentUserId?.toString();

  const myExpenses = useMemo(() => {
    if (!currentUserId) return [];
    return expenses.filter((e) => {
      const payerId = e.paidBy?._id || e.paidBy;
      return payerId?.toString() === currentUserId?.toString();
    });
  }, [expenses, currentUserId]);

  const totalMyPaise = useMemo(() => {
    return myExpenses.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
  }, [myExpenses]);

  // Member-wise breakdown of who paid how much
  const memberSpendingBreakdown = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      const u = m.userId || {};
      const uid = u._id || m.userId;
      if (uid) {
        map[uid.toString()] = {
          id: uid.toString(),
          name: u.name || 'Roommate',
          mobile: u.mobile || '',
          totalPaise: 0,
          count: 0,
        };
      }
    });

    expenses.forEach((e) => {
      const payer = e.paidBy;
      const pid = payer?._id?.toString() || payer?.toString();
      if (pid) {
        if (!map[pid]) {
          map[pid] = {
            id: pid,
            name: payer?.name || 'Roommate',
            mobile: payer?.mobile || '',
            totalPaise: 0,
            count: 0,
          };
        }
        map[pid].totalPaise += e.amountInSmallestUnit || 0;
        map[pid].count += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.totalPaise - a.totalPaise);
  }, [members, expenses]);

  // Filtered expense list based on selectedFilter
  const filteredExpenses = useMemo(() => {
    if (selectedFilter === 'all') {
      return expenses;
    }
    if (selectedFilter === 'me') {
      return myExpenses;
    }
    // Filter by specific member ID
    return expenses.filter((e) => {
      const payerId = e.paidBy?._id || e.paidBy;
      return payerId?.toString() === selectedFilter.toString();
    });
  }, [expenses, myExpenses, selectedFilter]);

  // Selected member information
  const selectedMemberInfo = useMemo(() => {
    if (selectedFilter === 'all') return null;
    if (selectedFilter === 'me') {
      return {
        name: user?.name || 'You',
        totalPaise: totalMyPaise,
        count: myExpenses.length,
      };
    }
    const found = memberSpendingBreakdown.find((m) => m.id === selectedFilter);
    return found || null;
  }, [selectedFilter, memberSpendingBreakdown, user, totalMyPaise, myExpenses]);

  // Handle Add Simple Expense
  async function handleAddExpense(e) {
    e.preventDefault();
    if (!form.amountRupees || Number(form.amountRupees) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSavingExpense(true);
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          type: 'shared',
          roomId,
          title: form.title.trim(),
          amountRupees: Number(form.amountRupees),
          category: form.category,
          receiptUrl: form.receiptUrl || undefined,
          splitMethod: 'equal',
        }),
      });

      toast.success(` Added expense of ₹${form.amountRupees} for the room!`);
      setShowAddExpense(false);
      setForm({
        title: '',
        amountRupees: '',
        category: 'groceries',
        receiptUrl: '',
      });
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  }

  // Handle Invite Token Generation
  async function handleOpenInvite() {
    setShowInviteModal(true);
    setGeneratingInvite(true);
    try {
      const res = await api(`/api/rooms/${roomId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      setInviteToken(res.token);
    } catch (err) {
      toast.error(err.message || 'Failed to generate invitation link');
    } finally {
      setGeneratingInvite(false);
    }
  }

  const inviteUrl = inviteToken ? `${window.location.origin}/join?token=${inviteToken}` : '';

  function copyToClipboard(text, fieldName, successMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(successMsg || 'Copied to clipboard! ');
    setTimeout(() => {
      setCopiedField((prev) => (prev === fieldName ? null : prev));
    }, 2200);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-[var(--shadow)]" style={{ padding: 48, textAlign: 'center' }}>
        <span className="spinner" />
        <p className="muted text-sm" style={{ marginTop: 12 }}>Loading room details…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm transition-all hover:shadow-[var(--shadow)]" style={{ padding: 32, textAlign: 'center' }}>
        <h3>Room not found</h3>
        <button className="btn-primary" onClick={() => navigate('/rooms')}>{t('backToRooms')}</button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4" style={{ flexWrap: 'wrap', gap: 14 }}>
        <div>
          <button type="button" className="btn-ghost" style={{ marginBottom: 12, padding: '7px 14px', fontSize: '0.85rem', gap: 6 }} onClick={() => navigate('/rooms')}>
            <HiOutlineArrowLeft size={14} /> Back to rooms
          </button>
          <h1 style={{ margin: 0 }}>{room.name}</h1>
          {room.description && <p className="muted subtitle" style={{ marginTop: 4 }}>{room.description}</p>}
          {room.address && <p className="muted text-sm" style={{ marginTop: 4 }}>{room.address}</p>}
        </div>
        <div className="row">
          <button type="button" className="btn-ghost" onClick={handleOpenInvite}><HiOutlineUserAdd size={16} /> Invite roommates</button>
          <button type="button" className="btn-primary" onClick={() => setShowAddExpense(true)}><HiOutlinePlus size={17} /> {t('addExpenseBtn')}</button>
        </div>
      </div>

      <div className="room-detail-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="app-card"><span className="text-xs muted font-bold" style={{ letterSpacing: '0.04em' }}>TOTAL ROOM SPEND</span><strong style={{ display: 'block', marginTop: 8, fontSize: '1.65rem', color: 'var(--brand)' }}>{formatINR(totalRoomPaise)}</strong></div>
        <div className="app-card"><span className="text-xs muted font-bold" style={{ letterSpacing: '0.04em' }}>YOUR CONTRIBUTION</span><strong style={{ display: 'block', marginTop: 8, fontSize: '1.65rem' }}>{formatINR(totalMyPaise)}</strong></div>
        <div className="app-card"><span className="text-xs muted font-bold" style={{ letterSpacing: '0.04em' }}>ROOM MEMBERS</span><strong style={{ display: 'block', marginTop: 8, fontSize: '1.65rem' }}>{members.length}</strong></div>
      </div>

      <section className="stack" style={{ gap: 14, marginBottom: 24 }}>
        <div className="flex items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>Member contributions</h2><button type="button" className="modal-close-button" onClick={() => setSelectedFilter('all')}>View all expenses</button></div>
        <div className="room-member-grid">
          {memberSpendingBreakdown.map((member) => (
            <button type="button" key={member.id} className="app-card" style={{ textAlign: 'left', padding: '16px 18px', borderColor: selectedFilter === member.id ? 'var(--brand)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedFilter(member.id)}>
              <strong style={{ display: 'block' }}>{member.name}{member.id === currentUserId?.toString() ? ' (You)' : ''}</strong>
              <span className="muted text-xs">{member.count} expenses</span>
              <strong style={{ display: 'block', marginTop: 8, color: 'var(--brand)' }}>{formatINR(member.totalPaise)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <div className="flex items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0 }}>Room expenses</h2><p className="muted text-sm" style={{ marginTop: 4 }}>{selectedMemberInfo ? `Expenses paid by ${selectedMemberInfo.name}` : 'All shared room expenses'}</p></div>
          <button type="button" className="modal-close-button" onClick={() => setSelectedFilter('all')}>All expenses</button>
        </div>
        {filteredExpenses.length === 0 ? (
          <div className="app-card" style={{ padding: 44, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px' }}>{selectedFilter === 'all' ? t('noExpensesYet') : selectedFilter === 'me' ? t('noMyExpensesYet') : `${selectedMemberInfo?.name || 'This roommate'} has not paid for any expenses yet.`}</h3>
            <p className="muted text-sm" style={{ maxWidth: 380, margin: '0 auto 16px' }}>{t('noExpensesPrompt')}</p>
            <button type="button" className="btn-primary" onClick={() => setShowAddExpense(true)}>{t('addFirstExpenseBtn')}</button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {filteredExpenses.map((e) => {
              const payerName = e.paidBy?.name || 'Roommate';
              const isMe = (e.paidBy?._id || e.paidBy)?.toString() === currentUserId?.toString();
              const dateStr = e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently';
              return (
                <article key={e._id} className="expense-row rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
                  <div style={{ minWidth: 0 }}><h3 style={{ margin: 0, fontSize: '1rem' }}>{e.title}</h3><p className="muted text-xs" style={{ marginTop: 4 }}>{dateStr} | {t('paidBy')} {isMe ? 'You' : payerName}{e.description ? ` | ${e.description}` : ''}</p></div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}><strong style={{ fontSize: '1.1rem' }}>{formatINR(e.amountInSmallestUnit)}</strong><div className="muted text-xs">{t('forWholeRoom')}</div></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Invite Roommates Modal ──────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)] stack" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {t('inviteModalTitle')}
                  </h2>
                  <p className="muted text-xs" style={{ margin: 0 }}>
                    {room.name}
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-button" onClick={() => setShowInviteModal(false)} aria-label="Close invite dialog">
                <HiOutlineX size={15} />
              </button>
            </div>

            {generatingInvite ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <span className="spinner" />
                <p className="muted text-xs" style={{ marginTop: 10 }}>Generating secure invitation code…</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: 16 }}>
                {/* 1. VIP Voucher / Pass Style Invite Code Box */}
                <div
                  style={{
                    background: 'var(--brand-soft)',
                    border: '1.5px dashed var(--brand)',
                    borderRadius: 14,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand)' }}>
                        {t('inviteCodeLabel')}
                      </span>
                    </div>
                    <span className="text-xs muted" style={{ fontSize: '0.75rem' }}>
                      Click to Copy
                    </span>
                  </div>

                  {/* Monospace Code with responsive word-break */}
                  <div
                    onClick={() => copyToClipboard(inviteToken, 'code', 'Invite Code copied to clipboard! ')}
                    title="Click anywhere to copy code"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      wordBreak: 'break-all',
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'var(--ink)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    {inviteToken || 'Generating…'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
                    <span className="text-xs muted" style={{ fontSize: '0.78rem', flex: 1, minWidth: 200, lineHeight: 1.3 }}>
                      Roommates can paste this code on the <strong>Join Room</strong> page.
                    </span>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => copyToClipboard(inviteToken, 'code', 'Invite Code copied! 🚀')}
                      style={{
                        flexShrink: 0,
                        fontWeight: 700,
                        background: copiedField === 'code' ? '#10b981' : undefined,
                      }}
                    >
                      {copiedField === 'code' ? <><HiCheck size={14} /> Copied!</> : <><HiDuplicate size={14} /> Copy Code</>}
                    </button>
                  </div>
                </div>

                {/* 2. Direct Shareable Link */}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)' }}>
                      Direct Shareable Link
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all" value={inviteUrl} readOnly
                      style={{
                        fontSize: '0.82rem',
                        background: 'var(--card-bg)',
                        cursor: 'pointer',
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => copyToClipboard(inviteUrl, 'link', 'Link copied! 🚀')}
                      style={{
                        flexShrink: 0,
                        background: copiedField === 'link' ? '#10b981' : undefined,
                        color: copiedField === 'link' ? '#fff' : undefined,
                      }}
                    >
                      {copiedField === 'link' ? <><HiCheck size={14} /> Copied!</> : <><HiDuplicate size={14} /> Copy Link</>}
                    </button>
                  </div>
                </div>

                {/* 3. WhatsApp Direct Share */}
                <button
                  type="button"
                  className="btn-whatsapp"
                  onClick={() => {
                    const text = encodeURIComponent(
                      `Bhai, "${room.name}" flat ka expense track karne ke liye FairShare room join kar le:\n\n🔗 Join Link: ${inviteUrl}\n🔑 Invite Code: ${inviteToken}`
                    );
                    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                  }}
                >
                  <SiWhatsapp size={18} /> Share on WhatsApp
                </button>

                <div className="row" style={{ gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setShowInviteModal(false)}
                  >
                    <HiOutlineX size={16} /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ───────────────────────────── */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={() => setShowAddExpense(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)] stack" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{t('modalAddExpenseTitle')}</h2>
              <button type="button" className="modal-close-button" onClick={() => setShowAddExpense(false)} aria-label="Close dialog">
                <HiOutlineX size={18} />
              </button>
            </div>
            <p className="text-sm muted" style={{ margin: 0 }}>
              {t('modalAddExpenseSubtitle')}
            </p>

            <form className="stack" onSubmit={handleAddExpense} style={{ gap: 14 }}>
              <div>
                <label htmlFor="expense-title" style={{ fontWeight: 600 }}>{t('expenseTitleLabel')}</label>
                <input
                  id="expense-title"
                  className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('expenseTitlePlaceholder')}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="expense-amount" style={{ fontWeight: 600 }}>{t('amountLabel')}</label>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                  value={form.amountRupees}
                  onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label htmlFor="expense-category" style={{ fontWeight: 600 }}>{t('categoryLabel')}</label>
                <select
                  id="expense-category"
                  className="w-full rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-[11px] text-[.95rem] text-[var(--ink)] outline-none transition-all"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="groceries">{t('catGroceries')}</option>
                  <option value="food">{t('catFood')}</option>
                  <option value="wifi">{t('catWifi')}</option>
                  <option value="utilities">{t('catUtilities')}</option>
                  <option value="rent">{t('catRent')}</option>
                  <option value="maid">{t('catMaid')}</option>
                  <option value="maintenance">{t('catMaintenance')}</option>
                  <option value="general">{t('catGeneral')}</option>
                </select>
              </div>

              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <button
                  id="confirm-add-room-expense-btn"
                  className="btn-primary"
                  type="submit"
                  disabled={savingExpense}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {savingExpense ? t('savingExpenseBtn') : t('saveExpenseBtn')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowAddExpense(false)}>
                  {t('cancelBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
