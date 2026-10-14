function DetailPanel({ id, eyebrow, title, onClose, children }) {
  return (
    <section aria-label={`${title} details`} className="detail-panel" id={id}>
      <div className="detail-panel-heading">
        <div>
          <span className="section-kicker">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <button aria-label="Close details" className="detail-close" onClick={onClose} type="button">×</button>
      </div>
      <div className="detail-panel-content">{children}</div>
    </section>
  )
}

export default DetailPanel
