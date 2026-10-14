import { describe, expect, it } from 'vitest'
import { case001 } from '../data/case001.js'
import { createCaseIndex } from '../data/caseIndex.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'
import { rankSuspects } from './suspectRanking.js'

function fixture() {
  const suspects = [
    { id: 'S-A', name: 'Aster Vale', initials: 'AV', role: 'Guest' },
    { id: 'S-B', name: 'Briar North', initials: 'BN', role: 'Accountant' },
  ]
  const evidence = [
    { id: 'E-A', title: 'Verified entry', relatedSuspectIds: ['S-A'] },
    { id: 'E-B', title: 'Conflicting account', relatedSuspectIds: ['S-A'] },
    { id: 'E-C', title: 'Neutral context note', relatedSuspectIds: ['S-A'] },
    { id: 'E-D', title: 'Unlinked receipt', relatedSuspectIds: [] },
    { id: 'E-HIDDEN', title: 'Hidden sealed record', relatedSuspectIds: ['S-B'] },
  ]
  const timeline = [
    { id: 'T-A', timestamp: '9:10 PM', title: 'Reported arrival', description: 'A reported account.', relatedSuspectIds: ['S-A'], confirmed: false },
  ]
  const relationships = [
    { suspectId: 'S-A', evidenceId: 'E-A', stance: 'supporting', rationale: 'A documented lead.' },
    { suspectId: 'S-A', evidenceId: 'E-B', stance: 'contradicting', rationale: 'A documented conflict.' },
    { suspectId: 'S-A', evidenceId: 'E-C', stance: 'neutral', rationale: 'Context only.' },
    { suspectId: 'S-B', evidenceId: 'E-HIDDEN', stance: 'supporting', rationale: 'This remains sealed.' },
  ]
  return { suspects, evidence, timeline, relationships }
}

const oneClueThreshold = { minimumDirectionalClues: 1, priorityThresholds: { high: 3, moderate: 2 }, points: { supporting: 2, contradicting: 2, neutral: 0 } }

describe('rankSuspects', () => {
  it('returns all five real suspects using their source IDs and names', () => {
    const result = rankSuspects({
      suspects: case001.suspects,
      evidence: case001.evidence,
      timeline: case001.events,
      relationships: createSuspectEvidenceRelationships(case001),
      discoveredEvidenceIds: new Set(),
      caseIndex: createCaseIndex(case001),
    })
    expect(result.rankedSuspects).toHaveLength(5)
    expect(result.rankedSuspects.map(({ id }) => id).sort()).toEqual(['S001', 'S002', 'S003', 'S004', 'S005'])
    expect(result.rankedSuspects.find(({ id }) => id === 'S001').name).toBe('Rahul Malhotra')
    expect(result.rankedSuspects.every(({ priorityLabel }) => priorityLabel === 'Insufficient evidence')).toBe(true)
  })

  it('is deterministic for identical input and gives equal scores stable tie ranks', () => {
    const data = fixture()
    const input = { ...data, discoveredEvidenceIds: new Set(['E-C']) }
    const first = rankSuspects(input)
    const second = rankSuspects(input)
    expect(first).toEqual(second)
    expect(first.rankedSuspects.map(({ id }) => id)).toEqual(['S-A', 'S-B'])
    expect(first.rankedSuspects.map(({ rankPosition }) => rankPosition)).toEqual([1, 1])
  })

  it('adds configured points for discovered supporting investigation leads', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A'], scoringConfig: oneClueThreshold })
    expect(result.rankedSuspects[0].score).toBe(2)
    expect(result.rankedSuspects[0].supportingEvidence.map(({ id, points }) => [id, points])).toEqual([['E-A', 2]])
    expect(result.rankedSuspects[0].priorityLabel).toBe('Moderate investigation priority')
  })

  it('subtracts configured points for discovered contradicting relationships', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-B'], scoringConfig: oneClueThreshold })
    const suspect = result.rankedSuspects.find(({ id }) => id === 'S-A')
    expect(suspect.score).toBe(-2)
    expect(suspect.contradictingEvidence.map(({ id, points }) => [id, points])).toEqual([['E-B', -2]])
    expect(suspect.explanation).toContain('1 discovered clue contradict this lead (-2 total)')
  })

  it('excludes undiscovered evidence from scores, references, and explanations', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A'] })
    const serialized = JSON.stringify(result)
    expect(result.rankedSuspects.find(({ id }) => id === 'S-B').score).toBe(0)
    expect(serialized).not.toContain('E-HIDDEN')
    expect(serialized).not.toContain('Hidden sealed record')
    expect(serialized).not.toContain('This remains sealed')
  })

  it('updates a score when the discovered evidence set grows without mutating the set', () => {
    const data = fixture()
    const beforeIds = new Set(['E-A'])
    const before = rankSuspects({ ...data, discoveredEvidenceIds: beforeIds })
    const after = rankSuspects({ ...data, discoveredEvidenceIds: new Set([...beforeIds, 'E-B']) })
    expect(before.rankedSuspects[0].score).toBe(1)
    expect(after.rankedSuspects[0].score).toBe(0)
    expect([...beforeIds]).toEqual(['E-A'])
  })

  it('counts a duplicate suspect/evidence relationship once', () => {
    const data = fixture()
    const duplicateLinks = [...data.relationships, data.relationships[0], { ...data.relationships[0] }]
    const result = rankSuspects({ ...data, relationships: duplicateLinks, discoveredEvidenceIds: ['E-A'] })
    expect(result.rankedSuspects[0].score).toBe(1)
    expect(result.rankedSuspects[0].supportingEvidence).toHaveLength(1)
  })

  it('does not score neutral or unrelated discovered evidence', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-C', 'E-D'] })
    expect(result.rankedSuspects[0].score).toBe(0)
    expect(result.rankedSuspects[0].neutralEvidence.map(({ id }) => id)).toEqual(['E-C'])
    expect(result.rankedSuspects[1].neutralEvidence).toEqual([])
  })

  it('handles invalid discovered references safely and reports visible data warnings', () => {
    const data = fixture()
    const relationships = [
      { suspectId: 'S-MISSING', evidenceId: 'E-A', stance: 'supporting' },
      { suspectId: 'S-A', evidenceId: 'E-MISSING', stance: 'supporting' },
    ]
    const result = rankSuspects({ ...data, relationships, discoveredEvidenceIds: ['E-A', 'E-MISSING'] })
    expect(result.rankedSuspects).toHaveLength(2)
    expect(result.rankedSuspects.every(({ score }) => score === 0)).toBe(true)
    expect(result.dataWarnings.join(' ')).toContain('missing suspect S-MISSING')
    expect(result.dataWarnings.join(' ')).toContain('missing evidence E-MISSING')
  })

  it('marks profiles with too few directional discovered clues as insufficient', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A'] })
    expect(result.rankedSuspects[0].priorityLabel).toBe('Insufficient evidence')
    expect(result.hasMeaningfulEvidence).toBe(false)
  })

  it('retains contradictory clues in the result rather than hiding them', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A', 'E-B'], scoringConfig: oneClueThreshold })
    expect(result.rankedSuspects[0].supportingEvidence.map(({ id }) => id)).toEqual(['E-A'])
    expect(result.rankedSuspects[0].contradictingEvidence.map(({ id }) => id)).toEqual(['E-B'])
    expect(result.rankedSuspects[0].score).toBe(0)
  })

  it('ignores conflicting duplicate relationship stances and warns instead of choosing one', () => {
    const data = fixture()
    const relationships = [...data.relationships, { ...data.relationships[0], stance: 'contradicting' }]
    const result = rankSuspects({ ...data, relationships, discoveredEvidenceIds: ['E-A'] })
    expect(result.rankedSuspects[0].score).toBe(0)
    expect(result.rankedSuspects[0].supportingEvidence).toEqual([])
    expect(result.rankedSuspects[0].contradictingEvidence).toEqual([])
    expect(result.dataWarnings.join(' ')).toContain('Conflicting discovered relationships')
  })

  it('keeps numeric totals and the explanation formula consistent', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A', 'E-B'], scoringConfig: oneClueThreshold })
    const first = result.rankedSuspects[0]
    expect(first.supportingEvidence.reduce((sum, item) => sum + item.points, 0)
      + first.contradictingEvidence.reduce((sum, item) => sum + item.points, 0)).toBe(first.score)
    expect(first.explanation).toContain('Investigation score: 0.')
    expect(first.explanation).toContain('(+2 total)')
    expect(first.explanation).toContain('(-2 total)')
    expect(first.explanation).toContain('Verified entry')
    expect(first.explanation).toContain('Conflicting account')
  })

  it('does not mutate input records or discovery state', () => {
    const data = fixture()
    const original = JSON.stringify(data)
    const discovered = new Set(['E-A', 'E-B'])
    const result = rankSuspects({ ...data, discoveredEvidenceIds: discovered })
    result.rankedSuspects[0].supportingEvidence.push({ id: 'local-only' })
    expect(JSON.stringify(data)).toBe(original)
    expect([...discovered]).toEqual(['E-A', 'E-B'])
  })

  it('handles empty and incomplete collections gracefully', () => {
    expect(rankSuspects().rankedSuspects).toEqual([])
    const result = rankSuspects({ suspects: null, evidence: null, timeline: null, relationships: null })
    expect(result.rankedSuspects).toEqual([])
    expect(result.dataWarnings.length).toBeGreaterThan(0)
  })

  it('returns only valid discovered evidence references', () => {
    const data = fixture()
    const result = rankSuspects({ ...data, discoveredEvidenceIds: ['E-A'] })
    const validIds = new Set(data.evidence.map(({ id }) => id))
    const references = result.rankedSuspects.flatMap((suspect) => [
      ...suspect.supportingEvidence,
      ...suspect.contradictingEvidence,
      ...suspect.neutralEvidence,
    ])
    expect(references.every(({ id }) => validIds.has(id) && ['E-A'].includes(id))).toBe(true)
    expect(references.some(({ id }) => id === 'E-HIDDEN')).toBe(false)
  })

  it('does not hardcode a preferred suspect and exposes linked timeline context without scoring it', () => {
    const data = fixture()
    const relationships = [{ suspectId: 'S-B', evidenceId: 'E-HIDDEN', stance: 'supporting' }]
    const result = rankSuspects({ ...data, relationships, discoveredEvidenceIds: ['E-HIDDEN'] })
    expect(result.rankedSuspects[0].id).toBe('S-B')
    expect(result.rankedSuspects[0].score).toBe(1)
    expect(result.rankedSuspects[0].relevantTimelineEvents).toEqual([])
    expect(result.rankedSuspects[1].relevantTimelineEvents).toMatchObject([
      { id: 'T-A', confirmed: false, title: 'Reported arrival' },
    ])
    expect(result.rankedSuspects[1].score).toBe(0)
  })

  it('derives only real case relationship pairs from the existing records', () => {
    const relationships = createSuspectEvidenceRelationships(case001)
    const sourcePairs = case001.evidence.flatMap((item) => item.relatedSuspectIds.map((suspectId) => `${suspectId}/${item.id}`)).sort()
    expect(relationships.map(({ suspectId, evidenceId }) => `${suspectId}/${evidenceId}`).sort()).toEqual(sourcePairs)
    expect(relationships.every(({ stance }) => stance === 'supporting')).toBe(true)
  })
})
