import { useEffect, useMemo, useState } from 'react'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { createCaseIndex } from '../data/caseIndex.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'

function signed(value) {
  return value > 0 ? `+${value}` : String(value)
}

function CounterfactualLab({ caseFile, discoveredEvidenceIds, onSelectEvidence }) {
  const [excludedEvidenceIds, setExcludedEvidenceIds] = useState(() => new Set())
  const discoveredKey = [...discoveredEvidenceIds].sort().join('|')
  const discoveredEvidence = useMemo(
    () => caseFile.evidence.filter((evidence) => discoveredEvidenceIds.has(evidence.id)),
    [caseFile.evidence, discoveredKey],
  )
  const relationships = useMemo(() => createSuspectEvidenceRelationships(caseFile), [caseFile])
  const caseIndex = useMemo(() => createCaseIndex(caseFile), [caseFile])

  useEffect(() => {
    setExcludedEvidenceIds((current) => {
      const next = new Set([...current].filter((id) => discoveredEvidenceIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [discoveredKey])

  const baseline = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds,
    relationships,
    caseIndex,
  }), [caseFile, caseIndex, discoveredKey, relationships])

  const scenarioEvidenceIds = useMemo(
    () => new Set([...discoveredEvidenceIds].filter((id) => !excludedEvidenceIds.has(id))),
    [discoveredKey, excludedEvidenceIds],
  )
  const scenario = useMemo(() => rankSuspects({
    suspects: caseFile.suspects,
    evidence: caseFile.evidence,
    timeline: caseFile.events,
    discoveredEvidenceIds: scenarioEvidenceIds,
    relationships,
    caseIndex,
  }), [caseFile, caseIndex, relationships, scenarioEvidenceIds])

  const baselineById = new Map(baseline.rankedSuspects.map((suspect) => [suspect.id, suspect]))
  const scenarioLeader = scenario.rankedSuspects[0]
  const baselineLeader = baseline.rankedSuspects[0]
  const changed = excludedEvidenceIds.size > 0

  const toggleEvidence = (id) => {
    setExcludedEvidenceIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section aria-labelledby="counterfactual-title" className="investigation-section counterfactual-lab-section">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">WHAT-IF ANALYSIS · NON-DESTRUCTIVE</span>
          <h2 id="counterfactual-title">Counterfactual Theory Lab</h2>
          <span className="algorithm-tag">Hash table relationships · auditable re-ranking</span>
        </div>
        <span className="section-count">{excludedEvidenceIds.size ? `${excludedEvidenceIds.size} clue${excludedEvidenceIds.size === 1 ? '' : 's'} withheld` : 'Live case state'}</span>
      </div>
      <p className="section-intro">
        Temporarily withhold a discovered clue and see how the investigation-priority order changes. This is a sandbox: it never locks, deletes, or changes your actual case progress.
      </p>

      {!discoveredEvidence.length ? (
        <div className="counterfactual-empty">
          <strong>Discover a clue to activate the lab.</strong>
          <span>The ranking engine only accepts evidence you have actually inspected.</span>
        </div>
      ) : (
        <div className="counterfactual-workbench">
          <div className="counterfactual-controls">
            <div className="counterfactual-controls-heading">
              <div><span className="section-kicker">SCENARIO INPUTS</span><h3>Withhold clues</h3></div>
              <button className="inline-action" onClick={() => setExcludedEvidenceIds(new Set())} type="button">Reset scenario</button>
            </div>
            <p>Select a clue to remove it from the temporary ranking.</p>
            <ul className="counterfactual-clue-list">
              {discoveredEvidence.map((evidence) => {
                const isWithheld = excludedEvidenceIds.has(evidence.id)
                return (
                  <li key={evidence.id}>
                    <button
                      aria-pressed={isWithheld}
                      className={`counterfactual-clue${isWithheld ? ' is-withheld' : ''}`}
                      onClick={() => toggleEvidence(evidence.id)}
                      type="button"
                    >
                      <span className="counterfactual-clue-check" aria-hidden="true">{isWithheld ? '＋' : '✓'}</span>
                      <span><code>{evidence.id}</code><strong>{evidence.title}</strong><small>{isWithheld ? 'Withheld from scenario' : 'Included in scenario'} · {evidence.reliability} reliability</small></span>
                    </button>
                    <button className="counterfactual-inspect" onClick={() => onSelectEvidence?.(evidence.id)} type="button">Inspect</button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="counterfactual-results">
            <div className="counterfactual-verdict">
              <span className="section-kicker">SCENARIO OUTPUT</span>
              <h3>{changed && scenarioLeader?.id !== baselineLeader?.id ? 'The lead changed' : changed ? 'The lead held' : 'Baseline ranking loaded'}</h3>
              <p>{changed
                ? scenarioLeader?.id === baselineLeader?.id
                  ? `${baselineLeader.name} remains the highest-priority follow-up after the withheld clue${excludedEvidenceIds.size === 1 ? '' : 's'} is removed.`
                  : `${scenarioLeader.name} moves ahead when the withheld clue${excludedEvidenceIds.size === 1 ? '' : 's'} is removed.`
                : 'Remove one or more discovered clues to run a counterfactual ranking.'}</p>
              <small>Priority is a follow-up signal, not a probability of guilt.</small>
            </div>
            <div className="counterfactual-table-wrap">
              <table className="counterfactual-table">
                <caption>Baseline compared with the current what-if scenario</caption>
                <thead><tr><th scope="col">Profile</th><th scope="col">Rank</th><th scope="col">Score</th><th scope="col">Change</th></tr></thead>
                <tbody>
                  {scenario.rankedSuspects.map((suspect) => {
                    const original = baselineById.get(suspect.id)
                    const rankChange = original.rankPosition - suspect.rankPosition
                    const scoreChange = suspect.score - original.score
                    return (
                      <tr key={suspect.id}>
                        <th scope="row"><span>{suspect.rankPosition}</span><strong>{suspect.name}</strong></th>
                        <td>{original.rankPosition === suspect.rankPosition ? '—' : `was #${original.rankPosition}`}</td>
                        <td>{signed(suspect.score)}</td>
                        <td className={rankChange > 0 || scoreChange > 0 ? 'is-up' : rankChange < 0 || scoreChange < 0 ? 'is-down' : ''}>
                          {scoreChange === 0 && rankChange === 0 ? 'Unchanged' : `${signed(scoreChange)} score · ${rankChange > 0 ? '↑' : rankChange < 0 ? '↓' : '—'} rank`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default CounterfactualLab
