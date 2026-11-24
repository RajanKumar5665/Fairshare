import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CATEGORIES, formatDate, formatINR } from '../utils/money';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { exportPersonalCsv, exportPersonalPdf } from '../utils/exportReport';
import PhotoPicker from '../components/PhotoPicker';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineSave,
  HiOutlineBell,
  HiOutlineTable,
  HiOutlineDocumentDownload,
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ title: '', amountRupees: '', category: 'food', receiptUrl: '' });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exporting, setExporting] = useState(null);
  const navigate = useNavigate();
  const { approvals } = usePendingApprovals({ enabled: Boolean(user) });

  const displayName = user?.name || t('User');
  const firstName = displayName.split(' ')[0];
  const greeting = getGreeting(currentTime.getHours());

  async function load() {
    try {
      const data = await api('/api/expenses/personal');
      setExpenses(data.expenses || []);
    } catch (err) {
      toast.error(err.message || t('Failed to load expenses'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) load();
  }, [user, authLoading]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
    const now = new Date();
    const monthItems = visible.filter((e) => {
      const d = new Date(e.expenseDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonth = monthItems.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
    return { spent, thisMonth, monthCount: monthItems.length, count: visible.length };
  }, [visible]);

  async function doExport(kind) {
    if (!filtered.length) return toast.error(t('Nothing to export yet'));
    const label = `my_expenses${filter ? `_${filter}` : ''}`;
    setExporting(kind);
    try {
      if (kind === 'pdf') await exportPersonalPdf(filtered, { name: t("{name}'s expenses", { name: displayName }), label });
      else await exportPersonalCsv(filtered, label);
      toast.success(t('{kind} downloaded', { kind: kind.toUpperCase() }));
    } catch (err) {
      toast.error(err.message || t('Export failed'));
    } finally {
      setExporting(null);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.amountRupees || Number(form.amountRupees) <= 0) {
      toast.error(t('Please enter a valid amount'));
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
      toast.success(t('Expense recorded successfully! 🎉'));
      setForm({ title: '', amountRupees: '', category: 'food', receiptUrl: '' });
      setShowAddModal(false);
      await load();
    } catch (err) {
      toast.error(err.message || t('Failed to save expense'));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelExpense(id) {
    if (!window.confirm(t('deleteExpensePrompt') || 'Delete this expense?')) return;
    setDeletingId(id);
    try {
      await api(`/api/expenses/${id}`, { method: 'DELETE' });
      toast.success(t('Expense deleted'));
      setExpenses((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      toast.error(err.message || t('Failed to delete expense'));
    } finally {
      setDeletingId(null);
    }
  }

  const sheetNote = t('This stays in your personal ledger and will not be split with any room.');

  if (authLoading || !user) {
    return (
      <div className="d-page">
        <section className="d-hero">
          <div className="d-hero-copy">
            <p className="d-greet">{t('Loading…')}</p>
            <h1 className="d-name">SplitCircle</h1>
          </div>
          <div className="d-balance">
            <span className="d-balance-label">{t('This month')}</span>
            <span className="d-balance-amt">—</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="d-page">
      <section className="d-hero dx-hero">
        <div className="dx-hero-top">
          <div className="dx-hello">
            <span className="dx-date">{formattedToday}</span>
            <h1>
              {t(greeting)}, {firstName}
            </h1>
          </div>
          <Link to="/profile" className="dx-avatar" title={displayName} aria-label={t('Open profile')}>
            {displayName
              .split(' ')
              .filter(Boolean)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Link>
        </div>
        <div className="dx-amount">
          <span>{t('Spent in {month}', { month: currentTime.toLocaleString('en-IN', { month: 'long' }) })}</span>
          <strong>{formatINR(totals.thisMonth)}</strong>
          <small>
            {totals.monthCount === 1
              ? t('{n} expense this month', { n: totals.monthCount })
              : t('{n} expenses this month', { n: totals.monthCount })}
          </small>
        </div>
      </section>

      <div className="d-stats rx-stats">
        <div className="d-stat">
          <div className="d-stat-lbl">{t('All time')}</div>
          <div className="d-stat-val">{formatINR(totals.spent)}</div>
        </div>
        <div className="d-stat">
          <div className="d-stat-lbl">{t('Entries')}</div>
          <div className="d-stat-val">{totals.count}</div>
        </div>
        <div className="d-stat">
          <div className="d-stat-lbl">{t('Avg this month')}</div>
          <div className="d-stat-val">{formatINR(totals.monthCount > 0 ? Math.round(totals.thisMonth / totals.monthCount) : 0)}</div>
        </div>
      </div>

      {approvals.length > 0 && (
        <section className="rx-dash-approvals" aria-label={t('Room expenses waiting for your approval')}>
          <button
            type="button"
            className="rx-alert"
            onClick={() => navigate(`/rooms/${approvals[0].roomId}?tab=approvals`)}
          >
            <span className="rx-alert-ico"><HiOutlineBell size={18} /></span>
            <span className="rx-alert-text">
              <strong>
                {approvals.length === 1
                  ? t('{n} room expense needs your approval', { n: approvals.length })
                  : t('{n} room expenses need your approval', { n: approvals.length })}
              </strong>
              <small>{t('Your roommates are waiting — it won’t count until you approve.')}</small>
            </span>
            <span className="rx-alert-cta">{t('Review')}</span>
          </button>
          {approvals.slice(0, 3).map((a) => (
            <Link key={a.expenseId} to={`/rooms/${a.roomId}?tab=approvals`} className="rx-dash-item">
              <div className="d-row-main">
                <div className="d-row-title">{a.title}</div>
                <div className="d-row-meta">
                  <span>{a.roomName}</span>
                  <span className="d-dot" />
                  <span>{t('{name} paid {amount}', { name: a.paidByName, amount: formatINR(a.amountPaise) })}</span>
                </div>
              </div>
              <div className="d-row-right">
                <div style={{ textAlign: 'right' }}>
                  <div className="d-row-amt">{formatINR(a.mySharePaise)}</div>
                  <div className="muted text-xs">{t('your share')}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      <div className="d-section-head">
        <div>
          <h2>{t('dashboardTitle')}</h2>
          <p className="muted">{t('dashboardSubtitle')}</p>
        </div>
        <div className="d-export">
          {filtered.length > 0 && (
            <>
              <button type="button" className="btn-ghost btn-sm" onClick={() => doExport('csv')} disabled={!!exporting} aria-label={t('Export CSV')}>
                {exporting === 'csv' ? <span className="spinner" /> : <HiOutlineTable size={15} />} CSV
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => doExport('pdf')} disabled={!!exporting} aria-label={t('Export PDF')}>
                {exporting === 'pdf' ? <span className="spinner" /> : <HiOutlineDocumentDownload size={15} />} PDF
              </button>
            </>
          )}
          <button id="add-expense-fab" className="btn-primary d-add-desktop" onClick={() => setShowAddModal(true)}>
            <HiOutlinePlus size={18} />
            {t('addPersonalExpenseBtn')}
          </button>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="d-chips">
        <button type="button" className={`d-chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>
          {t('All')} ({visible.length})
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
              {CAT_EMOJI[c] || '📦'} {t(c)} ({count})
            </button>
          );
        })}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="d-list">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
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
                  <span style={{ textTransform: 'capitalize' }}>{t(e.category)}</span>
                </div>
              </div>
              <div className="d-row-right">
                <div className="d-row-amt">{formatINR(e.amountInSmallestUnit)}</div>
                <button
                  className="d-del"
                  onClick={() => cancelExpense(e._id)}
                  disabled={deletingId === e._id}
                  aria-label={t('Delete expense')}
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

      {!showAddModal && (
        <button className="d-fab" aria-label={t('Add expense')} onClick={() => setShowAddModal(true)}>
          <HiOutlinePlus size={26} />
        </button>
      )}

      {/* MODAL / BOTTOM SHEET */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="d-sheet-grip" />
            <div className="d-sheet-head">
              <h2>{t('addPersonalExpenseBtn')}</h2>
              <button className="modal-close-button" aria-label={t('Close')} onClick={() => setShowAddModal(false)}>
                <HiOutlineX size={16} />
              </button>
            </div>
            <p className="muted d-sheet-note">{sheetNote}</p>

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
                <label htmlFor="exp-title">{t('What was it for?')}</label>
                <input
                  id="exp-title"
                  className="d-input"
                  placeholder={t('e.g. Lunch, Petrol, Movie')}
                  maxLength={100}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label>{t('Category')}</label>
                <div className="d-cat-grid">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`d-cat ${form.category === c ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, category: c })}
                    >
                      <span>{CAT_EMOJI[c] || '📦'}</span>
                      <small>{t(c)}</small>
                    </button>
                  ))}
                </div>
              </div>

              <PhotoPicker
                label="Receipt"
                value={form.receiptUrl}
                onChange={(receiptUrl) => setForm((cur) => ({ ...cur, receiptUrl }))}
              />

              <div className="d-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>
                  {t('Cancel')}
                </button>
                <button id="save-expense-btn" className="btn-primary" type="submit" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? (<><span className="spinner" /> {t('Saving…')}</>) : (<><HiOutlineSave size={16} /> {t('Save Expense')}</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
