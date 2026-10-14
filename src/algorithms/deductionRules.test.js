import { describe, expect, it } from 'vitest'
import { evaluateDeductionRules } from './deductionRules.js'

const locations = [{ id: 'L-A' }, { id: 'L-B' }]
const oneRule = [{
  id: 'location-check',
  type: 'same_time_distinct_locations',
  title: 'Same-time location check',
  purpose: 'Check only explicit confirmed location observations.',
  conditions: 'At least two verified observations at the same timestamp.',
  violationMeaning: 'Incompatible records need review.',
}]

function observation(locationId, timestamp = '9:30 PM') {
  return { suspectId: 'S-A', locationId, timestamp, confirmed: true }
}

describe('evaluateDeductionRules', () => {
  it('detects a genuine contradiction between explicit confirmed observations', () => {
    const result = evaluateDeductionRules({
      suspectId: 'S-A',
      evidence: [{ id: 'E-A', suspectLocationObservations: [observation('L-A')] }],
      timeline: [{ id: 'T-A', confirmed: true, suspectLocationObservations: [observation('L-B')] }],
      locations,
      discoveredEvidenceIds: new Set(['E-A']),
      caseRules: oneRule,
    })[0]
    expect(result.result).toBe('violated')
    expect(result.referencedEvidenceIds).toEqual(['E-A'])
    expect(result.timelineEventIds).toEqual(['T-A'])
    expect(result.explanation).toMatch(/does not establish guilt/i)
  })

  it('leaves incomplete timeline or location information unresolved', () => {
    const result = evaluateDeductionRules({
      suspectId: 'S-A',
      evidence: [{ id: 'E-A', suspectLocationObservations: [observation('L-A')] }],
      timeline: [{ id: 'T-A', confirmed: false, suspectLocationObservations: [observation('L-B')] }],
      locations,
      discoveredEvidenceIds: new Set(['E-A']),
      caseRules: oneRule,
    })[0]
    expect(result.result).toBe('unresolved')
    expect(result.candidateObservationCount).toBe(1)
    expect(result.explanation).toMatch(/at least two explicit, verified/i)
  })

  it('ignores undiscovered evidence observations and never returns their IDs', () => {
    const result = evaluateDeductionRules({
      suspectId: 'S-A',
      evidence: [
        { id: 'E-OPEN', suspectLocationObservations: [observation('L-A')] },
        { id: 'E-HIDDEN', title: 'Hidden record', suspectLocationObservations: [observation('L-B')] },
      ],
      locations,
      discoveredEvidenceIds: new Set(['E-OPEN']),
      caseRules: oneRule,
    })[0]
    expect(result.result).toBe('unresolved')
    expect(result.candidateObservationCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain('E-HIDDEN')
  })

  it('does not infer presence from graph reachability or travel-time assumptions', () => {
    const graph = { hasPath: () => true, shortestPath: () => ['L-A', 'L-B'] }
    const noClaims = evaluateDeductionRules({ suspectId: 'S-A', locations, caseRules: oneRule, graph })[0]
    expect(noClaims.result).toBe('unresolved')

    const differentTimes = evaluateDeductionRules({
      suspectId: 'S-A',
      evidence: [{ id: 'E-A', suspectLocationObservations: [observation('L-A', '9:20 PM')] }],
      timeline: [{ id: 'T-A', confirmed: true, suspectLocationObservations: [observation('L-B', '9:40 PM')] }],
      locations,
      discoveredEvidenceIds: new Set(['E-A']),
      caseRules: oneRule,
      graph,
    })[0]
    expect(differentTimes.result).toBe('satisfied')
    expect(differentTimes.explanation).toMatch(/establish whereabouts between observations/i)
  })

  it('reports a satisfied check only for complete compatible observations', () => {
    const result = evaluateDeductionRules({
      suspectId: 'S-A',
      evidence: [{ id: 'E-A', suspectLocationObservations: [observation('L-A')] }],
      timeline: [{ id: 'T-A', confirmed: true, suspectLocationObservations: [observation('L-A')] }],
      locations,
      discoveredEvidenceIds: new Set(['E-A']),
      caseRules: oneRule,
    })[0]
    expect(result.result).toBe('satisfied')
    expect(result.applicable).toBe(true)
  })

  it('reports why default rules cannot be evaluated from the current case records', () => {
    const result = evaluateDeductionRules({
      suspectId: 'S001',
      evidence: [{ id: 'E003', relatedSuspectIds: ['S001'] }],
      timeline: [{ id: 'T001', relatedSuspectIds: ['S001'], confirmed: true }],
      locations,
      discoveredEvidenceIds: new Set(['E003']),
    })[0]
    expect(result.result).toBe('unresolved')
    expect(result.explanation).toMatch(/narrative alibi fields do not establish those observations/i)
    expect(result.explanation).toMatch(/corridor reachability is not evidence/i)
  })

  it('handles unknown rule IDs, malformed rules, and malformed rule lists safely', () => {
    const results = evaluateDeductionRules({
      suspectId: 'S-A',
      caseRules: [
        { id: 'unknown-rule', type: 'unsupported_constraint' },
        { type: 'same_time_distinct_locations' },
        null,
      ],
    })
    expect(results).toHaveLength(3)
    expect(results.every(({ result }) => result === 'unresolved')).toBe(true)
    expect(results[0].explanation).toMatch(/not supported/i)
    expect(evaluateDeductionRules({ caseRules: null })[0].explanation).toMatch(/malformed/i)
  })

  it('returns a diagnostic when no case-specific rules are configured', () => {
    const result = evaluateDeductionRules({ suspectId: 'S-A', caseRules: [] })[0]
    expect(result.result).toBe('unresolved')
    expect(result.ruleId).toBe('no-configured-case-rules')
    expect(result.explanation).toMatch(/did not infer a contradiction/i)
  })
})
