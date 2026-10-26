import { useMemo, useState } from 'react'
import { evaluateTheory } from '../algorithms/deductionEngine.js'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'

const STATUS_LABELS = {
  supported: 'Supported for further investigation',
  contradicted: 'A documented conflict needs review',
  inconclusive: 'Inconclusive',
  insufficient_evidence: 'Insufficient discovered clues',
}

function EvidenceFactList({ facts, emptyMessage, onSelectEvidence }) {
  if (!facts.length) return <p className="deduction-empty">{emptyMessage}</p>
  return (
    <ul className="deduction-fact-list">
      {facts.map((fact) => (
        <li className={`is-${fact.stance || 'rule'}`} key={fact.id}>
          <span className="deduction-fact-type">{fact.sourceType === 'rule' ? 'Rule result' : fact.stance === 'supporting' ? 'Follow-up lead' : fact.stance === 'contradicting' ? 'Contradicting fact' : 'Context'}</span>
          <strong>{fact.title}</strong>
          <p>{fact.explanation}</p>
          {fact.rationale && fact.rationale !== fact.explanation && <small>{fact.rationale}</small>}
          {fact.evidenceId && <button className="deduction-evidence-link" onClick={() => onSelectEvidence(fact.evidenceId)} type="button">Inspect discovered clue · {fact.evidenceId}</button>}
          {fact.evidenceIds?.map((evidenceId) => <button className="deduction-evidence-link" key={evidenceId} onClick={() => onSelectEvidence(evidenceId)} type="button">Inspect discovered clue · {evidenceId}</button>)}
        </li>
      ))}
    </ul>
  )
}

function wrapSvgText(text, maxCharacters = 21, maximumLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > maxCharacters) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > maximumLines) {
    lines.length = maximumLines
    lines[maximumLines - 1] = `${lines[maximumLines - 1].slice(0, maxCharacters - 1)}…`
  }
  return lines
}

function makeGraphNodes(result) {
  return [
    ...result.supportingFacts.map((fact) => ({ ...fact, kind: 'support', lane: 0, label: 'DISCOVERED SUPPORT' })),
    ...result.contradictingFacts.map((fact) => ({ ...fact, kind: 'contradiction', lane: 1, label: 'CONFLICT TO REVIEW' })),
    ...result.timelineContext.map((event) => ({
      id: `timeline:${event.id}`,
      kind: 'timeline',
      lane: 2,
      label: event.confirmed ? 'CONFIRMED REPORT' : 'UNVERIFIED REPORT',
      title: event.title,
      explanation: `${event.explanation} ${event.description}`,
      timelineEventId: event.id,
    })),
    ...result.rulesEvaluated.map((rule) => ({
      id: `rule:${rule.ruleId}`,
      kind: rule.result === 'violated' ? 'contradiction' : 'rule',
      lane: 3,
      label: `RULE · ${rule.result.toUpperCase()}`,
      title: rule.title,
      explanation: rule.explanation,
      evidenceIds: rule.referencedEvidenceIds,
      timelineEventIds: rule.timelineEventIds,
    })),
    ...result.unresolvedQuestions.map((question, index) => ({
      id: `question:${index}`,
      kind: 'unresolved',
      lane: 4,
      label: 'UNRESOLVED',
      title: question,
      explanation: question,
    })),
  ]
}

function DeductionGraph({ result }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const nodes = useMemo(() => makeGraphNodes(result), [result])
  const columnX = [10, 210, 410, 610, 810]
  const nodeWidth = 180
  const nodeHeight = 82
  const rowGap = 105
  const height = Math.max(220, 145 + Math.max(1, ...[0, 1, 2, 3, 4].map((lane) => nodes.filter((node) => node.lane === lane).length)) * rowGap)
  const theoryX = 410
  const theoryWidth = 180
  const nodePositions = nodes.map((node) => {
    const laneNodes = nodes.filter((candidate) => candidate.lane === node.lane)
    const index = laneNodes.findIndex((candidate) => candidate.id === node.id)
    return { ...node, x: columnX[node.lane], y: 132 + index * rowGap }
  })
  const selected = nodePositions.find(({ id }) => id === selectedNodeId)

  const activateNode = (id) => setSelectedNodeId(id)
  const onNodeKeyDown = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateNode(id)
    }
  }

  return (
    <div className="deduction-graph-section">
      <div className="deduction-graph-heading"><h4>Fact connection map</h4><span>Every node is derived from this evaluation</span></div>
      {nodes.length ? (
        <>
          <div className="deduction-graph-scroll" role="region" aria-label="Scrollable deduction graph" tabIndex="0">
            <svg aria-label={`Discovered facts and reports connected to ${result.suspect.name}'s investigation theory`} className="deduction-graph" height={height} role="img" viewBox={`0 0 1000 ${height}`} width="1000">
              <g className="deduction-graph-edges" aria-hidden="true">
                {nodePositions.map((node) => (
                  <path className={`is-${node.kind}`} d={`M ${theoryX + theoryWidth / 2} 82 V 105 H ${node.x + nodeWidth / 2} V ${node.y}`} key={`edge:${node.id}`} />
                ))}
              </g>
              <g className="deduction-graph-theory">
                <rect height="62" rx="2" width={theoryWidth} x={theoryX} y="20" />
                <text className="deduction-svg-kicker" textAnchor="middle" x={theoryX + theoryWidth / 2} y="39">INVESTIGATION THEORY</text>
                <text className="deduction-svg-title" textAnchor="middle" x={theoryX + theoryWidth / 2} y="61">{result.suspect.name}</text>
              </g>
              {nodePositions.map((node) => {
                const titleLines = wrapSvgText(node.title)
                return (
                  <g
                    aria-label={`${node.label}: ${node.title}. Select to inspect explanation.`}
                    className={`deduction-graph-node is-${node.kind}${selectedNodeId === node.id ? ' is-selected' : ''}`}
                    key={node.id}
                    onClick={() => activateNode(node.id)}
                    onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                    role="button"
                    tabIndex="0"
                  >
                    <rect height={nodeHeight} rx="2" width={nodeWidth} x={node.x} y={node.y} />
                    <text className="deduction-svg-kicker" x={node.x + 9} y={node.y + 14}>{node.label}</text>
                    {titleLines.map((line, index) => <text className="deduction-svg-title" key={`${node.id}:line:${index}`} x={node.x + 9} y={node.y + 34 + index * 13}>{line}</text>)}
                    <text className="deduction-svg-meta" x={node.x + 9} y={node.y + 73}>{node.sourceType === 'evidence' ? node.evidenceId : node.timelineEventId || node.ruleId || node.kind}</text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="deduction-graph-legend" aria-label="Deduction graph legend">
            <span className="is-support">Supporting lead</span><span className="is-contradiction">Conflict</span><span className="is-timeline">Reported context</span><span className="is-rule">Rule check</span><span className="is-unresolved">Unresolved</span>
          </div>
          <ul className="deduction-graph-fallback" aria-label="Deduction graph nodes">
            {nodePositions.map((node) => <li key={`fallback:${node.id}`}><button className={`is-${node.kind}`} onClick={() => activateNode(node.id)} type="button"><span>{node.label}</span><strong>{node.title}</strong></button></li>)}
          </ul>
          {selected && <p aria-live="polite" className="deduction-node-inspector"><strong>{selected.title}</strong>{selected.explanation}</p>}
        </>
      ) : <p className="deduction-empty">No fact or report nodes are available for this selection.</p>}
    </div>
  )
}

function DeductionSnapshot({ result, priority, onSelectEvidence }) {
  return (
    <article className="deduction-comparison-card">
      <div className="deduction-comparison-person"><h4>{result.suspect.name}</h4><span className={`deduction-status is-${result.status}`}>{STATUS_LABELS[result.status]}</span></div>
      {priority && <p className="deduction-comparison-priority">Task 9 investigation priority: {priority.score > 0 ? '+' : ''}{priority.score} · {priority.priorityLabel}</p>}
      <p>{result.explanation}</p>
      <div className="deduction-comparison-facts">
        <div><h5>Supporting facts</h5><EvidenceFactList facts={result.supportingFacts} emptyMessage="No discovered support." onSelectEvidence={onSelectEvidence} /></div>
        <div><h5>Contradictions</h5><EvidenceFactList facts={result.contradictingFacts} emptyMessage="No documented contradiction." onSelectEvidence={onSelectEvidence} /></div>
      </div>
      <div className="deduction-comparison-uncertainty"><h5>Unresolved questions</h5><ul>{result.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>
    </article>
  )
}

function DeductionLab({ caseFile, caseIndex, discoveredEvidenceIds, onSelectEvidence, onSelectTimelineEvent, onTheoryEvaluated }) {
  const firstSuspectId = caseFile.suspects[0]?.id || ''
  const secondSuspectId = caseFile.suspects[1]?.id || firstSuspectId
  const [selectedSuspectId, setSelectedSuspectId] = useState(firstSuspectId)
  const [comparisonSuspectId, setComparisonSuspectId] = useState(secondSuspectId)
  const [hasEvaluated, setHasEvaluated] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const rankResult = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
    caseIndex,
  }), [caseFile, caseIndex, discoveredEvidenceIds, relationships])
  const evaluate = (suspectId) => evaluateTheory({
    suspectId,
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    locations: caseFile.locations,
    discoveredEvidenceIds,
    relationships,
  })
  const result = useMemo(() => evaluate(selectedSuspectId), [caseFile, selectedSuspectId, discoveredEvidenceIds, relationships])
  const comparisonResult = useMemo(() => evaluate(comparisonSuspectId), [caseFile, comparisonSuspectId, discoveredEvidenceIds, relationships])
  const selectedRank = rankResult.rankedSuspects.find(({ id }) => id === selectedSuspectId)
  const resultsToCompare = selectedSuspectId === comparisonSuspectId
    ? null
    : [result, comparisonResult]

  const resetSelection = () => {
    setSelectedSuspectId(firstSuspectId)
    setComparisonSuspectId(secondSuspectId)
    setHasEvaluated(false)
    setShowComparison(false)
  }

  return (
    <section aria-labelledby="deduction-lab-title" className="investigation-section deduction-lab-section" id="deduction-lab">
      <div className="section-heading-row">
        <div><span className="section-kicker">FACTS, CONSTRAINTS, UNCERTAINTY</span><h2 id="deduction-lab-title">Deduction Lab</h2></div>
        <span className="section-count">No guilt verdicts</span>
      </div>
      <p className="section-intro">Evaluate the theory that a profile merits further investigation. The engine considers discovered clues and explicitly documented constraints; a contradiction flags clues for review and does not prove guilt.</p>

      <div className="deduction-controls">
        <label className="deduction-field">Theory to evaluate
          <select aria-label="Suspect theory to evaluate" onChange={(event) => { setSelectedSuspectId(event.target.value); setHasEvaluated(false); setShowComparison(false) }} value={selectedSuspectId}>
            {caseFile.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>Further investigate: {suspect.name}</option>)}
          </select>
        </label>
        <div className="deduction-actions">
          <button className="button button-primary" onClick={() => { setHasEvaluated(true); onTheoryEvaluated?.(selectedSuspectId) }} type="button">Evaluate theory</button>
          <button className="button button-secondary" onClick={resetSelection} type="button">Reset temporary selection</button>
        </div>
      </div>

      <div className="deduction-priority-note">
        <span className="section-kicker">TASK 9 · INVESTIGATION PRIORITY</span>
        <strong>{selectedRank ? `${selectedRank.priorityLabel} · score ${selectedRank.score > 0 ? '+' : ''}${selectedRank.score}` : 'No ranking available'}</strong>
        <p>A priority score orders follow-up leads. It is separate from the constraint evaluation below and is not a verdict or probability.</p>
      </div>

      {hasEvaluated && (
        <div aria-live="polite" className="deduction-results">
          <div className="deduction-overall">
            <div><span className="section-kicker">OVERALL ASSESSMENT · {result.suspect?.id || selectedSuspectId}</span><h3>{result.suspect?.name || 'Selected profile'}</h3></div>
            <span className={`deduction-status is-${result.status}`}>{STATUS_LABELS[result.status]}</span>
            <p>{result.explanation}</p>
          </div>

          {result.status === 'insufficient_evidence' && <p className="deduction-notice" role="status">Not enough discovered clues to evaluate this theory. Continue investigating and return when you have more information.</p>}

          <div className="deduction-result-grid">
            <section className="deduction-result-card" aria-labelledby="deduction-support-title"><h4 id="deduction-support-title">Supporting facts</h4><EvidenceFactList facts={result.supportingFacts} emptyMessage="No discovered clue explicitly supports further investigation of this profile yet." onSelectEvidence={onSelectEvidence} /></section>
            <section className="deduction-result-card is-conflict" aria-labelledby="deduction-conflict-title"><h4 id="deduction-conflict-title">Contradicting facts</h4><EvidenceFactList facts={result.contradictingFacts} emptyMessage="No discovered clue or verified rule currently establishes a contradiction." onSelectEvidence={onSelectEvidence} /></section>
            <section className="deduction-result-card" aria-labelledby="deduction-unresolved-title"><h4 id="deduction-unresolved-title">Unresolved questions</h4>
              {result.unresolvedQuestions.length ? <ul className="deduction-question-list">{result.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : <p className="deduction-empty">No additional question was produced for this evaluation.</p>}
            </section>
          </div>

          <section aria-labelledby="deduction-rules-title" className="deduction-rule-results"><h4 id="deduction-rules-title">Rules evaluated</h4>
            <ul>{result.rulesEvaluated.map((rule) => <li className={`is-${rule.result}`} key={rule.ruleId}><div><strong>{rule.title}</strong><span className={`deduction-rule-status is-${rule.result}`}>{rule.result}</span></div><p>{rule.explanation}</p>{rule.referencedEvidenceIds.map((id) => <button className="deduction-evidence-link" key={id} onClick={() => onSelectEvidence(id)} type="button">Inspect discovered clue · {id}</button>)}{rule.timelineEventIds.map((id) => <button className="deduction-evidence-link" key={id} onClick={() => onSelectTimelineEvent(id)} type="button">View reported timeline event · {id}</button>)}</li>)}</ul>
          </section>

          <section aria-labelledby="deduction-timeline-context-title" className="deduction-timeline-context"><h4 id="deduction-timeline-context-title">Relevant reported timeline context</h4>
            {result.timelineContext.length ? <ul>{result.timelineContext.map((event) => <li key={event.id}><div><span>{event.timestamp || 'Time not recorded'} · {event.confirmed ? 'Confirmed report' : 'Unverified'}</span><strong>{event.title}</strong></div><p>{event.description}</p><small>{event.locationId ? `Reported event location: ${caseIndex.getLocationById(event.locationId)?.name || event.locationId}. ` : ''}{event.explanation}</small><button className="deduction-evidence-link" onClick={() => onSelectTimelineEvent(event.id)} type="button">Jump to timeline event · {event.id}</button></li>)}</ul> : <p className="deduction-empty">No timeline event is explicitly associated with this profile.</p>}
          </section>

          <DeductionGraph result={result} />
        </div>
      )}

      <section aria-labelledby="deduction-comparison-title" className="deduction-comparison">
        <div className="deduction-comparison-heading"><div><span className="section-kicker">SAME ENGINE · SAME DISCOVERED FACTS</span><h3 id="deduction-comparison-title">Compare two theories</h3></div></div>
        <div className="deduction-comparison-controls">
          <label className="deduction-field">Compare with
            <select aria-label="Second suspect theory to compare" onChange={(event) => setComparisonSuspectId(event.target.value)} value={comparisonSuspectId}>
              {caseFile.suspects.map((suspect) => <option key={suspect.id} value={suspect.id}>{suspect.name}</option>)}
            </select>
          </label>
          <button className="button button-secondary" onClick={() => setShowComparison(true)} type="button">Compare evaluations</button>
        </div>
        {showComparison && (resultsToCompare ? (
          <div className="deduction-comparison-results"><DeductionSnapshot onSelectEvidence={onSelectEvidence} priority={rankResult.rankedSuspects.find(({ id }) => id === resultsToCompare[0].suspectId)} result={resultsToCompare[0]} /><DeductionSnapshot onSelectEvidence={onSelectEvidence} priority={rankResult.rankedSuspects.find(({ id }) => id === resultsToCompare[1].suspectId)} result={resultsToCompare[1]} /></div>
        ) : <p className="deduction-notice" role="status">Choose two different suspect profiles to compare their evaluations.</p>)}
      </section>

      <details className="deduction-explainer">
        <summary>How rule-based deduction works</summary>
        <div>
          <p>The engine frames a theory as “this profile merits further investigation.” It considers discovered clues with a documented relationship, then evaluates structured constraints. A supporting fact is a follow-up lead; a contradiction means documented clues conflict and need review; an unresolved question identifies missing information. Missing information is never evidence of innocence.</p>
          <p>The current case has explicit suspect/clue links, but those links do not claim guilt or contradiction. The rule evaluator checks only verified, timestamped suspect-location observations that are explicitly present in the case file. No such observations currently exist. Reported timeline events are context and do not prove presence; the mansion corridor graph is not used for suspect movement or alibi inference.</p>
          <p>Task 9 ranking measures follow-up priority, while this engine checks documented facts and constraints. A high priority can coexist with an inconclusive evaluation. Discovering a clue updates both views through the existing evidence state, and evaluating a theory never changes discovery progress.</p>
          <p>Each evaluation currently builds ID lookup indexes, scans the case evidence and timeline for relevant records, checks explicit relationships and evaluates configured rules: O(S + E + T + L + R), where S is suspects, E evidence, T timeline events, L locations and R relationships. The result uses linear storage in the records and findings; suspect comparison runs the same evaluation separately for each selected profile.</p>
        </div>
      </details>
    </section>
  )
}

export default DeductionLab
