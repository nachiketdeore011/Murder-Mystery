import { describe, expect, it } from 'vitest'
import { case001 } from '../data/case001.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'
import { evaluateTheory } from './deductionEngine.js'
import { rankSuspects } from './suspectRanking.js'

function fixture() {
  return {
    suspects: [
      { id: 'S-A', name: 'Ari Vale', role: 'Guest' },
      { id: 'S-B', name: 'Noor Sen', role: 'Accountant' },
    ],
    evidence: [
      { id: 'E-A', title: 'Signed register', relatedSuspectIds: ['S-A'] },
      { id: 'E-B', title: 'Conflicting statement', relatedSuspectIds: ['S-A'] },
      { id: 'E-C', title: 'Unrelated receipt' },
      { id: 'E-HIDDEN', title: 'Hidden decisive clue', description: 'SECRET', relatedSuspectIds: ['S-A'] },
    ],
    timeline: [
      { id: 'T-A', timestamp: '9:20 PM', title: 'Reported conversation', description: 'A report.', relatedSuspectIds: ['S-A'], confirmed: false, locationId: 'L-A' },
    ],
    locations: [{ id: 'L-A', name: 'Study' }],
    relationships: [
      { suspectId: 'S-A', evidenceId: 'E-A', stance: 'supporting', rationale: 'The signed record creates a follow-up lead.' },
      { suspectId: 'S-A', evidenceId: 'E-B', stance: 'contradicting', rationale: 'The record conflicts with the stated account.' },
      { suspectId: 'S-A', evidenceId: 'E-C', stance: 'neutral', rationale: 'Context only.' },
      { suspectId: 'S-A', evidenceId: 'E-HIDDEN', stance: 'supporting', rationale: 'Must remain hidden.' },
    ],
    caseRules: [],
  }
}

describe('evaluateTheory', () => {
  it('evaluates an existing suspect and includes all five real case suspects when evaluated individually', () => {
    const relationships = createSuspectEvidenceRelationships(case001)
    const results = case001.suspects.map((suspect) => evaluateTheory({
      suspectId: suspect.id,
      suspects: case001.suspects,
      evidence: case001.evidence,
      timeline: case001.events,
      locations: case001.locations,
      relationships,
      discoveredEvidenceIds: new Set(),
    }))

    expect(results).toHaveLength(5)
    expect(results.map(({ suspectId, suspect }) => [suspectId, suspect.name])).toEqual(
      case001.suspects.map(({ id, name }) => [id, name]),
    )
    expect(results.every(({ status }) => status === 'insufficient_evidence')).toBe(true)
  })

  it('handles unknown IDs and returns insufficient evidence without exposing another record', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-UNKNOWN', ...data })
    expect(result.status).toBe('insufficient_evidence')
    expect(result.suspect).toBeNull()
    expect(result.supportingFacts).toEqual([])
    expect(result.unresolvedQuestions[0]).toMatch(/does not match/i)
  })

  it('recognizes discovered support, contradiction, and neutral context as separate facts', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A', 'E-B', 'E-C']) })
    expect(result.supportingFacts.map(({ evidenceId }) => evidenceId)).toEqual(['E-A'])
    expect(result.contradictingFacts.map(({ evidenceId }) => evidenceId)).toEqual(['E-B'])
    expect(result.neutralFacts.map(({ evidenceId }) => evidenceId)).toEqual(['E-C'])
    expect(result.status).toBe('inconclusive')
  })

  it('ignores undiscovered evidence in facts, explanations, and used references', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A']) })
    const serialized = JSON.stringify(result)
    expect(result.supportingFacts.map(({ evidenceId }) => evidenceId)).toEqual(['E-A'])
    expect(result.usedEvidenceIds).not.toContain('E-HIDDEN')
    expect(serialized).not.toContain('E-HIDDEN')
    expect(serialized).not.toContain('Hidden decisive clue')
    expect(serialized).not.toContain('SECRET')
  })

  it('recalculates when newly discovered evidence is supplied', () => {
    const data = fixture()
    const first = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A']) })
    const later = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A', 'E-B']) })
    expect(first.status).toBe('supported')
    expect(later.status).toBe('inconclusive')
    expect(later.contradictingFacts).toHaveLength(1)
  })

  it('does not double-count duplicate relationships and excludes conflicting duplicate stances', () => {
    const data = fixture()
    data.relationships.push({ ...data.relationships[0] })
    const unique = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A']) })
    expect(unique.supportingFacts).toHaveLength(1)

    data.relationships.push({ suspectId: 'S-A', evidenceId: 'E-A', stance: 'contradicting' })
    const conflict = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A']) })
    expect(conflict.supportingFacts).toHaveLength(0)
    expect(conflict.contradictingFacts).toHaveLength(0)
    expect(conflict.dataWarnings.join(' ')).toMatch(/conflicting relationship stances/i)
    expect(conflict.unresolvedQuestions.join(' ')).toMatch(/excluded/i)
  })

  it('does not invent a suspect relationship for evidence with no link', () => {
    const data = fixture()
    const result = evaluateTheory({
      suspectId: 'S-A',
      ...data,
      relationships: data.relationships.filter(({ evidenceId }) => evidenceId !== 'E-C'),
      discoveredEvidenceIds: new Set(['E-C']),
    })
    expect(result.neutralFacts).toHaveLength(0)
    expect(result.supportingFacts).toHaveLength(0)
    expect(result.status).toBe('insufficient_evidence')
  })

  it('reports unresolved questions and does not treat missing information as innocence', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(['E-A']) })
    expect(result.unresolvedQuestions.length).toBeGreaterThan(0)
    expect(result.explanation).toMatch(/not whether .* is guilty/i)
    expect(result.explanation).not.toMatch(/innocent|cleared/i)
  })

  it('shows reported timeline context without claiming that the suspect was present', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set() })
    expect(result.timelineContext).toHaveLength(1)
    expect(result.timelineContext[0].confirmed).toBe(false)
    expect(result.timelineContext[0].explanation).toMatch(/does not establish the person’s presence/i)
  })

  it('surfaces a verified constraint conflict without treating it as proof of guilt', () => {
    const result = evaluateTheory({
      suspectId: 'S-A',
      suspects: [{ id: 'S-A', name: 'Ari Vale' }],
      evidence: [{
        id: 'E-A',
        title: 'Verified register entry',
        relatedSuspectIds: ['S-A'],
        suspectLocationObservations: [{ suspectId: 'S-A', locationId: 'L-A', timestamp: '9:30 PM', confirmed: true }],
      }],
      timeline: [{
        id: 'T-A',
        confirmed: true,
        suspectLocationObservations: [{ suspectId: 'S-A', locationId: 'L-B', timestamp: '9:30 PM', confirmed: true }],
      }],
      locations: [{ id: 'L-A' }, { id: 'L-B' }],
      relationships: [],
      discoveredEvidenceIds: new Set(['E-A']),
    })
    expect(result.status).toBe('contradicted')
    expect(result.contradictingFacts.map(({ sourceType }) => sourceType)).toEqual(['rule'])
    expect(result.usedEvidenceIds).toEqual(['E-A'])
    expect(result.contradictingFacts[0].explanation).toMatch(/does not establish guilt/i)
    expect(result.explanation).toMatch(/not whether .* is guilty/i)
  })

  it('is deterministic and does not mutate records or discovery state', () => {
    const data = fixture()
    const discovered = new Set(['E-A', 'E-B'])
    const beforeData = structuredClone(data)
    const beforeDiscovered = [...discovered]
    const first = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: discovered })
    const second = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: discovered })
    expect(first).toEqual(second)
    expect(data).toEqual(beforeData)
    expect([...discovered]).toEqual(beforeDiscovered)
  })

  it('handles incomplete arrays, missing optional fields, and malformed relationship data gracefully', () => {
    const result = evaluateTheory({ suspectId: 'S-A', suspects: [{ id: 'S-A', name: 'Ari Vale' }], relationships: null })
    expect(result.status).toBe('insufficient_evidence')
    expect(result.timelineContext).toEqual([])
    expect(result.dataWarnings).toHaveLength(1)
    expect(() => evaluateTheory({ suspectId: 'S-A' })).not.toThrow()
  })

  it('uses actual existing relationships and matches the ranking priority separately from theory status', () => {
    const relationships = createSuspectEvidenceRelationships(case001)
    const discoveredEvidenceIds = new Set(['E001', 'E003'])
    const ranked = rankSuspects({
      suspects: case001.suspects,
      evidence: case001.evidence,
      timeline: case001.events,
      relationships,
      discoveredEvidenceIds,
    })
    const result = evaluateTheory({
      suspectId: 'S005',
      suspects: case001.suspects,
      evidence: case001.evidence,
      timeline: case001.events,
      locations: case001.locations,
      relationships,
      discoveredEvidenceIds,
    })
    expect(ranked.rankedSuspects.find(({ id }) => id === 'S005').score).toBe(1)
    expect(result.status).toBe('supported')
    expect(result.explanation).toMatch(/follow-up lead/i)
    expect(result.explanation).toMatch(/not whether .* is guilty/i)
  })

  it('does not use physical graph reachability as presence evidence', () => {
    const data = fixture()
    const result = evaluateTheory({ suspectId: 'S-A', ...data, discoveredEvidenceIds: new Set(), graph: { hasEdge: () => true } })
    expect(result.status).toBe('insufficient_evidence')
    expect(result.rulesEvaluated[0].result).toBe('unresolved')
    expect(result.rulesEvaluated[0].explanation).toMatch(/physical graph paths/i)
  })
})
