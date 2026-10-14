import { HashTable } from '../dsa/HashTable.js'

function createRecordIndex(records, collectionName) {
  if (!Array.isArray(records)) {
    throw new TypeError(`The ${collectionName} collection must be an array.`)
  }

  const index = new HashTable()
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || record.id.length === 0) {
      throw new TypeError(`Every ${collectionName} record must have a non-empty string ID.`)
    }
    if (index.has(record.id)) {
      throw new Error(`Duplicate ${collectionName} record ID "${record.id}".`)
    }
    index.set(record.id, record)
  }
  return index
}

/**
 * Build private ID indexes from a case file's existing records.
 * The case arrays remain the source of truth for rendering and ordered lists;
 * these tables provide direct lookup without copying or mutating records.
 */
export function createCaseIndex(caseFile) {
  if (!caseFile || typeof caseFile !== 'object') {
    throw new TypeError('A case file object is required to build its indexes.')
  }

  const suspects = createRecordIndex(caseFile.suspects, 'suspect')
  const evidence = createRecordIndex(caseFile.evidence, 'evidence')
  const locations = createRecordIndex(caseFile.locations, 'location')
  const timelineEvents = createRecordIndex(caseFile.events, 'timeline event')

  return Object.freeze({
    getSuspectById: (id) => suspects.get(id),
    getEvidenceById: (id) => evidence.get(id),
    getLocationById: (id) => locations.get(id),
    getTimelineEventById: (id) => timelineEvents.get(id),
    getStats: () => ({
      suspects: suspects.getStats(),
      evidence: evidence.getStats(),
      locations: locations.getStats(),
      timelineEvents: timelineEvents.getStats(),
    }),
  })
}

export default createCaseIndex
