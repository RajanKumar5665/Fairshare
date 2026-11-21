// CSV / PDF export for room month reports and personal expenses.
// jsPDF is loaded on demand so it never weighs down the first page load.

const STATUS_LABEL = {
  active: 'Approved',
  settled: 'Approved',
  disputed: 'Disputed',
  pending_review: 'Waiting for approval',
  rejected: 'Rejected',
  completed: 'Confirmed',
  pending: 'Waiting for confirmation',
  reversed: 'Reversed',
};

const rupees = (paise = 0) => (Number(paise) / 100).toFixed(2);
// jsPDF's built-in fonts have no ₹ glyph, so PDFs use "Rs."
const rs = (paise = 0) =>
  `Rs. ${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const safeName = (s) => String(s || 'export').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 60);

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection from user-entered titles.
  const guarded = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

/** Save a Blob — works in browsers and in installed PWAs (iOS uses the share sheet). */
export async function saveBlob(blob, filename) {
  if (isIOS() && isStandalone() && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function saveCsv(rows, filename) {
  // BOM so Excel opens UTF-8 (names in Hindi etc.) correctly
  return saveBlob(new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable };
}

const BRAND = [23, 105, 224];

function pdfHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, 40, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 40, 50);
  doc.text('FairShare', w - 40, 32, { align: 'right' });
  doc.setTextColor(23, 43, 77);
  return 88;
}

function pdfFooter(doc) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 40, h - 20);
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 20, { align: 'right' });
  }
}

function sectionTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(23, 43, 77);
  doc.text(text, 40, y);
  return y + 8;
}

const tableTheme = {
  styles: { fontSize: 9, cellPadding: 5, textColor: [23, 43, 77] },
  headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [243, 247, 255] },
  margin: { left: 40, right: 40 },
};

// ─── Room month report ────────────────────────────────────────────────────────

/** [label, value] for the per-person line: real equal share, or the range when splits differ. */
function shareLine(report, money) {
  const shares = report.members.map((m) => m.sharePaise);
  if (!shares.length) return ['Equal share per person', money(0)];
  const min = Math.min(...shares);
  const max = Math.max(...shares);
  if (max - min <= report.members.length) return ['Equal share per person', money(report.equalSharePaise)];
  return ['Share per person (not everyone was in every expense)', `${money(min)} – ${money(max)}`];
}

function balanceWord(paise) {
  if (paise > 0) return `gets back ${rupees(paise)}`;
  if (paise < 0) return `pays ${rupees(-paise)}`;
  return 'settled';
}

export function exportMonthlyCsv(report) {
  const names = report.members.map((m) => m.name);
  const rows = [
    [`${report.roomName} — ${report.monthLabel}`],
    [],
    ['Summary'],
    ['Total approved spending (INR)', rupees(report.totals.approvedPaise)],
    ['Approved expenses', report.totals.approvedCount],
    ['People in the room', report.headCount],
    shareLine(report, rupees).map((v, i) => (i === 0 ? `${v} (INR)` : v)),
    ['Waiting for approval (INR, not included)', rupees(report.totals.pendingPaise)],
    [],
    ['Per person'],
    ['Name', 'Paid (INR)', 'Fair share (INR)', 'Spent more(+)/less(-) (INR)', 'Paid to others (INR)', 'Received (INR)', 'Still to settle'],
    ...report.members.map((m) => [
      m.name,
      rupees(m.paidPaise),
      rupees(m.sharePaise),
      rupees(m.differencePaise),
      rupees(m.settlementsPaidPaise),
      rupees(m.settlementsReceivedPaise),
      balanceWord(m.remainingPaise),
    ]),
    [],
    ['Who pays whom'],
    ['From', 'To', 'Amount (INR)'],
    ...(report.transfers.length
      ? report.transfers.map((t) => [t.fromName, t.toName, rupees(t.amountPaise)])
      : [['Everyone is settled', '', '']]),
    [],
    ['Expenses'],
    ['Date', 'Title', 'Category', 'Paid by', 'Amount (INR)', 'Status', ...names.map((n) => `${n} share (INR)`)],
    ...report.expenses.map((e) => {
      const shareBy = Object.fromEntries(e.participants.map((p) => [p.userId, p.owedPaise]));
      return [
        day(e.expenseDate),
        e.title,
        e.category,
        e.paidByName,
        rupees(e.amountPaise),
        STATUS_LABEL[e.status] || e.status,
        ...report.members.map((m) => (shareBy[m.userId] !== undefined ? rupees(shareBy[m.userId]) : '')),
      ];
    }),
    [],
    ['Payments'],
    ['Date', 'From', 'To', 'Amount (INR)', 'Method', 'Status'],
    ...report.settlements.map((s) => [
      day(s.settledAt),
      s.fromName,
      s.toName,
      rupees(s.amountPaise),
      s.paymentMethod,
      STATUS_LABEL[s.status] || s.status,
    ]),
  ];
  return saveCsv(rows, `${safeName(report.roomName)}_${report.month}.csv`);
}

export async function exportMonthlyPdf(report) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = pdfHeader(doc, report.roomName, `Monthly settle-up · ${report.monthLabel}`);

  autoTable(doc, {
    ...tableTheme,
    startY: y,
    theme: 'plain',
    styles: { ...tableTheme.styles, fontSize: 10 },
    body: [
      ['Total approved spending', rs(report.totals.approvedPaise)],
      ['Approved expenses', String(report.totals.approvedCount)],
      ['People in the room', String(report.headCount)],
      shareLine(report, rs),
      ...(report.totals.pendingCount
        ? [[`Waiting for approval (${report.totals.pendingCount}, not included)`, rs(report.totals.pendingPaise)]]
        : []),
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 260 } },
  });
  y = doc.lastAutoTable.finalY + 24;

  y = sectionTitle(doc, 'Who pays whom', y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['From', 'To', 'Amount']],
    body: report.transfers.length
      ? report.transfers.map((t) => [t.fromName, t.toName, rs(t.amountPaise)])
      : [[{ content: 'Everyone is settled for this month', colSpan: 3, styles: { halign: 'center' } }]],
    columnStyles: { 2: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 24;

  y = sectionTitle(doc, 'Per person', y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Name', 'Paid', 'Fair share', 'Spent more / less', 'Still to settle']],
    body: report.members.map((m) => [
      m.name,
      rs(m.paidPaise),
      rs(m.sharePaise),
      `${m.differencePaise >= 0 ? '+' : '-'}${rs(Math.abs(m.differencePaise))}`,
      m.remainingPaise > 0
        ? `Gets ${rs(m.remainingPaise)}`
        : m.remainingPaise < 0
          ? `Pays ${rs(-m.remainingPaise)}`
          : 'Settled',
    ]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 24;

  y = sectionTitle(doc, 'Expenses', y);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Date', 'Title', 'Category', 'Paid by', 'Amount', 'Status']],
    body: report.expenses.length
      ? report.expenses.map((e) => [
          day(e.expenseDate),
          e.title,
          e.category,
          e.paidByName,
          rs(e.amountPaise),
          STATUS_LABEL[e.status] || e.status,
        ])
      : [[{ content: 'No expenses this month', colSpan: 6, styles: { halign: 'center' } }]],
    columnStyles: { 4: { halign: 'right' } },
  });

  if (report.settlements.length) {
    y = doc.lastAutoTable.finalY + 24;
    y = sectionTitle(doc, 'Payments', y);
    autoTable(doc, {
      ...tableTheme,
      startY: y,
      head: [['Date', 'From', 'To', 'Amount', 'Status']],
      body: report.settlements.map((s) => [
        day(s.settledAt),
        s.fromName,
        s.toName,
        rs(s.amountPaise),
        STATUS_LABEL[s.status] || s.status,
      ]),
      columnStyles: { 3: { halign: 'right' } },
    });
  }

  pdfFooter(doc);
  await saveBlob(doc.output('blob'), `${safeName(report.roomName)}_${report.month}.pdf`);
}

// ─── Personal expenses ────────────────────────────────────────────────────────

export function exportPersonalCsv(expenses, label = 'my_expenses') {
  const total = expenses.reduce((s, e) => s + (e.amountInSmallestUnit || 0), 0);
  const rows = [
    ['Date', 'Title', 'Category', 'Amount (INR)'],
    ...expenses.map((e) => [day(e.expenseDate), e.title, e.category, rupees(e.amountInSmallestUnit)]),
    [],
    ['Total', '', '', rupees(total)],
  ];
  return saveCsv(rows, `${safeName(label)}.csv`);
}

export async function exportPersonalPdf(expenses, { name = 'My expenses', label = 'my_expenses' } = {}) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const total = expenses.reduce((s, e) => s + (e.amountInSmallestUnit || 0), 0);
  const y = pdfHeader(doc, name, `${expenses.length} expenses · Total ${rs(total)}`);
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Date', 'Title', 'Category', 'Amount']],
    body: expenses.map((e) => [day(e.expenseDate), e.title, e.category, rs(e.amountInSmallestUnit)]),
    foot: [['', '', 'Total', rs(total)]],
    footStyles: { fillColor: [232, 241, 255], textColor: [23, 43, 77], fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' } },
  });
  pdfFooter(doc);
  await saveBlob(doc.output('blob'), `${safeName(label)}.pdf`);
}
