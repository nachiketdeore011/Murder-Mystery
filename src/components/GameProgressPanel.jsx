import { useRef, useState } from 'react'
import { exportGameProgress, importGameProgress } from '../state/gameProgress.js'

function formatTimestamp(value) {
  if (!value) return 'No saved timestamp yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Saved time unavailable' : date.toLocaleString()
}

function statusText(status) {
  const messages = {
    empty: 'No previous browser save found. New progress will save after your next change.',
    loaded: 'Saved progress was restored from this browser.',
    saved: 'Progress saved to this browser.',
    reset: 'This case progress was reset.',
    corrupted: 'The stored save is unreadable. It has been left untouched.',
    incompatible: 'The stored save is for another case or schema version.',
    'invalid-save': 'The stored save failed validation and was left untouched.',
    'storage-unavailable': 'Browser storage is unavailable. Export a save file for a backup.',
    'storage-error': 'Browser storage could not be read or cleared.',
    'write-error': 'Progress could not be saved to browser storage.',
    'imported-unsaved': 'Imported progress is active in this session but could not be saved here.',
    'validation-error': 'Progress did not pass save validation.',
  }
  return messages[status] || 'Progress status is unavailable.'
}

function GameProgressPanel({ caseFile, progress, saveStatus, hasUnsavedJournalDraft, onSaveNow, onImportProgress, onResetProgress }) {
  const fileInputRef = useRef(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackIsError, setFeedbackIsError] = useState(false)
  const bookmarkCount = Object.values(progress.bookmarks || {}).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0)

  const handleExport = () => {
    const result = exportGameProgress(progress, { caseFile })
    if (!result.ok) {
      setFeedback(result.errors.join(' '))
      setFeedbackIsError(true)
      return
    }
    const blob = new Blob([result.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${caseFile.id.toLowerCase()}-progress.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback('Progress exported as a JSON save file.')
    setFeedbackIsError(false)
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let contents
    try {
      contents = await file.text()
    } catch {
      setFeedback('The selected file could not be read.')
      setFeedbackIsError(true)
      return
    }

    const validation = importGameProgress(contents, { caseFile })
    if (!validation.ok) {
      setFeedback(validation.errors.join(' '))
      setFeedbackIsError(true)
      return
    }

    const restored = validation.progress
    const savedAt = formatTimestamp(restored.savedAt)
    const summary = [
      'Completed accusation: ' + (restored.completion ? 'yes' : 'no'),
      `Import progress for ${caseFile.id}?`,
      `Discovered clues: ${restored.discoveredEvidenceIds.length}`,
      `Journal entries: ${restored.journalEntries.length}`,
      `Bookmarks: ${bookmarkCountFor(restored.bookmarks)}`,
      `Save timestamp: ${savedAt}`,
      ...(validation.warnings.length ? [`Validation notes: ${validation.warnings.join(' ')}`] : []),
      'This replaces the current progress for this case.',
    ].join('\n')
    if (!window.confirm(summary)) {
      setFeedback('Import cancelled; current progress was not changed.')
      setFeedbackIsError(false)
      return
    }

    const applied = onImportProgress(restored)
    setFeedback(applied.ok
      ? applied.status === 'imported-unsaved'
        ? 'Progress imported for this session. Browser storage failed, so export a backup before leaving.'
        : 'Progress imported and saved.'
      : (applied.errors || ['Import cancelled; current progress was not changed.']).join(' '))
    setFeedbackIsError(!applied.ok || applied.status === 'imported-unsaved')
  }

  const handleReset = () => {
    const confirmed = window.confirm('Reset ' + caseFile.id + ' player progress? This removes discovered clues, journal entries, bookmarks and the current accusation for this case only.')
    if (!confirmed) {
      setFeedback('Reset cancelled; current progress was not changed.')
      setFeedbackIsError(false)
      return
    }
    const result = onResetProgress()
    setFeedback(result.ok ? 'Case progress reset. The static case file remains available.' : result.error)
    setFeedbackIsError(!result.ok)
  }

  const handleSave = () => {
    const result = onSaveNow()
    setFeedback(result.ok ? 'Progress saved to this browser.' : (result.errors || ['Progress could not be saved.']).join(' '))
    setFeedbackIsError(!result.ok)
  }

  return (
    <section aria-labelledby="save-progress-title" className="investigation-section game-progress-section" id="game-progress">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">LOCAL CASE FILE</span>
          <h2 id="save-progress-title">Game Progress</h2>
        </div>
        <span className="status-pill">{saveStatus.status.replaceAll('-', ' ')}</span>
      </div>
      <p aria-live="polite" className={`save-status-copy${saveStatus.recoveryRequired ? ' is-warning' : ''}`}>{statusText(saveStatus.status)}</p>
      <div className="save-progress-meta">
        <span><strong>Last saved</strong>{formatTimestamp(saveStatus.lastSavedAt || progress.savedAt)}</span>
        <span><strong>Journal entries</strong>{progress.journalEntries.length}</span>
        <span><strong>Bookmarks</strong>{bookmarkCount}</span>
        <span><strong>Case status</strong>{progress.completion ? 'Completed accusation' : 'In progress'}</span>
      </div>
      {saveStatus.errors?.length > 0 && (
        <ul className="save-message-list is-error" aria-label="Save issues">
          {saveStatus.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
        </ul>
      )}
      {saveStatus.warnings?.length > 0 && (
        <ul className="save-message-list" aria-label="Save validation notes">
          {saveStatus.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
        </ul>
      )}
      {feedback && <p aria-live="polite" className={`save-feedback${feedbackIsError ? ' is-error' : ''}`}>{feedback}</p>}
      {hasUnsavedJournalDraft && <p className="save-recovery-note">Finish or discard the open journal draft before saving or exporting it.</p>}
      <div className="save-actions">
        <button className="button button-primary" disabled={saveStatus.recoveryRequired || hasUnsavedJournalDraft} onClick={handleSave} type="button">Save progress now</button>
        <button className="button button-secondary" disabled={hasUnsavedJournalDraft} onClick={handleExport} type="button">Export JSON</button>
        <button className="button button-secondary" onClick={() => fileInputRef.current?.click()} type="button">Import save</button>
        <button className="button button-danger" onClick={handleReset} type="button">Reset case progress</button>
        <input
          accept="application/json,.json"
          aria-label="Choose a progress save JSON file"
          hidden
          onChange={handleImportFile}
          ref={fileInputRef}
          aria-hidden="true"
          tabIndex={-1}
          type="file"
        />
      </div>
      {saveStatus.recoveryRequired && <p className="save-recovery-note">To protect the stored file, saving is paused. Import a valid save or confirm a case-progress reset to recover.</p>}
      <p className="section-intro">Saves contain player discoveries, journal notes, bookmark IDs and a confirmed accusation. Static case data and algorithm indexes are rebuilt from the application data.</p>
    </section>
  )
}

function bookmarkCountFor(bookmarks) {
  return Object.values(bookmarks || {}).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0)
}

export default GameProgressPanel
