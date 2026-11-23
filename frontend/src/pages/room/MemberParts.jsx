import { useMemo, useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi';
import { formatINR } from '../../utils/money';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar, StatusBadge } from './RoomParts';
import { CAT_EMOJI, sameId } from './roomUtils';

const COUNTED = ['active', 'disputed', 'settled'];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';

const idOf = (u) => String(u?._id || u || '');
const nameOf = (u, fallback = 'Former member') => u?.name || fallback;

/**
 * Members list. Tap a member to see every expense they paid for,
 * with the date and whether it was approved.
 */
export function MemberList({ balances, expenses, me }) {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState(null);

  const byPayer = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      if (e.status === 'cancelled') continue;
      const id = idOf(e.paidBy);
      if (!map.has(id)) map.set(id, { list: [], spent: 0, waiting: 0 });
      const row = map.get(id);
      row.list.push(e);
      if (COUNTED.includes(e.status)) row.spent += e.amountInSmallestUnit;
      else if (e.status === 'pending_review') row.waiting += e.amountInSmallestUnit;
    }
    for (const row of map.values()) row.list.sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate));
    return map;
  }, [expenses]);

  const people = balances.filter((b) => b.isCurrentMember || b.netPaise !== 0 || byPayer.has(String(b.userId)));

  return (
    <ul className="rx-members">
      {people.map((b) => {
        const id = String(b.userId);
        const info = byPayer.get(id) || { list: [], spent: 0, waiting: 0 };
        const open = openId === id;
        const last = info.list[0];
        return (
          <li key={id} className={`rx-member-item ${open ? 'open' : ''}`}>
            <button type="button" className="rx-member-row" onClick={() => setOpenId(open ? null : id)} aria-expanded={open}>
              <Avatar name={b.name} size={40} />
              <div className="rx-member-main">
                <strong className="rx-ellipsis">
                  {b.name}
                  {sameId(id, me) ? ` (${t('you')})` : ''}
                </strong>
                <small className="muted">
                  {b.isCurrentMember ? (b.role === 'owner' ? t('Owner') : b.role === 'admin' ? t('Admin') : t('Member')) : t('Moved out')}
                  {' · '}
                  {info.list.length === 1 ? t('1 expense') : t('{n} expenses', { n: info.list.length })}
                  {last ? ` · ${t('last on {date}', { date: fmtDate(last.expenseDate) })}` : ''}
                </small>
              </div>
              <div className="rx-member-bal">
                <strong>{formatINR(info.spent)}</strong>
                <small className="muted">{t('spent')}</small>
              </div>
              <HiOutlineChevronDown size={16} className={`rx-chevron ${open ? 'open' : ''}`} />
            </button>

            {open && (
              <div className="rx-member-detail">
                <div className="rx-member-facts">
                  <span>
                    {t('Paid (approved)')} <strong>{formatINR(info.spent)}</strong>
                  </span>
                  {info.waiting > 0 && (
                    <span>
                      {t('Waiting for approval')} <strong>{formatINR(info.waiting)}</strong>
                    </span>
                  )}
                  <span>
                    {t('Balance')}{' '}
                    <strong className={b.netPaise > 0 ? 'rx-amt-pos' : b.netPaise < 0 ? 'rx-amt-neg' : ''}>
                      {b.netPaise > 0
                        ? t('gets {amount}', { amount: formatINR(b.netPaise) })
                        : b.netPaise < 0
                          ? t('owes {amount}', { amount: formatINR(-b.netPaise) })
                          : t('even')}
                    </strong>
                  </span>
                </div>
                {info.list.length === 0 ? (
                  <p className="muted text-xs" style={{ margin: 0 }}>
                    {t('No expenses paid by {name} yet.', { name: b.name })}
                  </p>
                ) : (
                  <ul className="rx-mini-list">
                    {info.list.map((e) => (
                      <li key={e._id}>
                        <span className="rx-mini-ico">{CAT_EMOJI[e.category] || '📦'}</span>
                        <span className="rx-mini-main">
                          <span className="rx-ellipsis">{e.title}</span>
                          <small className="muted">
                            {fmtDate(e.expenseDate)}
                            {idOf(e.createdBy) !== id ? ` · ${t('added by {name}', { name: nameOf(e.createdBy) })}` : ''}
                          </small>
                        </span>
                        <span className="rx-mini-right">
                          <strong>{formatINR(e.amountInSmallestUnit)}</strong>
                          {e.status !== 'active' && <StatusBadge status={e.status} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Timeline of who added, approved, rejected or deleted which expense, newest first. */
export function ActivityFeed({ expenses, me }) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const who = (u) => (sameId(idOf(u), me) ? t('You') : nameOf(u));

  const events = useMemo(() => {
    const out = [];
    for (const e of expenses) {
      const base = { id: e._id, title: e.title, amount: e.amountInSmallestUnit, category: e.category };
      const paidByOther = idOf(e.paidBy) !== idOf(e.createdBy);
      out.push({
        ...base,
        key: `${e._id}-add`,
        at: e.createdAt,
        kind: 'add',
        text: paidByOther
          ? t('{who} added “{title}” (paid by {payer})', { who: who(e.createdBy), title: e.title, payer: who(e.paidBy) })
          : t('{who} added “{title}”', { who: who(e.createdBy), title: e.title }),
      });
      // Skip the "approved" line when it was counted straight away (approval off / only one person)
      if (e.approvedAt && new Date(e.approvedAt) - new Date(e.createdAt) > 5000) {
        out.push({ ...base, key: `${e._id}-ok`, at: e.approvedAt, kind: 'ok', text: t('“{title}” approved by everyone', { title: e.title }) });
      }
      if (e.status === 'rejected' || e.rejectedBy) {
        const row = (e.participants || []).find((p) => p.reviewStatus === 'rejected');
        out.push({
          ...base,
          key: `${e._id}-no`,
          at: row?.reviewedAt || e.updatedAt,
          kind: 'no',
          text: t('{who} rejected “{title}”', { who: who(e.rejectedBy), title: e.title }) + (e.rejectionReason ? ` — “${e.rejectionReason}”` : ''),
        });
      }
      if (e.status === 'cancelled') {
        out.push({
          ...base,
          key: `${e._id}-del`,
          at: e.cancelledAt || e.updatedAt,
          kind: 'del',
          text: e.cancelledBy
            ? t('{who} deleted “{title}”', { who: who(e.cancelledBy), title: e.title })
            : t('“{title}” was deleted', { title: e.title }),
        });
      }
    }
    return out.filter((x) => x.at).sort((a, b) => new Date(b.at) - new Date(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, me, t]);

  if (!events.length) {
    return <p className="muted rx-empty-line">{t('Nothing has happened in this group yet.')}</p>;
  }

  const shown = showAll ? events : events.slice(0, 30);
  const ICON = { add: '➕', ok: '✅', no: '❌', del: '🗑️' };

  return (
    <>
      <ul className="rx-activity">
        {shown.map((ev) => (
          <li key={ev.key} className={`rx-act ${ev.kind}`}>
            <span className="rx-act-ico" aria-hidden="true">
              {ICON[ev.kind]}
            </span>
            <span className="rx-act-main">
              <span>{ev.text}</span>
              <small className="muted">{fmtDateTime(ev.at)}</small>
            </span>
            <strong className="rx-act-amt">{formatINR(ev.amount)}</strong>
          </li>
        ))}
      </ul>
      {events.length > 30 && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAll((s) => !s)}>
          {showAll ? t('Show less') : t('Show all {n}', { n: events.length })}
        </button>
      )}
    </>
  );
}
