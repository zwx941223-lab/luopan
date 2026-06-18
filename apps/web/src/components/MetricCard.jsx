export function MetricCard({ label, value, accent }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong className={accent ? `accent-${accent}` : ""}>{value}</strong>
    </article>
  );
}
