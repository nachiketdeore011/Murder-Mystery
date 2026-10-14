function validateKey(key) {
  if (typeof key !== 'string') {
    throw new TypeError('HashTable keys must be strings.')
  }
}

function createBuckets(bucketCount) {
  return Array.from({ length: bucketCount }, () => [])
}

/**
 * A custom string-keyed hash table using separate chaining.
 * Hashing a string costs O(k), where k is its length. With a bounded load
 * factor, lookups and updates are expected O(k) on average and O(k + n) in the
 * worst case when n keys cluster in one bucket. A resize rehashes all entries
 * in O(total key length); geometric growth makes that cost amortized across inserts.
 */
export class HashTable {
  #buckets
  #entryCount = 0
  #initialBucketCount
  #maxLoadFactor

  constructor(initialBucketCount = 8, maxLoadFactor = 0.75) {
    if (!Number.isSafeInteger(initialBucketCount) || initialBucketCount < 1) {
      throw new RangeError('The initial bucket count must be a positive integer.')
    }
    if (typeof maxLoadFactor !== 'number' || !Number.isFinite(maxLoadFactor) || maxLoadFactor <= 0) {
      throw new RangeError('The maximum load factor must be a positive finite number.')
    }

    this.#initialBucketCount = initialBucketCount
    this.#maxLoadFactor = maxLoadFactor
    this.#buckets = createBuckets(initialBucketCount)
  }

  /** Insert or update a string key. Updating does not increase the entry count. */
  set(key, value) {
    validateKey(key)
    const bucketIndex = this.getBucketIndex(key)
    const bucket = this.#buckets[bucketIndex]
    const existingIndex = bucket.findIndex(([storedKey]) => storedKey === key)

    if (existingIndex >= 0) {
      bucket[existingIndex][1] = value
      return this
    }

    bucket.push([key, value])
    this.#entryCount += 1
    while (this.#entryCount / this.#buckets.length > this.#maxLoadFactor) {
      this.#resize(this.#buckets.length * 2)
    }
    return this
  }

  get(key) {
    validateKey(key)
    const bucket = this.#buckets[this.getBucketIndex(key)]
    const entry = bucket.find(([storedKey]) => storedKey === key)
    return entry ? entry[1] : undefined
  }

  has(key) {
    validateKey(key)
    const bucket = this.#buckets[this.getBucketIndex(key)]
    return bucket.some(([storedKey]) => storedKey === key)
  }

  delete(key) {
    validateKey(key)
    const bucket = this.#buckets[this.getBucketIndex(key)]
    const entryIndex = bucket.findIndex(([storedKey]) => storedKey === key)
    if (entryIndex < 0) return false
    bucket.splice(entryIndex, 1)
    this.#entryCount -= 1
    return true
  }

  clear() {
    this.#buckets = createBuckets(this.#initialBucketCount)
    this.#entryCount = 0
  }

  size() {
    return this.#entryCount
  }

  keys() {
    return this.#buckets.flatMap((bucket) => bucket.map(([key]) => key))
  }

  values() {
    return this.#buckets.flatMap((bucket) => bucket.map(([, value]) => value))
  }

  entries() {
    return this.#buckets.flatMap((bucket) => bucket.map(([key, value]) => [key, value]))
  }

  /** Return a copied bucket snapshot; callers cannot mutate internal chains. */
  getBuckets() {
    return this.#buckets.map((bucket) => bucket.map(([key, value]) => [key, value]))
  }

  /** Return the bucket a string key maps to at the current table capacity. */
  getBucketIndex(key) {
    validateKey(key)
    return this.#hash(key) % this.#buckets.length
  }

  getStats() {
    let collisionCount = 0
    let maxChainLength = 0
    for (const bucket of this.#buckets) {
      if (bucket.length > 1) collisionCount += bucket.length - 1
      if (bucket.length > maxChainLength) maxChainLength = bucket.length
    }

    return {
      entryCount: this.#entryCount,
      bucketCount: this.#buckets.length,
      loadFactor: this.#entryCount / this.#buckets.length,
      collisionCount,
      maxChainLength,
    }
  }

  #hash(key) {
    // 32-bit FNV-1a over UTF-16 code units; unsigned conversion keeps indices non-negative.
    let hash = 0x811c9dc5
    for (let index = 0; index < key.length; index += 1) {
      hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193)
    }
    return hash >>> 0
  }

  #resize(nextBucketCount) {
    if (!Number.isSafeInteger(nextBucketCount) || nextBucketCount <= this.#buckets.length) {
      throw new RangeError('The resized bucket count must be a larger safe integer.')
    }

    const nextBuckets = createBuckets(nextBucketCount)
    for (const bucket of this.#buckets) {
      for (const [key, value] of bucket) {
        const nextIndex = this.#hash(key) % nextBucketCount
        if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= nextBucketCount) {
          throw new Error(`Invalid bucket index ${nextIndex} while resizing the hash table.`)
        }
        nextBuckets[nextIndex].push([key, value])
      }
    }
    this.#buckets = nextBuckets
  }
}

export default HashTable
