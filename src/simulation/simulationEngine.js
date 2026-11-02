import { Graph, createGraphFromLocations } from '../dsa/Graph.js'
import { dijkstra } from '../dsa/dijkstra.js'
import { case001 } from '../data/case001.js'

const SIMULATION_START_TIME = '9:00 PM'
const SIMULATION_END_TIME = '10:24 PM'
const SIMULATION_START_LOCATION_ID = 'L002'
const SIMULATION_VERSION = 1
const ALLOWED_TIMESTAMPS = new Set([
  '9:00 PM', '9:05 PM', '9:22 PM', '9:30 PM', '9:35 PM', '9:40 PM',
  '9:41 PM', '9:43 PM', '9:44 PM', '9:48 PM', '9:50 PM', '9:51 PM',
  '9:55 PM', '9:57 PM', '10:00 PM', '10:08 PM', '10:24 PM',
])

function validateTimestamp(value) {
  if (!ALLOWED_TIMESTAMPS.has(value)) {
    throw new TypeError(
      `A simulation timestamp must be a valid timestamp. Received: ${value}`
    )
  }
  return value
}

const TIME_ORDER = [...ALLOWED_TIMESTAMPS]
function parseTimestampKey(ts) {
  if (typeof ts !== 'string') return null
  const hourMinute = ts.trim()
  if (!/^\d{1,2}:\d{2} (AM|PM)$/i.test(hourMinute)) return null
  const match = hourMinute.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/i)
  if (!match) return null
  const hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  let normalizedHour = hour % 12
  if (period === 'PM') normalizedHour += 12
  if (normalizedHour === 0) normalizedHour = 12
  return `${normalizedHour}:${String(minute).padStart(2, '0')}`
}

function compareTimeValues(first, second) {
  const a = parseTimestampKey(first)
  const b = parseTimestampKey(second)
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  if (!a || !b) return first < second ? -1 : first > second ? 1 : 0
  return a < b ? -1 : a > b ? 1 : 0
}

function validateLocationId(caseFile, locationId) {
  if (!caseFile.locations.some((l) => l.id === locationId)) {
    throw new RangeError(
      `Location ID "${locationId}" is not in the case file.`
    )
  }
  return locationId
}

function validateEvidenceId(caseFile, evidenceId, context) {
  if (!caseFile.evidence.some((e) => e.id === evidenceId)) {
    throw new RangeError(
      `Evidence ID "${evidenceId}" is not in the case file${context ? ` (${context})` : ''}.`
    )
  }
}

/** Start a deterministic, read-only simulation of CASE-001. */
export function createInitialSimulationState(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'caseFile')
    && (!options.caseFile || typeof options.caseFile !== 'object')) {
    throw new TypeError('A case file object is required for the simulation.')
  }
  const caseFile = options.caseFile || case001
  if (!Array.isArray(caseFile.evidence) || caseFile.evidence.length === 0) {
    throw new TypeError('The case file must define at least one evidence record.')
  }
  if (!Array.isArray(caseFile.locations) || caseFile.locations.length === 0) {
    throw new TypeError('The case file must define at least one location.')
  }
  if (!Array.isArray(caseFile.events)) {
    throw new TypeError('The case file must define a timeline events array.')
  }

  const startTime = (options.startTime || SIMULATION_START_TIME)
  validateTimestamp(startTime)
  const startLocationId = (options.startLocationId || SIMULATION_START_LOCATION_ID)
  validateLocationId(caseFile, startLocationId)

  if (compareTimeValues(caseFile.incidentTime, startTime) < 0
    && startTime !== SIMULATION_START_TIME) {
    throw new RangeError(
      `The start time "${startTime}" is after the reported incident time "${caseFile.incidentTime}".`
    )
  }

  const graph = createGraphFromLocations(caseFile.locations, caseFile.corridorWeights)

  const scheduledEvents = [...caseFile.events].map(
    (event) => ({
      id: event.id,
      timestamp: event.timestamp,
      title: event.title,
      description: event.description,
      relatedSuspectIds: [...event.relatedSuspectIds],
      locationId: event.locationId,
      confirmed: !!event.confirmed,
      observed: false,
      kind: event.confirmed ? 'confirmed' : 'reported',
    })
  )
  scheduledEvents.sort(
    (a, b) => compareTimeValues(a.timestamp, b.timestamp) || a.id.localeCompare(b.id)
  )

  const initialActivity = {
    type: 'simulation-started',
    occurredAt: startTime,
    detail: `Simulation started at ${startTime} in location ${startLocationId}.`,
  }

  return Object.freeze({
    version: SIMULATION_VERSION,
    caseFile,
    graph,
    routeGraph: graph,
    currentTime: startTime,
    startTime,
    currentLocationId: startLocationId,
    discoveredEvidenceIds: [],
    scheduledEvents,
    activityLog: [initialActivity],
    visitedLocationIds: [startLocationId],
    lastMove: null,
    routeCost: 0,
    status: 'running',
    hasMoved: false,
    snapshotRequestCount: 0,
    seed: 'CASE-001-deterministic',
  })
}

/** Advance the simulation clock to a later allowed timestamp. */
export function advanceTime(state, targetTime) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }
  try {
    validateTimestamp(targetTime)
  } catch (error) {
    if (parseTimestampKey(targetTime)
      && compareTimeValues(targetTime, SIMULATION_END_TIME) > 0) {
      return {
        ok: false,
        error: `The simulation window ends at ${SIMULATION_END_TIME}.`,
      }
    }
    return {
      ok: false,
      error: error.message,
    }
  }

  if (compareTimeValues(targetTime, state.currentTime) <= 0) {
    return {
      ok: false,
      error: `The clock can only move forward. Current time is ${state.currentTime}.`,
    }
  }
  if (compareTimeValues(targetTime, SIMULATION_END_TIME) > 0) {
    return {
      ok: false,
      error: `The simulation window ends at ${SIMULATION_END_TIME}.`,
    }
  }

  const newlyObserved = []
  const updatedEvents = state.scheduledEvents.map((event) => {
    if (event.observed) return event
    if (compareTimeValues(event.timestamp, targetTime) <= 0) {
      newlyObserved.push(event)
      return { ...event, observed: true }
    }
    return event
  })

  return {
    ok: true,
    state: Object.freeze({
      ...state,
      currentTime: targetTime,
      scheduledEvents: updatedEvents,
      activityLog: [
        ...state.activityLog,
        {
          type: 'time-advanced',
          occurredAt: targetTime,
          detail: `Clock advanced to ${targetTime}.`,
        },
      ],
    }),
  }
}

/** Move the player to another location using the real Dijkstra cost. */
export function movePlayer(state, toLocationId) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }
  validateLocationId(state.caseFile, toLocationId)

  if (toLocationId === state.currentLocationId) {
    return {
      ok: false,
      error: `Already in that location (${toLocationId}).`,
    }
  }

  if (!state.routeGraph) {
    return {
      ok: false,
      error: 'Route graph is not initialized.',
    }
  }

  const run = dijkstra(state.routeGraph, state.currentLocationId, toLocationId)
  if (!run.found) {
    return {
      ok: false,
      error: `No route connects ${state.currentLocationId} to ${toLocationId}.`,
    }
  }

  const newRouteCost = state.routeCost + run.totalCost

  return {
    ok: true,
    move: {
      fromLocationId: state.currentLocationId,
      toLocationId,
      cost: run.totalCost,
      path: run.path,
      graphVisitedOrder: run.visitedOrder,
    },
    state: Object.freeze({
      ...state,
      hasMoved: true,
      currentLocationId: toLocationId,
      routeCost: newRouteCost,
      lastMove: {
        fromLocationId: state.currentLocationId,
        toLocationId,
        cost: run.totalCost,
        path: run.path,
        computedWithCorridorWeights: true,
      },
      visitedLocationIds: [...state.visitedLocationIds, toLocationId],
      activityLog: [
        ...state.activityLog,
        {
          type: 'location-explored',
          occurredAt: state.currentTime,
          detail: `Moved from ${state.currentLocationId} to ${toLocationId}.`,
        },
      ],
    }),
  }
}

/** Inspect the current location and discover any unfound evidence filed there. */
export function inspectLocation(state) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }

  if (!state.hasMoved) {
    return {
      ok: false,
      error: `Location ${state.currentLocationId} is not in the case file for inspection until you move there.`,
    }
  }

  const currentLocation = state.caseFile.locations.find(
    (l) => l.id === state.currentLocationId
  )
  if (!currentLocation) {
    return {
      ok: false,
      error: `Location ${state.currentLocationId} is not in the case file.`,
    }
  }

  const newlyDiscovered = currentLocation.evidenceIds
    .filter((id) => !state.discoveredEvidenceIds.includes(id))
    .map((id) => {
      validateEvidenceId(state.caseFile, id, `location ${currentLocation.id}`)
      const record = state.caseFile.evidence.find((e) => e.id === id)
      if (!record) {
        throw new RangeError(`Evidence ${id} is not in the case file.`)
      }
      return {
        id,
        title: record.title,
        category: record.category,
        description: record.description,
        timestamp: record.timestamp,
        reliability: record.reliability,
        relevance: record.relevance,
        relatedSuspectIds: [...record.relatedSuspectIds],
        confirmed: false,
        source: 'inspection',
        locationId: currentLocation.id,
        locationName: currentLocation.name,
      }
    })

  if (newlyDiscovered.length === 0) {
    return {
      ok: true,
      discovered: [],
      state: Object.freeze({
        ...state,
        activityLog: [
          ...state.activityLog,
          {
            type: 'location-inspected',
            occurredAt: state.currentTime,
            detail: `Inspected ${currentLocation.name}. No new evidence.`,
          },
        ],
      }),
    }
  }

  const discoveredIds = [...state.discoveredEvidenceIds, ...newlyDiscovered.map((d) => d.id)]

  return {
    ok: true,
    discovered: newlyDiscovered.map((d) => d.id),
    state: Object.freeze({
      ...state,
      discoveredEvidenceIds: discoveredIds,
      activityLog: [
        ...state.activityLog,
        ...newlyDiscovered.map((record) => ({
          type: 'evidence-discovered',
          occurredAt: state.currentTime,
          id: record.id,
          label: `${record.id} ${record.title}`,
          detail: `Discovered ${record.title} while inspecting ${currentLocation.name}.`,
        })),
      ],
    }),
  }
}

/** Return timeline events visible at or before the current clock time. */
export function readVisibleEvents(state) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }

  const visibleEvents = state.scheduledEvents
    .filter((event) => compareTimeValues(event.timestamp, state.currentTime) <= 0)
    .map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      title: event.title,
      description: event.description,
      relatedSuspectIds: [...event.relatedSuspectIds],
      locationId: event.locationId,
      confirmed: !!event.confirmed,
      kind: event.kind,
    }))
    .sort(
      (a, b) =>
        compareTimeValues(a.timestamp, b.timestamp) ||
        a.id.localeCompare(b.id)
    )

  return {
    ok: true,
    visibleEvents,
    state: Object.freeze({
      ...state,
      scheduledEvents: state.scheduledEvents.map((event) =>
        compareTimeValues(event.timestamp, state.currentTime) <= 0
          ? { ...event, observed: true }
          : event
      ),
      activityLog: [
        ...state.activityLog,
        {
          type: 'events-read',
          occurredAt: state.currentTime,
          detail: `Read ${visibleEvents.length} visible timeline events.`,
        },
      ],
    }),
  }
}

/** Produce a serializable snapshot of the current simulation progress. */
export function takeSnapshot(state, previousRequestCount = 0) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }

  const requestCount = Math.max(
    previousRequestCount,
    state.snapshotRequestCount || 0
  ) + 1

  return {
    ok: true,
    snapshot: Object.freeze({
      version: state.version,
      currentLocationId: state.currentLocationId,
      discoveredEvidenceIds: [...state.discoveredEvidenceIds],
      visitedLocationIds: [...state.visitedLocationIds],
      routeCost: state.routeCost,
      status: state.status,
      currentTime: state.currentTime,
      lastMove: state.lastMove
        ? {
            fromLocationId: state.lastMove.fromLocationId,
            toLocationId: state.lastMove.toLocationId,
            cost: state.lastMove.cost,
            path: [...state.lastMove.path],
          }
        : null,
      snapshotRequestCount: requestCount,
      activityLogLength: state.activityLog.length,
    }),
    state: Object.freeze({
      ...state,
      snapshotRequestCount: requestCount,
    }),
  }
}

/** End the simulation run. */
export function endSimulation(state) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A simulation state is required.')
  }

  return {
    ok: true,
    state: Object.freeze({
      ...state,
      status: 'ended',
      activityLog: [
        ...state.activityLog,
        {
          type: 'simulation-ended',
          occurredAt: state.currentTime,
          detail: `Simulation ended at ${state.currentTime}.`,
        },
      ],
    }),
  }
}

/** Replay a deterministic sequence of actions. */
export function replayState(initialState, actions) {
  if (!Array.isArray(actions)) {
    throw new TypeError('An actions array is required.')
  }

  let state = initialState
  const history = []

  for (const action of actions) {
    if (typeof action !== 'object' || action === null || !action.type) {
      return {
        ok: false,
        error: `Unknown action type.`,
        history,
      }
    }

    let result

    switch (action.type) {
      case 'end':
        result = endSimulation(state)
        break
      case 'move': {
        if (typeof action.locationId !== 'string') {
          return { ok: false, error: `Unknown action type.`, history }
        }
        result = movePlayer(state, action.locationId)
        break
      }
      case 'inspect':
        result = inspectLocation(state)
        break
      case 'advance': {
        if (typeof action.time !== 'string') {
          return { ok: false, error: `Unknown action type.`, history }
        }
        result = advanceTime(state, action.time)
        break
      }
      case 'read':
        result = readVisibleEvents(state)
        break
      case 'snapshot':
        result = takeSnapshot(state, history.filter((h) => h.type === 'snapshot').length)
        break
      default:
        return { ok: false, error: `Unknown action type.`, history }
    }

    if (!result.ok) {
      return { ok: false, error: result.error, history }
    }

    history.push({
      type: action.type,
      stateBefore: state,
      snapshot: action.type === 'snapshot' ? result.snapshot : undefined,
      stateAfter: result.state,
    })

    state = result.state
  }

  return { ok: true, state, history }
}

export default {
  createInitialSimulationState,
  advanceTime,
  movePlayer,
  inspectLocation,
  readVisibleEvents,
  takeSnapshot,
  endSimulation,
  replayState,
}
