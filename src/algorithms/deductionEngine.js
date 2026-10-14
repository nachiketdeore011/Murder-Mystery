import { evaluateDeductionRules, DEFAULT_DEDUCTION_RULES } from './deductionRules.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'

const VALID_STANCES = new Set(['supporting', 'contradicting', 'neutral'])

function makeIndex(records) {
  const index = new Map()
  if (!Array.isArray(records)) return index
  for (const record of records) {
    if (record && typeof record.id === 'string' && record.id && !index.has(record.id)) {
      index.set(record.id, record)
    }
  }
  return index
}

function makeEvidenceFact(record, relationship) {
  const stance = relationship.stance
  const effect = stance === 'supporting'
    ? 'This discovered record is an explicit follow-up lead for this profile.'
    : stance === 'contradicting'
      ? 'This discovered record is explicitly classified as conflicting with this theory and needs review.'
      : 'This discovered record is linked as context and does not support or contradict the theory.'

  return {
    id: `evidence:${record.id}`,
    sourceType: 'evidence',
    evidenceId: record.id,
    title: record.title || record.id,
    stance,
    rationale: relationship.rationale || effect,
    explanation: effect,
  }
}

function addUniqueRelationship(relationships, relationship, warnings) {
  const pairKey = JSON.stringify([relationship.suspectId, relationship.evidenceId])
  const existing = relationships.get(pairKey)
  if (!existing) {
    relationships.set(pairKey, relationship)
    return
  }
  if (existing.stance !== relationship.stance) {
    relationships.delete(pairKey)
    relationships.set(pairKey, { conflict: true })
    warnings.push(`Conflicting relationship stances for discovered evidence ${relationship.evidenceId} were excluded.`)
  }
}

function makeEmptyResult(suspectId, question, explanation) {
  return {
    suspectId: typeof suspectId === 'string' ? suspectId : null,
    suspect: null,
    status: 'insufficient_evidence',
    supportingFacts: [],
    contradictingFacts: [],
    neutralFacts: [],
    unresolvedQuestions: [question],
    rulesEvaluated: [],
    timelineContext: [],
    usedEvidenceIds: [],
    dataWarnings: [],
    explanation,
  }
}

/**
 * Evaluate a theory that a suspect merits further investigation. This does
 * not determine guilt. `relatedSuspectIds` is interpreted through the same
 * explicit follow-up-lead rule used by Task 9; custom relationships may also
 * use `contradicting` or `neutral` when the case explicitly documents them.
 *
 * Only discovered evidence can become a fact or be named in a result. Timeline
 * associations are context only; they do not prove that a suspect was present.
 * The function is pure with respect to supplied records and discovery state.
 */
export function evaluateTheory({
  suspectId,
  discoveredEvidenceIds = new Set(),
  suspects = [],
  evidence = [],
  timeline = [],
  locations = [],
  relationships,
  caseRules = DEFAULT_DEDUCTION_RULES,
} = {}) {
  const suspectIndex = makeIndex(suspects)
  const evidenceIndex = makeIndex(evidence)
  const timelineRecords = Array.isArray(timeline) ? timeline : []
  const discovered = discoveredEvidenceIds instanceof Set
    ? new Set([...discoveredEvidenceIds].filter((id) => typeof id === 'string'))
    : new Set(Array.isArray(discoveredEvidenceIds)
      ? discoveredEvidenceIds.filter((id) => typeof id === 'string')
      : [])
  const suspect = typeof suspectId === 'string' ? suspectIndex.get(suspectId) : undefined

  if (!suspect) {
    return makeEmptyResult(
      suspectId,
      'The selected suspect ID does not match a record in the current case file.',
      'The selected suspect ID could not be resolved to a case record, so no theory was evaluated.',
    )
  }

  const dataWarnings = []
  const sourceRelationships = relationships === undefined
    ? createSuspectEvidenceRelationships({ evidence: Array.isArray(evidence) ? evidence : [] })
    : relationships
  const normalizedRelationships = new Map()

  if (!Array.isArray(sourceRelationships)) {
    dataWarnings.push('The explicit evidence relationship collection is unavailable; no evidence relationships were applied.')
  } else {
    for (const relationship of sourceRelationships) {
      if (!relationship || relationship.suspectId !== suspectId || typeof relationship.evidenceId !== 'string') continue

      // Check discovery before resolving or reporting an evidence record.
      if (!discovered.has(relationship.evidenceId)) continue
      const record = evidenceIndex.get(relationship.evidenceId)
      if (!record) {
        dataWarnings.push(`A discovered relationship references missing evidence ${relationship.evidenceId} and was skipped.`)
        continue
      }
      if (Array.isArray(record.relatedSuspectIds) && !record.relatedSuspectIds.includes(suspectId)) {
        dataWarnings.push(`The discovered relationship for ${relationship.evidenceId} conflicts with its source record and was skipped.`)
        continue
      }
      if (!VALID_STANCES.has(relationship.stance)) {
        dataWarnings.push(`The discovered relationship for ${relationship.evidenceId} has an unsupported stance and was skipped.`)
        continue
      }
      addUniqueRelationship(normalizedRelationships, relationship, dataWarnings)
    }
  }

  const supportingFacts = []
  const contradictingFacts = []
  const neutralFacts = []
  const usedEvidenceIds = new Set()

  for (const [pairKey, relationship] of normalizedRelationships.entries()) {
    if (relationship.conflict) continue
    const [, evidenceId] = JSON.parse(pairKey)
    const record = evidenceIndex.get(evidenceId)
    if (!record || !discovered.has(evidenceId)) continue
    const fact = makeEvidenceFact(record, relationship)
    usedEvidenceIds.add(record.id)
    if (relationship.stance === 'supporting') supportingFacts.push(fact)
    else if (relationship.stance === 'contradicting') contradictingFacts.push(fact)
    else neutralFacts.push(fact)
  }

  const rulesEvaluated = evaluateDeductionRules({
    suspectId,
    evidence: Array.isArray(evidence) ? evidence : [],
    timeline: timelineRecords,
    locations,
    discoveredEvidenceIds: discovered,
    caseRules,
  })

  const ruleContradictions = []
  for (const rule of rulesEvaluated) {
    for (const evidenceId of rule.referencedEvidenceIds || []) {
      if (discovered.has(evidenceId) && evidenceIndex.has(evidenceId)) usedEvidenceIds.add(evidenceId)
    }
    if (rule.result === 'violated') {
      ruleContradictions.push({
        id: `rule:${rule.ruleId}`,
        sourceType: 'rule',
        ruleId: rule.ruleId,
        title: rule.title,
        stance: 'contradicting',
        evidenceIds: (rule.referencedEvidenceIds || []).filter((id) => discovered.has(id) && evidenceIndex.has(id)),
        timelineEventIds: [...(rule.timelineEventIds || [])],
        explanation: rule.explanation,
      })
    }
  }
  contradictingFacts.push(...ruleContradictions)

  // Events are shown only as reported context. relatedSuspectIds does not
  // establish that the suspect was physically at the event's location.
  const timelineContext = timelineRecords
    .filter((event) => event && typeof event.id === 'string'
      && Array.isArray(event.relatedSuspectIds) && event.relatedSuspectIds.includes(suspectId))
    .map((event) => ({
      id: event.id,
      title: event.title || event.id,
      timestamp: event.timestamp || null,
      description: event.description || '',
      confirmed: event.confirmed === true,
      locationId: typeof event.locationId === 'string' ? event.locationId : null,
      explanation: event.confirmed === true
        ? 'The event is marked as a confirmed report; its association with this profile does not establish the person’s presence.'
        : 'This event is an unverified report; its association with this profile does not establish the person’s presence.',
    }))

  const unresolvedQuestions = []
  for (const warning of dataWarnings) unresolvedQuestions.push(warning)
  for (const rule of rulesEvaluated) {
    if (rule.result === 'unresolved') unresolvedQuestions.push(rule.explanation)
  }
  if (supportingFacts.length || contradictingFacts.length || neutralFacts.length) {
    unresolvedQuestions.push('What independent information could corroborate or challenge these discovered leads?')
    unresolvedQuestions.push('Which documented facts, if any, can establish a reliable account of the relevant time and place?')
  }

  const ruleSatisfied = rulesEvaluated.some((rule) => rule.result === 'satisfied')
  let status
  if (supportingFacts.length && contradictingFacts.length) status = 'inconclusive'
  else if (supportingFacts.length) status = 'supported'
  else if (contradictingFacts.length) status = 'contradicted'
  else if (neutralFacts.length || ruleSatisfied) status = 'inconclusive'
  else status = 'insufficient_evidence'

  const totalRelevantFacts = supportingFacts.length + contradictingFacts.length + neutralFacts.length
  let explanation
  if (!totalRelevantFacts && !ruleSatisfied) {
    explanation = `Not enough discovered evidence is explicitly linked to ${suspect.name} to evaluate this theory meaningfully. Timeline reports are context only, and the configured location-consistency rule remains unresolved without explicit verified observations.`
  } else {
    const parts = []
    if (supportingFacts.length) parts.push(`${supportingFacts.length} discovered follow-up lead${supportingFacts.length === 1 ? ' supports' : 's support'} further investigation`)
    if (contradictingFacts.length) parts.push(`${contradictingFacts.length} discovered contradiction${contradictingFacts.length === 1 ? ' requires' : 's require'} review`)
    if (neutralFacts.length) parts.push(`${neutralFacts.length} discovered context record${neutralFacts.length === 1 ? ' provides' : 's provide'} context without affecting the theory`)
    if (!parts.length) parts.push('the evaluated rule check found no conflict among the limited verified observations')
    explanation = `${parts.join('; ')}. These findings address whether the lead merits follow-up, not whether ${suspect.name} is guilty. Missing information is unresolved, not evidence of innocence.`
  }

  return {
    suspectId,
    suspect: { id: suspect.id, name: suspect.name, role: suspect.role || '' },
    status,
    supportingFacts,
    contradictingFacts,
    neutralFacts,
    unresolvedQuestions,
    rulesEvaluated,
    timelineContext,
    usedEvidenceIds: [...usedEvidenceIds].sort(),
    dataWarnings,
    explanation,
  }
}

export default evaluateTheory
