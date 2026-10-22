import { case001 } from '../data/case001.js'

export const SAVE_SCHEMA_VERSION = 2
export const COMPLETION_SCHEMA_VERSION = 1
export const SAVE_STORAGE_KEY = `algorithmic-detective:progress:${case001.id}`
export const JOURNAL_CATEGORIES = Object.freeze([
  'observation',
  'suspect_theory',
  'timeline_note',
  'evidence_connection',
  'unresolved_question',
])
export const JOURNAL_TITLE_LIMIT = 100
export const JOURNAL_BODY_LIMIT = 5000

const BOOKMARK_TYPES = Object.freeze(['suspects', 'evidence', 'locations'])
const RECORD_TYPE_TO_COLLECTION = Object.freeze({
  suspect: 'suspects',
  evidence: 'evidence',
  location: 'locations',
})

function currentIso(now) {
  const date = now instanceof Date ? now : new Date(now ?? Date.now())
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function isTimestamp(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value))
}

function emptyBookmarks() {
  return { suspects: [], evidence: [], locations: [] }
}

export function createInitialGameProgress(caseFile = case001) {
  return {
    caseId: caseFile.id,
    schemaVersion: SAVE_SCHEMA_VERSION,
    discoveredEvidenceIds: [],
    journalEntries: [],
    bookmarks: emptyBookmarks(),
    completion: null,
    // A fresh case shows the guided tour once; older saves never see it again.
    tourCompleted: false,
    savedAt: null,
  }
}

function getCollectionIndex(caseFile, collection) {
  const records = Array.isArray(caseFile?.[collection]) ? caseFile[collection] : []
  return new Map(records.filter((record) => record && typeof record.id === 'string').map((record) => [record.id, record]))
}

function normalizeLinkedRecord(linkedRecord, { caseFile, discoveredEvidenceIds }, warnings, entryId) {
  if (linkedRecord === undefined || linkedRecord === null) return undefined
  if (!linkedRecord || typeof linkedRecord !== 'object' || Array.isArray(linkedRecord)
    || !Object.hasOwn(RECORD_TYPE_TO_COLLECTION, linkedRecord.type)
    || typeof linkedRecord.id !== 'string' || !linkedRecord.id) {
    warnings.push(`The link on journal entry ${entryId} was malformed and was removed.`)
    return undefined
  }
  if (linkedRecord.type === 'evidence' && !discoveredEvidenceIds.has(linkedRecord.id)) {
    warnings.push(`The evidence link on journal entry ${entryId} was removed because that clue is not discovered.`)
    return undefined
  }
  const index = getCollectionIndex(caseFile, RECORD_TYPE_TO_COLLECTION[linkedRecord.type])
  if (!index.has(linkedRecord.id)) {
    warnings.push(`The link on journal entry ${entryId} refers to a missing case record and was removed.`)
    return undefined
  }
  return { type: linkedRecord.type, id: linkedRecord.id }
}

function migrateVersionZero(data, now) {
  // Version 0 stored discoveries only. Version 1 added journal and bookmarks.
  return {
    ...data,
    schemaVersion: 1,
    journalEntries: Array.isArray(data.journalEntries) ? data.journalEntries : [],
    bookmarks: data.bookmarks && typeof data.bookmarks === 'object' ? data.bookmarks : emptyBookmarks(),
    savedAt: isTimestamp(data.savedAt) ? data.savedAt : currentIso(now),
  }
}

function migrateVersionOne(data) {
  // Version 2 adds one validated, player-authored final accusation attempt.
  // Saves that predate the guided tour are treated as already toured.
  return { ...data, schemaVersion: SAVE_SCHEMA_VERSION, completion: null, tourCompleted: true }
}

function normalizeCompletion(completion, { caseFile, discoveredEvidenceIds }, errors, warnings) {
  if (completion === undefined || completion === null) return null
  if (!completion || typeof completion !== 'object' || Array.isArray(completion)) {
    errors.push('The saved accusation record is malformed.')
    return null
  }
  const suspects = getCollectionIndex(caseFile, 'suspects')
  const evidence = getCollectionIndex(caseFile, 'evidence')
  if (completion.schemaVersion !== COMPLETION_SCHEMA_VERSION || completion.caseId !== caseFile.id) {
    errors.push('The saved accusation belongs to an unsupported version or case.')
  }
  if (!isTimestamp(completion.completedAt)) errors.push('The saved accusation timestamp is invalid.')
  if (typeof completion.selectedSuspectId !== 'string' || !suspects.has(completion.selectedSuspectId)) {
    errors.push('The saved accusation references an unknown suspect.')
  }
  if (!Array.isArray(completion.selectedEvidenceIds)) errors.push('The saved accusation evidence IDs must be an array.')
  const selectedEvidenceIds = []
  const seen = new Set()
  if (Array.isArray(completion.selectedEvidenceIds)) {
    for (const id of completion.selectedEvidenceIds) {
      if (typeof id !== 'string' || !evidence.has(id)) {
        errors.push('The saved accusation references unknown evidence.')
        continue
      }
      if (!discoveredEvidenceIds.has(id)) {
        errors.push('The saved accusation cites evidence that is not discovered in this save.')
        continue
      }
      if (seen.has(id)) {
        warnings.push(`Duplicate accusation evidence ${id} was removed.`)
        continue
      }
      seen.add(id)
      selectedEvidenceIds.push(id)
    }
  }
  const explanation = typeof completion.explanation === 'string' ? completion.explanation.trim() : ''
  if (!explanation || explanation.length > 2000) errors.push('The saved accusation needs an explanation of 1–2000 characters.')
  if (errors.length && (!completion.completedAt || !completion.selectedSuspectId || !Array.isArray(completion.selectedEvidenceIds) || !explanation)) return null
  return {
    schemaVersion: COMPLETION_SCHEMA_VERSION,
    caseId: caseFile.id,
    completedAt: completion.completedAt,
    selectedSuspectId: completion.selectedSuspectId,
    selectedEvidenceIds,
    explanation,
  }
}

/**
 * Validate and sanitize a save envelope. Only player-owned progress fields
 * survive normalization; static case records and derived DSA instances are
 * never copied into the returned progress object.
 */
export function validateGameProgress(data, { caseFile = case001, now = new Date() } = {}) {
  const errors = []
  const warnings = []
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Save data must be a JSON object.'], warnings, progress: null }
  }
  if (data.caseId !== caseFile.id) {
    return { valid: false, errors: [`This save belongs to ${String(data.caseId || 'an unknown case')}; the current case is ${caseFile.id}.`], warnings, progress: null, code: 'incompatible_case' }
  }

  let source = data
  if (data.schemaVersion === 0) source = migrateVersionZero(data, now)
  if (source.schemaVersion === 1) source = migrateVersionOne(source)
  else if (source.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [`Save schema version ${String(data.schemaVersion)} is not supported by this game version.`],
      warnings,
      progress: null,
      code: 'incompatible_version',
    }
  }

  const suspectIndex = getCollectionIndex(caseFile, 'suspects')
  const evidenceIndex = getCollectionIndex(caseFile, 'evidence')
  const locationIndex = getCollectionIndex(caseFile, 'locations')

  if (!Array.isArray(source.discoveredEvidenceIds)) errors.push('Discovered evidence IDs must be an array.')
  const discoveredEvidenceIds = []
  const discoveredSet = new Set()
  if (Array.isArray(source.discoveredEvidenceIds)) {
    for (const id of source.discoveredEvidenceIds) {
      if (typeof id !== 'string' || !evidenceIndex.has(id)) {
        errors.push(`The save references unknown evidence ID ${String(id)}.`)
        continue
      }
      if (discoveredSet.has(id)) {
        warnings.push(`Duplicate discovered evidence ID ${id} was removed.`)
        continue
      }
      discoveredSet.add(id)
      discoveredEvidenceIds.push(id)
    }
  }

  if (!Array.isArray(source.journalEntries)) errors.push('Journal entries must be an array.')
  const journalEntries = []
  const journalIds = new Set()
  if (Array.isArray(source.journalEntries)) {
    for (const entry of source.journalEntries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push('A journal entry is not a valid object.')
        continue
      }
      const hasValidId = typeof entry.id === 'string' && Boolean(entry.id.trim())
      const duplicateId = hasValidId && journalIds.has(entry.id)
      if (!hasValidId) errors.push('A journal entry is missing its ID.')
      else if (duplicateId) errors.push(`Duplicate journal entry ID ${entry.id} is not allowed.`)
      else journalIds.add(entry.id)

      const title = typeof entry.title === 'string' ? entry.title.trim() : ''
      const body = typeof entry.body === 'string' ? entry.body.trim() : ''
      if (!title || title.length > JOURNAL_TITLE_LIMIT) errors.push(`Journal entry ${entry.id || '(unknown)'} needs a title of 1–${JOURNAL_TITLE_LIMIT} characters.`)
      if (!body || body.length > JOURNAL_BODY_LIMIT) errors.push(`Journal entry ${entry.id || '(unknown)'} needs a note of 1–${JOURNAL_BODY_LIMIT} characters.`)
      if (!JOURNAL_CATEGORIES.includes(entry.category)) errors.push(`Journal entry ${entry.id || '(unknown)'} has an unsupported category.`)
      if (!isTimestamp(entry.createdAt) || !isTimestamp(entry.updatedAt)) errors.push(`Journal entry ${entry.id || '(unknown)'} has an invalid timestamp.`)
      if (!hasValidId || duplicateId || !title || title.length > JOURNAL_TITLE_LIMIT
        || !body || body.length > JOURNAL_BODY_LIMIT || !JOURNAL_CATEGORIES.includes(entry.category)
        || !isTimestamp(entry.createdAt) || !isTimestamp(entry.updatedAt)) continue

      const linkedRecord = normalizeLinkedRecord(entry.linkedRecord, {
        caseFile,
        discoveredEvidenceIds: discoveredSet,
      }, warnings, entry.id)
      journalEntries.push({
        id: entry.id,
        title,
        body,
        category: entry.category,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        ...(linkedRecord ? { linkedRecord } : {}),
      })
    }
  }

  const bookmarks = emptyBookmarks()
  if (!source.bookmarks || typeof source.bookmarks !== 'object' || Array.isArray(source.bookmarks)) {
    errors.push('Bookmarks must contain suspect, evidence, and location ID lists.')
  } else {
    for (const type of BOOKMARK_TYPES) {
      const recordLabel = type === 'suspects' ? 'suspect' : type === 'locations' ? 'location' : 'evidence'
      if (!Array.isArray(source.bookmarks[type])) {
        errors.push(`The ${type} bookmark list must be an array.`)
        continue
      }
      const index = type === 'suspects' ? suspectIndex : type === 'evidence' ? evidenceIndex : locationIndex
      const seen = new Set()
      for (const id of source.bookmarks[type]) {
        if (typeof id !== 'string' || !index.has(id) || (type === 'evidence' && !discoveredSet.has(id))) {
          warnings.push(`An invalid ${recordLabel} bookmark was discarded.`)
          continue
        }
        if (seen.has(id)) {
          warnings.push(`Duplicate ${recordLabel} bookmark ${id} was removed.`)
          continue
        }
        seen.add(id)
        bookmarks[type].push(id)
      }
    }
  }

  const completion = normalizeCompletion(source.completion, {
    caseFile,
    discoveredEvidenceIds: discoveredSet,
  }, errors, warnings)

  // Saves written before the guided tour existed carry no flag; those players
  // are never pushed back through the tour.
  const tourCompleted = source.tourCompleted === undefined
    ? true
    : typeof source.tourCompleted === 'boolean' ? source.tourCompleted : null
  if (tourCompleted === null) errors.push('The saved guided-tour state must be true or false.')

  if (!isTimestamp(source.savedAt)) errors.push('The save timestamp is missing or invalid.')

  if (errors.length) return { valid: false, errors, warnings, progress: null }
  const progress = {
    caseId: caseFile.id,
    schemaVersion: SAVE_SCHEMA_VERSION,
    discoveredEvidenceIds,
    journalEntries,
    bookmarks,
    completion,
    tourCompleted,
    savedAt: source.savedAt,
  }
  return { valid: true, errors, warnings, progress }
}

function getStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

function storageKey(caseFile) {
  return `algorithmic-detective:progress:${caseFile.id}`
}

/** Load and validate the current case save without deleting or rewriting bad data. */
export function loadGameProgress({ storage, caseFile = case001, now = new Date() } = {}) {
  const emptyProgress = createInitialGameProgress(caseFile)
  const target = getStorage(storage)
  if (!target || typeof target.getItem !== 'function') {
    return { status: 'storage-unavailable', progress: emptyProgress, warnings: [], errors: ['Browser storage is unavailable. Progress can be exported as a file.'], recoverable: false }
  }
  let raw
  try {
    raw = target.getItem(storageKey(caseFile))
  } catch {
    return { status: 'storage-error', progress: emptyProgress, warnings: [], errors: ['Saved progress could not be read from this browser.'], recoverable: true }
  }
  if (raw === null || raw === undefined) {
    return { status: 'empty', progress: emptyProgress, warnings: [], errors: [], recoverable: false }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupted', progress: emptyProgress, warnings: [], errors: ['The saved JSON could not be read. The original save was left untouched. Import a valid save or reset this case to recover.'], recoverable: true }
  }
  const validation = validateGameProgress(parsed, { caseFile, now })
  if (!validation.valid) {
    const incompatible = validation.code === 'incompatible_case' || validation.code === 'incompatible_version'
    return {
      status: incompatible ? 'incompatible' : 'invalid-save',
      progress: emptyProgress,
      warnings: validation.warnings,
      errors: validation.errors,
      recoverable: true,
    }
  }
  return { status: 'loaded', progress: validation.progress, warnings: validation.warnings, errors: [], recoverable: false }
}

/** Save only validated player state; storage exceptions are returned, not thrown. */
export function saveGameProgress(progress, { storage, caseFile = case001, now = new Date() } = {}) {
  const target = getStorage(storage)
  if (!target || typeof target.setItem !== 'function') {
    return { ok: false, status: 'storage-unavailable', errors: ['Browser storage is unavailable. Export progress as a file instead.'] }
  }
  const stamped = { ...progress, caseId: progress?.caseId ?? caseFile.id, schemaVersion: SAVE_SCHEMA_VERSION, savedAt: currentIso(now) }
  const validation = validateGameProgress(stamped, { caseFile, now })
  if (!validation.valid) return { ok: false, status: 'validation-error', errors: validation.errors, warnings: validation.warnings }
  try {
    target.setItem(storageKey(caseFile), JSON.stringify(validation.progress))
    return { ok: true, status: 'saved', progress: validation.progress, warnings: validation.warnings }
  } catch {
    return { ok: false, status: 'write-error', errors: ['Progress could not be saved. Check browser storage availability and try exporting a save file.'] }
  }
}

/** Remove only this case's player save and return a fresh in-memory progress object. */
export function resetGameProgress({ storage, caseFile = case001 } = {}) {
  const target = getStorage(storage)
  if (!target || typeof target.removeItem !== 'function') {
    return { ok: false, status: 'storage-unavailable', progress: createInitialGameProgress(caseFile), error: 'Browser storage is unavailable; in-memory progress was reset.' }
  }
  try {
    target.removeItem(storageKey(caseFile))
    return { ok: true, status: 'reset', progress: createInitialGameProgress(caseFile) }
  } catch {
    return { ok: false, status: 'storage-error', progress: createInitialGameProgress(caseFile), error: 'Saved progress could not be removed from this browser.' }
  }
}

/** Return a JSON export result; it contains player progress, never case records or DSA indexes. */
export function exportGameProgress(progress, { caseFile = case001, now = new Date() } = {}) {
  const stamped = { ...progress, caseId: progress?.caseId ?? caseFile.id, schemaVersion: SAVE_SCHEMA_VERSION }
  if (!isTimestamp(stamped.savedAt)) stamped.savedAt = currentIso(now)
  const validation = validateGameProgress(stamped, { caseFile, now })
  if (!validation.valid) return { ok: false, errors: validation.errors, warnings: validation.warnings }
  const payload = { ...validation.progress, exportedAt: currentIso(now) }
  return { ok: true, json: JSON.stringify(payload, null, 2), payload, warnings: validation.warnings }
}

/** Parse and validate an imported JSON save without applying or persisting it. */
export function importGameProgress(input, { caseFile = case001, now = new Date() } = {}) {
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return { ok: false, status: 'invalid-json', errors: ['The selected file is not valid JSON.'], warnings: [], progress: null }
    }
  }
  const validation = validateGameProgress(data, { caseFile, now })
  return {
    ok: validation.valid,
    status: validation.valid ? 'validated' : validation.code || 'invalid-save',
    errors: validation.errors,
    warnings: validation.warnings,
    progress: validation.progress,
  }
}

function makeEntryId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  } catch {
    // Use the local fallback where secure random UUID generation is unavailable.
  }
  return `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function validateEntryFields({ title, body, category }) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : ''
  const normalizedBody = typeof body === 'string' ? body.trim() : ''
  if (!normalizedTitle || normalizedTitle.length > JOURNAL_TITLE_LIMIT) throw new RangeError(`Title must contain 1–${JOURNAL_TITLE_LIMIT} characters.`)
  if (!normalizedBody || normalizedBody.length > JOURNAL_BODY_LIMIT) throw new RangeError(`Note must contain 1–${JOURNAL_BODY_LIMIT} characters.`)
  if (!JOURNAL_CATEGORIES.includes(category)) throw new TypeError('Choose a valid journal category.')
  return { title: normalizedTitle, body: normalizedBody, category }
}

function validateEntryLink(linkedRecord, options) {
  if (!linkedRecord) return undefined
  const warnings = []
  const link = normalizeLinkedRecord(linkedRecord, options, warnings, 'new')
  if (!link) throw new TypeError(warnings[0] || 'The linked record is invalid.')
  return link
}

export function createJournalEntry(input, { entries = [], caseFile = case001, discoveredEvidenceIds = new Set(), now = new Date(), idFactory = makeEntryId } = {}) {
  const values = validateEntryFields(input || {})
  const id = typeof input?.id === 'string' && input.id.trim() ? input.id : idFactory()
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('A journal entry needs a stable string ID.')
  if (entries.some((entry) => entry?.id === id)) throw new Error(`Journal entry ID ${id} already exists.`)
  const timestamp = currentIso(now)
  const linkedRecord = validateEntryLink(input?.linkedRecord, { caseFile, discoveredEvidenceIds })
  return { id, ...values, createdAt: timestamp, updatedAt: timestamp, ...(linkedRecord ? { linkedRecord } : {}) }
}

export function updateJournalEntry(entries, id, changes, { caseFile = case001, discoveredEvidenceIds = new Set(), now = new Date() } = {}) {
  const current = entries.find((entry) => entry.id === id)
  if (!current) throw new Error(`Journal entry ${id} was not found.`)
  const values = validateEntryFields({ ...current, ...changes })
  const linkedRecord = validateEntryLink(changes?.linkedRecord === undefined ? current.linkedRecord : changes.linkedRecord, { caseFile, discoveredEvidenceIds })
  return entries.map((entry) => entry.id === id
    ? { id: current.id, ...values, createdAt: current.createdAt, updatedAt: currentIso(now), ...(linkedRecord ? { linkedRecord } : {}) }
    : entry)
}

export function deleteJournalEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id)
}

export function filterJournalEntries(entries, { query = '', category = 'all' } = {}) {
  const needle = typeof query === 'string' ? query.trim().toLocaleLowerCase() : ''
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => (category === 'all' || entry.category === category)
      && (!needle || `${entry.title} ${entry.body}`.toLocaleLowerCase().includes(needle)))
    .slice()
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id))
}

export function addBookmark(bookmarks, type, id, { caseFile = case001, discoveredEvidenceIds = new Set() } = {}) {
  if (!BOOKMARK_TYPES.includes(type)) throw new TypeError('Bookmark type must be suspects, evidence, or locations.')
  if (typeof id !== 'string' || !id) throw new TypeError('Bookmark IDs must be strings.')
  const collectionName = type
  const index = getCollectionIndex(caseFile, collectionName)
  const recordLabel = type === 'suspects' ? 'suspect' : type === 'locations' ? 'location' : 'evidence'
  if (!index.has(id)) throw new Error(`Cannot bookmark missing ${recordLabel} record ${id}.`)
  if (type === 'evidence' && !discoveredEvidenceIds.has(id)) throw new Error('Undiscovered evidence cannot be bookmarked.')
  const next = Object.fromEntries(BOOKMARK_TYPES.map((bookmarkType) => [
    bookmarkType,
    Array.isArray(bookmarks?.[bookmarkType]) ? [...new Set(bookmarks[bookmarkType].filter((value) => typeof value === 'string'))] : [],
  ]))
  if (!next[type].includes(id)) next[type].push(id)
  return next
}

export function removeBookmark(bookmarks, type, id) {
  const next = Object.fromEntries(BOOKMARK_TYPES.map((bookmarkType) => [
    bookmarkType,
    Array.isArray(bookmarks?.[bookmarkType]) ? [...new Set(bookmarks[bookmarkType].filter((value) => typeof value === 'string'))] : [],
  ]))
  if (BOOKMARK_TYPES.includes(type)) next[type] = next[type].filter((item) => item !== id)
  return next
}
