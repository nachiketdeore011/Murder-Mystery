import { describe, expect, it } from 'vitest'
import { BPlusTree } from './BPlusTree.js'

function sortedKeys(tree) {
  return tree.getAllEntries().map(({ key }) => key)
}

function visitStructure(node, callback) {
  if (!node) return
  callback(node)
  node.children.forEach((child) => visitStructure(child, callback))
}

function makeSequence(count, prefix = 'K') {
  return Array.from({ length: count }, (_, index) => `${prefix}${String(index).padStart(3, '0')}`)
}

function expectedEntries(reference) {
  return [...reference.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => ({ key, value }))
}

describe('BPlusTree', () => {
  it('starts empty, reports useful stats, and validates its empty state', () => {
    const tree = new BPlusTree()
    expect(tree.isEmpty()).toBe(true)
    expect(tree.size()).toBe(0)
    expect(tree.getMin()).toBeUndefined()
    expect(tree.getMax()).toBeUndefined()
    expect(tree.getAllEntries()).toEqual([])
    expect(tree.rangeSearch('A', 'Z')).toEqual([])
    expect(tree.getStats()).toEqual({ height: 0, keyCount: 0, leafCount: 0, internalNodeCount: 0, order: 4 })
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
    expect(tree.getStructure()).toBeNull()
  })

  it('validates the configurable order', () => {
    expect(() => new BPlusTree(2)).toThrow('order must be an integer of at least 3')
    expect(() => new BPlusTree(3.5)).toThrow('order must be an integer of at least 3')
    expect(new BPlusTree(3).order).toBe(3)
  })

  it('inserts, searches, and returns the original value', () => {
    const tree = new BPlusTree()
    const record = { id: 'E004' }
    expect(tree.insert('E004', record)).toBe(true)
    expect(tree.search('E004')).toBe(record)
    expect(tree.has('E004')).toBe(true)
    expect(tree.search('missing')).toBeUndefined()
    expect(tree.has('missing')).toBe(false)
    expect(tree.validate().valid).toBe(true)
  })

  it('accepts the empty string as a valid lexicographic key', () => {
    const tree = new BPlusTree(3)
    tree.insert('', 'empty-key')
    tree.insert('A', 'next-key')
    expect(tree.search('')).toBe('empty-key')
    expect(tree.rangeSearch('', '').map(({ key }) => key)).toEqual([''])
    expect(sortedKeys(tree)).toEqual(['', 'A'])
    expect(tree.validate().valid).toBe(true)
  })

  it('keeps leaves sorted for ascending and descending insertion orders', () => {
    for (const keys of [makeSequence(60), makeSequence(60).reverse()]) {
      const tree = new BPlusTree(4)
      keys.forEach((key, index) => tree.insert(key, index))
      expect(sortedKeys(tree)).toEqual(makeSequence(60))
      expect(tree.validate()).toEqual({ valid: true, errors: [] })
    }
  })

  it('splits leaves, internal nodes, and grows the root over multiple levels', () => {
    const tree = new BPlusTree(3)
    makeSequence(45).forEach((key) => tree.insert(key, key))
    const stats = tree.getStats()
    expect(stats.height).toBeGreaterThanOrEqual(4)
    expect(stats.leafCount).toBeGreaterThan(10)
    expect(stats.internalNodeCount).toBeGreaterThan(5)
    expect(tree.getStructure().type).toBe('internal')
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
  })

  it('handles a deterministic randomized insertion order and returns sorted entries', () => {
    const keys = makeSequence(120)
    let seed = 73021
    for (let index = keys.length - 1; index > 0; index -= 1) {
      seed = (seed * 48271) % 2147483647
      const swapIndex = seed % (index + 1)
      ;[keys[index], keys[swapIndex]] = [keys[swapIndex], keys[index]]
    }
    const tree = new BPlusTree(5)
    keys.forEach((key) => tree.insert(key, key.toLowerCase()))
    expect(sortedKeys(tree)).toEqual(makeSequence(120))
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
  })

  it('updates duplicate keys without adding another entry', () => {
    const tree = new BPlusTree(4)
    makeSequence(30).forEach((key) => tree.insert(key, `old:${key}`))
    expect(tree.insert('K014', 'updated')).toBe(false)
    expect(tree.search('K014')).toBe('updated')
    expect(tree.size()).toBe(30)
    expect(sortedKeys(tree).filter((key) => key === 'K014')).toHaveLength(1)
    expect(tree.validate().valid).toBe(true)
  })

  it('returns all entries and inclusive range results in key order', () => {
    const tree = new BPlusTree(4)
    ;['E009', 'E002', 'E007', 'E001', 'E011', 'E004', 'E006'].forEach((key) => tree.insert(key, `record:${key}`))
    expect(tree.getAllEntries()).toEqual(['E001', 'E002', 'E004', 'E006', 'E007', 'E009', 'E011']
      .map((key) => ({ key, value: `record:${key}` })))
    const entriesBeforeRange = tree.getAllEntries()
    expect(tree.rangeSearch('E002', 'E009')).toEqual(['E002', 'E004', 'E006', 'E007', 'E009']
      .map((key) => ({ key, value: `record:${key}` })))
    expect(tree.getAllEntries()).toEqual(entriesBeforeRange)
    expect(tree.rangeSearch('E003', 'E005').map(({ key }) => key)).toEqual(['E004'])
    expect(tree.rangeSearch('E012', 'E020')).toEqual([])
    expect(tree.rangeSearch('E009', 'E002')).toEqual([])
  })

  it('finds minimum and maximum entries', () => {
    const tree = new BPlusTree(3)
    ;['E008', 'E003', 'E012', 'E001'].forEach((key) => tree.insert(key, key))
    expect(tree.getMin()).toEqual({ key: 'E001', value: 'E001' })
    expect(tree.getMax()).toEqual({ key: 'E012', value: 'E012' })
  })

  it('deletes leaf entries, reports missing keys, and rebalances after borrowing and merging', () => {
    const tree = new BPlusTree(4)
    makeSequence(9).forEach((key) => tree.insert(key, key))
    expect(tree.getStats().height).toBeGreaterThan(1)
    expect(tree.delete('K000')).toBe(true)
    expect(tree.search('K000')).toBeUndefined()
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
    // The rightmost three-entry leaf lends to its underfull left neighbor.
    expect(tree.delete('K006')).toBe(true)
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
    expect(tree.delete('missing')).toBe(false)
    expect(tree.size()).toBe(7)
  })

  it('merges leaves, rebalances internal nodes, and shrinks the root', () => {
    const tree = new BPlusTree(3)
    const keys = makeSequence(90)
    keys.forEach((key) => tree.insert(key, key))
    const initialHeight = tree.getStats().height
    expect(initialHeight).toBeGreaterThan(3)

    for (const key of keys) {
      expect(tree.delete(key)).toBe(true)
      expect(tree.validate()).toEqual({ valid: true, errors: [] })
    }
    expect(tree.isEmpty()).toBe(true)
    expect(tree.getStats()).toEqual({ height: 0, keyCount: 0, leafCount: 0, internalNodeCount: 0, order: 3 })
    expect(tree.getStructure()).toBeNull()
  })

  it('maintains forward and backward leaf links after repeated splits and merges', () => {
    const tree = new BPlusTree(4)
    makeSequence(35).forEach((key) => tree.insert(key, key))
    for (const key of ['K003', 'K010', 'K011', 'K020', 'K022', 'K030']) tree.delete(key)
    const structure = tree.getStructure()
    const leaves = []
    visitStructure(structure, (node) => { if (node.type === 'leaf') leaves.push(node) })
    expect(leaves.map(({ keys }) => keys).flat()).toEqual(sortedKeys(tree))
    expect(leaves[0].previousLeafId).toBeNull()
    expect(leaves.at(-1).nextLeafId).toBeNull()
    leaves.forEach((leaf, index) => {
      expect(leaf.previousLeafId).toBe(index > 0 ? leaves[index - 1].id : null)
      expect(leaf.nextLeafId).toBe(index + 1 < leaves.length ? leaves[index + 1].id : null)
    })
    expect(tree.validate()).toEqual({ valid: true, errors: [] })
  })

  it('updates a value after multiple splits without changing the key count', () => {
    const tree = new BPlusTree(3)
    makeSequence(55).forEach((key) => tree.insert(key, { version: 1 }))
    const beforeStats = tree.getStats()
    expect(tree.insert('K027', { version: 2 })).toBe(false)
    expect(tree.search('K027')).toEqual({ version: 2 })
    expect(tree.size()).toBe(55)
    expect(tree.getStats()).toEqual(beforeStats)
    expect(tree.validate().valid).toBe(true)
  })

  it('can be reused after clear and after deleting every key', () => {
    const tree = new BPlusTree(3)
    makeSequence(15).forEach((key) => tree.insert(key, key))
    tree.clear()
    expect(tree.isEmpty()).toBe(true)
    expect(tree.validate().valid).toBe(true)
    expect(tree.insert('AGAIN', 7)).toBe(true)
    expect(tree.getAllEntries()).toEqual([{ key: 'AGAIN', value: 7 }])
    expect(tree.delete('AGAIN')).toBe(true)
    expect(tree.insert('ONCE-MORE', 8)).toBe(true)
    expect(tree.validate().valid).toBe(true)
  })

  it('supports several orders and preserves occupancy rules', () => {
    for (const order of [3, 4, 5, 6, 9]) {
      const tree = new BPlusTree(order)
      makeSequence(150).forEach((key) => tree.insert(key, key))
      expect(tree.order).toBe(order)
      expect(tree.getStats().keyCount).toBe(150)
      expect(tree.validate()).toEqual({ valid: true, errors: [] })
      makeSequence(150).filter((_, index) => index % 2 === 0).forEach((key) => tree.delete(key))
      expect(tree.validate()).toEqual({ valid: true, errors: [] })
    }
  })

  it('matches a reference model during a long mixed insert, update, delete, and range sequence', () => {
    const tree = new BPlusTree(4)
    const reference = new Map()
    const keys = makeSequence(75)
    let seed = 991
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }

    for (let step = 0; step < 700; step += 1) {
      const key = keys[Math.floor(random() * keys.length)]
      if (random() < 0.62) {
        const value = `step-${step}`
        tree.insert(key, value)
        reference.set(key, value)
      } else {
        expect(tree.delete(key)).toBe(reference.delete(key))
      }

      expect(tree.validate()).toEqual({ valid: true, errors: [] })
      expect(tree.getAllEntries()).toEqual(expectedEntries(reference))
      expect(tree.size()).toBe(reference.size)

      const startIndex = Math.floor(random() * keys.length)
      const endIndex = Math.floor(random() * keys.length)
      const start = keys[Math.min(startIndex, endIndex)]
      const end = keys[Math.max(startIndex, endIndex)]
      const expectedRange = expectedEntries(reference).filter(({ key: entryKey }) => entryKey >= start && entryKey <= end)
      expect(tree.rangeSearch(start, end)).toEqual(expectedRange)
    }
  })

  it('returns detached structural snapshots and a useful path for searches', () => {
    const tree = new BPlusTree(3)
    makeSequence(20).forEach((key) => tree.insert(key, key))
    const path = tree.getSearchPath('K008')
    expect(path.found).toBe(true)
    expect(path.path.at(-1).type).toBe('leaf')
    expect(tree.getSearchPath('MISSING').found).toBe(false)
    const snapshot = tree.getStructure()
    snapshot.keys.push('CORRUPTION')
    expect(tree.validate().valid).toBe(true)
    expect(tree.has('CORRUPTION')).toBe(false)
  })

  it('rejects non-string keys consistently', () => {
    const tree = new BPlusTree()
    expect(() => tree.insert(4, 'bad')).toThrow('keys must be strings')
    expect(() => tree.search(null)).toThrow('keys must be strings')
    expect(() => tree.delete(undefined)).toThrow('keys must be strings')
    expect(() => tree.rangeSearch('A', 4)).toThrow('keys must be strings')
  })
})
