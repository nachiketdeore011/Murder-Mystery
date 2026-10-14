function timeToMinute(timestamp) {
  if (typeof timestamp !== 'string') return null
  const match = timestamp.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) return null
  return (hour % 12) * 60 + minute + (match[3].toUpperCase() === 'PM' ? 12 * 60 : 0)
}

/**
 * Structured rule definitions accepted by the deduction engine.
 *
 * A suspect's location can only be compared when a source record contains an
 * explicit `suspectLocationObservations` array. Each observation must include
 * suspectId, locationId, timestamp and confirmed:true. Timeline observations
 * additionally require the event itself to be confirmed. Same-time claims in
 * different rooms conflict; route reachability and travel time are never used.
 */
export const DEFAULT_DEDUCTION_RULES = Object.freeze([
  Object.freeze({
    id: 'same-time-location-exclusion',
    type: 'same_time_distinct_locations',
    title: 'Same-time location consistency',
    purpose: 'Check explicit, verified observations for one suspect at the same moment.',
    conditions: 'At least two confirmed observations name the same suspect and exact time but different valid locations.',
    resultWhenMet: 'Mark the records as violated when one suspect has incompatible confirmed locations at the same timestamp.',
    whyMeaningful: 'The conflicting records require source review; this constraint does not identify what happened or establish guilt.',
    violationMeaning: 'The records conflict and need source review; this does not identify what happened or prove guilt.',
  }),
])

function unresolved(rule, reason, applicable = false) {
  return {
    ruleId: rule?.id || 'unnamed-rule',
    title: rule?.title || 'Unidentified deduction rule',
    result: 'unresolved',
    applicable,
    referencedEvidenceIds: [],
    timelineEventIds: [],
    explanation: reason,
  }
}

function collectVerifiedObservations({ suspectId, evidence, timeline, locations, discoveredEvidenceIds }) {
  const locationIds = new Set((Array.isArray(locations) ? locations : [])
    .filter((location) => location && typeof location.id === 'string')
    .map((location) => location.id))
  const observations = []

  const collect = (record, sourceType) => {
    if (!record || typeof record.id !== 'string' || !record.id || !Array.isArray(record.suspectLocationObservations)) return
    for (let index = 0; index < record.suspectLocationObservations.length; index += 1) {
      const observation = record.suspectLocationObservations[index]
      if (!observation || observation.suspectId !== suspectId || observation.confirmed !== true) continue
      if (sourceType === 'timeline' && record.confirmed !== true) continue
      const minute = timeToMinute(observation.timestamp)
      if (minute === null || !locationIds.has(observation.locationId)) continue
      observations.push({
        sourceType,
        sourceId: record.id,
        observationIndex: index,
        locationId: observation.locationId,
        timestamp: observation.timestamp,
        minute,
      })
    }
  }

  if (Array.isArray(evidence)) {
    for (const record of evidence) {
      if (!record || !discoveredEvidenceIds.has(record.id)) continue
      collect(record, 'evidence')
    }
  }
  if (Array.isArray(timeline)) {
    for (const event of timeline) collect(event, 'timeline')
  }
  return observations
}

function evaluateSameTimeLocationRule({ rule, suspectId, evidence, timeline, locations, discoveredEvidenceIds }) {
  const observations = collectVerifiedObservations({ suspectId, evidence, timeline, locations, discoveredEvidenceIds })
  if (observations.length < 2) {
    return {
      ...unresolved(
        rule,
        'This rule needs at least two explicit, verified location observations for this suspect. The current reported timeline and narrative alibi fields do not establish those observations; corridor reachability is not evidence of presence.',
      ),
      candidateObservationCount: observations.length,
    }
  }

  const locationsByMinute = new Map()
  let conflict = null
  for (const observation of observations) {
    let locationsAtMinute = locationsByMinute.get(observation.minute)
    if (!locationsAtMinute) {
      locationsAtMinute = { first: observation, byLocation: new Set() }
      locationsByMinute.set(observation.minute, locationsAtMinute)
    }
    if (!locationsAtMinute.byLocation.has(observation.locationId)) {
      if (locationsAtMinute.byLocation.size > 0 && !conflict) conflict = [locationsAtMinute.first, observation]
      locationsAtMinute.byLocation.add(observation.locationId)
    }
  }

  const referencedEvidenceIds = [...new Set(observations
    .filter((observation) => observation.sourceType === 'evidence')
    .map((observation) => observation.sourceId))]
  const timelineEventIds = [...new Set(observations
    .filter((observation) => observation.sourceType === 'timeline')
    .map((observation) => observation.sourceId))]

  if (conflict) {
    const [first] = conflict
    return {
      ruleId: rule.id,
      title: rule.title,
      result: 'violated',
      applicable: true,
      referencedEvidenceIds,
      timelineEventIds,
      explanation: `Two verified records place this suspect at distinct locations at ${first.timestamp}. The accounts conflict and require review; this inconsistency does not establish guilt.`,
    }
  }

  return {
    ruleId: rule.id,
    title: rule.title,
    result: 'satisfied',
    applicable: true,
    referencedEvidenceIds,
    timelineEventIds,
    explanation: `The ${observations.length} explicit, verified location observations checked do not place this suspect in different locations at the same recorded moment. This limited check does not prove the theory or establish whereabouts between observations.`,
  }
}

/**
 * Evaluate structured constraints without inferring locations from routes or
 * narrative text. Unknown and malformed rules become unresolved records.
 */
export function evaluateDeductionRules({
  suspectId,
  evidence = [],
  timeline = [],
  locations = [],
  discoveredEvidenceIds = new Set(),
  caseRules = DEFAULT_DEDUCTION_RULES,
} = {}) {
  const discovered = discoveredEvidenceIds instanceof Set
    ? discoveredEvidenceIds
    : new Set(Array.isArray(discoveredEvidenceIds) ? discoveredEvidenceIds : [])
  if (!Array.isArray(caseRules)) {
    return [unresolved(null, 'The optional case rule list is malformed; no configured constraints could be evaluated.')]
  }
  if (caseRules.length === 0) {
    return [unresolved(
      { id: 'no-configured-case-rules', title: 'Case-specific rule check' },
      'No case-specific deduction rules are configured. The engine did not infer a contradiction from narrative descriptions or physical graph paths.',
    )]
  }

  return caseRules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !rule.id) {
      return unresolved({ id: `malformed-rule-${index + 1}` }, 'This rule is missing a valid ID or structured definition.')
    }
    if (rule.suspectId && rule.suspectId !== suspectId) {
      return unresolved(rule, 'This rule applies to a different suspect profile.', false)
    }
    if (rule.type === 'same_time_distinct_locations') {
      return evaluateSameTimeLocationRule({ rule, suspectId, evidence, timeline, locations, discoveredEvidenceIds: discovered })
    }
    return unresolved(rule, `Rule type "${String(rule.type || 'missing')}" is not supported by this evaluator.`)
  })
}

export default evaluateDeductionRules
