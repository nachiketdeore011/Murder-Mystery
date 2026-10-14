import { describe, expect, it } from 'vitest'
import { case001 } from './case001.js'
import { createEvidenceIndex } from './evidenceIndex.js'

describe('case evidence B+ Tree index', () => {
  it('indexes actual evidence records by their stable IDs and returns original records', () => {
    const index = createEvidenceIndex(case001.evidence)
    expect(index.getEvidenceById('E004')).toBe(case001.evidence[3])
    expect(index.getEvidenceById('E999')).toBeUndefined()
    expect(index.getEvidenceIndexStats().keyCount).toBe(12)
    expect(index.validateEvidenceIndex()).toEqual({ valid: true, errors: [] })
  })

  it('returns inclusive evidence ranges in lexicographic key order', () => {
    const index = createEvidenceIndex(case001.evidence)
    expect(index.searchEvidenceRange('E003', 'E007').map(({ id }) => id))
      .toEqual(['E003', 'E004', 'E005', 'E006', 'E007'])
    expect(index.searchEvidenceRange('E012', 'E001')).toEqual([])
    expect(index.searchEvidenceRange('E020', 'E030')).toEqual([])
  })

  it('returns all source records in key order without replacing the source array', () => {
    const originalEvidence = [...case001.evidence]
    const index = createEvidenceIndex(case001.evidence)
    expect(index.getAllEvidenceIndexed()).toEqual([...case001.evidence].sort((a, b) => a.id.localeCompare(b.id)))
    expect(case001.evidence).toEqual(originalEvidence)
    expect(index.getEvidenceIndexStats()).toMatchObject({ keyCount: 12, order: 4 })
  })

  it('does not change records or their discovery flags during index queries', () => {
    const before = JSON.stringify(case001.evidence)
    const index = createEvidenceIndex(case001.evidence)
    index.getEvidenceById('E002')
    index.searchEvidenceRange('E001', 'E012')
    index.getAllEvidenceIndexed()
    expect(JSON.stringify(case001.evidence)).toBe(before)
    expect(case001.evidence.every((record) => record.discovered === false)).toBe(true)
  })

  it('rejects malformed evidence collections and duplicate IDs', () => {
    expect(() => createEvidenceIndex(null)).toThrow('evidence collection must be an array')
    expect(() => createEvidenceIndex([{}])).toThrow('Every evidence record must have a non-empty string ID')
    expect(() => createEvidenceIndex([{ id: 'E001' }, { id: 'E001' }])).toThrow('Duplicate evidence ID "E001"')
  })
})
