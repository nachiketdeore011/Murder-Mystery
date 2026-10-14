export const ACCUSATION_EXPLANATION_LIMIT = 2000
export const ACCUSATION_OUTCOMES = Object.freeze([
  'case_solved',
  'correct_incomplete',
  'promising_reasoning_incorrect',
  'incorrect_accusation',
  'insufficient_evidence',
])

function indexById(records) {
  return new Map((Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record.id === 'string')
    .map((record) => [record.id, record]))
}

/** Validate solution references against the source-of-truth case collections. */
export function validateCaseSolution(solution, { caseFile } = {}) {
  const errors = []
  if (!solution || typeof solution !== 'object') return { valid: false, errors: ['A case solution is required.'] }
  if (!caseFile || solution.caseId !== caseFile.id) errors.push('The solution case ID does not match the current case.')
  const suspects = indexById(caseFile?.suspects)
  const evidence = indexById(caseFile?.evidence)
  const hasEventCollection = Array.isArray(caseFile?.events)
  const events = indexById(caseFile?.events)
  if (typeof solution.culpritSuspectId !== 'string' || !suspects.has(solution.culpritSuspectId)) {
    errors.push('The configured solution references a missing suspect.')
  }
  for (const field of ['essentialEvidenceIds', 'supportingEvidenceIds', 'contextualEvidenceIds']) {
    if (!Array.isArray(solution[field])) {
      errors.push(`The configured solution field ${field} must be an array.`)
      continue
    }
    for (const id of solution[field]) if (typeof id !== 'string' || !evidence.has(id)) errors.push(`The configured solution references missing evidence in ${field}.`)
  }
  if (!Array.isArray(solution.timelineEventIds)) errors.push('The configured timeline references must be an array.')
  else if (hasEventCollection) for (const id of solution.timelineEventIds) if (typeof id !== 'string' || !events.has(id)) errors.push('The configured solution references a missing timeline event.')
  if (!Array.isArray(solution.essentialEvidenceIds) || solution.essentialEvidenceIds.length === 0) errors.push('At least one essential evidence ID must be configured.')
  if (typeof solution.explanation !== 'string' || !solution.explanation.trim()) errors.push('The configured solution needs an explanation.')
  return { valid: errors.length === 0, errors }
}

function invalid(errors) {
  return { valid: false, errors, outcome: null }
}

/**
 * Evaluate a confirmed accusation against the configured fictional solution.
 * This checks IDs and authored evidence relationships; it does not interpret
 * arbitrary prose or claim to prove guilt. Identical inputs produce identical
 * output. Inputs and case records are never mutated.
 * With ID indexes built per evaluation, time is O(S + E + T + D + C + W):
 * suspects, evidence, timeline, discovered IDs, cited IDs and explanation text.
 */
export function evaluateAccusation({
  selectedSuspectId,
  selectedEvidenceIds = [],
  explanation,
  discoveredEvidenceIds = [],
  suspects = [],
  evidence = [],
  events,
  solution,
  caseFile,
} = {}) {
  const validationCase = caseFile || {
    id: solution?.caseId,
    suspects,
    evidence,
    ...(Array.isArray(events) ? { events } : {}),
  }
  const solutionValidation = validateCaseSolution(solution, { caseFile: validationCase })
  if (!solutionValidation.valid) return invalid(['The case solution is unavailable or incomplete.'])

  const suspectIndex = indexById(suspects)
  const evidenceIndex = indexById(evidence)
  if (typeof selectedSuspectId !== 'string' || !suspectIndex.has(selectedSuspectId)) {
    return invalid(['Select a suspect from this case before submitting an accusation.'])
  }
  if (!Array.isArray(selectedEvidenceIds) || !(Array.isArray(discoveredEvidenceIds) || discoveredEvidenceIds instanceof Set)) {
    return invalid(['Selected evidence must be a list and discovered evidence must be a list or set.'])
  }
  const discovered = new Set([...discoveredEvidenceIds].filter((id) => typeof id === 'string'))
  const normalizedEvidenceIds = []
  const seen = new Set()
  for (const id of selectedEvidenceIds) {
    if (typeof id !== 'string' || !evidenceIndex.has(id)) return invalid(['A selected evidence record is unavailable or undiscovered.'])
    if (!discovered.has(id)) return invalid(['A selected evidence record is unavailable or undiscovered.'])
    if (!seen.has(id)) {
      seen.add(id)
      normalizedEvidenceIds.push(id)
    }
  }
  const normalizedExplanation = typeof explanation === 'string' ? explanation.trim() : ''
  if (!normalizedExplanation) return invalid(['Add a brief explanation before confirming your accusation.'])
  if (normalizedExplanation.length > ACCUSATION_EXPLANATION_LIMIT) return invalid([`The explanation must be ${ACCUSATION_EXPLANATION_LIMIT} characters or fewer.`])

  const selectedSet = new Set(normalizedEvidenceIds)
  const supportingEvidenceIds = normalizedEvidenceIds.filter((id) => solution.supportingEvidenceIds.includes(id))
  const contextualEvidenceIds = normalizedEvidenceIds.filter((id) => solution.contextualEvidenceIds.includes(id))
  const relevantEvidenceIds = new Set([...supportingEvidenceIds, ...contextualEvidenceIds])
  const irrelevantEvidenceIds = normalizedEvidenceIds.filter((id) => !relevantEvidenceIds.has(id))
  const missingEssentialEvidenceIds = solution.essentialEvidenceIds.filter((id) => !selectedSet.has(id))
  const correctSuspect = selectedSuspectId === solution.culpritSuspectId
  const hasRelevantEvidence = supportingEvidenceIds.length + contextualEvidenceIds.length > 0
  let outcome
  if (!normalizedEvidenceIds.length || !hasRelevantEvidence) outcome = 'insufficient_evidence'
  else if (correctSuspect && missingEssentialEvidenceIds.length === 0) outcome = 'case_solved'
  else if (correctSuspect) outcome = 'correct_incomplete'
  else if (supportingEvidenceIds.length) outcome = 'promising_reasoning_incorrect'
  else outcome = 'incorrect_accusation'

  const reasoningAssessment = correctSuspect
    && supportingEvidenceIds.length === solution.essentialEvidenceIds.length
    && missingEssentialEvidenceIds.length === 0
    ? 'well_supported'
    : supportingEvidenceIds.length > 0
      ? 'partially_supported'
      : contextualEvidenceIds.length > 0
        ? 'limited_context'
        : 'insufficient'

  const suspect = suspectIndex.get(selectedSuspectId)
  const feedbackByOutcome = {
    case_solved: 'Your accusation matches the configured solution and cites all essential records. The conclusion remains a fictional, circumstantial reconstruction.',
    correct_incomplete: 'You selected the configured suspect, but the evidence you cited does not include every essential record. A correct guess and a supported case are different outcomes.',
    promising_reasoning_incorrect: 'Some cited records connect to the configured solution, but they do not support this suspect as the answer. Review the alternative explanations.',
    incorrect_accusation: 'The cited records do not support this accusation against the configured solution. Your investigation progress is preserved.',
    insufficient_evidence: 'The selected records do not provide enough relevant support to evaluate this accusation meaningfully.',
  }

  return {
    valid: true,
    selectedSuspectId,
    selectedSuspectName: suspect.name,
    correctSuspect,
    evidenceComplete: missingEssentialEvidenceIds.length === 0,
    supportingEvidenceIds,
    contextualEvidenceIds,
    irrelevantEvidenceIds,
    missingEssentialEvidenceIds,
    reasoningAssessment,
    explanationProvided: Boolean(normalizedExplanation),
    outcome,
    feedback: feedbackByOutcome[outcome],
  }
}

export default evaluateAccusation
