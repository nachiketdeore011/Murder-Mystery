function EvidenceCard({ evidence, isDiscovered, locationName, onDiscover, onInspect }) {
  return (
    <article className={`evidence-card${isDiscovered ? ' is-discovered' : ' is-locked'}`} data-evidence-id={evidence.id}>
      <div className="evidence-card-heading">
        <span className="record-id">{evidence.id}</span>
        {isDiscovered && <span className="evidence-category">{evidence.category}</span>}
      </div>
      {isDiscovered ? (
        <>
          <h3>{evidence.title}</h3>
          <p>{evidence.description}</p>
          <div className="evidence-card-footer">
            <span className="evidence-reliability">Reliability: {evidence.reliability}</span>
            <button className="inline-action" onClick={onInspect} type="button">View details</button>
          </div>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="lock-mark">—</span>
          <h3>Evidence awaiting inspection</h3>
          <p className="locked-copy">
            Sealed until you inspect it. {locationName ? `Filed in the ${locationName}.` : 'Filed in an unlisted room.'}
          </p>
          <div className="evidence-card-footer">
            <span className="locked-label">Undiscovered</span>
            <button aria-label={`Inspect the clue filed in the ${locationName || 'unlisted room'}`} className="inline-action" onClick={onDiscover} type="button">Inspect clue</button>
          </div>
        </>
      )}
    </article>
  )
}

export default EvidenceCard
