import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiArrowRight,
  HiCheck,
  HiOutlineClock,
  HiOutlineDocumentDownload,
  HiOutlineTable,
  HiOutlineX,
  HiOutlineSparkles,
  HiOutlineLockClosed,
} from 'react-icons/hi';
import { formatINR } from '../../utils/money';
import { exportMonthlyCsv, exportMonthlyPdf } from '../../utils/exportReport';
import { Avatar } from './RoomParts';
import { CAT_EMOJI, sameId, shortDate } from './roomUtils';

const METHOD_LABEL = { upi: 'UPI', cash: 'Cash', bank_transfer: 'Bank', other: 'Other' };

/**
 * `paymentsEnabled` = false → calculation only (flat month still running, or the
 * all-time view of a flat). Who paid / who didn't appears once the month is settled.
 */
export default function SettleUpTab({
  report,
  me,
  isAdmin,
  busy,
  paymentsEnabled = true,
  paymentsNote,
  onPay,
  onReceive,
  onConfirm,
  onRejectPayment,
  onShowPending,
}) {
  const [exporting, setExporting] = useState(null);

  async function doExport(kind) {
    setExporting(kind);
    try {
      if (kind === 'pdf') await exportMonthlyPdf(report);
      else await exportMonthlyCsv(report);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  const { totals } = report;
  const pendingPayments = report.settlements.filter((s) => s.status === 'pending');
  const maxPaid = Math.max(1, ...report.members.map((m) => m.paidPaise), report.equalSharePaise);

  // "Equal share" (total ÷ people) is only true when everyone was in every expense.
  // Otherwise show the real range so nobody thinks the maths is wrong.
  const shares = report.members.map((m) => m.sharePaise);
  const minShare = shares.length ? Math.min(...shares) : 0;
  const maxShare = shares.length ? Math.max(...shares) : 0;
  const sharesEqual = maxShare - minShare <= report.members.length; // allow paisa rounding

  // A transfer already has a payment waiting for confirmation?
  const pendingFor = (t) => pendingPayments.find((s) => sameId(s.fromId, t.from) && sameId(s.toId, t.to));

  return (
    <div className="rx-stack">
      <div className="rx-section-head">
        <div>
          <h2>Settle up · {report.monthLabel}</h2>
          <p className="muted">Everything approved{report.month === 'all' ? '' : ' this month'}, divided fairly.</p>
        </div>
        <div className="rx-export">
          <button type="button" className="btn-ghost btn-sm" onClick={() => doExport('csv')} disabled={!!exporting}>
            {exporting === 'csv' ? <span className="spinner" /> : <HiOutlineTable size={15} />} CSV
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => doExport('pdf')} disabled={!!exporting}>
            {exporting === 'pdf' ? <span className="spinner" /> : <HiOutlineDocumentDownload size={15} />} PDF
          </button>
        </div>
      </div>

      {totals.pendingCount > 0 && (
        <button type="button" className="rx-callout warn rx-callout-btn" onClick={onShowPending}>
          <HiOutlineClock size={18} />
          <span>
            {totals.pendingCount} {totals.pendingCount === 1 ? 'expense' : 'expenses'} ({formatINR(totals.pendingPaise)}) still
            waiting for approval — not included below.
          </span>
        </button>
      )}

      <div className="rx-tiles">
        <div className="rx-tile">
          <span className="rx-tile-lbl">Total spent</span>
          <strong>{formatINR(totals.approvedPaise)}</strong>
          <small className="muted">{totals.approvedCount} approved</small>
        </div>
        <div className="rx-tile brand">
          {sharesEqual ? (
            <>
              <span className="rx-tile-lbl">Equal share</span>
              <strong>{formatINR(report.equalSharePaise)}</strong>
              <small>per person · {report.headCount} people</small>
            </>
          ) : (
            <>
              <span className="rx-tile-lbl">Shares differ</span>
              <strong>
                {formatINR(minShare)} – {formatINR(maxShare)}
              </strong>
              <small>some expenses weren’t split with everyone · see each person below</small>
            </>
          )}
        </div>
        {paymentsEnabled ? (
          <div className="rx-tile">
            <span className="rx-tile-lbl">Settled</span>
            <strong>{formatINR(totals.settledPaise)}</strong>
            <small className="muted">confirmed payments</small>
          </div>
        ) : (
          <div className="rx-tile">
            <span className="rx-tile-lbl">People</span>
            <strong>{report.headCount}</strong>
            <small className="muted">in this hisaab</small>
          </div>
        )}
      </div>

      {!paymentsEnabled && paymentsNote && (
        <div className="rx-callout">
          <HiOutlineLockClosed size={18} />
          <span>{paymentsNote}</span>
        </div>
      )}

      {/* Who pays whom */}
      <section className="rx-card">
        <h3 className="rx-card-title">{paymentsEnabled ? 'Who pays whom' : 'Who will pay whom'}</h3>
        {totals.approvedCount === 0 ? (
          <p className="muted rx-empty-line">No approved expenses this month yet.</p>
        ) : report.transfers.length === 0 ? (
          <div className="rx-allset">
            <HiOutlineSparkles size={22} />
            <div>
              <strong>{paymentsEnabled ? `All settled for ${report.monthLabel}!` : 'Everyone is even so far'}</strong>
              <p className="muted">Nobody owes anybody{paymentsEnabled ? ' for this period' : ' right now'}.</p>
            </div>
          </div>
        ) : (
          <ul className="rx-transfers">
            {report.transfers.map((t) => {
              const iPay = sameId(t.from, me);
              const iGet = sameId(t.to, me);
              const waiting = pendingFor(t);
              return (
                <li key={`${t.from}-${t.to}`} className={iPay ? 'mine-pay' : iGet ? 'mine-get' : ''}>
                  <div className="rx-transfer-who">
                    <Avatar name={t.fromName} size={32} tone="danger" />
                    <span className="rx-transfer-names">
                      <strong>{iPay ? 'You' : t.fromName}</strong>
                      <HiArrowRight size={14} className="muted" />
                      <strong>{iGet ? 'You' : t.toName}</strong>
                    </span>
                  </div>
                  <strong className="rx-transfer-amt">{formatINR(t.amountPaise)}</strong>
                  <div className="rx-transfer-act">
                    {!paymentsEnabled ? null : waiting ? (
                      <span className="rx-mini warn">
                        <HiOutlineClock size={12} /> {formatINR(waiting.amountPaise)} waiting for {iGet ? 'you' : waiting.toName}
                      </span>
                    ) : iPay ? (
                      <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onPay(t)}>
                        <HiCheck size={14} /> I paid
                      </button>
                    ) : iGet ? (
                      <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onReceive(t)}>
                        <HiCheck size={14} /> I received
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Per person breakdown */}
      <section className="rx-card">
        <h3 className="rx-card-title">Who spent how much</h3>
        <div className="rx-people">
          <div className="rx-people-head" aria-hidden="true">
            <span>Person</span>
            <span>Paid</span>
            <span>Share</span>
            <span>Result</span>
          </div>
          {report.members.map((m) => {
            const left = m.remainingPaise;
            return (
              <div key={m.userId} className="rx-person">
                <div className="rx-person-name">
                  <Avatar name={m.name} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <strong className="rx-ellipsis">{sameId(m.userId, me) ? `${m.name} (you)` : m.name}</strong>
                    <div className="rx-bar" aria-hidden="true">
                      <span style={{ width: `${(m.paidPaise / maxPaid) * 100}%` }} />
                      <i style={{ left: `${(m.sharePaise / maxPaid) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="rx-person-num">
                  <small>Paid</small>
                  {formatINR(m.paidPaise)}
                </div>
                <div className="rx-person-num">
                  <small>Share</small>
                  {formatINR(m.sharePaise)}
                </div>
                <div className="rx-person-num">
                  <small>Result</small>
                  {left > 0 ? (
                    <span className="rx-amt-pos">gets {formatINR(left)}</span>
                  ) : left < 0 ? (
                    <span className="rx-amt-neg">pays {formatINR(-left)}</span>
                  ) : (
                    <span className="rx-amt-zero">
                      <HiCheck size={12} /> even
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="muted rx-footnote">
          Bar = what they paid · tick = their fair share. Spent more than the share → gets money back; spent less → pays.
        </p>
      </section>

      {report.categories.length > 0 && (
        <section className="rx-card">
          <h3 className="rx-card-title">Where the money went</h3>
          <ul className="rx-cats">
            {report.categories.map((c) => (
              <li key={c.category}>
                <span className="rx-cat-name">
                  {CAT_EMOJI[c.category] || '📦'} <span>{c.category}</span>
                </span>
                <span className="rx-cat-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(c.percentage, 2)}%` }} />
                </span>
                <span className="rx-cat-amt">
                  {formatINR(c.amountPaise)} <small className="muted">{c.percentage}%</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paymentsEnabled && report.settlements.length > 0 && (
        <section className="rx-card">
          <h3 className="rx-card-title">Payments</h3>
          <ul className="rx-payments">
            {report.settlements.map((s) => {
              const iReceive = sameId(s.toId, me);
              const iSent = sameId(s.fromId, me);
              return (
                <li key={s._id}>
                  <div className="rx-pay-main">
                    <strong className="rx-ellipsis">
                      {iSent ? 'You' : s.fromName} → {iReceive ? 'You' : s.toName}
                    </strong>
                    <small className="muted">
                      {shortDate(s.settledAt)} · {METHOD_LABEL[s.paymentMethod] || s.paymentMethod}
                      {s.note ? ` · ${s.note}` : ''}
                    </small>
                  </div>
                  <strong>{formatINR(s.amountPaise)}</strong>
                  <div className="rx-pay-status">
                    {s.status === 'pending' && (iReceive || isAdmin) ? (
                      <>
                        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => onRejectPayment(s)} aria-label="Not received">
                          <HiOutlineX size={14} />
                        </button>
                        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onConfirm(s)}>
                          <HiCheck size={14} /> Got it
                        </button>
                      </>
                    ) : s.status === 'pending' ? (
                      <span className="badge warn">Waiting</span>
                    ) : s.status === 'completed' ? (
                      <span className="badge success">Confirmed</span>
                    ) : (
                      <span className="badge danger">{s.status}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
