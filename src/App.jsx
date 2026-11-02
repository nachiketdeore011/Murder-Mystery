import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import Navbar from './components/Navbar.jsx'
import ConfusionFeedbackModal from './components/ConfusionFeedbackModal.jsx'
import GuidedTour from './components/GuidedTour.jsx'
import HowToPlayModal from './components/HowToPlayModal.jsx'
import CaseSimulation from './components/CaseSimulation.jsx'
import About from './pages/About.jsx'
import CaseFilesPlaceholder from './pages/CaseFilesPlaceholder.jsx'
import Home from './pages/Home.jsx'
import Investigation from './pages/Investigation.jsx'
import InvestigationDashboard from './pages/InvestigationDashboard.jsx'
import { case001 } from './data/case001.js'
import { appendSessionActivity } from './analytics/activityLog.js'
import {
  loadGameProgress,
  resetGameProgress,
  saveGameProgress,
  validateGameProgress,
} from './state/gameProgress.js'

const SAVE_RECOVERY_REQUIRED = new Set(['corrupted', 'invalid-save', 'incompatible', 'storage-error'])

function createSaveStatus(loadResult) {
  return {
    status: loadResult.status,
    errors: loadResult.errors || [],
    warnings: loadResult.warnings || [],
    lastSavedAt: loadResult.progress?.savedAt || null,
    recoveryRequired: SAVE_RECOVERY_REQUIRED.has(loadResult.status),
  }
}

function App() {
  const [activeView, setActiveView] = useState('home')
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [initialLoad] = useState(() => loadGameProgress({ caseFile: case001 }))
  const [progress, setProgress] = useState(initialLoad.progress)
  const [saveStatus, setSaveStatus] = useState(() => createSaveStatus(initialLoad))
  const [progressRevision, setProgressRevision] = useState(0)
  const [hasUnsavedJournalDraft, setHasUnsavedJournalDraft] = useState(false)
  const [activityLog, setActivityLog] = useState([])
  const [pendingSelection, setPendingSelection] = useState(null)
  const [pendingSectionId, setPendingSectionId] = useState(null)
  const activitySequence = useRef(0)
  const pageShellRef = useRef(null)
  const discoveredEvidenceIds = useMemo(() => new Set(progress.discoveredEvidenceIds), [progress.discoveredEvidenceIds])

  useEffect(() => {
    if (!hasUnsavedJournalDraft) return undefined
    const preventDraftLoss = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventDraftLoss)
    return () => window.removeEventListener('beforeunload', preventDraftLoss)
  }, [hasUnsavedJournalDraft])

  const closeHowToPlay = useCallback(() => {
    setIsHowToPlayOpen(false)
  }, [])

  const closeFeedback = useCallback(() => {
    setIsFeedbackOpen(false)
  }, [])

  const navigate = (view) => {
    if (activeView === 'investigation' && hasUnsavedJournalDraft) {
      if (!window.confirm('A journal note has unsaved changes. Leave this investigation and discard the draft?')) return
      setHasUnsavedJournalDraft(false)
    }
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateProgress = useCallback((updater) => {
    setProgress((current) => updater(current))
    setProgressRevision((revision) => revision + 1)
  }, [])

  const recordActivity = useCallback((type, details = {}) => {
    activitySequence.current += 1
    const event = {
      id: 'session-' + activitySequence.current,
      type,
      occurredAt: new Date().toISOString(),
      ...details,
    }
    setActivityLog((current) => appendSessionActivity(current, event))
  }, [])

  const reportConfusion = useCallback((note) => {
    recordActivity('confusion-reported', { label: note || 'No detail given' })
  }, [recordActivity])

  const discoverEvidence = useCallback((evidenceId) => {
    const evidence = case001.evidence.find((record) => record.id === evidenceId)
    if (!evidence || discoveredEvidenceIds.has(evidenceId)) return
    updateProgress((current) => ({
      ...current,
      discoveredEvidenceIds: [...current.discoveredEvidenceIds, evidenceId],
    }))
    recordActivity('evidence-discovered', { recordType: 'evidence', recordId: evidence.id, label: evidence.title })
  }, [discoveredEvidenceIds, recordActivity, updateProgress])

  const updateJournalEntries = useCallback((journalEntries) => {
    const previousById = new Map(progress.journalEntries.map((entry) => [entry.id, entry]))
    const nextById = new Map(journalEntries.map((entry) => [entry.id, entry]))
    for (const [id, previous] of previousById) {
      const next = nextById.get(id)
      if (!next) recordActivity('journal-entry-deleted')
      else if (next.updatedAt !== previous.updatedAt) recordActivity('journal-entry-updated')
    }
    for (const id of nextById.keys()) if (!previousById.has(id)) recordActivity('journal-entry-saved')
    updateProgress((current) => ({ ...current, journalEntries }))
  }, [progress.journalEntries, recordActivity, updateProgress])

  const updateBookmarks = useCallback((bookmarks) => {
    for (const collection of ['suspects', 'evidence', 'locations']) {
      const previous = new Set(progress.bookmarks[collection] || [])
      const next = new Set(bookmarks[collection] || [])
      const recordType = collection === 'suspects' ? 'suspect' : collection === 'locations' ? 'location' : 'evidence'
      for (const id of next) {
        if (previous.has(id)) continue
        const record = case001[collection].find((item) => item.id === id)
        const visible = collection !== 'evidence' || discoveredEvidenceIds.has(id)
        recordActivity('bookmark-added', {
          recordType,
          recordId: id,
          ...(visible ? { label: record?.name || record?.title } : {}),
        })
      }
      for (const id of previous) {
        if (next.has(id)) continue
        const record = case001[collection].find((item) => item.id === id)
        const visible = collection !== 'evidence' || discoveredEvidenceIds.has(id)
        recordActivity('bookmark-removed', {
          recordType,
          recordId: id,
          ...(visible ? { label: record?.name || record?.title } : {}),
        })
      }
    }
    updateProgress((current) => ({ ...current, bookmarks }))
  }, [discoveredEvidenceIds, progress.bookmarks, recordActivity, updateProgress])

  const applySaveResult = useCallback((result) => {
    if (result.ok) {
      setProgress(result.progress)
      setSaveStatus({
        status: 'saved',
        errors: [],
        warnings: result.warnings || [],
        lastSavedAt: result.progress.savedAt,
        recoveryRequired: false,
      })
      return result
    }
    setSaveStatus((current) => ({
      ...current,
      status: result.status || 'write-error',
      errors: result.errors || ['Progress could not be saved.'],
    }))
    return result
  }, [])

  const saveNow = useCallback(() => {
    if (saveStatus.recoveryRequired) {
      return { ok: false, status: 'recovery-required', errors: ['Import a valid save or reset this case before saving over the recovery state.'] }
    }
    return applySaveResult(saveGameProgress(progress, { caseFile: case001 }))
  }, [applySaveResult, progress, saveStatus.recoveryRequired])

  useLayoutEffect(() => {
    const pageShell = pageShellRef.current
    const diagnosticsEnabled = import.meta.env.DEV
    if (!pageShell) {
      if (diagnosticsEnabled) console.warn('[Anime.js] Animation target missing')
      return undefined
    }

    const prefersReducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      if (diagnosticsEnabled) console.info('[Anime.js] Reduced motion enabled; entrance animation skipped')
      return undefined
    }

    if (diagnosticsEnabled) console.info('[Anime.js] Animation effect triggered; target found', pageShell)

    let animation
    let hasLoggedUpdate = false
    let hasCompleted = false
    try {
      animation = animate(pageShell, {
        opacity: [0, 1],
        y: [60, 0],
        scale: [0.96, 1],
        duration: 1000,
        ease: 'outCubic',
        onBegin: () => {
          if (diagnosticsEnabled) console.info('[Anime.js] Animation started')
        },
        onUpdate: () => {
          if (!diagnosticsEnabled || hasLoggedUpdate) return
          hasLoggedUpdate = true
          const style = getComputedStyle(pageShell)
          console.info('[Anime.js] Target styles updating', {
            opacity: style.opacity,
            transform: style.transform,
          })
        },
        onComplete: () => {
          hasCompleted = true
          if (diagnosticsEnabled) console.info('[Anime.js] Animation completed')
        },
      })
    } catch (error) {
      pageShell.style.opacity = '1'
      pageShell.style.transform = 'none'
      console.error('[Anime.js] Animation failed; showing page without animation', error)
      return undefined
    }

    return () => {
      if (diagnosticsEnabled && !hasCompleted) console.info('[Anime.js] Animation cancelled during cleanup')
      animation.revert()
    }
  }, [activeView])

  // Revision starts at zero, so loading a save never triggers an immediate write.
  // A malformed or incompatible save remains untouched until the player imports or resets.
  useEffect(() => {
    if (progressRevision === 0 || saveStatus.recoveryRequired) return
    applySaveResult(saveGameProgress(progress, { caseFile: case001 }))
  }, [progressRevision]) // progress is the state paired with the revision that triggered this effect.

  const importProgress = useCallback((candidate) => {
    if (hasUnsavedJournalDraft
      && !window.confirm('Importing this save will discard the unsaved journal draft. Continue?')) {
      return { ok: false, status: 'cancelled', errors: ['Import cancelled; the current progress was not changed.'] }
    }
    const validation = validateGameProgress(candidate, { caseFile: case001 })
    if (!validation.valid) return { ok: false, status: 'invalid-save', errors: validation.errors, warnings: validation.warnings }

    setProgress(validation.progress)
    setProgressRevision(0)
    setHasUnsavedJournalDraft(false)
    const persisted = saveGameProgress(validation.progress, { caseFile: case001 })
    if (persisted.ok) {
      setProgress(persisted.progress)
      setSaveStatus({
        status: 'saved',
        errors: [],
        warnings: [...validation.warnings, ...(persisted.warnings || [])],
        lastSavedAt: persisted.progress.savedAt,
        recoveryRequired: false,
      })
      return { ok: true, status: 'saved', warnings: [...validation.warnings, ...(persisted.warnings || [])] }
    }
    setSaveStatus({
      status: 'imported-unsaved',
      errors: persisted.errors || ['The imported progress is active in this session but could not be saved to browser storage.'],
      warnings: validation.warnings,
      lastSavedAt: validation.progress.savedAt,
      recoveryRequired: false,
    })
    return { ok: true, status: 'imported-unsaved', warnings: validation.warnings, errors: persisted.errors }
  }, [hasUnsavedJournalDraft])

  const resetProgress = useCallback((options = {}) => {
    if (hasUnsavedJournalDraft
      && !window.confirm('Resetting progress will also discard the unsaved journal draft. Continue?')) {
      return { ok: false, status: 'cancelled', error: 'Reset cancelled; current progress and the journal draft were not changed.' }
    }
    const result = resetGameProgress({ caseFile: case001 })
    setProgress(result.progress)
    setProgressRevision(0)
    setHasUnsavedJournalDraft(false)
    setSaveStatus({
      status: result.status,
      errors: result.error ? [result.error] : [],
      warnings: [],
      lastSavedAt: null,
      recoveryRequired: !result.ok,
    })
    if (result.status !== 'cancelled') {
      recordActivity(options.source === 'replay' ? 'replay-started' : 'progress-reset')
    }
    return result
  }, [hasUnsavedJournalDraft, recordActivity])

  const completeAccusation = useCallback((attempt) => {
    recordActivity(attempt.outcome === 'case_solved' ? 'case-solved' : 'accusation-submitted')
    updateProgress((current) => {
      if (current.completion) return current
      return {
        ...current,
        completion: {
          schemaVersion: 1,
          caseId: case001.id,
          completedAt: new Date().toISOString(),
          selectedSuspectId: attempt.selectedSuspectId,
          selectedEvidenceIds: [...attempt.selectedEvidenceIds],
          explanation: attempt.explanation.trim(),
        },
      }
    })
  }, [recordActivity, updateProgress])

  const dismissGuidedTour = useCallback(() => {
    if (progress.tourCompleted) return
    updateProgress((current) => (current.tourCompleted ? current : { ...current, tourCompleted: true }))
  }, [progress.tourCompleted, updateProgress])

  // The simulation can hand the player straight to the section it is describing.
  // The scroll runs after the investigation view has painted its DOM.
  useEffect(() => {
    if (activeView !== 'investigation' || !pendingSectionId) return
    const target = document.getElementById(pendingSectionId)
    setPendingSectionId(null)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeView, pendingSectionId])

  const openInvestigationSection = useCallback((sectionId) => {
    setPendingSectionId(typeof sectionId === 'string' && sectionId ? sectionId : null)
    navigate('investigation')
  }, [navigate])

  const openInvestigationRecord = useCallback((type, id) => {
    if (type === 'evidence' && !discoveredEvidenceIds.has(id)) return
    setPendingSelection({ type, id })
    navigate('investigation')
  }, [discoveredEvidenceIds, navigate])

  const consumePendingSelection = useCallback(() => setPendingSelection(null), [])

  let page

  switch (activeView) {
    case 'investigation':
      page = (
        <Investigation
          activityLog={activityLog}
          caseFile={case001}
          discoveredEvidenceIds={discoveredEvidenceIds}
          onDiscoverEvidence={discoverEvidence}
          onReturnHome={() => navigate('home')}
          progress={progress}
          onJournalEntriesChange={updateJournalEntries}
          onBookmarksChange={updateBookmarks}
          saveStatus={saveStatus}
          onSaveNow={saveNow}
          onImportProgress={importProgress}
          onResetProgress={resetProgress}
          onCompleteAccusation={completeAccusation}
          onActivity={recordActivity}
          initialSelection={pendingSelection}
          onInitialSelectionHandled={consumePendingSelection}
          onJournalDraftDirtyChange={setHasUnsavedJournalDraft}
          hasUnsavedJournalDraft={hasUnsavedJournalDraft}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
        />
      )
      break
    case 'analytics':
      page = (
        <InvestigationDashboard
          activityLog={activityLog}
          caseFile={case001}
          discoveredEvidenceIds={discoveredEvidenceIds}
          onActivity={recordActivity}
          onOpenRecord={openInvestigationRecord}
          onReturnToInvestigation={() => navigate('investigation')}
          progress={progress}
        />
      )
      break
    case 'simulation':
      page = (
        <CaseSimulation
          caseFile={case001}
          onOpenInvestigation={openInvestigationSection}
          onReturnHome={() => navigate('home')}
        />
      )
      break
    case 'case-files':
      page = (
        <CaseFilesPlaceholder
          caseFile={case001}
          discoveredEvidenceIds={discoveredEvidenceIds}
          onOpenCase={() => navigate('investigation')}
          progress={progress}
        />
      )
      break
    case 'about':
      page = <About />
      break
    default:
      page = (
        <Home
          onStartInvestigation={() => navigate('investigation')}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenSimulation={() => navigate('simulation')}
        />
      )
  }

  return (
    <div className="app-shell">
      <Navbar activeView={activeView} onNavigate={navigate} />
      <div className="page-shell" key={activeView} ref={pageShellRef}>
        {page}
      </div>
      {activeView === 'investigation' && progress.tourCompleted === false && (
        <GuidedTour onDismiss={dismissGuidedTour} />
      )}
      <footer className="site-footer">
        <span>An interactive DSA mini-project</span>
        <span className="footer-separator" aria-hidden="true">•</span>
        <span>Case files are fictional</span>
      </footer>
      <HowToPlayModal isOpen={isHowToPlayOpen} onClose={closeHowToPlay} />
      <ConfusionFeedbackModal isOpen={isFeedbackOpen} onClose={closeFeedback} onSubmit={reportConfusion} />
      <span className="ambient-grain" aria-hidden="true" />
    </div>
  )
}

export default App
