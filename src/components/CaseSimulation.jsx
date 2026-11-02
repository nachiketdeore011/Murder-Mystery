import { useEffect, useMemo, useState } from 'react'
import ProgressBar from './ProgressBar.jsx'
import { case001 } from '../data/case001.js'
import { caseSolution } from '../data/caseSolution.js'
import {
  buildCaseSimulation,
  describeRouteChoice,
  evaluateSimulationAccusation,
} from '../simulation/caseSimulation.js'

const AUTOPLAY_INTERVAL_MS = 4200

const OUTCOME_LABELS = {
  case_solved: 'Case solved',
  correct_incomplete: 'Correct suspect, incomplete citation',
  promising_reasoning_incorrect: 'Promising reasoning, wrong suspect',
  incorrect_accusation: 'Incorrect accusation',
  insufficient_evidence: 'Insufficient evidence to evaluate',
}

const REASONING_LABELS = {
  well_supported: 'Well supported',
  partially_supported: 'Partially supported',
  limited_context: 'Limited context only',
  insufficient: 'Not supported',
}

function typeLabel(type) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function SearchDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <ul className="simulation-detail-list">
        {detail.matches.map((match) => (
          <li key={`${match.type}-${match.id}`}>
            <span className="simulation-detail-id">{match.id}</span>
            <span className="simulation-detail-copy">
              <strong>{match.title}</strong>
              <span>{typeLabel(match.type)} · matched on {match.matchingWords.join(', ')}</span>
              {!match.isUnlocked && <span className="simulation-sealed">Sealed — inspect its card in the Clue Register to uncover it.</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="simulation-detail-foot">
        Prefix “{detail.nearMissPrefix}” returns {detail.nearMissCount} results. The Trie matches whole words from
        their first letter, so a fragment from the middle of a word never finds anything.
      </p>
    </div>
  )
}

function ClueDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <dl className="simulation-facts">
        <div><dt>Filed in</dt><dd>{detail.filedAtName}</dd></div>
        <div><dt>Noted time</dt><dd>{detail.timestamp || 'None recorded'}</dd></div>
        <div><dt>Stated reliability</dt><dd>{detail.reliability}</dd></div>
        <div><dt>Weight</dt><dd>{detail.weight === 'essential' ? 'Carries the reconstruction' : 'Context only'}</dd></div>
      </dl>
      <p className="simulation-detail-foot">{detail.relevance}</p>
    </div>
  )
}

function SuspectsDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <ul className="simulation-detail-list is-wide">
        {detail.rows.map((row) => (
          <li key={row.id}>
            <span className="simulation-detail-id">{row.id}</span>
            <span className="simulation-detail-copy">
              <strong>{row.name}</strong>
              <span>{row.role} · cited in {row.linkedClueCount} discovered {row.linkedClueCount === 1 ? 'clue' : 'clues'}</span>
              <span>Stated alibi: {row.alibi}</span>
              <span>Possible motive: {row.motive}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RankingDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <table className="simulation-table">
        <caption>Investigation priority after {detail.rows.length} profiles were scored</caption>
        <thead>
          <tr>
            <th scope="col">Profile</th>
            <th scope="col">Score</th>
            <th scope="col">Clues affecting it</th>
            <th scope="col">Priority</th>
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{row.score > 0 ? `+${row.score}` : row.score}</td>
              <td>{row.directionalEvidenceCount}</td>
              <td>{row.priorityLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.warnings.length > 0 && (
        <ul className="simulation-detail-list">
          {detail.warnings.map((warning) => <li key={warning}><span className="simulation-detail-copy"><span>{warning}</span></span></li>)}
        </ul>
      )}
    </div>
  )
}

function DeductionDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <div className="simulation-facts-inline">
        <span className="status-pill is-active">Theory {detail.status}</span>
        <span>{detail.supporting.length} supporting · {detail.contradicting.length} conflicting · {detail.neutral.length} context</span>
      </div>
      <ul className="simulation-detail-list">
        {detail.supporting.map((fact) => (
          <li key={`support-${fact.id}`}>
            <span className="simulation-detail-id">{fact.id}</span>
            <span className="simulation-detail-copy"><strong>{fact.title}</strong><span>Follow-up lead</span></span>
          </li>
        ))}
        {detail.contradicting.map((fact) => (
          <li key={`contradict-${fact.id}`}>
            <span className="simulation-detail-id">{fact.id}</span>
            <span className="simulation-detail-copy"><strong>{fact.title}</strong><span>Conflicts with the theory — review the source</span></span>
          </li>
        ))}
      </ul>
      <ul className="simulation-questions">
        {detail.unresolvedQuestions.map((question) => <li key={question}>{question}</li>)}
      </ul>
    </div>
  )
}

function NetworkDetail({ detail }) {
  return (
    <div className="simulation-detail">
      <dl className="simulation-facts">
        {Object.entries(detail.nodeCounts).map(([type, count]) => (
          <div key={type}><dt>{typeLabel(type)} nodes</dt><dd>{count}</dd></div>
        ))}
      </dl>
      <p className="simulation-detail-foot">
        Link types drawn: {detail.edgeTypes.join(', ')}. {detail.validation.valid
          ? 'Every link resolves at both ends.'
          : `The network reported ${detail.validation.errors.length} broken link(s).`}
      </p>
    </div>
  )
}

function StepDetail({ step }) {
  if (!step.detail) return null
  switch (step.detail.kind) {
    case 'search': return <SearchDetail detail={step.detail} />
    case 'clue': return <ClueDetail detail={step.detail} />
    case 'suspects': return <SuspectsDetail detail={step.detail} />
    case 'ranking': return <RankingDetail detail={step.detail} />
    case 'deduction': return <DeductionDetail detail={step.detail} />
    case 'network': return <NetworkDetail detail={step.detail} />
    default: return null
  }
}

// The accusation is the one place the reader's own choices decide the ending,
// so it owns its own draft and scores it with the game's live evaluator.
export function SimulationAccusationForm({ caseFile, choice, clueOptions, discoveredEvidenceIds, simulation, solution }) {
  const [suspectId, setSuspectId] = useState('')
  const [evidenceIds, setEvidenceIds] = useState([])
  const [explanation, setExplanation] = useState('')
  const [result, setResult] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const toggleEvidence = (evidenceId) => {
    setEvidenceIds((current) => (current.includes(evidenceId)
      ? current.filter((id) => id !== evidenceId)
      : [...current, evidenceId]))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!suspectId) {
      setResult({ valid: false, errors: ['Select a suspect from this case before submitting an accusation.'] })
      return
    }
    setResult(evaluateSimulationAccusation({
      caseFile,
      discoveredEvidenceIds,
      explanation,
      selectedEvidenceIds: evidenceIds,
      selectedSuspectId: suspectId,
      solution,
    }))
  }

  const clear = () => {
    setSuspectId('')
    setEvidenceIds([])
    setResult(null)
  }

  return (
    <form className="simulation-form" onSubmit={submit}>
      <fieldset>
        <legend>{choice.prompt}</legend>
        <ul className="simulation-options is-inline">
          {choice.suspects.map((suspect) => (
            <li key={suspect.id}>
              <label className={`simulation-option${suspectId === suspect.id ? ' is-selected' : ''}`}>
                <input
                  checked={suspectId === suspect.id}
                  name="simulation-suspect"
                  onChange={() => setSuspectId(suspect.id)}
                  type="radio"
                  value={suspect.id}
                />
                <span className="simulation-option-name">{suspect.name}</span>
                <span className="simulation-option-meta">{suspect.role}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Cite the clues that carry your case</legend>
        <ul className="simulation-options">
          {clueOptions.map((clue) => (
            <li key={clue.id}>
              <label className={`simulation-option${evidenceIds.includes(clue.id) ? ' is-selected' : ''}`}>
                <input
                  checked={evidenceIds.includes(clue.id)}
                  onChange={() => toggleEvidence(clue.id)}
                  type="checkbox"
                  value={clue.id}
                />
                <span className="simulation-option-name">{clue.id} · {clue.title}</span>
                <span className="simulation-option-meta">{clue.category} · filed in the {clue.filedAtName}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="simulation-field">
        <span>Explain your reasoning</span>
        <textarea onChange={(event) => setExplanation(event.target.value)} rows={4} value={explanation} />
      </label>

      <div className="simulation-form-actions">
        <button className="button button-primary" type="submit">Submit accusation</button>
        <button className="button button-secondary" onClick={clear} type="button">Clear</button>
      </div>

      {result && (
        <div aria-live="polite" className="simulation-verdict">
          {result.valid ? (
            <>
              <p className={`simulation-outcome${result.outcome === 'case_solved' ? ' is-success' : ''}`}>
                {OUTCOME_LABELS[result.outcome] || result.outcome}
              </p>
              <ul className="simulation-questions">
                <li>Accused: {result.selectedSuspectName}</li>
                <li>Reasoning: {REASONING_LABELS[result.reasoningAssessment] || result.reasoningAssessment}</li>
                <li>Cited clues: {result.supportingEvidenceIds.length} supporting, {result.contextualEvidenceIds.length} context, {result.irrelevantEvidenceIds.length} unrelated</li>
                <li>Essential clues still missing: {result.missingEssentialEvidenceIds.length ? result.missingEssentialEvidenceIds.join(', ') : 'none'}</li>
              </ul>
              <p className="simulation-detail-foot">{result.feedback}</p>
            </>
          ) : (
            <p className="simulation-detail-foot is-error">{result.errors.join(' ')}</p>
          )}
        </div>
      )}

      {result?.valid && !revealed && (
        <button className="button button-secondary" onClick={() => setRevealed(true)} type="button">
          Show the reconstruction&apos;s answer
        </button>
      )}
      {revealed && (
        <p className="simulation-note">
          <strong>The reconstruction names {simulation.culpritName}</strong>
          Citing {choice.recommendedEvidenceIds.join(', ')} is the shortest fully supported case. The walkthrough continues from there; your own verdict stands above.
        </p>
      )}
    </form>
  )
}

function CaseSimulation({ caseFile = case001, onOpenInvestigation, onReturnHome, solution = caseSolution }) {
  const simulation = useMemo(() => buildCaseSimulation({ caseFile, solution }), [caseFile, solution])
  const steps = simulation.steps
  const [stepIndex, setStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [routeChoiceId, setRouteChoiceId] = useState('')
  const [runId, setRunId] = useState(0)

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1
  const discoveredPercent = Math.round((step.discoveredIds.length / simulation.totals.clueTotal) * 100)

  useEffect(() => {
    if (!isPlaying) return undefined
    // A decision step waits for the reader, so auto-play stops there.
    if (step.kind === 'decision' || isLastStep) {
      setIsPlaying(false)
      return undefined
    }
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1))
    }, AUTOPLAY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isPlaying, isLastStep, step.kind, steps.length])

  const goToStep = (nextIndex) => {
    setStepIndex(Math.min(Math.max(nextIndex, 0), steps.length - 1))
  }

  const restart = () => {
    setIsPlaying(false)
    setStepIndex(0)
    setRouteChoiceId('')
    // Remounting the accusation form clears the draft it owns.
    setRunId((current) => current + 1)
  }

  const routeOption = step.choice?.kind === 'route'
    ? step.choice.options.find((option) => option.id === routeChoiceId)
    : null

  return (
    <main className="simulation-page" aria-labelledby="simulation-title">
      <header className="simulation-header">
        <div className="simulation-heading">
          <span className="section-kicker">{simulation.caseId} · SIMULATION</span>
          <h1 id="simulation-title">{simulation.title}, one session at a time</h1>
          <p className="simulation-subtitle">
            {steps.length} steps · {simulation.totals.essentialCount} clues carry the reconstruction ·
            every figure below is computed by the same code the game runs
          </p>
        </div>
        <div className="simulation-header-actions">
          <button className="button button-secondary" onClick={onReturnHome} type="button">← Return to Home</button>
          <button className="button button-primary" onClick={() => onOpenInvestigation(step.targetId)} type="button">
            Open the real investigation
          </button>
        </div>
      </header>

      <p className="simulation-disclaimer">{simulation.disclaimer}</p>

      <div className="simulation-layout">
        <nav aria-label="Simulation steps" className="simulation-rail">
          <ol>
            {steps.map((entry, index) => (
              <li key={entry.id}>
                <button
                  aria-current={index === stepIndex ? 'step' : undefined}
                  className={`simulation-rail-button${index === stepIndex ? ' is-current' : ''}${index < stepIndex ? ' is-passed' : ''}`}
                  onClick={() => goToStep(index)}
                  type="button"
                >
                  <span aria-hidden="true" className="simulation-rail-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="simulation-rail-copy">
                    <span className="simulation-rail-title">{entry.title}</span>
                    <span className="simulation-rail-section">{entry.section}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="simulation-stage">
          <p aria-live="polite" className="simulation-live">
            Step {step.stepNumber} of {steps.length}: {step.title} — {step.section}
          </p>

          <div className="simulation-stage-topline">
            <span className="section-kicker">STEP {step.stepNumber} OF {steps.length} · {step.phase}</span>
            <span className="simulation-section-chip">Investigation section · {step.section}</span>
          </div>

          <h2>{step.title}</h2>
          <p className="simulation-coach">{step.coach}</p>

          {step.route && (
            <p className="simulation-route">
              <strong>Walk</strong>
              {step.route.pathNames.join(' → ')} · {step.route.cost} cost units · {step.route.visitedCount} rooms finalised by Dijkstra
            </p>
          )}

          <dl className="simulation-beat">
            <div><dt>What the detective does</dt><dd>{step.action}</dd></div>
            <div><dt>What comes back</dt><dd>{step.result}</dd></div>
          </dl>

          {step.note && (
            <p className="simulation-note"><strong>{step.note.label}</strong>{step.note.text}</p>
          )}

          <StepDetail step={step} />

          {step.choice?.kind === 'route' && (
            <div className="simulation-choice">
              <h3>{step.choice.prompt}</h3>
              <ul className="simulation-options">
                {step.choice.options.map((option) => (
                  <li key={option.id}>
                    <button
                      aria-pressed={routeChoiceId === option.id}
                      className={`simulation-option${routeChoiceId === option.id ? ' is-selected' : ''}`}
                      onClick={() => setRouteChoiceId(option.id)}
                      type="button"
                    >
                      <span className="simulation-option-name">{option.name}</span>
                      <span className="simulation-option-meta">
                        {option.cost} cost units · {option.filedClueIds.length} clue{option.filedClueIds.length === 1 ? '' : 's'} filed
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {routeOption && (
                <p className={`simulation-verdict is-${describeRouteChoice({ option: routeOption, recommendedId: step.choice.recommendedId }).tone}`}>
                  {describeRouteChoice({ option: routeOption, recommendedId: step.choice.recommendedId }).message}
                </p>
              )}
              {!routeOption && <p className="simulation-detail-foot">Pick a room to see its route cost and what is filed there.</p>}
            </div>
          )}

          {step.choice?.kind === 'accusation' && (
            <SimulationAccusationForm
              caseFile={caseFile}
              choice={{
                ...step.choice,
                suspects: step.detail.suspects,
              }}
              clueOptions={step.detail.clueOptions}
              discoveredEvidenceIds={step.discoveredIds}
              key={runId}
              simulation={simulation}
              solution={solution}
            />
          )}

          <div className="simulation-progress">
            <div className="progress-numbers">
              <strong>{step.discoveredIds.length}<span> / {simulation.totals.clueTotal}</span></strong>
              <span>clues discovered</span>
            </div>
            <ProgressBar label={`${discoveredPercent}% of clues collected`} value={discoveredPercent} />
          </div>

          <p className="algorithm-tag">{step.algorithm.label}</p>
          <p className="simulation-algorithm-detail">{step.algorithm.detail}</p>

          <div className="simulation-controls">
            <button className="button button-secondary" disabled={isFirstStep} onClick={() => goToStep(stepIndex - 1)} type="button">
              ← Previous step
            </button>
            <button className="button button-secondary" onClick={() => setIsPlaying((current) => !current)} type="button">
              {isPlaying ? 'Pause auto-play' : 'Auto-play steps'}
            </button>
            <button className="button button-primary" disabled={isLastStep} onClick={() => goToStep(stepIndex + 1)} type="button">
              {isLastStep ? 'End of walkthrough' : 'Next step →'}
            </button>
            <button className="button button-secondary" onClick={restart} type="button">Restart</button>
            <button className="button button-secondary" onClick={() => onOpenInvestigation(step.targetId)} type="button">
              Open “{step.section}” and try it yourself
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default CaseSimulation
