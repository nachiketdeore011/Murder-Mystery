import { HashTable } from '../dsa/HashTable.js'
import { SUSPECT_RANKING_CONFIG } from '../data/suspectEvidenceRelationships.js'

const VALID_STANCES = new Set(['supporting', 'contradicting', 'neutral'])

function buildRecordIndex(records, label, warnings) {
  const index = new HashTable()
  if (!Array.isArray(records)) {
    warnings.push(`The ${label} collection is unavailable.`)
    return index
  }

  for (const record of records) {
    if (!record || typeof record.id !== 'string' || !record.id) {
      warnings.push(`A ${label} record has no usable string ID and was skipped.`)
      continue
    }
    if (index.has(record.id)) {
      warnings.push(`Duplicate ${label} ID ${record.id} was skipped.`)
      continue
    }
    index.set(record.id, record)
  }
  return index
}

function asDiscoveredSet(value, warnings) {
  if (value instanceof Set) return new Set([...value].filter((id) => typeof id === 'string'))
  if (Array.isArray(value)) return new Set(value.filter((id) => typeof id === 'string'))
  warnings.push('Discovered evidence IDs were unavailable; no evidence was scored.')
  return new Set()
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value)
}

function makeEvidenceReference(record, stance, points, rationale) {
  return {
    id: record.id,
    title: record.title || record.id,
    stance,
    points,
    rationale: rationale || 'No additional case-specific rationale was provided.',
  }
}

function getPriorityLabel(score, directionalCount, config) {
  if (directionalCount < config.minimumDirectionalClues) return 'Insufficient evidence'
  if (score >= config.priorityThresholds.high) return 'High investigation priority'
  if (score >= config.priorityThresholds.moderate) return 'Moderate investigation priority'
  return 'Low investigation priority'
}

/**
 * Rank records by an auditable investigation-priority rule, never by guilt.
 * Only discovered evidence with an explicit relationship can affect a score.
 * Duplicate suspect/evidence pairs count once; conflicting duplicate stances
 * are ignored and reported. The caller's arrays and records are not mutated.
 *
 * Expected complexity with ID indexes: O(S + E + R + T + A + S log S), where
 * S is suspects, E evidence, R relationship records, T timeline events and A
 * suspect/event associations. Building fallback indexes is linear in records.
 */
export function rankSuspects({
  suspects = [],
  evidence = [],
  timeline = [],
  discoveredEvidenceIds = new Set(),
  relationships = [],
  caseIndex,
  scoringConfig = SUSPECT_RANKING_CONFIG,
} = {}) {
  const dataWarnings = []
  const suspectIndex = buildRecordIndex(suspects, 'suspect', dataWarnings)
  const evidenceIndex = buildRecordIndex(evidence, 'evidence', dataWarnings)
  const timelineIndex = buildRecordIndex(timeline, 'timeline event', dataWarnings)
  const discovered = asDiscoveredSet(discoveredEvidenceIds, dataWarnings)
  const config = {
    points: { ...SUSPECT_RANKING_CONFIG.points, ...(scoringConfig?.points || {}) },
    minimumDirectionalClues: Number.isInteger(scoringConfig?.minimumDirectionalClues)
      ? Math.max(0, scoringConfig.minimumDirectionalClues)
      : SUSPECT_RANKING_CONFIG.minimumDirectionalClues,
    priorityThresholds: {
      ...SUSPECT_RANKING_CONFIG.priorityThresholds,
      ...(scoringConfig?.priorityThresholds || {}),
    },
  }
  const getSuspect = (id) => caseIndex?.getSuspectById?.(id) ?? suspectIndex.get(id)
  const getEvidence = (id) => caseIndex?.getEvidenceById?.(id) ?? evidenceIndex.get(id)
  const getTimelineEvent = (id) => caseIndex?.getTimelineEventById?.(id) ?? timelineIndex.get(id)

  const suspectIds = new Set(suspectIndex.keys())
  const normalizedRelationships = new HashTable()
  const conflictingPairs = new Set()

  if (!Array.isArray(relationships)) {
    dataWarnings.push('Relationship data is unavailable; no evidence relationships were applied.')
  } else {
    for (const relationship of relationships) {
      if (!relationship || typeof relationship.suspectId !== 'string' || typeof relationship.evidenceId !== 'string') {
        dataWarnings.push('A relationship without usable suspect/evidence IDs was skipped.')
        continue
      }

      // Do not even resolve or report a hidden record through a relationship.
      if (!discovered.has(relationship.evidenceId)) continue

      const pairKey = JSON.stringify([relationship.suspectId, relationship.evidenceId])
      if (conflictingPairs.has(pairKey)) continue
      if (!suspectIds.has(relationship.suspectId) || !getSuspect(relationship.suspectId)) {
        dataWarnings.push(`A discovered relationship references missing suspect ${relationship.suspectId}.`)
        continue
      }
      const record = getEvidence(relationship.evidenceId)
      if (!record || !evidenceIndex.has(relationship.evidenceId)) {
        dataWarnings.push(`A discovered relationship references missing evidence ${relationship.evidenceId}.`)
        continue
      }
      if (Array.isArray(record.relatedSuspectIds) && !record.relatedSuspectIds.includes(relationship.suspectId)) {
        dataWarnings.push(`Relationship ${relationship.suspectId}/${relationship.evidenceId} conflicts with the case record and was skipped.`)
        continue
      }
      if (!VALID_STANCES.has(relationship.stance)) {
        dataWarnings.push(`A discovered relationship for ${relationship.evidenceId} has an unsupported stance and was skipped.`)
        continue
      }

      const previous = normalizedRelationships.get(pairKey)
      if (previous) {
        if (previous.stance !== relationship.stance) {
          normalizedRelationships.delete(pairKey)
          conflictingPairs.add(pairKey)
          dataWarnings.push(`Conflicting discovered relationships for ${relationship.suspectId}/${relationship.evidenceId} were ignored.`)
        }
        continue
      }
      normalizedRelationships.set(pairKey, relationship)
    }
  }

  const eventIdsBySuspect = new HashTable()
  const seenEventAssociations = new Set()
  if (Array.isArray(timeline)) {
    for (const event of timeline) {
      if (!event || typeof event.id !== 'string' || !Array.isArray(event.relatedSuspectIds)) continue
      for (const suspectId of event.relatedSuspectIds) {
        if (!suspectIds.has(suspectId)) continue
        const associationKey = JSON.stringify([suspectId, event.id])
        if (seenEventAssociations.has(associationKey)) continue
        seenEventAssociations.add(associationKey)
        const eventIds = eventIdsBySuspect.get(suspectId) || []
        eventIds.push(event.id)
        eventIdsBySuspect.set(suspectId, eventIds)
      }
    }
  }

  const relationshipsBySuspect = new HashTable()
  for (const [, relationship] of normalizedRelationships.entries()) {
    const suspectRelationships = relationshipsBySuspect.get(relationship.suspectId) || []
    suspectRelationships.push(relationship)
    relationshipsBySuspect.set(relationship.suspectId, suspectRelationships)
  }

  const results = []
  for (const suspectId of suspectIndex.keys()) {
    const suspect = getSuspect(suspectId) || suspectIndex.get(suspectId)
    let score = 0
    const supportingEvidence = []
    const contradictingEvidence = []
    const neutralEvidence = []

    for (const relationship of relationshipsBySuspect.get(suspectId) || []) {
      const record = getEvidence(relationship.evidenceId)
      if (!record) continue
      if (relationship.stance === 'supporting') {
        const points = Math.abs(config.points.supporting)
        score += points
        supportingEvidence.push(makeEvidenceReference(record, relationship.stance, points, relationship.rationale))
      } else if (relationship.stance === 'contradicting') {
        const points = -Math.abs(config.points.contradicting)
        score += points
        contradictingEvidence.push(makeEvidenceReference(record, relationship.stance, points, relationship.rationale))
      } else {
        neutralEvidence.push(makeEvidenceReference(record, relationship.stance, 0, relationship.rationale))
      }
    }

    const directionalEvidenceCount = supportingEvidence.length + contradictingEvidence.length
    const priorityLabel = getPriorityLabel(score, directionalEvidenceCount, config)
    const supportingPoints = supportingEvidence.reduce((sum, item) => sum + item.points, 0)
    const contradictingPoints = contradictingEvidence.reduce((sum, item) => sum + item.points, 0)
    const affectingClues = [...supportingEvidence, ...contradictingEvidence]
    const directionalSummary = `${directionalEvidenceCount} discovered directionally classified clue${directionalEvidenceCount === 1 ? '' : 's'} ${directionalEvidenceCount === 1 ? 'affects' : 'affect'} this profile`
    const clueSummary = affectingClues.length
      ? ` Discovered clues affecting this score: ${affectingClues.map((item) => `${item.id} (${item.title})`).join('; ')}.`
      : ''
    const explanation = directionalEvidenceCount < config.minimumDirectionalClues
      ? `Investigation score: ${formatSigned(score)}. ${directionalSummary}; at least ${config.minimumDirectionalClues} are required for a meaningful priority label. This score is not a probability of guilt.${clueSummary}`
      : `Investigation score: ${formatSigned(score)}. ${supportingEvidence.length} discovered clue${supportingEvidence.length === 1 ? '' : 's'} support further investigation (${formatSigned(supportingPoints)} total); ${contradictingEvidence.length} discovered clue${contradictingEvidence.length === 1 ? '' : 's'} contradict this lead (${formatSigned(contradictingPoints)} total). This is an investigation priority, not a probability of guilt.${clueSummary}`

    const unresolvedQuestions = [
      'What independent information could corroborate or challenge the reported account?',
      'Which additional discovered clues, if any, can establish a reliable time or location?',
    ]
    const relevantTimelineEvents = (eventIdsBySuspect.get(suspectId) || [])
      .map((id) => getTimelineEvent(id))
      .filter(Boolean)
      .map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        title: event.title,
        description: event.description,
        confirmed: Boolean(event.confirmed),
        locationId: event.locationId || null,
      }))

    results.push({
      id: suspect.id,
      name: suspect.name,
      initials: suspect.initials || suspect.name?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2) || '?',
      role: suspect.role || '',
      score,
      rankPosition: null,
      priorityLabel,
      supportingEvidence,
      contradictingEvidence,
      neutralEvidence,
      supportingCount: supportingEvidence.length,
      contradictingCount: contradictingEvidence.length,
      directionalEvidenceCount,
      relevantTimelineEvents,
      unresolvedQuestions,
      explanation,
    })
  }

  results.sort((left, right) => right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  let previousScore
  let currentRank = 0
  results.forEach((suspect, index) => {
    if (index === 0 || suspect.score !== previousScore) currentRank = index + 1
    suspect.rankPosition = currentRank
    previousScore = suspect.score
  })

  return {
    rankedSuspects: results,
    dataWarnings,
    hasMeaningfulEvidence: results.some((suspect) => suspect.directionalEvidenceCount >= config.minimumDirectionalClues),
  }
}

export default rankSuspects
