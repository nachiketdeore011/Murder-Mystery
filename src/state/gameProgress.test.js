import { beforeEach, describe, expect, it } from 'vitest'
import { case001 } from '../data/case001.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { evaluateTheory } from '../algorithms/deductionEngine.js'
import {
  addBookmark,
  createInitialGameProgress,
  createJournalEntry,
  deleteJournalEntry,
  exportGameProgress,
  filterJournalEntries,
  importGameProgress,
  loadGameProgress,
  removeBookmark,
  resetGameProgress,
  saveGameProgress,
  updateJournalEntry,
  validateGameProgress,
} from './gameProgress.js'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

function initialWith(overrides = {}) {
  return {
    ...createInitialGameProgress(case001),
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('game progress persistence', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('loads a fresh progress state when no save exists', () => {
    const result = loadGameProgress({ storage, caseFile: case001 })
    expect(result.status).toBe('empty')
    expect(result.progress.caseId).toBe(case001.id)
    expect(result.progress.discoveredEvidenceIds).toEqual([])
  })

  it('starts a fresh case with the guided tour still pending', () => {
    expect(createInitialGameProgress(case001).tourCompleted).toBe(false)
    expect(loadGameProgress({ storage, caseFile: case001 }).progress.tourCompleted).toBe(false)
  })

  it('migrates older saves so returning players are not pushed through the tour', () => {
    const versionZero = { caseId: case001.id, schemaVersion: 0, discoveredEvidenceIds: ['E001'] }
    const migratedZero = validateGameProgress(versionZero, { caseFile: case001, now: new Date('2026-02-01T00:00:00.000Z') })
    expect(migratedZero.valid).toBe(true)
    expect(migratedZero.progress.tourCompleted).toBe(true)

    const versionOne = initialWith()
    delete versionOne.tourCompleted
    versionOne.schemaVersion = 1
    const migratedOne = validateGameProgress(versionOne, { caseFile: case001 })
    expect(migratedOne.valid).toBe(true)
    expect(migratedOne.progress.tourCompleted).toBe(true)

    const versionTwoWithoutFlag = initialWith()
    delete versionTwoWithoutFlag.tourCompleted
    const normalized = validateGameProgress(versionTwoWithoutFlag, { caseFile: case001 })
    expect(normalized.valid).toBe(true)
    expect(normalized.progress.tourCompleted).toBe(true)
  })

  it('persists a completed guided tour so it never shows again', () => {
    const stored = saveGameProgress(initialWith({ tourCompleted: true }), { storage, caseFile: case001 })
    expect(stored.ok).toBe(true)
    expect(stored.progress.tourCompleted).toBe(true)
    expect(loadGameProgress({ storage, caseFile: case001 }).progress.tourCompleted).toBe(true)
  })

  it('rejects a malformed guided-tour state', () => {
    const result = validateGameProgress(initialWith({ tourCompleted: 'yes' }), { caseFile: case001 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('guided-tour state')
  })

  it('saves valid progress and restores it on load', () => {
    const saved = saveGameProgress(initialWith({ discoveredEvidenceIds: ['E001'] }), {
      storage,
      caseFile: case001,
      now: new Date('2026-01-02T03:04:05.000Z'),
    })
    expect(saved.ok).toBe(true)
    expect(saved.progress.savedAt).toBe('2026-01-02T03:04:05.000Z')
    const loaded = loadGameProgress({ storage, caseFile: case001 })
    expect(loaded.status).toBe('loaded')
    expect(loaded.progress.discoveredEvidenceIds).toEqual(['E001'])
  })

  it('leaves malformed stored JSON untouched for recovery', () => {
    const key = `algorithmic-detective:progress:${case001.id}`
    storage.setItem(key, '{ definitely-not-json')
    const result = loadGameProgress({ storage, caseFile: case001 })
    expect(result.status).toBe('corrupted')
    expect(result.recoverable).toBe(true)
    expect(storage.getItem(key)).toBe('{ definitely-not-json')
  })

  it('reports incompatible future schema and case IDs', () => {
    const future = validateGameProgress({ ...initialWith(), schemaVersion: 88 }, { caseFile: case001 })
    expect(future.valid).toBe(false)
    expect(loadRaw({ ...initialWith(), schemaVersion: 88 }).status).toBe('incompatible')
    const wrongCase = validateGameProgress({ ...initialWith(), caseId: 'CASE-999' }, { caseFile: case001 })
    expect(wrongCase.valid).toBe(false)
    expect(wrongCase.code).toBe('incompatible_case')
  })

  it('rejects unknown evidence IDs and invalid journal structures', () => {
    const invalidEvidence = validateGameProgress(initialWith({ discoveredEvidenceIds: ['E999'] }), { caseFile: case001 })
    expect(invalidEvidence.valid).toBe(false)
    expect(invalidEvidence.errors.join(' ')).toContain('unknown evidence ID E999')
    const invalidNote = validateGameProgress(initialWith({ journalEntries: [{ id: 'x', title: '', body: '   ' }] }), { caseFile: case001 })
    expect(invalidNote.valid).toBe(false)
  })

  it('rejects duplicate journal IDs without normalizing them into separate notes', () => {
    const entry = createJournalEntry({ id: 'duplicate', title: 'One', body: 'A note.', category: 'observation' })
    const result = validateGameProgress(initialWith({ journalEntries: [entry, { ...entry, title: 'Two' }] }), { caseFile: case001 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('Duplicate journal entry ID duplicate')
    expect(result.progress).toBeNull()
  })

  it('handles inaccessible and unavailable browser storage without throwing', () => {
    expect(loadGameProgress({ storage: null, caseFile: case001 }).status).toBe('storage-unavailable')
    const throwingRead = { getItem() { throw new Error('private details must not be logged') } }
    expect(loadGameProgress({ storage: throwingRead, caseFile: case001 }).status).toBe('storage-error')
    const throwingWrite = { setItem() { throw new Error('quota') } }
    expect(saveGameProgress(initialWith(), { storage: throwingWrite, caseFile: case001 }).status).toBe('write-error')
    expect(saveGameProgress(initialWith(), { storage: null, caseFile: case001 }).status).toBe('storage-unavailable')
  })

  it('resets only the current case save', () => {
    const key = `algorithmic-detective:progress:${case001.id}`
    storage.setItem(key, JSON.stringify(initialWith({
      discoveredEvidenceIds: ['E001'],
      completion: {
        schemaVersion: 1,
        caseId: case001.id,
        completedAt: '2026-06-01T00:00:00.000Z',
        selectedSuspectId: 'S005',
        selectedEvidenceIds: ['E001'],
        explanation: 'The key record warrants further scrutiny.',
      },
    })))
    const result = resetGameProgress({ storage, caseFile: case001 })
    expect(result.ok).toBe(true)
    expect(storage.getItem(key)).toBeNull()
    expect(result.progress.discoveredEvidenceIds).toEqual([])
    expect(result.progress.completion).toBeNull()
  })

  it('migrates the supported version zero discoveries-only shape', () => {
    const legacy = { caseId: case001.id, schemaVersion: 0, discoveredEvidenceIds: ['E001'] }
    const result = validateGameProgress(legacy, { caseFile: case001, now: new Date('2026-02-01T00:00:00.000Z') })
    expect(result.valid).toBe(true)
    expect(result.progress.schemaVersion).toBe(2)
    expect(result.progress.discoveredEvidenceIds).toEqual(['E001'])
    expect(result.progress.journalEntries).toEqual([])
    expect(result.progress.bookmarks).toEqual({ suspects: [], evidence: [], locations: [] })
  })

  it('does not overwrite stored progress while an imported file fails validation', () => {
    const key = `algorithmic-detective:progress:${case001.id}`
    const existing = JSON.stringify(initialWith({ discoveredEvidenceIds: ['E001'] }))
    storage.setItem(key, existing)
    const imported = importGameProgress(JSON.stringify({ ...initialWith(), discoveredEvidenceIds: ['missing'] }), { caseFile: case001 })
    expect(imported.ok).toBe(false)
    expect(storage.getItem(key)).toBe(existing)
  })

  it('migrates version one progress without inventing a completed accusation', () => {
    const versionOne = { ...initialWith({ discoveredEvidenceIds: ['E001'] }), schemaVersion: 1 }
    delete versionOne.completion
    const result = validateGameProgress(versionOne, { caseFile: case001 })
    expect(result.valid).toBe(true)
    expect(result.progress.schemaVersion).toBe(2)
    expect(result.progress.completion).toBeNull()
    expect(result.progress.discoveredEvidenceIds).toEqual(['E001'])
  })

  it('persists a validated accusation using discovered IDs only', () => {
    const completion = {
      schemaVersion: 1,
      caseId: case001.id,
      completedAt: '2026-06-01T00:00:00.000Z',
      selectedSuspectId: 'S005',
      selectedEvidenceIds: ['E001', 'E008', 'E012'],
      explanation: 'These discovered records make the account unreliable.',
    }
    const candidate = initialWith({ discoveredEvidenceIds: ['E001', 'E008', 'E012'], completion })
    const stored = saveGameProgress(candidate, { storage, caseFile: case001 })
    expect(stored.ok).toBe(true)
    const loaded = loadGameProgress({ storage, caseFile: case001 })
    expect(loaded.progress.completion).toEqual(completion)
    expect(loaded.progress).not.toHaveProperty('solution')
    expect(loaded.progress).not.toHaveProperty('graph')
  })

  it('rejects a completion that cites evidence absent from discovery progress', () => {
    const completion = {
      schemaVersion: 1,
      caseId: case001.id,
      completedAt: '2026-06-01T00:00:00.000Z',
      selectedSuspectId: 'S005',
      selectedEvidenceIds: ['E008'],
      explanation: 'This record suggests an unanswered question.',
    }
    const result = validateGameProgress(initialWith({ completion }), { caseFile: case001 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('not discovered')
  })

  it('rejects malformed completion data without replacing the stored save', () => {
    const key = `algorithmic-detective:progress:${case001.id}`
    const current = JSON.stringify(initialWith({ discoveredEvidenceIds: ['E001'] }))
    storage.setItem(key, current)
    const imported = importGameProgress({
      ...initialWith(),
      completion: { schemaVersion: 1, caseId: case001.id, completedAt: 'bad', selectedSuspectId: 'S999', selectedEvidenceIds: ['E999'], explanation: '' },
    }, { caseFile: case001 })
    expect(imported.ok).toBe(false)
    expect(storage.getItem(key)).toBe(current)
  })

  it('validates and exports only player progress, excluding derived structures', () => {
    const candidate = { ...initialWith({ discoveredEvidenceIds: ['E001'] }), graph: { internal: true }, trie: { nodes: [] } }
    const result = exportGameProgress(candidate, { caseFile: case001, now: new Date('2026-03-02T00:00:00.000Z') })
    expect(result.ok).toBe(true)
    expect(result.payload.discoveredEvidenceIds).toEqual(['E001'])
    expect(result.payload).not.toHaveProperty('graph')
    expect(result.payload).not.toHaveProperty('trie')
    expect(result.payload).not.toHaveProperty('evidence')
  })

  it('discards invalid and undiscovered evidence bookmarks with a validation warning', () => {
    const result = validateGameProgress(initialWith({ bookmarks: { suspects: ['S001'], evidence: ['E001', 'E999'], locations: ['L001'] } }), { caseFile: case001 })
    expect(result.valid).toBe(true)
    expect(result.progress.bookmarks).toEqual({ suspects: ['S001'], evidence: [], locations: ['L001'] })
    expect(result.warnings.join(' ')).toContain('invalid evidence bookmark')
  })

  it('round-trips journal entries and bookmarks with discovery state', () => {
    const entry = createJournalEntry({ title: 'Initial observation', body: 'Check the key record.', category: 'observation', linkedRecord: { type: 'evidence', id: 'E001' } }, {
      caseFile: case001,
      discoveredEvidenceIds: new Set(['E001']),
      now: new Date('2026-04-05T10:00:00.000Z'),
      idFactory: () => 'note-1',
    })
    let progress = initialWith({ discoveredEvidenceIds: ['E001'], journalEntries: [entry] })
    progress = { ...progress, bookmarks: addBookmark(progress.bookmarks, 'evidence', 'E001', { caseFile: case001, discoveredEvidenceIds: new Set(['E001']) }) }
    saveGameProgress(progress, { storage, caseFile: case001 })
    const loaded = loadGameProgress({ storage, caseFile: case001 })
    expect(loaded.progress.journalEntries[0]).toMatchObject({ id: 'note-1', linkedRecord: { type: 'evidence', id: 'E001' } })
    expect(loaded.progress.bookmarks.evidence).toEqual(['E001'])
  })
})

function loadRaw(data) {
  const fake = memoryStorage({ [`algorithmic-detective:progress:${case001.id}`]: JSON.stringify(data) })
  return loadGameProgress({ storage: fake, caseFile: case001 })
}

describe('journal entry helpers', () => {
  const now = new Date('2026-05-06T07:08:09.000Z')

  it('creates a trimmed journal entry and rejects empty notes', () => {
    const entry = createJournalEntry({ title: '  Check clock  ', body: '  Compare the reported times.  ', category: 'timeline_note' }, { now, idFactory: () => 'note-clock' })
    expect(entry.title).toBe('Check clock')
    expect(entry.body).toBe('Compare the reported times.')
    expect(entry.createdAt).toBe(now.toISOString())
    expect(() => createJournalEntry({ title: '   ', body: '', category: 'observation' })).toThrow()
  })

  it('preserves creation time and changes modification time on edit', () => {
    const entry = createJournalEntry({ title: 'First', body: 'A note.', category: 'observation' }, { idFactory: () => 'edit-me', now })
    const nextTime = new Date('2026-05-07T07:08:09.000Z')
    const edited = updateJournalEntry([entry], entry.id, { title: 'Revised', body: 'More detail.' }, { now: nextTime })[0]
    expect(edited.createdAt).toBe(entry.createdAt)
    expect(edited.updatedAt).toBe(nextTime.toISOString())
    expect(edited.title).toBe('Revised')
  })

  it('prevents duplicate IDs, deletes entries, and searches and filters them', () => {
    const first = createJournalEntry({ id: 'one', title: 'Kitchen account', body: 'Check the receipt.', category: 'evidence_connection' }, { idFactory: () => 'unused' })
    const second = createJournalEntry({ id: 'two', title: 'A question', body: 'Who signed the note?', category: 'unresolved_question' }, { idFactory: () => 'unused' })
    expect(() => createJournalEntry({ id: 'one', title: 'Again', body: 'Duplicate.', category: 'observation' }, { entries: [first] })).toThrow(/already exists/)
    expect(filterJournalEntries([first, second], { query: 'receipt' }).map((entry) => entry.id)).toEqual(['one'])
    expect(filterJournalEntries([first, second], { category: 'unresolved_question' }).map((entry) => entry.id)).toEqual(['two'])
    expect(deleteJournalEntry([first, second], 'one')).toEqual([second])
  })

  it('removes a missing linked record from imported notes instead of retaining a stale reference', () => {
    const entry = createJournalEntry({ id: 'linked', title: 'A note', body: 'Text', category: 'observation' }, { now, idFactory: () => 'unused' })
    const result = validateGameProgress(initialWith({ journalEntries: [{ ...entry, linkedRecord: { type: 'suspect', id: 'S999' } }] }), { caseFile: case001 })
    expect(result.valid).toBe(true)
    expect(result.progress.journalEntries[0]).not.toHaveProperty('linkedRecord')
    expect(result.warnings.join(' ')).toContain('missing case record')
  })
})

describe('bookmark helpers and restored DSA inputs', () => {
  it('adds each bookmark once, removes it, and refuses undiscovered evidence', () => {
    const once = addBookmark({ suspects: ['S001', 'S001'] }, 'suspects', 'S001', { caseFile: case001 })
    expect(once.suspects).toEqual(['S001'])
    expect(addBookmark(once, 'suspects', 'S002', { caseFile: case001 }).suspects).toEqual(['S001', 'S002'])
    expect(removeBookmark(once, 'suspects', 'S001').suspects).toEqual([])
    expect(() => addBookmark(once, 'evidence', 'E001', { caseFile: case001 })).toThrow(/Undiscovered/)
    expect(() => addBookmark(once, 'suspects', 'S999', { caseFile: case001 })).toThrow(/missing/)
  })

  it('feeds restored discovery IDs into suspect ranking and deduction without changing case records', () => {
    const before = JSON.stringify(case001)
    const storage = memoryStorage()
    const stored = initialWith({ discoveredEvidenceIds: ['E003'] })
    saveGameProgress(stored, { storage, caseFile: case001 })
    const restored = loadGameProgress({ storage, caseFile: case001 }).progress
    const discovered = new Set(restored.discoveredEvidenceIds)
    const relationships = createSuspectEvidenceRelationships(case001)
    const ranking = rankSuspects({ suspects: case001.suspects, evidence: case001.evidence, timeline: case001.events, discoveredEvidenceIds: discovered, relationships })
    const rahul = ranking.rankedSuspects.find((suspect) => suspect.id === 'S001')
    expect(rahul.supportingEvidence.map((item) => item.id)).toContain('E003')
    const theory = evaluateTheory({ suspectId: 'S001', discoveredEvidenceIds: discovered, suspects: case001.suspects, evidence: case001.evidence, timeline: case001.events, locations: case001.locations, relationships })
    expect(theory.supportingFacts.map((fact) => fact.evidenceId)).toContain('E003')
    expect(JSON.stringify(case001)).toBe(before)
    expect(restored.discoveredEvidenceIds).toEqual(['E003'])
  })
})
