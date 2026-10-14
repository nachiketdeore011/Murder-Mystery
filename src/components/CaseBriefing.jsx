import { case001 } from '../data/case001.js'

const caseDetails = [
  { label: 'Case ID', value: case001.id, className: 'case-id' },
  { label: 'Location', value: case001.location },
  { label: 'Incident time', value: case001.incidentTime },
  { label: 'Status', value: case001.status, className: 'case-status' },
  { label: 'Suspects', value: String(case001.suspects.length), className: 'suspect-count' },
]

function CaseBriefing() {
  return (
    <section aria-labelledby="case-briefing-title" className="case-briefing">
      <div className="briefing-heading">
        <span className="section-kicker">PRELIMINARY CASE FILE</span>
        <h2 id="case-briefing-title">{case001.title}</h2>
      </div>
      <dl className="briefing-details">
        {caseDetails.map(({ label, value, className = '' }) => (
          <div className="briefing-detail" key={label}>
            <dt>{label}</dt>
            <dd className={className}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default CaseBriefing
