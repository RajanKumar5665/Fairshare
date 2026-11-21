import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { HiOutlineSave, HiOutlineX, HiCheck, HiOutlineShieldCheck } from 'react-icons/hi';
import { api } from '../../api/client';
import { formatINR } from '../../utils/money';
import { catsFor, sameId, toApiDate, toInputDate, todayIST } from './roomUtils';

const toPaise = (v) => Math.round(Number(v || 0) * 100);

/**
 * Add or edit a shared expense.
 * - Paid by: you or any friend in the group
 * - Split: equally between the people picked, or custom amounts per person
 * `expense` (optional) is a report expense being edited / re-submitted.
 */
export default function ExpenseSheet({ roomId, groupType = 'room', members, me, requireApproval, expense, minDate, onClose, onSaved }) {
  const editing = Boolean(expense);
  const activeIds = members.map((m) => m.id);
  const cats = catsFor(groupType);
  const monthlyEqual = groupType === 'room'; // flats: month total ÷ everyone, so no per-expense split

  const [form, setForm] = useState(() => {
    const existing = editing ? expense.participants.filter((p) => activeIds.includes(p.userId)) : [];
    const shares = editing ? new Set(existing.map((p) => p.owedPaise)) : new Set();
    const custom = Object.fromEntries(existing.map((p) => [p.userId, String(p.owedPaise / 100)]));
    return {
      amountRupees: editing ? String(expense.amountPaise / 100) : '',
      title: editing ? expense.title : '',
      category: editing ? expense.category || 'general' : cats[0].id,
      date: editing ? toInputDate(expense.expenseDate) : todayIST(),
      paidBy: editing ? expense.paidById : me,
      // Unequal existing split (differs by more than 1 paisa rounding) → open in custom mode
      mode: editing && shares.size > 1 && Math.max(...shares) - Math.min(...shares) > 1 ? 'custom' : 'equal',
      splitWith: editing ? existing.map((p) => p.userId) : activeIds,
      custom,
    };
  });
  const [saving, setSaving] = useState(false);

  const nameOf = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const amountPaise = toPaise(form.amountRupees);

  const customIds = activeIds.filter((id) => toPaise(form.custom[id]) > 0);
  const customTotal = customIds.reduce((s, id) => s + toPaise(form.custom[id]), 0);
  const customLeft = amountPaise - customTotal;

  const involved = form.mode === 'equal' ? form.splitWith : customIds;
  const perHead = form.splitWith.length ? Math.floor(amountPaise / form.splitWith.length) : 0;
  const approvers = [...new Set([...involved, form.paidBy])].filter((id) => !sameId(id, me));
  const willNeedApproval = requireApproval && approvers.length > 0;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function toggleMember(id) {
    setForm((f) => ({
      ...f,
      splitWith: f.splitWith.includes(id) ? f.splitWith.filter((x) => x !== id) : [...f.splitWith, id],
    }));
  }

  function fillRemaining(id) {
    const others = customIds.filter((x) => x !== id).reduce((s, x) => s + toPaise(form.custom[x]), 0);
    const rest = Math.max(0, amountPaise - others);
    set({ custom: { ...form.custom, [id]: String(rest / 100) } });
  }

  async function submit(e) {
    e.preventDefault();
    if (!(amountPaise > 0)) return toast.error('Please enter a valid amount');
    if (form.title.trim().length < 2) return toast.error('Please add a short title');

    let participants;
    let splitMethod;
    if (monthlyEqual) {
      participants = activeIds.map((userId) => ({ userId }));
      splitMethod = 'equal';
    } else if (form.mode === 'equal') {
      if (!form.splitWith.length) return toast.error('Pick at least one person to split with');
      participants = form.splitWith.map((userId) => ({ userId }));
      splitMethod = 'equal';
    } else {
      if (!customIds.length) return toast.error('Enter how much each person owes');
      if (customLeft !== 0) {
        return toast.error(
          customLeft > 0
            ? `${formatINR(customLeft)} is still not assigned to anyone`
            : `Shares are ${formatINR(-customLeft)} more than the total`,
        );
      }
      participants = customIds.map((userId) => ({ userId, amountRupees: toPaise(form.custom[userId]) / 100 }));
      splitMethod = 'exact';
    }

    setSaving(true);
    try {
      let res;
      if (editing) {
        const body = { title: form.title.trim(), category: form.category };
        if (form.date !== toInputDate(expense.expenseDate)) body.expenseDate = toApiDate(form.date) || new Date().toISOString();
        const before = expense.participants.map((p) => `${p.userId}:${p.owedPaise}`).sort().join(',');
        const amountChanged = amountPaise !== expense.amountPaise;
        const idsChanged =
          expense.participants.map((p) => p.userId).sort().join(',') !== participants.map((p) => p.userId).sort().join(',');
        const customChanged =
          splitMethod === 'exact' &&
          before !== participants.map((p) => `${p.userId}:${toPaise(p.amountRupees)}`).sort().join(',');
        if (amountChanged) body.amountRupees = amountPaise / 100;
        if (monthlyEqual ? amountChanged : amountChanged || idsChanged || customChanged || splitMethod === 'exact') {
          body.participants = participants;
          body.splitMethod = splitMethod;
        }
        res = await api(`/api/expenses/${expense._id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        res = await api('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({
            type: 'shared',
            roomId,
            title: form.title.trim(),
            amountRupees: amountPaise / 100,
            category: form.category,
            expenseDate: toApiDate(form.date),
            paidBy: form.paidBy,
            splitMethod,
            participants,
          }),
        });
      }
      toast.success(res.needsApproval ? 'Sent to your friends for approval' : editing ? 'Expense updated' : 'Expense added');
      onSaved?.(res);
    } catch (err) {
      toast.error(err.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  const who = (id) => (sameId(id, me) ? 'You' : nameOf[id] || 'Friend');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="exp-sheet-title">
        <div className="d-sheet-grip" />
        <div className="d-sheet-head">
          <h2 id="exp-sheet-title">{editing ? 'Edit expense' : 'Add expense'}</h2>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
            <HiOutlineX size={16} />
          </button>
        </div>
        {editing && expense.status === 'rejected' && expense.rejectionReason && (
          <p className="muted d-sheet-note">Rejected: “{expense.rejectionReason}”. Fix it and send it again.</p>
        )}

        <form className="d-form" onSubmit={submit} style={{ marginTop: 12 }}>
          <div className="d-amount-wrap">
            <span>₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              aria-label="Amount"
              value={form.amountRupees}
              onChange={(e) => set({ amountRupees: e.target.value })}
              autoFocus={!editing}
              required
            />
          </div>

          <div className="rx-form-row">
            <div>
              <label htmlFor="rx-title">What was it for?</label>
              <input
                id="rx-title"
                className="d-input"
                value={form.title}
                maxLength={100}
                onChange={(e) => set({ title: e.target.value })}
                placeholder={groupType === 'trip' ? 'e.g. Dinner, Hotel, Cab' : 'e.g. Vegetables, Electricity bill'}
                required
              />
            </div>
            <div>
              <label htmlFor="rx-date">Date</label>
              <input
                id="rx-date"
                className="d-input"
                type="date"
                max={todayIST()}
                min={minDate}
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="rx-paidby">Paid by</label>
            <select
              id="rx-paidby"
              className="d-input"
              value={form.paidBy}
              disabled={editing}
              onChange={(e) => set({ paidBy: e.target.value })}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {sameId(m.id, me) ? `You (${m.name})` : m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Category</label>
            <div className="d-cat-grid">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`d-cat ${form.category === c.id ? 'active' : ''}`}
                  onClick={() => set({ category: c.id })}
                  aria-pressed={form.category === c.id}
                >
                  <span>{c.emoji}</span>
                  <small>{c.label}</small>
                </button>
              ))}
            </div>
          </div>

          {monthlyEqual ? (
            <div className="rx-callout">
              <span>
                🏠 Room rule: at month end the total is divided <strong>equally among everyone</strong> in the room
                {members.length ? ` (${members.length} people now)` : ''}.
              </span>
            </div>
          ) : (
          <div>
            <div className="rx-label-row">
              <label style={{ margin: 0 }}>Split</label>
              <div className="rx-seg rx-seg-2" role="radiogroup" aria-label="Split type">
                <button type="button" role="radio" aria-checked={form.mode === 'equal'} className={form.mode === 'equal' ? 'active' : ''} onClick={() => set({ mode: 'equal' })}>
                  Equally
                </button>
                <button type="button" role="radio" aria-checked={form.mode === 'custom'} className={form.mode === 'custom' ? 'active' : ''} onClick={() => set({ mode: 'custom' })}>
                  Custom ₹
                </button>
              </div>
            </div>

            {form.mode === 'equal' ? (
              <>
                <div className="rx-label-row" style={{ marginTop: 4 }}>
                  <small className="muted">Between</small>
                  <button
                    type="button"
                    className="rx-link"
                    onClick={() => set({ splitWith: form.splitWith.length === activeIds.length ? [me] : activeIds })}
                  >
                    {form.splitWith.length === activeIds.length ? 'Only me' : 'Select everyone'}
                  </button>
                </div>
                <div className="rx-pick-grid">
                  {members.map((m) => {
                    const on = form.splitWith.includes(m.id);
                    return (
                      <button type="button" key={m.id} className={`rx-pick ${on ? 'on' : ''}`} onClick={() => toggleMember(m.id)} aria-pressed={on}>
                        <span className="rx-pick-check">{on && <HiCheck size={12} />}</span>
                        <span className="rx-pick-name">{sameId(m.id, me) ? `${m.name} (you)` : m.name}</span>
                      </button>
                    );
                  })}
                </div>
                {amountPaise > 0 && form.splitWith.length > 0 && (
                  <p className="rx-hint">
                    {formatINR(perHead)} each · {form.splitWith.length} {form.splitWith.length === 1 ? 'person' : 'people'}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="rx-custom">
                  {members.map((m) => (
                    <div key={m.id} className="rx-custom-row">
                      <span className="rx-pick-name">{sameId(m.id, me) ? `${m.name} (you)` : m.name}</span>
                      <div className="rx-custom-input">
                        <span>₹</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          aria-label={`${m.name}'s share`}
                          value={form.custom[m.id] ?? ''}
                          onChange={(e) => set({ custom: { ...form.custom, [m.id]: e.target.value } })}
                        />
                      </div>
                      <button type="button" className="rx-link" onClick={() => fillRemaining(m.id)} title="Give the rest to this person">
                        Rest
                      </button>
                    </div>
                  ))}
                </div>
                {amountPaise > 0 && (
                  <p className={`rx-hint ${customLeft === 0 ? 'ok' : 'bad'}`}>
                    {customLeft === 0
                      ? `✓ Adds up to ${formatINR(amountPaise)}`
                      : customLeft > 0
                        ? `${formatINR(customLeft)} left to assign`
                        : `${formatINR(-customLeft)} over the total`}
                  </p>
                )}
              </>
            )}
          </div>

          )}

          {willNeedApproval && (
            <div className="rx-callout warn">
              <HiOutlineShieldCheck size={18} />
              <span>
                Counts only after {approvers.map(who).join(', ')} {approvers.length === 1 ? 'approves' : 'approve'} it.
              </span>
            </div>
          )}

          <div className="d-form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? (
                <>
                  <span className="spinner" /> Saving…
                </>
              ) : (
                <>
                  <HiOutlineSave size={16} /> {editing ? 'Save' : willNeedApproval ? 'Send for approval' : 'Save expense'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
