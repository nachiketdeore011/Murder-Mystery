import { useEffect, useMemo, useRef, useState } from 'react'
import DetailPanel from '../components/DetailPanel.jsx'
import EvidenceCard from '../components/EvidenceCard.jsx'
import FinalAccusation from '../components/FinalAccusation.jsx'
import BPlusTreeExplorer from '../components/BPlusTreeExplorer.jsx'
import CounterfactualLab from '../components/CounterfactualLab.jsx'
import DeductionLab from '../components/DeductionLab.jsx'
import EvidenceRelationshipNetwork from '../components/EvidenceRelationshipNetwork.jsx'
import GameProgressPanel from '../components/GameProgressPanel.jsx'
import GraphExplorer from '../components/GraphExplorer.jsx'
import HashTableExplorer from '../components/HashTableExplorer.jsx'
import IntelligentClueSearch from '../components/IntelligentClueSearch.jsx'
import InvestigationJournal from '../components/InvestigationJournal.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import SuspectAnalysis from '../components/SuspectAnalysis.jsx'
import SuspectCard from '../components/SuspectCard.jsx'
import TrieExplorer from '../components/TrieExplorer.jsx'
import TreeExplorer from '../components/TreeExplorer.jsx'
import { createCaseIndex } from '../data/caseIndex.js'
import { createClueSearchIndex } from '../data/clueSearchIndex.js'
import { createEvidenceIndex } from '../data/evidenceIndex.js'
import { addBookmark, removeBookmark } from '../state/gameProgress.js'

function timeToMinutes(timestamp) {
  const match = timestamp.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return Number.MAX_SAFE_INTEGER
  const [, hourText, minuteText, meridiem] = match
  let hour = Number(hourText) % 12
  if (meridiem.toUpperCase() === 'PM') hour += 12
  return hour * 60 + Number(minuteText)
}

// Sealed clues cannot be opened from search, so the message names the room the
// clue was filed in and the one action that uncovers it.
export function sealedClueHint(evidenceId, locationName) {
  const room = locationName ? ` It was filed in the ${locationName}.` : ''
  return `${evidenceId} is still sealed.${room} Open the Clue Register and inspect the sealed card to uncover it.`
}

// One "what next" line for the progress card, derived only from data the page
// already holds so every stage is testable without mounting the page.
export function nextStepHint({ activityLog = [], caseFile = {}, discoveredEvidenceIds, progress = {} } = {}) {
  const discovered = discoveredEvidenceIds instanceof Set
    ? discoveredEvidenceIds
    : new Set(Array.isArray(discoveredEvidenceIds) ? discoveredEvidenceIds : [])
  const evidenceTotal = Array.isArray(caseFile.evidence) ? caseFile.evidence.length : 0
  const suspects = Array.isArray(caseFile.suspects) ? caseFile.suspects : []
  const reviewedSuspectIds = new Set((Array.isArray(activityLog) ? activityLog : [])
    .filter((event) => event?.type === 'suspect-reviewed' && typeof event.recordId === 'string')
    .map((event) => event.recordId))
  const everySuspectReviewed = suspects.length > 0 && suspects.every((suspect) => reviewedSuspectIds.has(suspect.id))

  if (progress.completion) return 'Accusation recorded — review the completed case or replay it.'
  if (evidenceTotal > 0 && discovered.size >= evidenceTotal) return "You're ready to make a Final Accusation."
  if (discovered.size === 0) return 'Start by exploring the Crime Scene Map.'
  if (!everySuspectReviewed) return "Open each suspect's profile to review their account."
  return 'Try the Deduction Lab to test a theory.'
}

function RecordActions({ isBookmarked, onAddNote, onToggleBookmark, recordLabel }) {
  return (
    <div className="record-detail-actions">
      <button className="button button-secondary" onClick={onToggleBookmark} type="button">
        {isBookmarked ? 'Remove bookmark' : 'Bookmark this clue'}
      </button>
      <button className="button button-secondary" onClick={onAddNote} type="button">Add journal note about this {recordLabel}</button>
    </div>
  )
}

function Investigation({
  activityLog,
  caseFile,
  discoveredEvidenceIds,
  onDiscoverEvidence,
  onReturnHome,
  progress,
  onJournalEntriesChange,
  onBookmarksChange,
  saveStatus,
  onSaveNow,
  onImportProgress,
  onResetProgress,
  onJournalDraftDirtyChange,
  hasUnsavedJournalDraft,
  onCompleteAccusation,
  onActivity,
  onOpenFeedback,
  initialSelection,
  onInitialSelectionHandled,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState(null)
  const [journalRequest, setJournalRequest] = useState(null)
  const journalRequestCounter = useRef(0)
  const handledInitialSelection = useRef(null)
  const caseIndex = useMemo(() => createCaseIndex(caseFile), [caseFile])
  // Case data is immutable; a replacement case object creates a fresh Trie index.
  const clueSearchIndex = useMemo(() => createClueSearchIndex(caseFile), [caseFile])
  // Rebuild on an immutable evidence-array replacement; discovery state is separate.
  const evidenceIndex = useMemo(() => createEvidenceIndex(caseFile.evidence), [caseFile.evidence])
  const discoveredCount = discoveredEvidenceIds.size
  const evidenceTotal = caseFile.evidence.length
  const progressPercent = Math.round((discoveredCount / evidenceTotal) * 100)
  const currentStatus = progress.completion ? 'Case completed' : discoveredCount > 0 ? 'Investigation in progress' : caseFile.status

  const categories = useMemo(
    () => [...new Set(caseFile.evidence.map((item) => item.category))].sort(),
    [caseFile.evidence],
  )

  const visibleEvidence = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase()
    return caseFile.evidence.filter((item) => {
      const isDiscovered = discoveredEvidenceIds.has(item.id)
      if (!isDiscovered) return !query && selectedCategory === 'all'
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
      const matchesSearch = !query || `${item.title} ${item.description}`.toLocaleLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [caseFile.evidence, discoveredEvidenceIds, searchTerm, selectedCategory])

  const timeline = useMemo(
    () => [...caseFile.events].sort((left, right) => timeToMinutes(left.timestamp) - timeToMinutes(right.timestamp)),
    [caseFile.events],
  )

  const selectedSuspect = selectedDetail?.type === 'suspect'
    ? caseIndex.getSuspectById(selectedDetail.id)
    : null
  const selectedLocation = selectedDetail?.type === 'location'
    ? caseIndex.getLocationById(selectedDetail.id)
    : null
  const selectedEvidence = selectedDetail?.type === 'evidence'
    ? evidenceIndex.getEvidenceById(selectedDetail.id)
    : null

  useEffect(() => {
    if (!selectedDetail) return
    if (selectedDetail.type === 'evidence' && !discoveredEvidenceIds.has(selectedDetail.id)) return
    const panelId = `${selectedDetail.type}-detail-panel`
    document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [discoveredEvidenceIds, selectedDetail])

  useEffect(() => {
    if (!selectedTimelineEventId) return
    document.getElementById(`timeline-event-${selectedTimelineEventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedTimelineEventId])

  const selectDetail = (type, id) => {
    if (type === 'evidence' && !discoveredEvidenceIds.has(id)) return
    const record = type === 'suspect'
      ? caseIndex.getSuspectById(id)
      : type === 'location'
        ? caseIndex.getLocationById(id)
        : type === 'evidence'
          ? evidenceIndex.getEvidenceById(id)
          : null
    if (!record) return
    setSelectedDetail({ type, id })
    onActivity?.(type === 'suspect' ? 'suspect-reviewed' : type === 'location' ? 'location-explored' : 'evidence-reviewed', {
      recordType: type,
      recordId: id,
      label: record.name || record.title,
    })
  }
  const selectTimelineEvent = (id) => {
    const event = caseIndex.getTimelineEventById(id)
    if (!event) return
    setSelectedTimelineEventId(id)
    onActivity?.('timeline-reviewed', { recordType: 'timeline', recordId: id, label: event.title })
  }
  const closeDetail = () => setSelectedDetail(null)
  const openRecordFromJournal = (type, id) => {
    if (type === 'evidence' && !discoveredEvidenceIds.has(id)) return
    selectDetail(type, id)
    document.getElementById(`${type}-detail-panel`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  const openNetworkRecord = (type, id) => {
    if (type === 'evidence' && !discoveredEvidenceIds.has(id)) return
    if (type === 'suspect' || type === 'location' || type === 'evidence') selectDetail(type, id)
  }
  const requestJournalEntry = (type, id) => {
    journalRequestCounter.current += 1
    setJournalRequest({ type, id, nonce: journalRequestCounter.current })
    document.getElementById('investigation-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const toggleBookmark = (type, id) => {
    const collection = type === 'suspect' ? 'suspects' : type === 'location' ? 'locations' : 'evidence'
    const currentBookmarks = progress.bookmarks[collection] || []
    const nextBookmarks = currentBookmarks.includes(id)
      ? removeBookmark(progress.bookmarks, collection, id)
      : addBookmark(progress.bookmarks, collection, id, { caseFile, discoveredEvidenceIds })
    onBookmarksChange(nextBookmarks)
  }
  const isBookmarked = (collection, id) => (progress.bookmarks[collection] || []).includes(id)

  const selectClueSearchResult = (result) => {
    if (result.type === 'evidence') {
      if (discoveredEvidenceIds.has(result.id)) {
        selectDetail('evidence', result.id)
        return `Opened discovered clue ${result.id}.`
      }
      const sealedEvidence = caseIndex.getEvidenceById(result.id)
      const sealedLocationName = sealedEvidence ? caseIndex.getLocationById(sealedEvidence.discoveredAt)?.name : null
      const sealedCard = document.querySelector(`[data-evidence-id="${result.id}"]`)
      if (sealedCard) sealedCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else document.getElementById('evidence-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return sealedClueHint(result.id, sealedLocationName)
    }
    if (result.type === 'suspect' || result.type === 'location') {
      selectDetail(result.type, result.id)
      return `Opened the ${result.type === 'suspect' ? 'suspect profile' : 'location'} entry for ${result.title}.`
    }
    if (result.type === 'timeline') {
      selectTimelineEvent(result.id)
      return `Jumped to the reported event “${result.title}”.`
    }
    return ''
  }

  useEffect(() => {
    if (!initialSelection) return
    const selectionKey = initialSelection.type + ':' + initialSelection.id
    if (handledInitialSelection.current === selectionKey) {
      onInitialSelectionHandled?.()
      return
    }
    handledInitialSelection.current = selectionKey
    if (initialSelection.type === 'timeline') selectTimelineEvent(initialSelection.id)
    else selectDetail(initialSelection.type, initialSelection.id)
    onInitialSelectionHandled?.()
  }, [initialSelection, onInitialSelectionHandled])

  return (
    <main className="investigation-page" aria-labelledby="investigation-title">
      <header className="investigation-header">
        <div className="investigation-heading">
          <span className="section-kicker">{caseFile.id} · ACTIVE FILE</span>
          <h1 id="investigation-title">{caseFile.title}</h1>
          <p className="investigation-subtitle">{caseFile.location}<span aria-hidden="true"> / </span>Incident reported at {caseFile.incidentTime}</p>
        </div>
        <button className="button button-secondary return-home" onClick={onReturnHome} type="button">
          <span aria-hidden="true">←</span> Return to Home
        </button>
        <button className="button button-primary" onClick={() => document.getElementById('final-accusation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} type="button">
          {progress.completion ? 'Review Completed Case' : 'Make Final Accusation'}
        </button>
        <button className="button button-secondary confusion-trigger" onClick={onOpenFeedback} type="button">Something confusing?</button>
      </header>

      <nav aria-label="Map and relationship tools" className="investigation-map-nav">
        <a href="#crime-scene-map">Crime Scene Map</a>
        <a href="#evidence-relationship-network">Clue Network</a>
      </nav>

      <section aria-label="Case overview" className="case-overview">
        <div className="case-overview-copy">
          <span className="section-kicker">INITIAL BRIEFING</span>
          <h2>Reported incident</h2>
          <p>{caseFile.briefing}</p>
          <p className="investigator-objective"><strong>Initial objective</strong>{caseFile.objective}</p>
        </div>
        <div className="progress-card">
          <div className="progress-card-heading">
            <span className="section-kicker">CASE PROGRESS</span>
            <span className={`status-pill${discoveredCount ? ' is-active' : ''}`}>{currentStatus}</span>
          </div>
          <div className="progress-numbers"><strong>{discoveredCount}<span> / {evidenceTotal}</span></strong><span>clues discovered</span></div>
          <ProgressBar label={`${progressPercent}% of clues collected`} value={progressPercent} />
          <div className="progress-caption"><span>{progressPercent}% collected</span><span>Case {caseFile.id}</span></div>
          <p className="progress-next-step"><strong>Next step</strong>{nextStepHint({ activityLog, caseFile, discoveredEvidenceIds, progress })}</p>
        </div>
      </section>

      <InvestigationJournal
        bookmarks={progress.bookmarks}
        caseFile={caseFile}
        discoveredEvidenceIds={discoveredEvidenceIds}
        entries={progress.journalEntries}
        journalRequest={journalRequest}
        onBookmarksChange={onBookmarksChange}
        onDraftDirtyChange={onJournalDraftDirtyChange}
        onEntriesChange={onJournalEntriesChange}
        onOpenRecord={openRecordFromJournal}
      />

      <GameProgressPanel
        caseFile={caseFile}
        hasUnsavedJournalDraft={hasUnsavedJournalDraft}
        onImportProgress={onImportProgress}
        onResetProgress={onResetProgress}
        onSaveNow={onSaveNow}
        progress={progress}
        saveStatus={saveStatus}
      />

      <IntelligentClueSearch
        clueSearchIndex={clueSearchIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onSelectResult={selectClueSearchResult}
      />

      <section aria-labelledby="suspects-title" className="investigation-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">PERSONS OF INTEREST</span>
            <h2 id="suspects-title">Suspects</h2>
          </div>
          <span className="section-count">{caseFile.suspects.length} profiles</span>
        </div>
        <div className="suspect-grid">
          {caseFile.suspects.map((suspect) => (
            <SuspectCard
              isSelected={selectedDetail?.type === 'suspect' && selectedDetail.id === suspect.id}
              key={suspect.id}
              onSelect={() => selectDetail('suspect', suspect.id)}
              suspect={suspect}
            />
          ))}
        </div>
        {selectedSuspect && (
          <DetailPanel id="suspect-detail-panel" eyebrow={`SUSPECT PROFILE · ${selectedSuspect.id}`} onClose={closeDetail} title={selectedSuspect.name}>
            <div className="profile-detail-grid">
              <div><span className="detail-label">Role / age</span><p>{selectedSuspect.role}, {selectedSuspect.age}</p></div>
              <div><span className="detail-label">Possible motive</span><p>{selectedSuspect.motive}</p></div>
              <div><span className="detail-label">Stated alibi</span><p>{selectedSuspect.alibi}</p></div>
              <div><span className="detail-label">Associated clues</span>
                {selectedSuspect.evidenceIds.length ? (
                  <ul className="detail-reference-list">
                    {selectedSuspect.evidenceIds.map((id) => {
                      const evidence = caseIndex.getEvidenceById(id)
                      const isDiscovered = discoveredEvidenceIds.has(id)
                      return <li key={id}><span>{id}</span>{isDiscovered ? evidence.title : 'Sealed clue'}</li>
                    })}
                  </ul>
                ) : <p>No clues are currently associated with this profile.</p>}
              </div>
            </div>
            <p className="detail-caution">These are reported accounts and possible motives; none establishes guilt.</p>
            <RecordActions
              isBookmarked={isBookmarked('suspects', selectedSuspect.id)}
              onAddNote={() => requestJournalEntry('suspect', selectedSuspect.id)}
              onToggleBookmark={() => toggleBookmark('suspect', selectedSuspect.id)}
              recordLabel="suspect profile"
            />
          </DetailPanel>
        )}
      </section>

      <SuspectAnalysis
        caseFile={caseFile}
        caseIndex={caseIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onSelectEvidence={(evidenceId) => selectDetail('evidence', evidenceId)}
      />

      <CounterfactualLab
        caseFile={caseFile}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onSelectEvidence={(evidenceId) => selectDetail('evidence', evidenceId)}
      />

      <DeductionLab
        caseFile={caseFile}
        caseIndex={caseIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onTheoryEvaluated={() => onActivity?.('deduction-evaluated')}
        onSelectEvidence={(evidenceId) => selectDetail('evidence', evidenceId)}
        onSelectTimelineEvent={selectTimelineEvent}
      />

      <FinalAccusation
        caseFile={caseFile}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onComplete={onCompleteAccusation}
        onResetProgress={onResetProgress}
        onSelectEvidence={(evidenceId) => selectDetail('evidence', evidenceId)}
        progress={progress}
      />

      <section aria-labelledby="evidence-title" className="investigation-section evidence-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">SEALED AND DISCOVERED</span>
            <h2 id="evidence-title">Clue Register</h2>
            <span className="algorithm-tag">Hash table index · O(1) lookup</span>
          </div>
          <span className="section-count">{discoveredCount} of {evidenceTotal} discovered</span>
        </div>
        <p className="section-intro">Sealed clues unlock when you inspect their card here. Every sealed card names the room it was filed in, and the Crime Scene Map shows the rooms you have already uncovered.</p>
        <div className="evidence-controls">
          <label className="control-label">Search discovered clues
            <input aria-label="Search clues" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search titles and descriptions" type="search" value={searchTerm} />
          </label>
          <label className="control-label">Category
            <select aria-label="Filter by category" onChange={(event) => setSelectedCategory(event.target.value)} value={selectedCategory}>
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>
        <div aria-live="polite" className="evidence-results-note">
          {searchTerm.trim() || selectedCategory !== 'all'
            ? `${visibleEvidence.length} matching discovered clue${visibleEvidence.length === 1 ? '' : 's'}; sealed clues remain hidden.`
            : `${visibleEvidence.length} clues in this file, including sealed ones.`}
        </div>
        {visibleEvidence.length ? (
          <div className="evidence-grid">
            {visibleEvidence.map((item) => {
              const isDiscovered = discoveredEvidenceIds.has(item.id)
              return (
                <EvidenceCard
                  evidence={item}
                  isDiscovered={isDiscovered}
                  key={item.id}
                  locationName={caseIndex.getLocationById(item.discoveredAt)?.name}
                  onDiscover={() => onDiscoverEvidence(item.id)}
                  onInspect={() => selectDetail('evidence', item.id)}
                />
              )
            })}
          </div>
        ) : <p className="empty-results">No discovered clues match those filters.</p>}
        {selectedEvidence && discoveredEvidenceIds.has(selectedEvidence.id) && (
          <DetailPanel id="evidence-detail-panel" eyebrow={`CLUE FILE · ${selectedEvidence.id}`} onClose={closeDetail} title={selectedEvidence.title}>
            <div className="evidence-detail-grid">
              <div><span className="detail-label">Category</span><p>{selectedEvidence.category}</p></div>
              <div><span className="detail-label">Reliability</span><p className={`reliability-label is-${selectedEvidence.reliability}`}>{selectedEvidence.reliability}</p></div>
              <div><span className="detail-label">Found at</span><p>{caseIndex.getLocationById(selectedEvidence.discoveredAt)?.name}</p></div>
              <div><span className="detail-label">Recorded time</span><p>{selectedEvidence.timestamp || 'Not recorded'}</p></div>
              <div className="detail-wide"><span className="detail-label">Details</span><p>{selectedEvidence.description}</p></div>
              <div className="detail-wide"><span className="detail-label">Why it may matter</span><p>{selectedEvidence.relevance}</p></div>
              <div className="detail-wide"><span className="detail-label">Related profiles</span>
                {selectedEvidence.relatedSuspectIds.length
                  ? <p>{selectedEvidence.relatedSuspectIds.map((id) => caseIndex.getSuspectById(id)?.name).filter(Boolean).join(', ')}</p>
                  : <p>No suspect is currently linked to this clue.</p>}
              </div>
            </div>
            <p className="detail-caution">A documented association or relevance does not establish responsibility.</p>
            <RecordActions
              isBookmarked={isBookmarked('evidence', selectedEvidence.id)}
              onAddNote={() => requestJournalEntry('evidence', selectedEvidence.id)}
              onToggleBookmark={() => toggleBookmark('evidence', selectedEvidence.id)}
              recordLabel="clue"
            />
          </DetailPanel>
        )}
      </section>

      <section aria-labelledby="locations-title" className="investigation-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">MALHOTRA MANSION</span>
            <h2 id="locations-title">Locations</h2>
          </div>
          <span className="section-count">{caseFile.locations.length} rooms and grounds</span>
        </div>
        <div className="location-grid">
          {caseFile.locations.map((location) => {
            const count = location.evidenceIds.filter((id) => discoveredEvidenceIds.has(id)).length
            return (
              <button
                aria-pressed={selectedDetail?.type === 'location' && selectedDetail.id === location.id}
                className={`location-card${selectedDetail?.type === 'location' && selectedDetail.id === location.id ? ' is-selected' : ''}`}
                key={location.id}
                onClick={() => selectDetail('location', location.id)}
                type="button"
              >
                <span className="location-id">{location.id}</span>
                <strong>{location.name}</strong>
                <span className="location-evidence-count">{count} / {location.evidenceIds.length} clues inspected</span>
              </button>
            )
          })}
        </div>
        {selectedLocation && (
          <DetailPanel id="location-detail-panel" eyebrow={`LOCATION RECORD · ${selectedLocation.id}`} onClose={closeDetail} title={selectedLocation.name}>
            <p className="location-description">{selectedLocation.description}</p>
            <p className="location-record-count">{selectedLocation.evidenceIds.length} clues filed here · {selectedLocation.evidenceIds.filter((id) => discoveredEvidenceIds.has(id)).length} inspected</p>
            <div className="location-detail-columns">
              <div><span className="detail-label">Connected locations</span>
                <p>{selectedLocation.connectedLocationIds.map((id) => caseIndex.getLocationById(id)?.name).filter(Boolean).join(' · ')}</p>
              </div>
              <div><span className="detail-label">Associated clues</span>
                <ul className="detail-reference-list">
                  {selectedLocation.evidenceIds.map((id) => {
                    const evidence = caseIndex.getEvidenceById(id)
                    const isDiscovered = discoveredEvidenceIds.has(id)
                    return <li key={id}><span>{id}</span>{isDiscovered ? evidence.title : 'Locked clue'}</li>
                  })}
                </ul>
              </div>
            </div>
            <RecordActions
              isBookmarked={isBookmarked('locations', selectedLocation.id)}
              onAddNote={() => requestJournalEntry('location', selectedLocation.id)}
              onToggleBookmark={() => toggleBookmark('location', selectedLocation.id)}
              recordLabel="location"
            />
          </DetailPanel>
        )}
      </section>

      <GraphExplorer
        corridorWeights={caseFile.corridorWeights}
        discoveredEvidenceIds={discoveredEvidenceIds}
        locations={caseFile.locations}
        onSelectLocation={(locationId) => selectDetail('location', locationId)}
      />

      <EvidenceRelationshipNetwork
        caseFile={caseFile}
        caseIndex={caseIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onOpenRecord={openNetworkRecord}
        onRequestJournalEntry={requestJournalEntry}
        onSelectTimelineEvent={selectTimelineEvent}
      />

      <HashTableExplorer caseIndex={caseIndex} />

      <TreeExplorer caseFile={caseFile} discoveredEvidenceIds={discoveredEvidenceIds} />

      <BPlusTreeExplorer
        caseFile={caseFile}
        discoveredEvidenceIds={discoveredEvidenceIds}
        evidenceIndex={evidenceIndex}
        onSelectEvidence={(evidenceId) => selectDetail('evidence', evidenceId)}
        selectedEvidenceId={selectedDetail?.type === 'evidence' ? selectedDetail.id : null}
      />

      <TrieExplorer clueSearchIndex={clueSearchIndex} onSelectRecord={selectClueSearchResult} />

      <section aria-labelledby="timeline-title" className="investigation-section timeline-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">REPORTED ACCOUNTS</span>
            <h2 id="timeline-title">Timeline preview</h2>
          </div>
          <span className="section-count">{timeline.length} initial reports</span>
        </div>
        <p className="section-intro">These entries are initial reports, not a proven sequence of events.</p>
        <ol className="timeline-list">
          {timeline.map((event) => (
            <li className={`timeline-event${selectedTimelineEventId === event.id ? ' is-selected' : ''}`} id={`timeline-event-${event.id}`} key={event.id}>
              <time className="timeline-time">{event.timestamp}</time>
              <span aria-hidden="true" className="timeline-marker" />
              <div className="timeline-copy">
                <div className="timeline-title-row"><h3>{event.title}</h3><span className={`event-status${event.confirmed ? ' is-confirmed' : ' is-unverified'}`}>{event.confirmed ? 'Confirmed report' : 'Unverified'}</span></div>
                <p>{event.description}</p>
                <span className="timeline-location">{event.locationId ? caseIndex.getLocationById(event.locationId)?.name : 'Location not specified'}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

export default Investigation
