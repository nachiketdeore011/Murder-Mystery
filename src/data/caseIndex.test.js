import { describe, expect, it } from 'vitest'
import { case001 } from './case001.js'
import { createCaseIndex } from './caseIndex.js'

describe('case data indexes', () => {
  const index = createCaseIndex(case001)

  it('resolves all case collections by their existing stable IDs', () => {
    expect(index.getSuspectById('S001')).toBe(case001.suspects[0])
    expect(index.getEvidenceById('E004')).toBe(case001.evidence[3])
    expect(index.getLocationById('L003')).toBe(case001.locations[2])
    expect(index.getTimelineEventById('T008')).toBe(case001.events[7])
    expect(index.getEvidenceById('missing')).toBeUndefined()
  })

  it('reports index counts without replacing the case source arrays', () => {
    expect(index.getStats()).toMatchObject({
      suspects: { entryCount: 5 },
      evidence: { entryCount: 12 },
      locations: { entryCount: 6 },
      timelineEvents: { entryCount: 8 },
    })
    expect(case001.suspects).toHaveLength(5)
    expect(case001.evidence).toHaveLength(12)
    expect(case001.locations).toHaveLength(6)
    expect(case001.events).toHaveLength(8)
  })

  it('does not modify case records while indexing them', () => {
    const before = JSON.stringify(case001)
    createCaseIndex(case001)
    expect(JSON.stringify(case001)).toBe(before)
  })

  it('rejects records with missing or duplicate IDs', () => {
    expect(() => createCaseIndex({ suspects: [{}], evidence: [], locations: [], events: [] }))
      .toThrow('Every suspect record must have a non-empty string ID')
    expect(() => createCaseIndex({
      suspects: [{ id: 'S001' }, { id: 'S001' }], evidence: [], locations: [], events: [],
    })).toThrow('Duplicate suspect record ID "S001"')
  })
})
