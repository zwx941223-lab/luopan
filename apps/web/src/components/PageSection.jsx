export function PageSection({ title, subtitle, actions, children }) {
  return (
    <section className="page-section">
      <header className="section-header">
        <div>
          <p className="section-eyebrow">{title}</p>
          {subtitle ? <h2>{subtitle}</h2> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
