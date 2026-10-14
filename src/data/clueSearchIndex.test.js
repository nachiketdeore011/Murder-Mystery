import { describe, expect, it } from 'vitest'
import { case001 } from './case001.js'
import { createClueSearchIndex, tokenizeSearchText } from './clueSearchIndex.js'

describe('case clue search index', () => {
  it('indexes real titles and descriptions across the four supported record types', () => {
    const index = createClueSearchIndex(case001)
    const evidence = index.searchCluesByPrefix('unansw')
    const suspect = index.searchCluesByPrefix('rah')
    const location = index.searchCluesByPrefix('gar', { types: ['location'] })
    const timeline = index.searchCluesByPrefix('interru', { types: ['timeline'] })

    expect(evidence.some((result) => result.type === 'evidence' && result.id === 'E008')).toBe(true)
    expect(suspect.some((result) => result.type === 'suspect' && result.id === 'S001')).toBe(true)
    expect(location.some(({ type, id, title }) => type === 'location' && id === 'L006' && title === 'Garden')).toBe(true)
    expect(location.every(({ type }) => type === 'location')).toBe(true)
    expect(timeline).toEqual([expect.objectContaining({ type: 'timeline', id: 'T004', title: 'East Corridor camera interruption' })])
  })

  it('returns the original case record references and preserves source data', () => {
    const before = JSON.stringify(case001)
    const index = createClueSearchIndex(case001)
    const result = index.searchCluesByPrefix('ledger').find(({ id }) => id === 'E002')
    expect(result.record).toBe(case001.evidence[1])
    expect(JSON.stringify(case001)).toBe(before)
    expect(case001.evidence).toHaveLength(12)
  })

  it('retains associations for a token shared across multiple case records', () => {
    const index = createClueSearchIndex(case001)
    const gardenResults = index.searchCluesByPrefix('garden')
    expect(gardenResults.some(({ type, id }) => type === 'location' && id === 'L006')).toBe(true)
    expect(gardenResults.some(({ type, id }) => type === 'evidence' && id === 'E011')).toBe(true)
    expect(gardenResults.some(({ type, id }) => type === 'evidence' && id === 'E012')).toBe(true)
  })

  it('does not duplicate one record when a word repeats in its searchable fields', () => {
    const index = createClueSearchIndex(case001)
    const matches = index.searchCluesByPrefix('study')
    const e001 = matches.filter(({ type, id }) => type === 'evidence' && id === 'E001')
    expect(e001).toHaveLength(1)
    expect(e001[0].matchingWords).toContain('Study')
  })

  it('provides prefix suggestions with all associated real records', () => {
    const index = createClueSearchIndex(case001)
    const suggestions = index.getClueSearchSuggestions('mal', 10)
    const malhotra = suggestions.find(({ word }) => word.toLowerCase() === 'malhotra')
    expect(malhotra).toBeDefined()
    expect(malhotra.records.some(({ type, id }) => type === 'suspect' && id === 'S001')).toBe(true)
    expect(malhotra.records.some(({ type, id }) => type === 'suspect' && id === 'S002')).toBe(true)
    expect(index.getClueSearchSuggestions('', 0)).toEqual([])
    expect(() => index.getClueSearchSuggestions('mal', -1)).toThrow(RangeError)
  })

  it('orders suggestions deterministically and applies result filters and limits', () => {
    const index = createClueSearchIndex(case001)
    const suggestions = index.getClueSearchSuggestions('acc', 20).map(({ word }) => word.toLowerCase())
    expect(suggestions).toEqual([...suggestions].sort())
    expect(index.searchCluesByPrefix('acc', { limit: 1 })).toHaveLength(1)
    expect(index.searchCluesByPrefix('acc', { limit: 0 })).toEqual([])
    expect(index.searchCluesByPrefix('acc', { types: ['timeline'] }).every(({ type }) => type === 'timeline')).toBe(true)
    expect(() => index.searchCluesByPrefix('acc', { limit: -1 })).toThrow(RangeError)
  })

  it('does not return all records for an empty prefix search', () => {
    const index = createClueSearchIndex(case001)
    expect(index.searchCluesByPrefix('   ')).toEqual([])
  })

  it('tokenizes punctuation without empty terms and preserves display spelling', () => {
    expect(tokenizeSearchText('  Ananya’s note — 9:48 PM! ')).toEqual([
      { word: 'Ananya', normalized: 'ananya' },
      { word: 's', normalized: 's' },
      { word: 'note', normalized: 'note' },
      { word: '9', normalized: '9' },
      { word: '48', normalized: '48' },
      { word: 'PM', normalized: 'pm' },
    ])
    expect(tokenizeSearchText('Évidence café')).toEqual([
      { word: 'Évidence', normalized: 'évidence' },
      { word: 'café', normalized: 'café' },
    ])
    expect(() => tokenizeSearchText(null)).toThrow(TypeError)
  })

  it('rebuilds against a replacement case file and removes stale records', () => {
    const index = createClueSearchIndex(case001)
    const replacement = {
      ...case001,
      evidence: [{ ...case001.evidence[0], title: 'Revised Archive Entry', description: 'A newly indexed record.' }],
    }
    const stats = index.rebuildClueSearchIndex(replacement)
    expect(index.searchCluesByPrefix('revis').map(({ id }) => id)).toEqual(['E001'])
    expect(index.searchCluesByPrefix('ledger').some(({ type, id }) => type === 'evidence' && id === 'E002')).toBe(false)
    expect(stats.recordCount).toBe(20)
    expect(case001.evidence[0].title).toBe('Study key checkout sheet')
    expect(index.searchCluesByPrefix('archive')[0].record).toBe(replacement.evidence[0])
  })

  it('reports index statistics and exposes all terms in sorted order', () => {
    const index = createClueSearchIndex(case001)
    const stats = index.getClueSearchStats()
    const words = index.getAllIndexedWords()
    expect(stats.recordCount).toBe(31)
    expect(stats.wordCount).toBeGreaterThan(0)
    expect(stats.recordWordAssociations).toBeGreaterThan(stats.recordCount)
    expect(words.map(({ word }) => word.toLowerCase())).toEqual(
      [...words.map(({ word }) => word.toLowerCase())].sort(),
    )
    expect(index.getTrieStructure().children.length).toBeGreaterThan(0)
  })

  it('rejects malformed record collections and duplicate stable IDs', () => {
    expect(() => createClueSearchIndex({ evidence: null, suspects: [], locations: [], events: [] }))
      .toThrow('evidence collection must be an array')
    expect(() => createClueSearchIndex({
      evidence: [{ id: '', title: 'No ID' }], suspects: [], locations: [], events: [],
    })).toThrow('non-empty string ID and display title')
    expect(() => createClueSearchIndex({
      evidence: [{ id: 'E001', title: 'One' }, { id: 'E001', title: 'Two' }],
      suspects: [], locations: [], events: [],
    })).toThrow('Duplicate evidence record ID')
  })
})
