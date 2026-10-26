function toSet(value) {
  if (value instanceof Set) return new Set(value)
  return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
}

function timestampMinutes(value) {
  if (typeof value !== 'string') return Number.MAX_SAFE_INTEGER
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return Number.MAX_SAFE_INTEGER
  const hour = Number(match[1]) % 12
  return (hour + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2])
}

function countBookmarks(bookmarks = {}) {
  return ['suspects', 'evidence', 'locations'].reduce((count, collection) => (
    count + (Array.isArray(bookmarks[collection]) ? new Set(bookmarks[collection]).size : 0)
  ), 0)
}

/**
 * Derive dashboard metrics from current case records and player state.
 * Evidence records returned here are discovered records only; undiscovered
 * records are reduced to an aggregate count and never copied into UI data.
 */
export function calculateInvestigationMetrics({
  caseFile = {},
  discoveredEvidenceIds = new Set(),
  progress = {},
  activityLog = [],
  deductionChecks = [],
  caseStatus = 'Investigating',
} = {}) {
  const evidence = Array.isArray(caseFile.evidence) ? caseFile.evidence : []
  const suspects = Array.isArray(caseFile.suspects) ? caseFile.suspects : []
  const locations = Array.isArray(caseFile.locations) ? caseFile.locations : []
  const timeline = Array.isArray(caseFile.events) ? caseFile.events : []
  const discoveredIds = toSet(discoveredEvidenceIds)
  const discoveredEvidence = evidence.filter((record) => record && discoveredIds.has(record.id))
  const discoveredCategories = new Map()
  for (const record of discoveredEvidence) {
    const category = typeof record.category === 'string' && record.category.trim() ? record.category : 'Uncategorized'
    discoveredCategories.set(category, (discoveredCategories.get(category) || 0) + 1)
  }

  const allActivity = Array.isArray(activityLog) ? activityLog : []
  let latestResetIndex = -1
  for (let index = 0; index < allActivity.length; index += 1) {
    if (allActivity[index]?.type === 'progress-reset' || allActivity[index]?.type === 'replay-started') latestResetIndex = index
  }
  const validActivity = allActivity.slice(latestResetIndex + 1)
  const reviewedIds = (recordType) => new Set(validActivity
    .filter((event) => event?.recordType === recordType && typeof event.recordId === 'string')
    .map((event) => event.recordId))
  const reviewedSuspects = reviewedIds('suspect')
  const exploredLocations = reviewedIds('location')
  const reviewedTimelineEvents = reviewedIds('timeline')
  const completedChecks = Array.isArray(deductionChecks) ? deductionChecks : []
  const satisfiedCheckCount = completedChecks.filter((check) => check?.result === 'satisfied').length
  const eligibleCheckCount = completedChecks.filter((check) => check && check.applicable !== false).length

  const locationProgress = locations.map((location) => ({
    id: location.id,
    name: location.name,
    explored: exploredLocations.has(location.id),
    discoveredEvidenceCount: discoveredEvidence.filter((record) => record.discoveredAt === location.id).length,
  }))
  const orderedTimeline = [...timeline].sort((left, right) => timestampMinutes(left?.timestamp) - timestampMinutes(right?.timestamp))
  const totalEvidence = evidence.length
  const discoveredCount = discoveredEvidence.length

  return {
    evidence: {
      total: totalEvidence,
      discovered: discoveredCount,
      undiscovered: Math.max(0, totalEvidence - discoveredCount),
      percentage: totalEvidence ? Math.round((discoveredCount / totalEvidence) * 100) : 0,
      discoveredRecords: discoveredEvidence,
      byCategory: [...discoveredCategories.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((left, right) => left.category.localeCompare(right.category)),
    },
    suspects: {
      total: suspects.length,
      investigated: Math.min(suspects.length, reviewedSuspects.size),
      reviewedIds: [...reviewedSuspects],
      records: suspects.map((suspect) => ({
        id: suspect.id,
        discoveredLinkedEvidenceCount: discoveredEvidence.filter((record) => record.relatedSuspectIds?.includes(suspect.id)).length,
      })),
    },
    locations: {
      total: locations.length,
      explored: Math.min(locations.length, exploredLocations.size),
      records: locationProgress,
    },
    timeline: {
      total: timeline.length,
      reviewed: Math.min(timeline.length, reviewedTimelineEvents.size),
      reviewedIds: [...reviewedTimelineEvents],
      events: orderedTimeline,
    },
    journalEntryCount: Array.isArray(progress.journalEntries) ? progress.journalEntries.length : 0,
    bookmarkCount: countBookmarks(progress.bookmarks),
    deductionChecks: { satisfied: satisfiedCheckCount, total: eligibleCheckCount },
    caseStatus,
  }
}

const SECTION_BY_EVENT_TYPE = {
  'evidence-discovered': 'Clue register',
  'evidence-reviewed': 'Clue register',
  'suspect-reviewed': 'Suspects',
  'location-explored': 'Crime Scene Map',
  'timeline-reviewed': 'Timeline',
  'deduction-evaluated': 'Deduction Lab',
  'journal-entry-saved': 'Investigation Journal',
  'journal-entry-updated': 'Investigation Journal',
  'journal-entry-deleted': 'Investigation Journal',
  'bookmark-added': 'Bookmarks',
  'bookmark-removed': 'Bookmarks',
  'accusation-submitted': 'Final Accusation',
  'case-solved': 'Final Accusation',
  'confusion-reported': 'Confusion feedback',
}

/**
 * Summarize the current browser session from its activity log: which sections
 * were used, the order clues were discovered in, how far the accusation got,
 * and any confusion a player reported. This is a developer and teaching aid;
 * nothing here is persisted, and nothing leaves the browser.
 */
export function summarizeSessionActivity({ activityLog = [], caseFile = {}, discoveredEvidenceIds = new Set() } = {}) {
  const events = Array.isArray(activityLog) ? activityLog : []
  let latestResetIndex = -1
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]?.type === 'progress-reset' || events[index]?.type === 'replay-started') latestResetIndex = index
  }
  const sessionEvents = events.slice(latestResetIndex + 1)
  const discoveredIds = toSet(discoveredEvidenceIds)
  const evidence = Array.isArray(caseFile.evidence) ? caseFile.evidence : []
  const titleById = new Map(evidence.map((record) => [record?.id, record?.title]))
  const sectionCounts = new Map()
  const discoveredOverTime = []
  const confusionReports = []
  let accusationAttempts = 0
  let solvedCount = 0

  for (const event of sessionEvents) {
    const section = SECTION_BY_EVENT_TYPE[event?.type]
    if (section) sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1)
    if (event?.type === 'evidence-discovered' && typeof event.recordId === 'string') {
      discoveredOverTime.push({
        recordId: event.recordId,
        label: event.label || titleById.get(event.recordId) || event.recordId,
        occurredAt: event.occurredAt,
        stillDiscovered: discoveredIds.has(event.recordId),
      })
    }
    if (event?.type === 'accusation-submitted') accusationAttempts += 1
    if (event?.type === 'case-solved') {
      accusationAttempts += 1
      solvedCount += 1
    }
    if (event?.type === 'confusion-reported') confusionReports.push({ occurredAt: event.occurredAt, note: event.label || '' })
  }

  return {
    eventCount: sessionEvents.length,
    sectionsVisited: [...sectionCounts.entries()]
      .map(([section, visits]) => ({ section, visits }))
      .sort((left, right) => right.visits - left.visits || left.section.localeCompare(right.section)),
    discoveredOverTime,
    accusationAttempts,
    caseSolved: solvedCount > 0,
    confusionReports,
    firstActivityAt: sessionEvents[0]?.occurredAt ?? null,
    lastActivityAt: sessionEvents[sessionEvents.length - 1]?.occurredAt ?? null,
  }
}

export default calculateInvestigationMetrics
