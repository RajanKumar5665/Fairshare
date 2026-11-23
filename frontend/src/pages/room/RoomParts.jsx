import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiCheck,
  HiOutlineX,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineClock,
  HiOutlineChevronDown,
} from 'react-icons/hi';
import { formatINR } from '../../utils/money';
import { CAT_EMOJI, PAYMENT_METHODS, STATUS_META, initials, sameId, shortDate } from './roomUtils';

export function Avatar({ name, size = 34, tone }) {
  return (
    <span className={`rx-avatar ${tone || ''}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' };
  return <span className={`badge ${meta.tone}`}>{meta.label}</span>;
}

/** One shared expense; tap to see the split and act on it. */
export function ExpenseCard({ expense, me, canManage, busy, onApprove, onReject, onEdit, onDelete, defaultOpen = false, monthlyEqual = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMine = sameId(expense.paidById, me);
  const myRow = expense.participants.find((p) => sameId(p.userId, me));
  const needsMe = expense.status === 'pending_review' && myRow?.reviewStatus === 'pending';
  const approvedCount = expense.participants.filter((p) => p.reviewStatus === 'accepted').length;
  const waitingOn = expense.participants.filter((p) => p.reviewStatus === 'pending').map((p) => p.name);

  return (
    <article className={`rx-exp ${needsMe ? 'needs-me' : ''} ${expense.status}`}>
      <button type="button" className="rx-exp-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="d-row-ico">{CAT_EMOJI[expense.category] || '📦'}</span>
        <span className="d-row-main">
          <span className="d-row-title">{expense.title}</span>
          <span className="d-row-meta">
            <span>{shortDate(expense.expenseDate)}</span>
            <span className="d-dot" />
            <span className="rx-ellipsis">{isMine ? 'You paid' : `${expense.paidByName} paid`}</span>
            {expense.carriedOver && (
              <>
                <span className="d-dot" />
                <span title="Moved from last month because it was still waiting for approval">↪ last month</span>
              </>
            )}
          </span>
        </span>
        <span className="rx-exp-right">
          <span className="d-row-amt">{formatINR(expense.amountPaise)}</span>
          {expense.status === 'pending_review' ? (
            <span className="rx-mini warn">
              <HiOutlineClock size={12} /> {approvedCount}/{expense.participants.length}
            </span>
          ) : expense.status !== 'active' ? (
            <StatusBadge status={expense.status} />
          ) : monthlyEqual ? null : myRow ? (
            <span className="rx-mini muted">your share {formatINR(myRow.owedPaise)}</span>
          ) : null}
        </span>
        <HiOutlineChevronDown size={16} className={`rx-chevron ${open ? 'open' : ''}`} />
      </button>

      {needsMe && !open && (
        <div className="rx-exp-actions">
          <span className="rx-exp-ask">
            {monthlyEqual ? 'Is this expense correct?' : <>Your share: <strong>{formatINR(myRow.owedPaise)}</strong></>}
          </span>
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onReject(expense)}>
            <HiOutlineX size={14} /> Reject
          </button>
          <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onApprove(expense)}>
            <HiCheck size={14} /> Approve
          </button>
        </div>
      )}

      {open && (
        <div className="rx-exp-detail">
          {expense.status === 'rejected' && expense.rejectionReason && (
            <div className="rx-callout danger">
              <HiOutlineX size={16} />
              <span>Rejected: “{expense.rejectionReason}”</span>
            </div>
          )}
          {expense.status === 'pending_review' && waitingOn.length > 0 && (
            <div className="rx-callout warn">
              <HiOutlineClock size={16} />
              <span>Waiting for {waitingOn.join(', ')}. Not counted until everyone approves.</span>
            </div>
          )}

          {monthlyEqual && (
            <p className="muted text-xs" style={{ margin: 0 }}>
              Counted in this month’s total, which is divided equally among everyone in the room.
            </p>
          )}
          <ul className="rx-split">
            {expense.participants.map((p) => (
              <li key={p.userId || p.name}>
                <Avatar name={p.name} size={28} />
                <span className="rx-split-name">
                  {sameId(p.userId, me) ? 'You' : p.name}
                  {sameId(p.userId, expense.paidById) && <small className="muted"> · paid</small>}
                </span>
                <span className={`rx-review ${p.reviewStatus}`}>
                  {p.reviewStatus === 'accepted' ? <HiCheck size={12} /> : p.reviewStatus === 'pending' ? <HiOutlineClock size={12} /> : <HiOutlineX size={12} />}
                  {p.reviewStatus === 'accepted' ? 'OK' : p.reviewStatus === 'pending' ? 'Waiting' : 'Rejected'}
                </span>
                {!monthlyEqual && <strong className="rx-split-amt">{formatINR(p.owedPaise)}</strong>}
              </li>
            ))}
          </ul>

          <div className="rx-exp-actions">
            {canManage && (
              <>
                {['pending_review', 'rejected'].includes(expense.status) ? (
                  <button type="button" className="btn-ghost btn-sm rx-danger" disabled={busy} onClick={() => onDelete(expense)}>
                    <HiOutlineTrash size={14} /> Delete
                  </button>
                ) : (
                  <span className="muted text-xs rx-locked">🔒 Approved — can’t be deleted</span>
                )}
                <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onEdit(expense)}>
                  <HiOutlinePencil size={14} /> {expense.status === 'rejected' ? 'Fix & resubmit' : 'Edit'}
                </button>
              </>
            )}
            {needsMe && (
              <>
                <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onReject(expense)}>
                  <HiOutlineX size={14} /> Reject
                </button>
                <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onApprove(expense)}>
                  <HiCheck size={14} /> Approve
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** Ask for a reason before rejecting. */
export function RejectSheet({ expense, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (note.trim().length < 3) return toast.error('Please write a short reason');
    setSaving(true);
    try {
      await onSubmit(note.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rx-reject-title">
        <div className="d-sheet-grip" />
        <div className="d-sheet-head">
          <h2 id="rx-reject-title">Reject “{expense.title}”?</h2>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
            <HiOutlineX size={16} />
          </button>
        </div>
        <p className="muted d-sheet-note">
          {expense.paidByName} will see your reason and can fix the expense and send it again.
        </p>
        <form className="d-form" onSubmit={submit}>
          <div>
            <label htmlFor="rx-reason">Reason</label>
            <textarea
              id="rx-reason"
              className="d-input"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Amount looks wrong, I wasn't part of this"
              autoFocus
            />
          </div>
          <div className="d-form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary rx-btn-danger" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <span className="spinner" /> : <HiOutlineX size={16} />} Reject expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Record a month-end payment.
 * mode "paid": I paid `transfer.toName` (waits for them to confirm).
 * mode "received": I got money from `transfer.fromName` (counts immediately).
 */
export function PaymentSheet({ transfer, mode, onClose, onSubmit }) {
  const [amount, setAmount] = useState(String(transfer.amountPaise / 100));
  const [method, setMethod] = useState('upi');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const paise = Math.round(Number(amount) * 100);
    if (!(paise > 0)) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await onSubmit({ amountRupees: paise / 100, paymentMethod: method, note: note.trim() });
    } finally {
      setSaving(false);
    }
  }

  const paid = mode === 'paid';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rx-pay-title">
        <div className="d-sheet-grip" />
        <div className="d-sheet-head">
          <h2 id="rx-pay-title">{paid ? `Pay ${transfer.toName}` : `Received from ${transfer.fromName}`}</h2>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
            <HiOutlineX size={16} />
          </button>
        </div>
        <p className="muted d-sheet-note">
          {paid
            ? `${transfer.toName} will be asked to confirm they received it.`
            : 'This counts straight away because you are the one receiving it.'}
        </p>
        <form className="d-form" onSubmit={submit}>
          <div className="d-amount-wrap">
            <span>₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label>How?</label>
            <div className="rx-seg" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  role="radio"
                  aria-checked={method === m.id}
                  className={method === m.id ? 'active' : ''}
                  onClick={() => setMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="rx-pay-note">Note (optional)</label>
            <input
              id="rx-pay-note"
              className="d-input"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UPI ref, etc."
            />
          </div>
          <div className="d-form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? <span className="spinner" /> : <HiCheck size={16} />} {paid ? 'Mark as paid' : 'Mark as received'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
