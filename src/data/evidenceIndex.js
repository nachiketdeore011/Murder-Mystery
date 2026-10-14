import { BPlusTree } from '../dsa/BPlusTree.js'

/**
 * Build an ID-ordered index from the case's source evidence array. The tree
 * stores references to those original records; the array remains the rendering
 * source, while the index supplies direct and ordered range lookups. In the
 * current app case records are static and discovery is tracked separately. UI
 * owners should rebuild this index when the source array reference changes.
 */
export function createEvidenceIndex(evidenceRecords, order = 4) {
  if (!Array.isArray(evidenceRecords)) {
    throw new TypeError('The evidence collection must be an array.')
  }

  const tree = new BPlusTree(order)
  for (const record of evidenceRecords) {
    if (!record || typeof record.id !== 'string' || record.id.length === 0) {
      throw new TypeError('Every evidence record must have a non-empty string ID.')
    }
    if (tree.has(record.id)) {
      throw new Error(`Duplicate evidence ID "${record.id}".`)
    }
    tree.insert(record.id, record)
  }

  return Object.freeze({
    getEvidenceById: (id) => tree.search(id),
    searchEvidenceRange: (startId, endId) => tree.rangeSearch(startId, endId).map(({ value }) => value),
    getAllEvidenceIndexed: () => tree.getAllEntries().map(({ value }) => value),
    getEvidenceIndexStats: () => tree.getStats(),
    validateEvidenceIndex: () => tree.validate(),
    getStructure: () => tree.getStructure(),
    getSearchPath: (id) => tree.getSearchPath(id),
  })
}

export default createEvidenceIndex
