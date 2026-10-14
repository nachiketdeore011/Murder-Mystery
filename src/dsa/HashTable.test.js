import { describe, expect, it } from 'vitest'
import { HashTable } from './HashTable.js'

function findCollision(table) {
  const firstKey = 'collision-0'
  const firstBucket = table.getBucketIndex(firstKey)
  for (let index = 1; index < 1000; index += 1) {
    const nextKey = `collision-${index}`
    if (table.getBucketIndex(nextKey) === firstBucket) return [firstKey, nextKey]
  }
  throw new Error('Unable to find a collision in the test key range.')
}

describe('HashTable', () => {
  it('maps the same string to the same bucket for equal capacities', () => {
    const firstTable = new HashTable(11)
    const secondTable = new HashTable(11)
    expect(firstTable.getBucketIndex('CASE-001')).toBe(secondTable.getBucketIndex('CASE-001'))
    expect(firstTable.getBucketIndex('')).toBe(secondTable.getBucketIndex(''))
  })

  it('inserts and retrieves a value by key', () => {
    const table = new HashTable()
    table.set('S001', 'Rahul')
    expect(table.get('S001')).toBe('Rahul')
    expect(table.size()).toBe(1)
  })

  it('returns undefined for a missing key and distinguishes stored undefined values', () => {
    const table = new HashTable()
    expect(table.get('missing')).toBeUndefined()
    table.set('present', undefined)
    expect(table.get('present')).toBeUndefined()
    expect(table.has('present')).toBe(true)
    expect(table.has('missing')).toBe(false)
  })

  it('checks existence and updates an existing value without adding an entry', () => {
    const table = new HashTable()
    table.set('E004', 'sealed')
    table.set('E004', 'inspected')
    expect(table.get('E004')).toBe('inspected')
    expect(table.keys().filter((key) => key === 'E004')).toHaveLength(1)
    expect(table.size()).toBe(1)
  })

  it('deletes existing keys and returns false for missing keys', () => {
    const table = new HashTable()
    table.set('L003', 'Kitchen')
    expect(table.delete('L003')).toBe(true)
    expect(table.delete('L003')).toBe(false)
    expect(table.has('L003')).toBe(false)
    expect(table.size()).toBe(0)
  })

  it('supports an empty string key', () => {
    const table = new HashTable()
    table.set('', 'empty key value')
    expect(table.has('')).toBe(true)
    expect(table.get('')).toBe('empty key value')
  })

  it('stores values of different types, including object references', () => {
    const table = new HashTable()
    const record = { id: 'S001' }
    table.set('string', 'value')
    table.set('number', 12)
    table.set('boolean', false)
    table.set('object', record)
    table.set('null', null)
    expect(table.get('string')).toBe('value')
    expect(table.get('number')).toBe(12)
    expect(table.get('boolean')).toBe(false)
    expect(table.get('object')).toBe(record)
    expect(table.get('null')).toBeNull()
  })

  it('keeps distinct keys accessible after a forced collision', () => {
    const table = new HashTable(8)
    const [firstKey, secondKey] = findCollision(table)
    table.set(firstKey, 'first')
    table.set(secondKey, 'second')
    expect(table.getBucketIndex(firstKey)).toBe(table.getBucketIndex(secondKey))
    expect(table.get(firstKey)).toBe('first')
    expect(table.get(secondKey)).toBe('second')
    expect(table.getStats().collisionCount).toBe(1)
    expect(table.getStats().maxChainLength).toBe(2)
  })

  it('resizes and rehashes every entry into a valid bucket', () => {
    const table = new HashTable(2)
    for (let index = 0; index < 40; index += 1) table.set(`key-${index}`, index)
    expect(table.getStats().bucketCount).toBeGreaterThan(2)
    for (let index = 0; index < 40; index += 1) {
      const key = `key-${index}`
      expect(table.get(key)).toBe(index)
      expect(table.getBucketIndex(key)).toBeGreaterThanOrEqual(0)
      expect(table.getBucketIndex(key)).toBeLessThan(table.getStats().bucketCount)
    }
    expect(table.getStats().loadFactor).toBeLessThanOrEqual(0.75)
  })

  it('reports size consistently through insertions, updates, and deletions', () => {
    const table = new HashTable()
    table.set('A', 1)
    table.set('B', 2)
    table.set('A', 3)
    expect(table.size()).toBe(2)
    table.delete('B')
    expect(table.size()).toBe(1)
  })

  it('returns keys, values, and entry pairs for all records', () => {
    const table = new HashTable()
    table.set('A', 1).set('B', 2)
    expect(new Set(table.keys())).toEqual(new Set(['A', 'B']))
    expect(new Set(table.values())).toEqual(new Set([1, 2]))
    expect(table.entries()).toHaveLength(2)
    expect(table.entries()).toEqual(expect.arrayContaining([['A', 1], ['B', 2]]))
  })

  it('returns detached bucket snapshots that cannot corrupt internal chains', () => {
    const table = new HashTable(4)
    const [firstKey, secondKey] = findCollision(table)
    table.set(firstKey, 'first').set(secondKey, 'second')
    const snapshot = table.getBuckets()
    snapshot[table.getBucketIndex(firstKey)][0][0] = 'changed'
    snapshot[table.getBucketIndex(firstKey)].push(['extra', 'value'])
    expect(table.has(firstKey)).toBe(true)
    expect(table.has('changed')).toBe(false)
    expect(table.size()).toBe(2)
  })

  it('clears all entries and resets to the initial bucket capacity', () => {
    const table = new HashTable(3)
    for (let index = 0; index < 10; index += 1) table.set(`key-${index}`, index)
    table.clear()
    expect(table.size()).toBe(0)
    expect(table.keys()).toEqual([])
    expect(table.values()).toEqual([])
    expect(table.entries()).toEqual([])
    expect(table.getStats()).toMatchObject({ entryCount: 0, bucketCount: 3, loadFactor: 0 })
  })

  it('rejects non-string keys with a clear error', () => {
    const table = new HashTable()
    for (const invalidKey of [1, null, undefined, {}, Symbol('key')]) {
      expect(() => table.set(invalidKey, 'value')).toThrow('keys must be strings')
      expect(() => table.get(invalidKey)).toThrow('keys must be strings')
      expect(() => table.has(invalidKey)).toThrow('keys must be strings')
      expect(() => table.delete(invalidKey)).toThrow('keys must be strings')
      expect(() => table.getBucketIndex(invalidKey)).toThrow('keys must be strings')
    }
  })

  it('reports consistent entry, bucket, load, and collision statistics', () => {
    const table = new HashTable(4)
    const [firstKey, secondKey] = findCollision(table)
    table.set(firstKey, 1).set(secondKey, 2).set('third-key', 3)
    const stats = table.getStats()
    expect(stats.entryCount).toBe(3)
    expect(stats.bucketCount).toBe(4)
    expect(stats.loadFactor).toBe(0.75)
    expect(stats.collisionCount).toBe(1)
    expect(stats.maxChainLength).toBe(2)
  })

  it('inserts, retrieves, and deletes many distinct keys', () => {
    const table = new HashTable()
    const count = 500
    for (let index = 0; index < count; index += 1) table.set(`record-${index}`, index)
    expect(table.size()).toBe(count)
    for (let index = 0; index < count; index += 1) expect(table.get(`record-${index}`)).toBe(index)
    for (let index = 0; index < count; index += 1) expect(table.delete(`record-${index}`)).toBe(true)
    expect(table.size()).toBe(0)
  })

  it('validates constructor capacity and load threshold', () => {
    expect(() => new HashTable(0)).toThrow('positive integer')
    expect(() => new HashTable(8, Infinity)).toThrow('positive finite number')
  })
})
