import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateAccusation } from '../algorithms/caseResolution.js'
import { evaluateTheory } from '../algorithms/deductionEngine.js'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { caseSolution } from '../data/caseSolution.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'

const OUTCOME_COPY = {
  case_solved: { title: 'Case solved', eyebrow: 'FINAL ACCUSATION · SUPPORTED', tone: 'success' },
  correct_incomplete: { title: 'Correct suspect, incomplete case', eyebrow: 'FINAL ACCUSATION · PARTIAL SUPPORT', tone: 'caution' },
  promising_reasoning_incorrect: { title: 'Promising clues, incorrect accusation', eyebrow: 'FINAL ACCUSATION · REVIEW THE THEORY', tone: 'caution' },
  incorrect_accusation: { title: 'The accusation is not supported', eyebrow: 'FINAL ACCUSATION · CASE REVIEW', tone: 'warning' },
  insufficient_evidence: { title: 'Not enough clues to resolve the case', eyebrow: 'FINAL ACCUSATION · INCONCLUSIVE', tone: 'caution' },
}

function getRecord(records, id) {
  return records.find((record) => record.id === id)
}

function CaseResolution({ caseFile, completion, discoveredEvidenceIds, onResetProgress, onSelectEvidence }) {
  const [confirmReplay, setConfirmReplay] = useState(false)
  const [replayMessage, setReplayMessage] = useState('')
  const headingRef = useRef(null)
  const result = useMemo(() => evaluateAccusation({
    selectedSuspectId: completion.selectedSuspectId,
    selectedEvidenceIds: completion.selectedEvidenceIds,
    explanation: completion.explanation,
    discoveredEvidenceIds,
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    events: caseFile.events,
    caseFile,
    solution: caseSolution,
  }), [caseFile, completion, discoveredEvidenceIds])
  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const suspectRanking = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
  }), [caseFile, discoveredEvidenceIds, relationships])
  const priority = suspectRanking.rankedSuspects.find((suspect) => suspect.id === completion.selectedSuspectId)
  const deduction = useMemo(() => result.valid ? evaluateTheory({
    suspectId: completion.selectedSuspectId,
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    locations: caseFile.locations,
    discoveredEvidenceIds,
    relationships,
  }) : null, [caseFile, completion.selectedSuspectId, discoveredEvidenceIds, relationships, result.valid])

  // preventScroll keeps the case resolution banner from yanking the page on mount.
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [completion])

  const selectedSuspect = getRecord(caseFile.suspects, completion.selectedSuspectId)
  const outcome = result.valid ? OUTCOME_COPY[result.outcome] : null
  const selectedEvidence = completion.selectedEvidenceIds
    .map((id) => getRecord(caseFile.evidence, id))
    .filter((record) => record && discoveredEvidenceIds.has(record.id))
  const missingEssential = result.valid ? result.missingEssentialEvidenceIds : []
  const timelineRecords = caseSolution.timelineEventIds
    .map((id) => getRecord(caseFile.events, id))
    .filter(Boolean)

  const playAgain = () => {
    const reset = onResetProgress({ source: 'replay' })
    if (reset?.status === 'cancelled') {
      setReplayMessage(reset.error || 'Replay was cancelled; your progress is unchanged.')
      setConfirmReplay(false)
      return
    }
    setReplayMessage(reset?.ok === false
      ? 'The current session was reset, but browser storage could not confirm deletion. Check the save status before reloading.'
      : 'A new investigation has started. Your previous case file was cleared from this save.')
    setConfirmReplay(false)
  }

  return (
    <section aria-labelledby="case-resolution-title" className="investigation-section accusation-section" id="final-accusation">
      <div className={"resolution-banner is-" + (outcome?.tone || 'warning')}>
        <span className="section-kicker">{outcome?.eyebrow || 'COMPLETED CASE · SAVE VALIDATION'}</span>
        <h2 id="case-resolution-title" ref={headingRef} tabIndex={-1}>{outcome?.title || 'Completed accusation could not be reviewed'}</h2>
        <p>{result.valid ? result.feedback : 'This saved accusation no longer matches the available clues. Your investigation journal and bookmarks remain intact.'}</p>
      </div>

      {result.valid && (
        <>
          <div className="resolution-overview">
            <article className="resolution-card">
              <span className="detail-label">Selected suspect</span>
              <strong>{selectedSuspect?.name || 'Unknown suspect'}</strong>
              <span>{selectedSuspect?.role || ''}</span>
              <span className="resolution-assessment">{result.correctSuspect ? 'Matches the configured case solution' : 'Does not match the configured case solution'}</span>
            </article>
            <article className="resolution-card">
              <span className="detail-label">Evidence support</span>
              <strong>{result.supportingEvidenceIds.length} supporting · {result.contextualEvidenceIds.length} contextual</strong>
              <span>{missingEssential.length ? missingEssential.length + ' essential clue' + (missingEssential.length === 1 ? '' : 's') + ' not cited' : 'All essential clues cited'}</span>
              <span className="resolution-assessment">Assessment: {result.reasoningAssessment.replaceAll('_', ' ')}</span>
            </article>
            <article className="resolution-card">
              <span className="detail-label">Accusation recorded</span>
              <strong>{new Date(completion.completedAt).toLocaleString()}</strong>
              <span>Investigation progress is preserved for review.</span>
            </article>
          </div>

          <div className="resolution-columns">
            <section className="resolution-detail-card" aria-labelledby="resolution-explanation-title">
              <h3 id="resolution-explanation-title">Configured case reconstruction</h3>
              <p>{caseSolution.explanation}</p>
              <p className="resolution-caveat">{caseSolution.solutionLimits}</p>
              <h4>Documented motive</h4>
              <p>{getRecord(caseFile.suspects, caseSolution.culpritSuspectId)?.motive || 'No motive is documented.'}</p>
            </section>
            <section className="resolution-detail-card" aria-labelledby="resolution-timeline-title">
              <h3 id="resolution-timeline-title">Relevant reported timeline</h3>
              <ol className="resolution-timeline">
                {timelineRecords.map((event) => (
                  <li key={event.id}>
                    <time>{event.timestamp}</time>
                    <strong>{event.title}</strong>
                    <span>{event.description}</span>
                    <em>{event.confirmed ? 'Confirmed report' : 'Unverified account'}</em>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="resolution-detail-card" aria-labelledby="resolution-evidence-title">
            <div className="section-heading-row">
              <div><span className="section-kicker">PLAYER-CITED CLUES</span><h3 id="resolution-evidence-title">Clues in the accusation</h3></div>
              <span className="section-count">{selectedEvidence.length} cited</span>
            </div>
            {selectedEvidence.length ? (
              <ul className="resolution-evidence-list">
                {selectedEvidence.map((item) => {
                  const role = result.supportingEvidenceIds.includes(item.id)
                    ? 'Supports the configured reconstruction'
                    : result.contextualEvidenceIds.includes(item.id)
                      ? 'Relevant context; not decisive'
                      : 'No configured solution link'
                  return <li key={item.id}><span>{item.id}</span><strong>{item.title}</strong><small>{role}</small><button className="resolution-record-link" onClick={() => onSelectEvidence?.(item.id)} type="button">Open discovered clue</button></li>
                })}
              </ul>
            ) : <p>No clues were cited in this accusation.</p>}
            {missingEssential.length > 0 && (
              <div className="resolution-missed-clues">
                <h4>Essential clues not cited</h4>
                <ul>
                  {missingEssential.map((id) => {
                    const record = getRecord(caseFile.evidence, id)
                    const discovered = discoveredEvidenceIds.has(id)
                    return <li key={id}><span>{id}</span>{discovered ? record?.title : 'Clue not discovered during this run'}</li>
                  })}
                </ul>
              </div>
            )}
            {result.irrelevantEvidenceIds.length > 0 && <p className="resolution-caveat">{result.irrelevantEvidenceIds.length} cited clue{result.irrelevantEvidenceIds.length === 1 ? ' has' : 's have'} no configured connection to this solution. No meaning was inferred from the written explanation.</p>}
          </section>

          <section className="resolution-detail-card" aria-labelledby="accusation-theory-title">
            <h3 id="accusation-theory-title">Your explanation</h3>
            <blockquote className="player-accusation-text">{completion.explanation}</blockquote>
            <p className="resolution-caveat">The game checks your selected suspect and cited clue IDs. It does not use natural-language AI to judge the meaning or quality of your written theory.</p>
          </section>

          <section className="resolution-detail-card" aria-labelledby="resolution-analysis-title">
            <span className="section-kicker">TASKS 9–10 · SEPARATE ANALYSES</span>
            <h3 id="resolution-analysis-title">Priority and deduction review</h3>
            <div className="resolution-analysis-grid">
              <article>
                <span className="detail-label">Investigation priority</span>
                <strong>{priority?.priorityLabel || 'Insufficient clues'} · score {priority?.score ?? 0}</strong>
                <p>{priority?.explanation || 'No ranking result is available.'}</p>
                <small>This score prioritizes follow-up; it is not a guilt probability or verdict.</small>
              </article>
              <article>
                <span className="detail-label">Deduction consistency</span>
                <strong>{deduction?.status.replaceAll('_', ' ') || 'Unavailable'}</strong>
                <p>{deduction?.explanation || 'No deduction result is available.'}</p>
              </article>
            </div>
            {deduction && (
              <div className="resolution-deduction-groups">
                <div><h4>Supported follow-up facts</h4>{deduction.supportingFacts.length ? <ul>{deduction.supportingFacts.map((fact) => <li key={fact.id}><strong>{fact.title}</strong><span>{fact.explanation}</span>{fact.evidenceId && <button className="resolution-record-link" onClick={() => onSelectEvidence?.(fact.evidenceId)} type="button">Open discovered clue · {fact.evidenceId}</button>}</li>)}</ul> : <p>No discovered support is linked to this profile.</p>}</div>
                <div><h4>Contradictions</h4>{deduction.contradictingFacts.length ? <ul>{deduction.contradictingFacts.map((fact) => <li key={fact.id}><strong>{fact.title}</strong><span>{fact.explanation}</span>{fact.evidenceId && <button className="resolution-record-link" onClick={() => onSelectEvidence?.(fact.evidenceId)} type="button">Open discovered clue · {fact.evidenceId}</button>}</li>)}</ul> : <p>No explicit contradiction was established.</p>}</div>
                <div><h4>Unresolved questions</h4>{deduction.unresolvedQuestions.length ? <ul>{deduction.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}</ul> : <p>No unresolved questions were returned by the rule evaluator.</p>}</div>
              </div>
            )}
          </section>
        </>
      )}

      <div className="resolution-actions">
        <a className="button button-secondary" href="#suspect-analysis">Review Suspect Analysis</a>
        <a className="button button-secondary" href="#deduction-lab">Review Deduction Lab</a>
        <a className="button button-secondary" href="#investigation-journal">Review Journal</a>
        {!confirmReplay ? (
          <button className="button button-danger" onClick={() => { setReplayMessage(''); setConfirmReplay(true) }} type="button">Play Again</button>
        ) : (
          <div className="replay-confirmation" role="group" aria-label="Confirm replay">
            <p>Start over? This clears this case’s discoveries, journal, bookmarks and current accusation from the save.</p>
            <button className="button button-danger" onClick={playAgain} type="button">Confirm Play Again</button>
            <button className="button button-secondary" onClick={() => setConfirmReplay(false)} type="button">Cancel</button>
          </div>
        )}
      </div>
      {replayMessage && <p aria-live="polite" className="accusation-feedback">{replayMessage}</p>}
    </section>
  )
}

function FinalAccusation({ caseFile, discoveredEvidenceIds, progress, onComplete, onResetProgress, onSelectEvidence }) {
  const [selectedSuspectId, setSelectedSuspectId] = useState('')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState([])
  const [explanation, setExplanation] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [formError, setFormError] = useState('')
  const headingRef = useRef(null)
  const discoveredRecords = useMemo(
    () => caseFile.evidence.filter((item) => discoveredEvidenceIds.has(item.id)),
    [caseFile.evidence, discoveredEvidenceIds],
  )
  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const ranking = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
  }), [caseFile, discoveredEvidenceIds, relationships])
  const selectedPriority = ranking.rankedSuspects.find((suspect) => suspect.id === selectedSuspectId)
  const selectedDeduction = useMemo(() => selectedSuspectId ? evaluateTheory({
    suspectId: selectedSuspectId,
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    locations: caseFile.locations,
    discoveredEvidenceIds,
    relationships,
  }) : null, [caseFile, discoveredEvidenceIds, relationships, selectedSuspectId])

  // Focus follows the review step, not the page load: moving focus on mount
  // would pull the first-time player past the guided tour at the top.
  useEffect(() => {
    if (!reviewing) return
    headingRef.current?.focus({ preventScroll: true })
  }, [reviewing])

  useEffect(() => {
    if (progress.completion) return
    setSelectedSuspectId('')
    setSelectedEvidenceIds([])
    setExplanation('')
    setFormError('')
    setReviewing(false)
  }, [progress.completion])

  useEffect(() => {
    setSelectedEvidenceIds((current) => current.filter((id) => discoveredEvidenceIds.has(id)))
  }, [discoveredEvidenceIds])

  if (progress.completion) {
    return <CaseResolution caseFile={caseFile} completion={progress.completion} discoveredEvidenceIds={discoveredEvidenceIds} onResetProgress={onResetProgress} onSelectEvidence={onSelectEvidence} />
  }

  const toggleEvidence = (id) => {
    setSelectedEvidenceIds((current) => current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id])
  }

  const submitForReview = (event) => {
    event.preventDefault()
    setFormError('')
    if (!selectedSuspectId) {
      setFormError('Select one suspect before reviewing the accusation.')
      return
    }
    if (!explanation.trim() || explanation.trim().length > 2000) {
      setFormError('Write an explanation of 1–2000 characters before continuing.')
      return
    }
    setReviewing(true)
  }

  const confirmAccusation = () => {
    // This is the first point at which the solution is evaluated or revealed.
    const result = evaluateAccusation({
      selectedSuspectId,
      selectedEvidenceIds,
      explanation,
      discoveredEvidenceIds,
      suspects: caseFile.suspects,
      evidence: caseFile.evidence,
      events: caseFile.events,
      caseFile,
      solution: caseSolution,
    })
    if (!result.valid) {
      setFormError(result.errors.join(' '))
      setReviewing(false)
      return
    }
    onComplete({ selectedSuspectId, selectedEvidenceIds: [...selectedEvidenceIds], explanation: explanation.trim(), outcome: result.outcome })
  }

  const selectedSuspect = getRecord(caseFile.suspects, selectedSuspectId)
  const selectedEvidence = selectedEvidenceIds
    .filter((id) => discoveredEvidenceIds.has(id))
    .map((id) => getRecord(caseFile.evidence, id))
    .filter(Boolean)
  const progressPercent = caseFile.evidence.length ? Math.round((discoveredRecords.length / caseFile.evidence.length) * 100) : 0

  return (
    <section aria-labelledby="final-accusation-title" className="investigation-section accusation-section" id="final-accusation">
      <div className="section-heading-row">
        <div><span className="section-kicker">THE LAST QUESTION</span><h2 id="final-accusation-title" ref={headingRef} tabIndex={-1}>Make Final Accusation</h2></div>
        <span className="section-count">{reviewing ? 'Final review' : 'Player decision'}</span>
      </div>

      {!reviewing ? (
        <>
          <div className="accusation-readiness">
            <div>
              <span className="detail-label">Investigation readiness</span>
              <strong>{discoveredRecords.length} / {caseFile.evidence.length} clues discovered · {progressPercent}%</strong>
              <span>{progress.journalEntries.length} journal entries · {progress.bookmarks.suspects.length + progress.bookmarks.evidence.length + progress.bookmarks.locations.length} bookmarks</span>
            </div>
            <p>{discoveredRecords.length ? 'You may accuse now. A complete clue collection is not required, though a limited set of clues may leave important questions open.' : 'No clue has been discovered. You may still continue, but the accusation will be marked as insufficiently supported.'}</p>
          </div>
          <nav aria-label="Optional investigation review" className="accusation-review-links">
            <a href="#suspect-analysis">Review Suspect Analysis</a>
            <a href="#deduction-lab">Review Deduction Lab</a>
            <a href="#investigation-journal">Review Investigation Journal</a>
          </nav>

          <details className="accusation-analysis-review">
            <summary>Optional review: investigation priority and deduction</summary>
            {selectedPriority && selectedDeduction ? (
              <div className="accusation-analysis-summary">
                <article><span className="detail-label">Task 9 · Investigation priority</span><strong>{selectedPriority.priorityLabel} · score {selectedPriority.score}</strong><p>{selectedPriority.explanation}</p></article>
                <article><span className="detail-label">Task 10 · Theory consistency</span><strong>{selectedDeduction.status.replaceAll('_', ' ')}</strong><p>{selectedDeduction.explanation}</p></article>
                <p className="resolution-caveat">Priority orders follow-up leads; deduction checks documented facts. Neither determines the configured case solution.</p>
              </div>
            ) : <p className="resolution-caveat">Select a suspect to review their current score and deduction result. The game does not preselect a suspect.</p>}
          </details>

          <form className="accusation-form" onSubmit={submitForReview}>
            <fieldset className="accusation-fieldset">
              <legend><span className="section-kicker">01 · SELECT ONE PROFILE</span></legend>
              <div className="accusation-suspect-grid">
                {caseFile.suspects.map((suspect) => (
                  <label className={"accusation-suspect-option" + (selectedSuspectId === suspect.id ? ' is-selected' : '')} key={suspect.id}>
                    <input checked={selectedSuspectId === suspect.id} name="final-suspect" onChange={() => setSelectedSuspectId(suspect.id)} type="radio" value={suspect.id} />
                    <span className="suspect-avatar" aria-hidden="true">{suspect.initials}</span>
                    <span className="accusation-suspect-copy"><strong>{suspect.name}</strong><small>{suspect.role} · {suspect.age}</small><span>{suspect.biography}</span><small><b>Possible motive:</b> {suspect.motive}</small><small><b>Stated account:</b> {suspect.alibi}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="accusation-fieldset">
              <legend><span className="section-kicker">02 · CITE DISCOVERED CLUES</span></legend>
              <p className="section-intro">Only clues already discovered are selectable. You may cite any number of them; selection does not change discovery progress.</p>
              {discoveredRecords.length ? (
                <div className="accusation-evidence-grid">
                  {discoveredRecords.map((item) => (
                    <label className={"accusation-evidence-option" + (selectedEvidenceIds.includes(item.id) ? ' is-selected' : '')} key={item.id}>
                      <input checked={selectedEvidenceIds.includes(item.id)} onChange={() => toggleEvidence(item.id)} type="checkbox" value={item.id} />
                      <span className="evidence-id">{item.id}</span><strong>{item.title}</strong><small>{item.category} · {item.reliability} reliability</small>
                    </label>
                  ))}
                </div>
              ) : <p className="empty-results">No discovered clues are available to cite.</p>}
              {selectedEvidence.length > 0 && <div className="selected-accusation-evidence"><span className="detail-label">Selected clues · {selectedEvidence.length}</span><ul>{selectedEvidence.map((item) => <li key={item.id}><span>{item.id} · {item.title}</span><button aria-label={"Remove " + item.title + " from accusation"} onClick={() => toggleEvidence(item.id)} type="button">Remove</button></li>)}</ul></div>}
            </fieldset>

            <label className="control-label accusation-explanation-label" htmlFor="accusation-explanation">03 · EXPLAIN YOUR THEORY
              <textarea id="accusation-explanation" maxLength={2000} onChange={(event) => setExplanation(event.target.value)} placeholder="Why this suspect? Which discovered clues matter? How does the reported timeline fit, and what motive do you think the clues support?" required rows={5} value={explanation} />
              <span className="field-hint">1–2000 characters. This is your written theory; the game does not use natural-language AI to judge it. {explanation.length}/2000</span>
            </label>
            {formError && <p aria-live="assertive" className="accusation-error">{formError}</p>}
            <button className="button button-primary" disabled={!selectedSuspectId || !explanation.trim()} type="submit">Review accusation</button>
          </form>
        </>
      ) : (
        <div className="accusation-confirmation" aria-labelledby="accusation-review-title">
          <span className="section-kicker">FINAL REVIEW · NO RESULT SHOWN YET</span>
          <h3 id="accusation-review-title" tabIndex={-1} ref={headingRef}>Confirm your accusation</h3>
          <div className="accusation-review-grid">
            <div><span className="detail-label">Selected suspect</span><strong>{selectedSuspect?.name || 'No suspect selected'}</strong><span>{selectedSuspect?.role}</span></div>
            <div><span className="detail-label">Discovered clues cited</span>{selectedEvidence.length ? <ul>{selectedEvidence.map((item) => <li key={item.id}>{item.id} · {item.title}</li>)}</ul> : <p>No clue selected. The evaluation may be insufficient.</p>}</div>
            <div className="accusation-review-theory"><span className="detail-label">Your explanation</span><p>{explanation.trim()}</p></div>
          </div>
          <p className="resolution-caveat">Confirming reveals the configured fictional case reconstruction. You can return to revise this review without losing your discovery progress.</p>
          {formError && <p aria-live="assertive" className="accusation-error">{formError}</p>}
          <div className="resolution-actions">
            <button className="button button-secondary" onClick={() => setReviewing(false)} type="button">Back and revise</button>
            <button className="button button-primary" onClick={confirmAccusation} type="button">Confirm accusation and reveal result</button>
          </div>
        </div>
      )}
    </section>
  )
}

export default FinalAccusation
