import { useMemo, useState } from 'react'
import AlgorithmPerformanceLab from '../components/AlgorithmPerformanceLab.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { calculateInvestigationMetrics, summarizeSessionActivity } from '../analytics/investigationAnalytics.js'
import { getActivityDescription } from '../analytics/activityLog.js'
import { evaluateTheory } from '../algorithms/deductionEngine.js'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { evaluateAccusation } from '../algorithms/caseResolution.js'
import { createCaseIndex } from '../data/caseIndex.js'
import { case001 } from '../data/case001.js'
import { caseSolution } from '../data/caseSolution.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'

function formatTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function MetricCard({ label, value, detail, accent }) {
  return <article className={'analytics-metric-card' + (accent ? ' is-accent' : '')}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function InvestigationDashboard({
  caseFile = case001,
  discoveredEvidenceIds,
  progress,
  activityLog,
  onReturnToInvestigation,
  onOpenRecord,
  onActivity,
}) {
  const [timelineFilter, setTimelineFilter] = useState('all')
  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const caseIndex = useMemo(() => createCaseIndex(caseFile), [caseFile])
  const ranking = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
    caseIndex,
  }), [caseFile, caseIndex, discoveredEvidenceIds, relationships])
  const deductionChecks = useMemo(() => caseFile.suspects.flatMap((suspect) => evaluateTheory({
    suspectId: suspect.id,
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    locations: caseFile.locations,
    discoveredEvidenceIds,
    relationships,
  }).rulesEvaluated), [caseFile, discoveredEvidenceIds, relationships])
  const caseStatus = useMemo(() => {
    if (!progress?.completion) return 'Investigating'
    const result = evaluateAccusation({
      selectedSuspectId: progress.completion.selectedSuspectId,
      selectedEvidenceIds: progress.completion.selectedEvidenceIds,
      explanation: progress.completion.explanation,
      discoveredEvidenceIds,
      suspects: caseFile.suspects,
      evidence: caseFile.evidence,
      events: caseFile.events,
      caseFile,
      solution: caseSolution,
    })
    return result.valid && result.outcome === 'case_solved' ? 'Solved' : 'Unresolved'
  }, [caseFile, discoveredEvidenceIds, progress?.completion])
  const metrics = useMemo(() => calculateInvestigationMetrics({
    caseFile,
    discoveredEvidenceIds,
    progress,
    activityLog,
    deductionChecks,
    caseStatus,
  }), [caseFile, discoveredEvidenceIds, progress, activityLog, deductionChecks, caseStatus])
  const sessionSummary = useMemo(() => summarizeSessionActivity({
    activityLog,
    caseFile,
    discoveredEvidenceIds,
  }), [activityLog, caseFile, discoveredEvidenceIds])
  const discoveredIdSet = useMemo(() => new Set(discoveredEvidenceIds), [discoveredEvidenceIds])
  const reviewedSuspects = new Set(metrics.suspects.reviewedIds)
  const reviewedTimeline = new Set(metrics.timeline.reviewedIds)
  const visibleTimeline = metrics.timeline.events.filter((event) => (
    timelineFilter === 'all' || (timelineFilter === 'confirmed' ? event.confirmed : !event.confirmed)
  ))
  const latestActivity = [...(Array.isArray(activityLog) ? activityLog : [])].slice(-12).reverse()

  const openRecord = (type, id) => {
    if (type === 'evidence' && !discoveredIdSet.has(id)) return
    onOpenRecord(type, id)
  }

  return (
    <main aria-labelledby="analytics-title" className="investigation-dashboard">
      <header className="analytics-header">
        <div><span className="section-kicker">{caseFile.id} · INVESTIGATION INTELLIGENCE</span><h1 id="analytics-title">Investigation Analytics</h1><p>Progress, records and algorithm demonstrations derived from this case’s current state.</p></div>
        <button className="button button-primary" onClick={onReturnToInvestigation} type="button">Return to Investigation</button>
      </header>

      <section aria-label="Investigation metrics" className="analytics-metrics-grid">
        <MetricCard label="Total evidence items" value={metrics.evidence.total} detail="Records in the case file" />
        <MetricCard accent label="Evidence discovered" value={metrics.evidence.discovered} detail={metrics.evidence.percentage + '% of file records discovered'} />
        <MetricCard label="Undiscovered evidence" value={metrics.evidence.undiscovered} detail="Count only; sealed details stay hidden" />
        <MetricCard label="Suspects reviewed" value={metrics.suspects.investigated + ' / ' + metrics.suspects.total} detail="Profiles opened this session" />
        <MetricCard label="Locations explored" value={metrics.locations.explored + ' / ' + metrics.locations.total} detail="Location records opened this session" />
        <MetricCard label="Timeline reviewed" value={metrics.timeline.reviewed + ' / ' + metrics.timeline.total} detail="Reports opened this session" />
        <MetricCard label="Journal entries" value={metrics.journalEntryCount} detail="Player-authored observations" />
        <MetricCard label="Bookmarks" value={metrics.bookmarkCount} detail="Saved record references" />
        <MetricCard label="Constraint checks satisfied" value={metrics.deductionChecks.total ? metrics.deductionChecks.satisfied + ' / ' + metrics.deductionChecks.total : '—'} detail={metrics.deductionChecks.total ? 'Task 10 rule results across suspect theories' : 'No applicable check can run from current facts'} />
        <MetricCard accent label="Case status" value={metrics.caseStatus} detail={progress?.completion ? 'Based on the confirmed accusation record' : 'No final accusation has been submitted'} />
      </section>

      <div className="analytics-overview-grid">
        <section aria-labelledby="analytics-evidence-title" className="analytics-section">
          <div className="analytics-section-heading"><div><span className="section-kicker">DISCOVERY PROGRESS</span><h2 id="analytics-evidence-title">Evidence register</h2></div><span className="analytics-section-count">{metrics.evidence.undiscovered} sealed</span></div>
          <ProgressBar label={metrics.evidence.discovered + ' of ' + metrics.evidence.total + ' evidence items discovered'} value={metrics.evidence.percentage} />
          <div className="analytics-category-list">
            {metrics.evidence.byCategory.length ? metrics.evidence.byCategory.map(({ category, count }) => (
              <div className="analytics-category-row" key={category}>
                <span>{category}<i aria-hidden="true"><span style={{ width: ((count / Math.max(1, metrics.evidence.discovered)) * 100) + '%' }} /></i></span>
                <strong>{count} discovered</strong>
              </div>
            )) : <p className="analytics-empty">No evidence categories are visible until a clue is discovered.</p>}
          </div>
          <div className="analytics-discovered-list">
            {metrics.evidence.discoveredRecords.map((record) => (
              <button className="analytics-record-link" key={record.id} onClick={() => openRecord('evidence', record.id)} type="button"><span>{record.id} · {record.category}</span><strong>{record.title}</strong></button>
            ))}
            {metrics.evidence.undiscovered > 0 && <div className="analytics-sealed-record" aria-label={metrics.evidence.undiscovered + ' undiscovered evidence records are sealed'}><span aria-hidden="true">▰</span><strong>{metrics.evidence.undiscovered} sealed evidence record{metrics.evidence.undiscovered === 1 ? '' : 's'}</strong><small>Titles, categories and relationships remain hidden.</small></div>}
          </div>
        </section>

        <section aria-labelledby="analytics-suspects-title" className="analytics-section">
          <div className="analytics-section-heading"><div><span className="section-kicker">TASK 9 · FOLLOW-UP PRIORITY</span><h2 id="analytics-suspects-title">Suspect overview</h2></div><span className="analytics-section-count">Priority is not guilt</span></div>
          {!ranking.hasMeaningfulEvidence && <p className="analytics-notice">Not enough discovered evidence to rank suspects meaningfully. The scores below reflect only the existing case rule and discovered records.</p>}
          <ol className="analytics-suspect-list">
            {ranking.rankedSuspects.map((suspect) => (
              <li key={suspect.id} className="analytics-suspect-row">
                <span className="analytics-rank">#{suspect.rankPosition}</span>
                <div className="analytics-suspect-copy"><strong>{suspect.name}</strong><span>{suspect.role} · {reviewedSuspects.has(suspect.id) ? 'reviewed this session' : 'not yet reviewed this session'}</span><small>{suspect.supportingCount} discovered follow-up leads · {suspect.contradictingCount} documented contradictions</small></div>
                <div className="analytics-suspect-score"><strong>{suspect.score > 0 ? '+' : ''}{suspect.score}</strong><span>{suspect.priorityLabel}</span></div>
                <button className="analytics-mini-button" onClick={() => openRecord('suspect', suspect.id)} type="button">Open profile</button>
              </li>
            ))}
          </ol>
          <p className="analytics-note">Scores express investigation priority under Task 9’s documented rule. They are not probabilities or a guilt verdict.</p>
        </section>
      </div>

      <div className="analytics-overview-grid">
        <section aria-labelledby="analytics-locations-title" className="analytics-section">
          <div className="analytics-section-heading"><div><span className="section-kicker">MALHOTRA MANSION</span><h2 id="analytics-locations-title">Locations explored</h2></div><span className="analytics-section-count">{metrics.locations.explored} / {metrics.locations.total}</span></div>
          <ul className="analytics-location-list">
            {metrics.locations.records.map((location) => (
              <li key={location.id}><button onClick={() => openRecord('location', location.id)} type="button"><span>{location.id}</span><strong>{location.name}</strong><small>{location.explored ? 'Explored this session' : 'Not yet explored this session'} · {location.discoveredEvidenceCount} discovered clue{location.discoveredEvidenceCount === 1 ? '' : 's'}</small></button></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="analytics-timeline-title" className="analytics-section">
          <div className="analytics-section-heading"><div><span className="section-kicker">INITIAL REPORTS · NOT A PROVEN SEQUENCE</span><h2 id="analytics-timeline-title">Timeline overview</h2></div><span className="analytics-section-count">{metrics.timeline.reviewed} / {metrics.timeline.total} reviewed</span></div>
          <label className="analytics-field">Show timeline records
            <select aria-label="Filter dashboard timeline records" onChange={(event) => setTimelineFilter(event.target.value)} value={timelineFilter}>
              <option value="all">All reports</option><option value="confirmed">Confirmed reports</option><option value="unverified">Unverified reports</option>
            </select>
          </label>
          <ol className="analytics-timeline-list">
            {visibleTimeline.map((event) => (
              <li key={event.id}><time>{event.timestamp}</time><div><strong>{event.title}</strong><small>{event.confirmed ? 'Confirmed report' : 'Unverified report'} · {reviewedTimeline.has(event.id) ? 'reviewed this session' : 'not yet reviewed this session'}</small></div><button className="analytics-mini-button" onClick={() => openRecord('timeline', event.id)} type="button">Open event</button></li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="analytics-activity-title" className="analytics-section analytics-activity-section">
        <div className="analytics-section-heading"><div><span className="section-kicker">CURRENT BROWSER SESSION</span><h2 id="analytics-activity-title">Investigation activity</h2></div><span className="analytics-section-count">Not saved to case progress</span></div>
        <p className="analytics-section-intro">This feed starts when the app opens and keeps the latest 100 actions. It records new actions only; earlier actions are not reconstructed or fabricated.</p>
        {latestActivity.length ? <ol className="analytics-activity-list">
          {latestActivity.map((event) => <li key={event.id}><time>{formatTime(event.occurredAt)}</time><span className="analytics-activity-mark" aria-hidden="true" /><div><strong>{getActivityDescription(event)}</strong>{event.recordId && <small>{event.recordType} ID {event.recordId}</small>}</div></li>)}
        </ol> : <p className="analytics-empty">No investigation actions have been recorded in this session yet.</p>}
      </section>

      <details className="analytics-section session-summary">
        <summary>Session summary <span className="session-summary-count">{sessionSummary.eventCount} recorded action{sessionSummary.eventCount === 1 ? '' : 's'}</span></summary>
        <p className="analytics-section-intro">A developer and teaching aid for the current browser session only. Nothing here is saved or sent anywhere.</p>
        <div className="analytics-overview-grid">
          <div>
            <span className="section-kicker">SECTIONS VISITED</span>
            {sessionSummary.sectionsVisited.length ? (
              <ul className="session-summary-list">
                {sessionSummary.sectionsVisited.map((entry) => (
                  <li key={entry.section}><span>{entry.section}</span><strong>{entry.visits}</strong></li>
                ))}
              </ul>
            ) : <p className="analytics-empty">No section has been used yet in this session.</p>}
          </div>
          <div>
            <span className="section-kicker">CLUES DISCOVERED IN ORDER</span>
            {sessionSummary.discoveredOverTime.length ? (
              <ol className="session-summary-list">
                {sessionSummary.discoveredOverTime.map((entry) => (
                  <li key={entry.recordId + entry.occurredAt}><span>{entry.recordId} · {entry.label}</span><strong>{entry.stillDiscovered ? 'discovered' : 'since reset'}</strong></li>
                ))}
              </ol>
            ) : <p className="analytics-empty">No clue has been discovered in this session yet.</p>}
          </div>
        </div>
        <p className="analytics-note">Accusation attempts this session: {sessionSummary.accusationAttempts}{sessionSummary.caseSolved ? ' (case solved)' : ''}. Confusion reports: {sessionSummary.confusionReports.length}.</p>
        {sessionSummary.confusionReports.length > 0 && (
          <ul className="session-summary-list session-summary-feedback">
            {sessionSummary.confusionReports.map((report) => (
              <li key={report.occurredAt + report.note}><span>{formatTime(report.occurredAt)}</span><strong>{report.note || 'No detail given'}</strong></li>
            ))}
          </ul>
        )}
      </details>

      <AlgorithmPerformanceLab caseFile={caseFile} discoveredEvidenceIds={discoveredEvidenceIds} onActivity={onActivity} onOpenRecord={openRecord} />

      <section aria-labelledby="complexity-title" className="analytics-section complexity-reference">
        <div className="analytics-section-heading"><div><span className="section-kicker">IMPLEMENTATION-BASED REFERENCE</span><h2 id="complexity-title">Complexity guide</h2></div></div>
        <p className="analytics-section-intro">These bounds describe the implementations present in this repository, under the stated data-structure assumptions. They are not benchmark results.</p>
        <div className="complexity-table-wrap" role="region" aria-label="Scrollable algorithm complexity reference" tabIndex="0">
          <table><thead><tr><th scope="col">Algorithm or operation</th><th scope="col">Time</th><th scope="col">Assumption / use</th></tr></thead>
            <tbody>
              <tr><th scope="row">BFS</th><td>O(V + E)</td><td>Adjacency list; scans reachable component.</td></tr>
              <tr><th scope="row">DFS</th><td>O(V + E)</td><td>Adjacency list; scans reachable component.</td></tr>
              <tr><th scope="row">Dijkstra</th><td>O((V + E) log V)</td><td>Adjacency list and binary min-heap with lazy duplicate entries; weights must be non-negative.</td></tr>
              <tr><th scope="row">Hash table lookup</th><td>Average O(1), worst O(n)</td><td>String hash calculation additionally depends on key length.</td></tr>
              <tr><th scope="row">BST search</th><td>Typical O(log n), worst O(n)</td><td>Typical bound assumes a reasonably balanced ordinary BST; balance is not guaranteed.</td></tr>
              <tr><th scope="row">Trie prefix lookup</th><td>O(L)</td><td>Expected child lookup; excludes enumeration of matching words and records.</td></tr>
              <tr><th scope="row">B+ Tree lookup</th><td>O(logₘ n)</td><td>Fixed node order m; this project uses an in-memory educational index.</td></tr>
              <tr><th scope="row">B+ Tree range search</th><td>O(logₘ n + k)</td><td>Finds the first leaf, then scans k returned entries through leaf links.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="analytics-note">V = vertices, E = edges, n = indexed records, L = query length, m = B+ Tree order, and k = returned range records. No wall-clock performance claims are made for this small fictional case.</p>
      </section>
    </main>
  )
}

export default InvestigationDashboard
