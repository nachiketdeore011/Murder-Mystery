import { useMemo, useState } from 'react'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { createSuspectEvidenceRelationships, SUSPECT_RANKING_CONFIG } from '../data/suspectEvidenceRelationships.js'

function evidenceReferences(suspect) {
  return [
    ...suspect.supportingEvidence,
    ...suspect.contradictingEvidence,
    ...suspect.neutralEvidence,
  ]
}

function EvidenceReferences({ items, emptyText, onSelectEvidence }) {
  if (!items.length) return <p className="suspect-analysis-empty">{emptyText}</p>
  return (
    <ul className="suspect-analysis-evidence-list">
      {items.map((item) => (
        <li key={item.id}>
          <button onClick={() => onSelectEvidence(item.id)} type="button">
            <span className={`analysis-evidence-stance is-${item.stance}`}>
              {item.stance === 'supporting' ? 'Follow-up lead' : item.stance === 'contradicting' ? 'Contradicting lead' : 'Context only'}
            </span>
            <strong>{item.title}</strong>
            <code>{item.id}</code>
            <small>{item.rationale}</small>
          </button>
        </li>
      ))}
    </ul>
  )
}

function SuspectAnalysis({ caseFile, caseIndex, discoveredEvidenceIds, onSelectEvidence }) {
  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const ranking = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
    caseIndex,
  }), [caseFile, discoveredEvidenceIds, relationships, caseIndex])
  const [selectedSuspectId, setSelectedSuspectId] = useState(() => caseFile.suspects[0]?.id || '')
  const [comparisonLeftId, setComparisonLeftId] = useState(() => caseFile.suspects[0]?.id || '')
  const [comparisonRightId, setComparisonRightId] = useState(() => caseFile.suspects[1]?.id || caseFile.suspects[0]?.id || '')

  const suspects = ranking.rankedSuspects
  const selectedSuspect = suspects.find((suspect) => suspect.id === selectedSuspectId) || suspects[0]
  const comparisonLeft = suspects.find((suspect) => suspect.id === comparisonLeftId)
  const comparisonRight = suspects.find((suspect) => suspect.id === comparisonRightId)
  const scoreTies = new Set(suspects.map(({ score }) => score)).size < suspects.length
  const comparisonRightEvidenceIds = new Set(comparisonRight ? evidenceReferences(comparisonRight).map(({ id }) => id) : [])
  const sharedEvidence = comparisonLeft
    ? evidenceReferences(comparisonLeft).filter(({ id }) => comparisonRightEvidenceIds.has(id))
    : []

  return (
    <section aria-labelledby="suspect-analysis-title" className="investigation-section suspect-analysis-section" id="suspect-analysis">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">DISCOVERED CLUES ONLY</span>
          <h2 id="suspect-analysis-title">Suspect Analysis</h2>
          <span className="algorithm-tag">Ranking algorithm</span>
        </div>
        <span className="section-count">Investigation priority, not guilt</span>
      </div>
      <p className="section-intro">The ranking updates from the existing discovery state. A linked clue is treated as a lead for follow-up only; it does not establish presence, responsibility, or a probability of guilt.</p>

      {!ranking.hasMeaningfulEvidence && (
        <p className="suspect-analysis-notice" role="status">
          Not enough discovered evidence to rank suspects meaningfully. Continue investigating the mansion and examining clues.
        </p>
      )}
      {scoreTies && <p className="suspect-analysis-tie-note" role="status">Some profiles share the same investigation score and rank. The tie is shown as recorded; no extra confidence is inferred.</p>}

      <ol aria-label="Suspects ordered by investigation priority" className="suspect-analysis-ranking">
        {suspects.map((suspect) => (
          <li key={suspect.id}>
            <button
              aria-pressed={selectedSuspect?.id === suspect.id}
              className={`suspect-analysis-card${selectedSuspect?.id === suspect.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedSuspectId(suspect.id)}
              type="button"
            >
              <span className="analysis-card-topline">
                <span className="analysis-rank">#{suspect.rankPosition}</span>
                <span aria-hidden="true" className="suspect-avatar">{suspect.initials}</span>
                <span className="analysis-person"><strong>{suspect.name}</strong><small>{suspect.role}</small></span>
              </span>
              <span className="analysis-score-line"><strong>{suspect.score > 0 ? '+' : ''}{suspect.score}</strong><span>{suspect.priorityLabel}</span></span>
              <span className="analysis-count-line"><span>{suspect.supportingCount} follow-up leads</span><span>{suspect.contradictingCount} contradicting</span></span>
              <span className="analysis-card-explanation">{suspect.explanation}</span>
            </button>
          </li>
        ))}
      </ol>

      {selectedSuspect && (
        <section aria-label={`${selectedSuspect.name} analysis details`} className="suspect-analysis-detail">
          <div className="suspect-analysis-detail-heading">
            <div><span className="section-kicker">PROFILE {selectedSuspect.id} · RANK #{selectedSuspect.rankPosition}</span><h3>{selectedSuspect.name}</h3></div>
            <span className="analysis-priority-pill">{selectedSuspect.priorityLabel}</span>
          </div>
          <p className="analysis-formula">Score: {selectedSuspect.supportingEvidence.reduce((sum, item) => sum + item.points, 0)} supporting points + ({selectedSuspect.contradictingEvidence.reduce((sum, item) => sum + item.points, 0)} contradicting points) = <strong>{selectedSuspect.score > 0 ? '+' : ''}{selectedSuspect.score}</strong></p>
          <p className="analysis-explanation">{selectedSuspect.explanation}</p>

          <div className="suspect-analysis-detail-grid">
            <div><h4>Discovered follow-up leads</h4><EvidenceReferences items={selectedSuspect.supportingEvidence} emptyText="No discovered follow-up lead is currently linked to this profile." onSelectEvidence={onSelectEvidence} /></div>
            <div><h4>Discovered contradicting clues</h4><EvidenceReferences items={selectedSuspect.contradictingEvidence} emptyText="No discovered clue is classified as contradicting in the current case model." onSelectEvidence={onSelectEvidence} /></div>
            <div><h4>Discovered context with no score effect</h4><EvidenceReferences items={selectedSuspect.neutralEvidence} emptyText="No discovered neutral clue is linked to this profile." onSelectEvidence={onSelectEvidence} /></div>
            <div>
              <h4>Reported timeline context · not scored</h4>
              {selectedSuspect.relevantTimelineEvents.length ? (
                <ul className="suspect-analysis-event-list">
                  {selectedSuspect.relevantTimelineEvents.map((event) => (
                    <li key={event.id}><span>{event.timestamp} · {event.confirmed ? 'Confirmed report' : 'Unverified'}</span><strong>{event.title}</strong><small>{event.description}</small>{event.locationId && <small>{caseIndex.getLocationById(event.locationId)?.name || 'Location not specified'}</small>}</li>
                  ))}
                </ul>
              ) : <p className="suspect-analysis-empty">No timeline event is linked to this profile.</p>}
            </div>
          </div>

          <div className="suspect-analysis-uncertainty">
            <h4>Unresolved questions</h4>
            <ul>{selectedSuspect.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
          </div>
          <p className="suspect-analysis-graph-note">The mansion graph models physical corridors only. It has no suspect-presence edges, so room reachability is not used to score or explain a suspect.</p>
        </section>
      )}

      <section aria-labelledby="suspect-comparison-title" className="suspect-comparison">
        <div className="suspect-comparison-heading"><div><span className="section-kicker">SAME SCORING ENGINE</span><h3 id="suspect-comparison-title">Compare two profiles</h3></div></div>
        <div className="suspect-comparison-controls">
          <label>First profile<select aria-label="First profile to compare" onChange={(event) => setComparisonLeftId(event.target.value)} value={comparisonLeftId}>{suspects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
          <span aria-hidden="true" className="comparison-divider">↔</span>
          <label>Second profile<select aria-label="Second profile to compare" onChange={(event) => setComparisonRightId(event.target.value)} value={comparisonRightId}>{suspects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        {comparisonLeft && comparisonRight && comparisonLeft.id === comparisonRight.id
          ? <p className="suspect-analysis-notice" role="status">Choose two different profiles to compare their discovered clues.</p>
          : comparisonLeft && comparisonRight && (
            <div className="suspect-comparison-results">
              {[comparisonLeft, comparisonRight].map((suspect) => (
                <article className="suspect-comparison-profile" key={suspect.id}>
                  <div><h4>{suspect.name}</h4><strong>{suspect.score > 0 ? '+' : ''}{suspect.score} · {suspect.priorityLabel}</strong></div>
                  <p>{suspect.explanation}</p>
                  <h5>Follow-up leads</h5><EvidenceReferences items={suspect.supportingEvidence} emptyText="No discovered follow-up leads." onSelectEvidence={onSelectEvidence} />
                  <h5>Contradicting clues</h5><EvidenceReferences items={suspect.contradictingEvidence} emptyText="No discovered contradicting clues." onSelectEvidence={onSelectEvidence} />
                  <h5>Reported timeline context</h5>
                  {suspect.relevantTimelineEvents.length ? <ul className="suspect-analysis-event-list">{suspect.relevantTimelineEvents.map((event) => <li key={event.id}><span>{event.timestamp} · {event.confirmed ? 'Confirmed report' : 'Unverified'}</span><strong>{event.title}</strong><small>{event.description}</small></li>)}</ul> : <p className="suspect-analysis-empty">No linked reported events.</p>}
                  <h5>Remaining uncertainty</h5><ul className="comparison-uncertainties">{suspect.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                </article>
              ))}
              <div className="suspect-comparison-shared"><h4>Shared discovered clues</h4><EvidenceReferences items={sharedEvidence} emptyText="No discovered evidence is linked to both selected profiles." onSelectEvidence={onSelectEvidence} /></div>
              <p className="suspect-analysis-graph-note">Score differences indicate follow-up priority under the displayed rule; they do not establish guilt. Timeline reports remain context only.</p>
            </div>
          )}
      </section>

      <details className="suspect-ranking-explainer">
        <summary>How this ranking works</summary>
        <div className="ranking-explainer-copy">
          <p>The engine starts with the existing suspect records and considers discovered clues only. Current case links in <code>relatedSuspectIds</code> become explicit follow-up leads under this fictional rule: each adds {SUSPECT_RANKING_CONFIG.points.supporting} point. Contradicting relationships, when explicitly configured, subtract {SUSPECT_RANKING_CONFIG.points.contradicting} point; neutral relationships add zero. Duplicate suspect/clue links count once.</p>
          <p>A priority label requires at least {SUSPECT_RANKING_CONFIG.minimumDirectionalClues} discovered directionally classified clues. Once that threshold is met, High begins at {SUSPECT_RANKING_CONFIG.priorityThresholds.high} points, Moderate at {SUSPECT_RANKING_CONFIG.priorityThresholds.moderate}, and lower totals are labeled Low. Insufficient evidence takes precedence. This case currently has no substantiated contradictory links. The score represents investigation priority, never a statistical probability or finding of guilt. Reported timeline events add context only; the physical corridor graph is not a suspect relationship graph.</p>
          <p>With ID indexes, relationship processing is O(S + E + R + T + A), plus O(S log S) to order suspects. Here S is suspects, E evidence records, R relationship records, T timeline events and A suspect/event associations. No DSA structure is forced into the score calculation beyond the existing ID lookup index.</p>
          <p>Equal weights are used because the current case does not define calibrated evidence-strength points; reliability labels are shown elsewhere and are not treated as numeric probabilities.</p>
        </div>
      </details>
    </section>
  )
}

export default SuspectAnalysis
