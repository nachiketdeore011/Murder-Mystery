import { Trie, normalizeTrieWord } from '../dsa/Trie.js'

const TYPE_ORDER = { evidence: 0, suspect: 1, location: 2, timeline: 3 }

/**
 * Split searchable prose into Unicode letters/numbers. Punctuation separates
 * words; NFC plus lowercase normalization matches the Trie. The returned
 * spelling keeps the source's original capitalization for suggestions.
 */
export function tokenizeSearchText(text) {
  if (typeof text !== 'string') throw new TypeError('Search text must be a string.')
  const tokens = text.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? []
  return tokens.map((word) => ({ word, normalized: normalizeTrieWord(word).normalized }))
}

function getRecordCollections(caseFile) {
  if (!caseFile || typeof caseFile !== 'object') throw new TypeError('A case file object is required to build the clue index.')
  const collections = [
    { type: 'evidence', records: caseFile.evidence, title: (record) => record.title, fields: (record) => [record.title, record.description] },
    { type: 'suspect', records: caseFile.suspects, title: (record) => record.name, fields: (record) => [record.name, record.role, record.biography, record.motive, record.alibi] },
    { type: 'location', records: caseFile.locations, title: (record) => record.name, fields: (record) => [record.name, record.description] },
    { type: 'timeline', records: caseFile.events, title: (record) => record.title, fields: (record) => [record.title, record.description] },
  ]

  for (const { type, records } of collections) {
    if (!Array.isArray(records)) throw new TypeError(`The ${type} collection must be an array.`)
  }
  return collections
}

function compareResults(left, right) {
  const typeDifference = TYPE_ORDER[left.type] - TYPE_ORDER[right.type]
  if (typeDifference) return typeDifference
  const titleDifference = left.title < right.title ? -1 : left.title > right.title ? 1 : 0
  if (titleDifference) return titleDifference
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

function toIndexedRecord(record) {
  return { type: record.type, id: record.id, title: record.title, record: record.record }
}

/**
 * Create a case-scoped word-prefix index. The original case arrays remain the
 * source of truth; Trie payloads retain record references and the index never
 * edits those records. Replace case data immutably or call rebuildClueSearchIndex
 * to refresh it. Search is word-prefix based, not arbitrary substring search.
 */
export function createClueSearchIndex(initialCaseFile) {
  let caseFile = initialCaseFile
  let trie = new Trie()
  let recordCount = 0
  let recordWordAssociations = 0

  function rebuildClueSearchIndex(nextCaseFile = caseFile) {
    const collections = getRecordCollections(nextCaseFile)
    const nextTrie = new Trie()
    let nextRecordCount = 0
    let nextAssociations = 0
    const seenIdsByType = new Set()

    for (const { type, records, title: getTitle, fields } of collections) {
      for (const record of records) {
        if (!record || typeof record !== 'object') {
          throw new TypeError(`Every ${type} record must be an object.`)
        }
        const title = getTitle(record)
        if (typeof record.id !== 'string' || !record.id.trim() || typeof title !== 'string' || !title.trim()) {
          throw new TypeError(`Every ${type} record must have a non-empty string ID and display title.`)
        }
        const identity = `${type}:${record.id}`
        if (seenIdsByType.has(identity)) throw new Error(`Duplicate ${type} record ID "${record.id}".`)
        seenIdsByType.add(identity)
        nextRecordCount += 1

        const indexedRecord = { type, id: record.id, title, record }
        const uniqueTokens = new Map()
        for (const field of fields(record)) {
          if (typeof field !== 'string') continue
          for (const token of tokenizeSearchText(field)) {
            if (!uniqueTokens.has(token.normalized)) uniqueTokens.set(token.normalized, token.word)
          }
        }

        for (const displayWord of uniqueTokens.values()) {
          // Keep the first readable spelling from the record's indexed fields.
          nextTrie.insert(displayWord, indexedRecord)
          nextAssociations += 1
        }
      }
    }

    caseFile = nextCaseFile
    trie = nextTrie
    recordCount = nextRecordCount
    recordWordAssociations = nextAssociations
    return getClueSearchStats()
  }

  function getClueSearchSuggestions(prefix, limit = 8) {
    return trie.autocomplete(prefix, limit).map(({ word, payloads }) => ({
      word,
      records: payloads.map(toIndexedRecord),
    }))
  }

  function searchCluesByPrefix(prefix, options = {}) {
    const { limit = 20, types } = options
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Search result limit must be a non-negative integer.')
    if (limit === 0) return []
    const normalizedPrefix = normalizeTrieWord(prefix).normalized
    if (!normalizedPrefix) return []

    const allowedTypes = types ? new Set(types) : null
    const matchesByRecord = new Map()
    for (const { word, payloads } of trie.autocomplete(normalizedPrefix, Number.MAX_SAFE_INTEGER)) {
      for (const payload of payloads) {
        if (allowedTypes && !allowedTypes.has(payload.type)) continue
        const identity = `${payload.type}:${payload.id}`
        if (!matchesByRecord.has(identity)) {
          matchesByRecord.set(identity, { ...toIndexedRecord(payload), matchingWords: [] })
        }
        const result = matchesByRecord.get(identity)
        if (!result.matchingWords.includes(word)) result.matchingWords.push(word)
      }
    }

    return [...matchesByRecord.values()].sort(compareResults).slice(0, limit)
  }

  function getClueSearchStats() {
    return { ...trie.getStats(), recordCount, recordWordAssociations }
  }

  function getAllIndexedWords() {
    return trie.getAllEntries().map(({ word, payloads }) => ({
      word,
      records: payloads.map(toIndexedRecord),
    }))
  }

  rebuildClueSearchIndex(initialCaseFile)

  return Object.freeze({
    searchCluesByPrefix,
    getClueSearchSuggestions,
    rebuildClueSearchIndex,
    getClueSearchStats,
    getAllIndexedWords,
    getTrieStructure: () => trie.getStructure(),
  })
}

export default createClueSearchIndex
