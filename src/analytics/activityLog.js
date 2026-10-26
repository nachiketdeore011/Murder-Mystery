export const SESSION_ACTIVITY_LIMIT = 100

const ALLOWED_ACTIVITY_TYPES = new Set([
  'evidence-discovered',
  'evidence-reviewed',
  'suspect-reviewed',
  'location-explored',
  'timeline-reviewed',
  'deduction-evaluated',
  'journal-entry-saved',
  'journal-entry-updated',
  'journal-entry-deleted',
  'bookmark-added',
  'bookmark-removed',
  'accusation-submitted',
  'case-solved',
  'confusion-reported',
  'progress-reset',
  'replay-started',
])

/** Append one real session event while keeping a bounded, immutable history. */
export function appendSessionActivity(currentEvents, event, limit = SESSION_ACTIVITY_LIMIT) {
  if (!event || typeof event.id !== 'string' || !event.id
    || !ALLOWED_ACTIVITY_TYPES.has(event.type)
    || typeof event.occurredAt !== 'string' || Number.isNaN(Date.parse(event.occurredAt))) {
    throw new TypeError('A session activity event needs a stable ID, supported type, and valid timestamp.')
  }
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('The activity limit must be a positive integer.')
  const events = Array.isArray(currentEvents) ? currentEvents : []
  const nextEvents = [...events, { ...event }]
  let latestRunBoundary = -1
  for (let index = 0; index < nextEvents.length; index += 1) {
    if (nextEvents[index]?.type === 'progress-reset' || nextEvents[index]?.type === 'replay-started') latestRunBoundary = index
  }
  if (latestRunBoundary < 0) return nextEvents.slice(-limit)

  const currentRun = nextEvents.slice(latestRunBoundary)
  if (currentRun.length >= limit) return limit === 1
    ? currentRun.slice(-1)
    : [currentRun[0], ...currentRun.slice(-(limit - 1))]
  const previousRunCapacity = limit - currentRun.length
  return [...nextEvents.slice(0, latestRunBoundary).slice(-previousRunCapacity), ...currentRun]
}

export function getActivityDescription(event) {
  if (event?.type === 'evidence-discovered') return 'Evidence discovered: ' + (event.label || 'record')
  if (event?.type === 'evidence-reviewed') return 'Discovered evidence reviewed: ' + (event.label || 'record')
  if (event?.type === 'suspect-reviewed') return 'Suspect profile reviewed: ' + (event.label || 'profile')
  if (event?.type === 'location-explored') return 'Location explored: ' + (event.label || 'location')
  if (event?.type === 'timeline-reviewed') return 'Timeline report reviewed: ' + (event.label || 'event')
  if (event?.type === 'deduction-evaluated') return 'A suspect theory was evaluated'
  if (event?.type === 'journal-entry-saved') return 'A journal observation was saved'
  if (event?.type === 'journal-entry-updated') return 'A journal observation was updated'
  if (event?.type === 'journal-entry-deleted') return 'A journal observation was deleted'
  if (event?.type === 'bookmark-added') return 'Record bookmarked: ' + (event.label || 'record')
  if (event?.type === 'bookmark-removed') return 'Bookmark removed: ' + (event.label || 'record')
  if (event?.type === 'case-solved') return 'The case was solved after a confirmed accusation'
  if (event?.type === 'accusation-submitted') return 'A final accusation was submitted'
  if (event?.type === 'confusion-reported') return 'Player reported confusion: ' + (event.label || 'no detail given')
  if (event?.type === 'replay-started') return 'A new investigation replay was started'
  if (event?.type === 'progress-reset') return 'Investigation progress was reset'
  return 'Investigation activity recorded'
}
