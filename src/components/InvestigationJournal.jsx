import { useEffect, useMemo, useState } from 'react'
import {
  addBookmark,
  createJournalEntry,
  deleteJournalEntry,
  filterJournalEntries,
  JOURNAL_CATEGORIES,
  removeBookmark,
  updateJournalEntry,
} from '../state/gameProgress.js'

const CATEGORY_LABELS = Object.freeze({
  observation: 'Observation',
  suspect_theory: 'Suspect theory',
  timeline_note: 'Timeline note',
  evidence_connection: 'Evidence connection',
  unresolved_question: 'Unresolved question',
})

function emptyDraft(linkedRecord = null) {
  return { title: '', body: '', category: 'observation', linkedRecord }
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

function InvestigationJournal({
  caseFile,
  discoveredEvidenceIds,
  entries,
  bookmarks,
  onEntriesChange,
  onBookmarksChange,
  onOpenRecord,
  onDraftDirtyChange,
  journalRequest,
}) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(() => emptyDraft())
  const [baseline, setBaseline] = useState(JSON.stringify(emptyDraft()))
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState('')

  const filteredEntries = useMemo(() => filterJournalEntries(entries, { query, category: categoryFilter }), [entries, query, categoryFilter])
  const discoveredEvidence = useMemo(
    () => caseFile.evidence.filter((record) => discoveredEvidenceIds.has(record.id)),
    [caseFile.evidence, discoveredEvidenceIds],
  )
  const recordCollections = useMemo(() => ({
    suspect: caseFile.suspects,
    evidence: discoveredEvidence,
    location: caseFile.locations,
  }), [caseFile, discoveredEvidence])
  const hasDraftChanges = isFormOpen && JSON.stringify(draft) !== baseline

  useEffect(() => {
    onDraftDirtyChange?.(hasDraftChanges)
  }, [hasDraftChanges, onDraftDirtyChange])

  useEffect(() => () => onDraftDirtyChange?.(false), [onDraftDirtyChange])

  useEffect(() => {
    if (!journalRequest?.nonce) return
    const linkedRecord = { type: journalRequest.type, id: journalRequest.id }
    const nextDraft = emptyDraft(linkedRecord)
    setEditingId(null)
    setDraft(nextDraft)
    setBaseline(JSON.stringify(nextDraft))
    setFormError('')
    setIsFormOpen(true)
    window.setTimeout(() => document.getElementById('journal-title-input')?.focus(), 0)
  }, [journalRequest?.nonce])

  const getRecord = (linkedRecord) => {
    if (!linkedRecord) return null
    return recordCollections[linkedRecord.type]?.find((record) => record.id === linkedRecord.id) || null
  }

  const openNewEntry = (linkedRecord = null) => {
    const nextDraft = emptyDraft(linkedRecord)
    setEditingId(null)
    setDraft(nextDraft)
    setBaseline(JSON.stringify(nextDraft))
    setFormError('')
    setFeedback('')
    setIsFormOpen(true)
    document.getElementById('journal-title-input')?.focus()
  }

  const openEditEntry = (entry) => {
    const nextDraft = {
      title: entry.title,
      body: entry.body,
      category: entry.category,
      linkedRecord: entry.linkedRecord || null,
    }
    setEditingId(entry.id)
    setDraft(nextDraft)
    setBaseline(JSON.stringify(nextDraft))
    setFormError('')
    setFeedback('')
    setIsFormOpen(true)
    document.getElementById('journal-title-input')?.focus()
  }

  const closeForm = () => {
    if (hasDraftChanges && !window.confirm('Discard this unsaved journal draft?')) return
    setIsFormOpen(false)
    setEditingId(null)
    setFormError('')
    onDraftDirtyChange?.(false)
  }

  const saveEntry = (event) => {
    event.preventDefault()
    try {
      if (editingId) {
        const nextEntries = updateJournalEntry(entries, editingId, draft, {
          caseFile,
          discoveredEvidenceIds,
        })
        onEntriesChange(nextEntries)
        setFeedback('Journal entry updated. Notes remain player observations, not verified facts.')
      } else {
        const entry = createJournalEntry(draft, {
          entries,
          caseFile,
          discoveredEvidenceIds,
        })
        onEntriesChange([...entries, entry])
        setFeedback('Journal entry saved. This is a player note, not verified evidence.')
      }
      setIsFormOpen(false)
      setEditingId(null)
      setFormError('')
      onDraftDirtyChange?.(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The journal entry could not be saved.')
    }
  }

  const handleDelete = (entry) => {
    if (!window.confirm(`Permanently delete “${entry.title}” from the journal?`)) return
    onEntriesChange(deleteJournalEntry(entries, entry.id))
    if (editingId === entry.id) {
      setIsFormOpen(false)
      setEditingId(null)
      onDraftDirtyChange?.(false)
    }
    setFeedback('Journal entry deleted.')
  }

  const toggleBookmark = (type, id) => {
    const list = bookmarks[type] || []
    try {
      const next = list.includes(id)
        ? removeBookmark(bookmarks, type, id)
        : addBookmark(bookmarks, type, id, { caseFile, discoveredEvidenceIds })
      onBookmarksChange(next)
      setFeedback(list.includes(id) ? 'Bookmark removed.' : 'Record bookmarked.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The record could not be bookmarked.')
    }
  }

  const bookmarkGroups = [
    { type: 'suspects', label: 'Suspects', records: caseFile.suspects },
    { type: 'evidence', label: 'Discovered evidence', records: discoveredEvidence },
    { type: 'locations', label: 'Locations', records: caseFile.locations },
  ]

  const associationOptions = [
    ...caseFile.suspects.map((record) => ({ type: 'suspect', record })),
    ...discoveredEvidence.map((record) => ({ type: 'evidence', record })),
    ...caseFile.locations.map((record) => ({ type: 'location', record })),
  ]
  const associationValue = draft.linkedRecord ? `${draft.linkedRecord.type}:${draft.linkedRecord.id}` : ''

  return (
    <section aria-labelledby="journal-title" className="investigation-section journal-section" id="investigation-journal">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">PRIVATE CASE NOTES</span>
          <h2 id="journal-title">Investigation Journal</h2>
        </div>
        <button className="button button-secondary" onClick={() => openNewEntry()} type="button">New journal entry</button>
      </div>
      <p className="journal-disclaimer">Journal notes are private player observations. They are not verified facts and do not affect suspect rankings or deductions.</p>

      <div className="journal-layout">
        <div className="journal-main">
          {isFormOpen && (
            <form className="journal-form" onSubmit={saveEntry}>
              <div className="journal-form-heading">
                <div>
                  <span className="section-kicker">{editingId ? 'EDIT NOTE' : 'NEW NOTE'}</span>
                  <h3>{editingId ? 'Update journal entry' : 'Record an observation'}</h3>
                </div>
                <span className="journal-draft-state">{hasDraftChanges ? 'Unsaved draft' : 'Draft ready'}</span>
              </div>
              <label className="control-label" htmlFor="journal-title-input">Entry title
                <input
                  autoFocus
                  autoComplete="off"
                  id="journal-title-input"
                  maxLength={100}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  required
                  value={draft.title}
                />
              </label>
              <label className="control-label" htmlFor="journal-category-input">Category
                <select id="journal-category-input" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} value={draft.category}>
                  {JOURNAL_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                </select>
              </label>
              <label className="control-label" htmlFor="journal-link-input">Associated case record <span className="optional-label">optional</span>
                <select
                  id="journal-link-input"
                  onChange={(event) => {
                    const [type, id] = event.target.value.split(':')
                    setDraft((current) => ({ ...current, linkedRecord: type && id ? { type, id } : null }))
                  }}
                  value={associationValue}
                >
                  <option value="">No linked record</option>
                  {associationOptions.map(({ type, record }) => (
                    <option key={`${type}:${record.id}`} value={`${type}:${record.id}`}>
                      {type[0].toUpperCase() + type.slice(1)} · {record.id} · {record.name || record.title}
                    </option>
                  ))}
                </select>
                <span className="field-hint">Only discovered evidence can be linked.</span>
              </label>
              <label className="control-label" htmlFor="journal-body-input">Note
                <textarea
                  id="journal-body-input"
                  maxLength={5000}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  required
                  rows={5}
                  value={draft.body}
                />
              </label>
              {formError && <p aria-live="polite" className="journal-error">{formError}</p>}
              <div className="journal-form-actions">
                <button className="button button-primary" type="submit">{editingId ? 'Save changes' : 'Save entry'}</button>
                <button className="button button-secondary" onClick={closeForm} type="button">Cancel</button>
              </div>
            </form>
          )}

          <div className="journal-controls">
            <label className="control-label" htmlFor="journal-search">Search journal
              <input id="journal-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search titles and notes" type="search" value={query} />
            </label>
            <label className="control-label" htmlFor="journal-filter">Category
              <select id="journal-filter" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="all">All categories</option>
                {JOURNAL_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
              </select>
            </label>
          </div>

          {feedback && <p aria-live="polite" className="journal-feedback">{feedback}</p>}
          {filteredEntries.length ? (
            <ol className="journal-entry-list">
              {filteredEntries.map((entry) => {
                const linkedRecord = getRecord(entry.linkedRecord)
                return (
                  <li className="journal-entry" key={entry.id}>
                    <div className="journal-entry-topline">
                      <span className="journal-category-tag">{CATEGORY_LABELS[entry.category]}</span>
                      <time dateTime={entry.updatedAt}>{formatDate(entry.updatedAt)}</time>
                    </div>
                    <h3>{entry.title}</h3>
                    <p className="journal-entry-body">{entry.body}</p>
                    {linkedRecord && entry.linkedRecord && (
                      <button className="journal-record-link" onClick={() => onOpenRecord(entry.linkedRecord.type, entry.linkedRecord.id)} type="button">
                        Open linked {entry.linkedRecord.type}: {entry.linkedRecord.id} · {linkedRecord.name || linkedRecord.title}
                      </button>
                    )}
                    <div className="journal-entry-actions">
                      <span>Created {formatDate(entry.createdAt)}</span>
                      <button onClick={() => openEditEntry(entry)} type="button">Edit</button>
                      <button className="is-danger" onClick={() => handleDelete(entry)} type="button">Delete</button>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="journal-empty-state">
              <span className="section-kicker">NO MATCHING NOTES</span>
              <p>{entries.length ? 'No journal entries match this search and category.' : 'Your journal is empty. Record observations as you investigate.'}</p>
            </div>
          )}
        </div>

        <aside aria-labelledby="bookmarks-title" className="bookmark-panel">
          <div className="bookmark-panel-heading">
            <span className="section-kicker">SAVED RECORDS</span>
            <h3 id="bookmarks-title">Bookmarks</h3>
          </div>
          {bookmarkGroups.map((group) => {
            const ids = bookmarks[group.type] || []
            const records = ids.map((id) => group.records.find((record) => record.id === id)).filter(Boolean)
            if (!records.length) return null
            return (
              <div className="bookmark-group" key={group.type}>
                <h4>{group.label}</h4>
                <ul>
                  {records.map((record) => (
                    <li key={record.id}>
                      <button className="bookmark-open" onClick={() => onOpenRecord(group.type === 'suspects' ? 'suspect' : group.type === 'locations' ? 'location' : 'evidence', record.id)} type="button">
                        <span>{record.id}</span>{record.name || record.title}
                      </button>
                      <button aria-label={`Remove bookmark for ${record.name || record.title}`} className="bookmark-remove" onClick={() => toggleBookmark(group.type, record.id)} type="button">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {bookmarkCount(bookmarks) === 0 && <p className="bookmark-empty">No bookmarks yet. Save a suspect, discovered clue or location for quick reference.</p>}
          <p className="bookmark-privacy-note">Bookmarks store record IDs only. Sealed evidence cannot be bookmarked or opened from here.</p>
        </aside>
      </div>
    </section>
  )
}

function bookmarkCount(bookmarks) {
  return Object.values(bookmarks || {}).reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0)
}

export default InvestigationJournal
