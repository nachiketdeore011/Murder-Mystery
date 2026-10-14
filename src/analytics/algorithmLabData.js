import { BinarySearchTree } from '../dsa/BinarySearchTree.js'
import { HashTable } from '../dsa/HashTable.js'
import { createEvidenceIndex } from '../data/evidenceIndex.js'
import { createClueSearchIndex } from '../data/clueSearchIndex.js'

/**
 * Build fresh, real data-structure instances for the lab. Evidence is filtered
 * before any search structure is populated, so hidden records cannot leak via
 * hash lookups, ordered ranges, or Trie text search.
 */
export function createDiscoveredEvidenceLab(caseFile, discoveredEvidenceIds) {
  if (!caseFile || !Array.isArray(caseFile.evidence)) throw new TypeError('A case file with evidence is required.')
  const discovered = discoveredEvidenceIds instanceof Set
    ? discoveredEvidenceIds
    : new Set(Array.isArray(discoveredEvidenceIds) ? discoveredEvidenceIds : [])
  const discoveredRecords = caseFile.evidence.filter((record) => record && discovered.has(record.id))
  const hashTable = new HashTable()
  const binarySearchTree = new BinarySearchTree()

  for (const record of discoveredRecords) {
    hashTable.set(record.id, record)
    binarySearchTree.insert(record.id, record)
  }

  const safeCaseFile = { ...caseFile, evidence: discoveredRecords }
  return Object.freeze({
    discoveredRecords,
    hashTable,
    binarySearchTree,
    evidenceIndex: createEvidenceIndex(discoveredRecords),
    clueSearchIndex: createClueSearchIndex(safeCaseFile),
  })
}
