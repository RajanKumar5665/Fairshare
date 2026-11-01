export default function StatCard({ label, value, tone = 'teal' }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div><span>{label}</span><strong>{value ?? '—'}</strong></div>
    </article>
  );
}
