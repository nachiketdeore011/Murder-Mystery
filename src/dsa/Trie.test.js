import { describe, expect, it } from 'vitest'
import { Trie } from './Trie.js'

describe('Trie', () => {
  it('starts empty and returns empty results for ordinary lookups', () => {
    const trie = new Trie()
    expect(trie.isEmpty()).toBe(true)
    expect(trie.size()).toBe(0)
    expect(trie.search('clue')).toBe(false)
    expect(trie.startsWith('cl')).toBe(false)
    expect(trie.autocomplete('cl')).toEqual([])
    expect(trie.getAllWords()).toEqual([])
    expect(trie.getStats()).toEqual({ wordCount: 0, nodeCount: 1, maximumWordLength: 0 })
    expect(trie.startsWith('')).toBe(false)
  })

  it('inserts a single word and performs exact and prefix searches', () => {
    const trie = new Trie()
    expect(trie.insert('clue')).toBe(true)
    expect(trie.search('clue')).toBe(true)
    expect(trie.startsWith('clu')).toBe(true)
    expect(trie.search('clu')).toBe(false)
    expect(trie.startsWith('missing')).toBe(false)
    expect(trie.size()).toBe(1)
    expect(trie.isEmpty()).toBe(false)
  })

  it('normalizes case, surrounding whitespace, and canonically equivalent Unicode', () => {
    const trie = new Trie()
    trie.insert('  Study  ')
    trie.insert('CAFÉ')
    expect(trie.search('study')).toBe(true)
    expect(trie.search(' STUDY ')).toBe(true)
    expect(trie.search('cafe\u0301')).toBe(true)
    expect(trie.getAllWords()).toEqual(['CAFÉ', 'Study'])
  })

  it('preserves shared prefixes such as clue, clues, and clueless', () => {
    const trie = new Trie()
    trie.insert('clue')
    trie.insert('clues')
    trie.insert('clueless')
    expect(trie.autocomplete('clu').map(({ word }) => word)).toEqual(['clue', 'clueless', 'clues'])
    expect(trie.size()).toBe(3)
  })

  it('returns deterministic autocomplete results and honors limits', () => {
    const trie = new Trie()
    for (const word of ['ledger', 'letter', 'lamp', 'key', 'kitchen']) trie.insert(word)
    expect(trie.autocomplete('le').map(({ word }) => word)).toEqual(['ledger', 'letter'])
    expect(trie.autocomplete('l', 1).map(({ word }) => word)).toEqual(['lamp'])
    expect(trie.autocomplete('', 3).map(({ word }) => word)).toEqual(['key', 'kitchen', 'lamp'])
    expect(trie.autocomplete('l', 0)).toEqual([])
    expect(() => trie.autocomplete('l', -1)).toThrow(RangeError)
    expect(() => trie.autocomplete('l', 1.5)).toThrow(RangeError)
  })

  it('rejects empty inserted strings but treats empty lookup prefixes consistently', () => {
    const trie = new Trie()
    expect(() => trie.insert('  ')).toThrow('cannot be empty')
    expect(trie.search(' ')).toBe(false)
    expect(trie.delete('')).toBe(false)
    expect(trie.autocomplete('')).toEqual([])
    trie.insert('case')
    expect(trie.startsWith(' ')).toBe(true)
    expect(trie.autocomplete(' ').map(({ word }) => word)).toEqual(['case'])
  })

  it('does not increase size for duplicate normalized words and merges distinct payloads', () => {
    const trie = new Trie()
    const evidenceRecord = { id: 'E001' }
    const locationRecord = { id: 'L001' }
    expect(trie.insert('Study', evidenceRecord)).toBe(true)
    expect(trie.insert(' study ', evidenceRecord)).toBe(false)
    expect(trie.insert('STUDY', locationRecord)).toBe(false)
    expect(trie.insert('study', locationRecord)).toBe(false)
    expect(trie.size()).toBe(1)
    expect(trie.autocomplete('stu')).toEqual([{ word: 'Study', payloads: [evidenceRecord, locationRecord] }])
    expect(trie.getPayloads('STUDY')).toEqual([evidenceRecord, locationRecord])
  })

  it('allows payload values of different types and returns a defensive payload list', () => {
    const trie = new Trie()
    const record = { id: 'E004' }
    trie.insert('clue', record)
    trie.insert('clue', 'case note')
    trie.insert('clue', 7)
    const payloads = trie.getPayloads('clue')
    payloads.pop()
    expect(trie.getPayloads('clue')).toEqual([record, 'case note', 7])
  })

  it('deletes a word with no shared prefix and prunes unused nodes', () => {
    const trie = new Trie()
    trie.insert('garden')
    trie.insert('study')
    expect(trie.delete('garden')).toBe(true)
    expect(trie.search('garden')).toBe(false)
    expect(trie.search('study')).toBe(true)
    expect(trie.getStats().nodeCount).toBe(6) // root plus the five Study characters
  })

  it('deletes a shorter word without removing a longer word sharing its prefix', () => {
    const trie = new Trie()
    trie.insert('clue')
    trie.insert('clues')
    expect(trie.delete('clue')).toBe(true)
    expect(trie.search('clue')).toBe(false)
    expect(trie.search('clues')).toBe(true)
    expect(trie.startsWith('clue')).toBe(true)
  })

  it('deletes a longer word without removing its shorter prefix word', () => {
    const trie = new Trie()
    trie.insert('clue')
    trie.insert('clueless')
    expect(trie.delete('clueless')).toBe(true)
    expect(trie.search('clue')).toBe(true)
    expect(trie.search('clueless')).toBe(false)
  })

  it('does not change when asked to delete a missing word', () => {
    const trie = new Trie()
    trie.insert('clue')
    expect(trie.delete('clues')).toBe(false)
    expect(trie.delete('missing')).toBe(false)
    expect(trie.getAllWords()).toEqual(['clue'])
  })

  it('supports deleting all words, reinserting, and clearing the Trie', () => {
    const trie = new Trie()
    trie.insert('study')
    trie.insert('study key')
    expect(trie.delete('study')).toBe(true)
    expect(trie.delete('study key')).toBe(true)
    expect(trie.isEmpty()).toBe(true)
    expect(trie.size()).toBe(0)
    expect(trie.insert('study')).toBe(true)
    trie.clear()
    expect(trie.getAllWords()).toEqual([])
    expect(trie.getStats()).toEqual({ wordCount: 0, nodeCount: 1, maximumWordLength: 0 })
  })

  it('handles Unicode code points and supported punctuation-bearing input', () => {
    const trie = new Trie()
    trie.insert('café')
    trie.insert('🕵️clue')
    expect(trie.search('CAFÉ')).toBe(true)
    expect(trie.startsWith('🕵️')).toBe(true)
    expect(trie.autocomplete('🕵️').map(({ word }) => word)).toEqual(['🕵️clue'])
  })

  it('supports many distinct words and maintains correct statistics', () => {
    const trie = new Trie()
    const words = Array.from({ length: 400 }, (_, index) => `record-${String(index).padStart(4, '0')}`)
    for (const word of words) trie.insert(word)
    expect(trie.size()).toBe(400)
    expect(trie.search('RECORD-0399')).toBe(true)
    expect(trie.autocomplete('record-03', 150).map(({ word }) => word)).toHaveLength(100)
    expect(trie.getStats()).toMatchObject({ wordCount: 400, maximumWordLength: 11 })
    for (const word of words) expect(trie.delete(word)).toBe(true)
    expect(trie.isEmpty()).toBe(true)
    expect(trie.getStats()).toEqual({ wordCount: 0, nodeCount: 1, maximumWordLength: 0 })
  })

  it('can delete and reinsert the same word without retaining old payloads', () => {
    const trie = new Trie()
    trie.insert('key', 'old')
    expect(trie.delete('KEY')).toBe(true)
    expect(trie.insert('KEY', 'new')).toBe(true)
    expect(trie.autocomplete('k')).toEqual([{ word: 'KEY', payloads: ['new'] }])
  })

  it('returns detached structure snapshots for visualization', () => {
    const trie = new Trie()
    trie.insert('case')
    trie.insert('cash')
    const structure = trie.getStructure()
    expect(structure.children).toHaveLength(1)
    expect(structure.children[0].character).toBe('c')
    expect(structure.children[0].children).toHaveLength(1)
    structure.children[0].children.length = 0
    expect(trie.search('case')).toBe(true)
    expect(trie.getStructure().children[0].children).toHaveLength(1)
  })

  it('rejects unsupported word types consistently', () => {
    const trie = new Trie()
    expect(() => trie.insert(42)).toThrow(TypeError)
    expect(() => trie.search(null)).toThrow(TypeError)
    expect(() => trie.startsWith({})).toThrow(TypeError)
    expect(() => trie.delete(undefined)).toThrow(TypeError)
  })
})
