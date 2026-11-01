
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CATEGORIES, formatDate, formatINR } from '../utils/money';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineSave,
  HiOutlineCalendar,
  HiOutlineCurrencyRupee,
  HiOutlineCollection,
  HiOutlineClock,
} from 'react-icons/hi';

const CAT_EMOJI = {
  food: '🍔',
  travel: '🚗',
  shopping: '🛍️',
  bills: '📄',
  rent: '🏠',
  entertainment: '🎬',
  health: '💊',
  general: '📦',
  other: '📦',
};

function getGreeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ title: '', amountRupees: '', category: 'food', receiptUrl: '' });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const displayName = user?.name || 'User';
  const firstName = displayName.split(' ')[0];
  const greeting = getGreeting(currentTime.getHours());

  async function load() {
    try {
      const data = await api('/api/expenses/personal');
      setExpenses(data.expenses || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) load();
  }, [user, authLoading]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedToday = currentTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const visible = useMemo(
    () => expenses.filter((e) => e.status !== 'cancelled'),
    [expenses]
  );
  const filtered = useMemo(
    () => visible.filter((e) => !filter || e.category === filter),
    [visible, filter]
  );

  const totals = useMemo(() => {
    const spent = visible.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
    const thisMonth = visible
      .filter((e) => {
        const d = new Date(e.expenseDate);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
    return { spent, thisMonth, count: visible.length };
  }, [visible]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.amountRupees || Number(form.amountRupees) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          receiptUrl: form.receiptUrl || undefined,
          amountRupees: Number(form.amountRupees),
          type: 'personal',
        }),
      });
      toast.success('Expense recorded successfully! 🎉');
      setForm({ title: '', amountRupees: '', category: 'food', receiptUrl: '' });
      setShowAddModal(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelExpense(id) {
    if (!window.confirm(t('deleteExpensePrompt') || 'Delete this expense?')) return;
    setDeletingId(id);
    try {
      await api(`/api/expenses/${id}`, { method: 'DELETE' });
      toast.success('Expense deleted');
      setExpenses((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="d-hero">
        <div className="d-hero-top">
          <div className="d-brand">
            <img className="d-logo" src="/screenshot-wide.png" alt="" />
            <div>
              <div className="d-brand-name">FairShare</div>
              <div className="d-brand-sub">Loading…</div>
            </div>
          </div>
          <div className="d-avatar">F</div>
        </div>
        <p className="d-greet">{greeting},</p>
        <h1 className="d-name">{firstName} 👋</h1>
        <div className="d-balance">
          <span className="d-balance-label">Loading</span>
          <span className="d-balance-amt">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ minHeight: '100dvh', paddingBottom: 80 }}>
      {/* HERO */}
      <section className="d-hero">
        <div className="d-hero-top">
          <div className="d-brand">
            <img className="d-logo" src="/screenshot-wide.png" alt="" />
            <div>
              <div className="d-brand-name">FairShare</div>
              <div className="d-brand-sub">{formattedToday}</div>
            </div>
          </div>
          <div className="d-avatar" title={displayName}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        <p className="d-greet">{greeting},</p>
        <h1 className="d-name">{displayName} 👋</h1>

        <div className="d-balance">
          <span className="d-balance-label">Spent in {currentTime.toLocaleString('en-IN', { month: 'long' })}</span>
          <span className="d-balance-amt">{formatINR(totals.thisMonth)}</span>
        </div>
      </section>

      {/* STATS */}
      <div className="d-stats">
        <div className="d-stat">
          <span className="d-stat-ico"><HiOutlineCurrencyRupee size={20} /></span>
          <div className="d-stat-val">{formatINR(totals.spent)}</div>
          <div className="d-stat-lbl">{t('allTimeLabel')}</div>
        </div>
        <div className="d-stat">
          <span className="d-stat-ico"><HiOutlineCollection size={20} /></span>
          <div className="d-stat-val">{totals.count}</div>
          <div className="d-stat-lbl">{t('totalEntriesLabel')}</div>
        </div>
        <div className="d-stat">
          <span className="d-stat-ico"><HiOutlineCalendar size={20} /></span>
          <div className="d-stat-val">{formatINR(totals.thisMonth)}</div>
          <div className="d-stat-lbl">This month</div>
        </div>
        <div className="d-stat">
          <span className="d-stat-ico"><HiOutlinePlus size={20} /></span>
          <div className="d-stat-val">{formatINR(totals.count > 0 ? Math.round(totals.thisMonth / totals.count) : 0)}</div>
          <div className="d-stat-lbl">Per entry</div>
        </div>
      </div>

      {/* TITLE + ADD */}
      <div className="d-section-head">
        <div>
          <h2>{t('dashboardTitle')}</h2>
          <p className="muted">{t('dashboardSubtitle')}</p>
        </div>
        <button id="add-expense-fab" className="d-add-desktop" onClick={() => setShowAddModal(true)}>
          <HiOutlinePlus size={18} />
          {t('addPersonalExpenseBtn')}
        </button>
      </div>

      {/* FILTER CHIPS */}
      <div className="d-chips">
        <button type="button" className={`d-chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>
          All ({visible.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = visible.filter((e) => e.category === c).length;
          if (count === 0 && filter !== c) return null;
          return (
            <button
              key={c}
              type="button"
              className={`d-chip ${filter === c ? 'active' : ''}`}
              onClick={() => setFilter(filter === c ? '' : c)}
            >
              {CAT_EMOJI[c] || '📦'} {c} ({count})
            </button>
          );
        })}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="d-empty">
          <div className="d-empty-ico"><HiOutlinePlus size={28} /></div>
          <p className="muted">Loading your expenses…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="d-empty">
          <div className="d-empty-ico"><HiOutlinePlus size={28} /></div>
          <h3>{t('noPersonalExpenses')}</h3>
          <p className="muted">{t('noPersonalExpensesPrompt')}</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <HiOutlinePlus size={17} />
            {t('addPersonalExpenseBtn')}
          </button>
        </div>
      ) : (
        <div className="d-list">
          {filtered.map((e) => (
            <div key={e._id} className="d-row">
              <div className="d-row-ico">{CAT_EMOJI[e.category] || '📦'}</div>
              <div className="d-row-main">
                <div className="d-row-title">{e.title}</div>
                <div className="d-row-meta">
                  <span>{formatDate(e.expenseDate)}</span>
                  <span className="d-dot" />
                  <span style={{ textTransform: 'capitalize' }}>{e.category}</span>
                </div>
              </div>
              <div className="d-row-right">
                <div className="d-row-amt">{formatINR(e.amountInSmallestUnit)}</div>
                <button
                  className="d-del"
                  onClick={() => cancelExpense(e._id)}
                  disabled={deletingId === e._id}
                  aria-label="Delete expense"
                >
                  {deletingId === e._id ? (
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  ) : (
                    <HiOutlineTrash size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MOBILE FAB */}
      <button className="d-fab" aria-label="Add expense" onClick={() => setShowAddModal(true)}>
        <HiOutlinePlus size={26} />
      </button>

      {/* MODAL / BOTTOM SHEET */}
      {showAddModal && (
        <div className="d-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="d-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="d-sheet-grip" />
            <div className="d-sheet-head">
              <h2>{t('addPersonalExpenseBtn')}</h2>
              <button className="modal-close-button" aria-label="Close" onClick={() => setShowAddModal(false)}>
                <HiOutlineX size={16} />
              </button>
            </div>
            <p className="muted d-sheet-note">Ye expense sirf aapka hai, kisi room ke saath share nahi hoga.</p>

            <form onSubmit={onSubmit} className="d-form">
              <div className="d-amount-wrap">
                <span>₹</span>
                <input
                  id="exp-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amountRupees}
                  onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="exp-title">Title *</label>
                <input
                  id="exp-title"
                  className="d-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label>Category</label>
                <div className="d-cat-grid">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`d-cat ${form.category === c ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, category: c })}
                    >
                      <span>{CAT_EMOJI[c] || '📦'}</span>
                      <small>{c}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="exp-receipt">Receipt image (optional)</label>
                <input
                  id="exp-receipt"
                  className="d-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      toast.error('Please select an image file only');
                      e.target.value = '';
                      return;
                    }
                    if (file.size > 1.5 * 1024 * 1024) {
                      toast.error('Image must be 1.5 MB or smaller');
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setForm((cur) => ({ ...cur, receiptUrl: reader.result }));
                    reader.readAsDataURL(file);
                  }}
                />
              </div>

              <div className="d-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button id="save-expense-btn" className="btn-primary" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? (<><span className="spinner" /> Saving…</>) : (<><HiOutlineSave size={16} /> Save Expense</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
