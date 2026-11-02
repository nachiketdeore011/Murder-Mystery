import { describe, expect, it } from 'vitest'
import {
  createInitialSimulationState,
  advanceTime,
  movePlayer,
  inspectLocation,
  readVisibleEvents,
  takeSnapshot,
  endSimulation,
  replayState,
} from './simulationEngine.js'
import { case001 } from '../data/case001.js'
import { createGraphFromLocations } from '../dsa/Graph.js'
import { dijkstra } from '../dsa/dijkstra.js'

describe('simulation engine initial state', () => {
  const state = createInitialSimulationState()

  it('starts at the case start time and in the Main Hall', () => {
    expect(state.currentTime).toBe('9:00 PM')
    expect(state.currentLocationId).toBe('L002')
  })

  it('has no discovered clues yet', () => {
    expect(state.discoveredEvidenceIds).toEqual([])
  })

  it('loads the case timeline as scheduled events', () => {
    expect(state.scheduledEvents).toHaveLength(case001.events.length)
    expect(state.scheduledEvents[0].id).toBe(case001.events[0].id)
    expect(state.scheduledEvents[0].observed).toBe(false)
  })

  it('records the simulation start as its first activity', () => {
    expect(state.activityLog).toHaveLength(1)
    expect(state.activityLog[0].type).toBe('simulation-started')
  })

  it('starts with a running status', () => {
    expect(state.status).toBe('running')
  })

  it('accepts a custom start time within the allowed window', () => {
    const custom = createInitialSimulationState({ startTime: '9:35 PM' })
    expect(custom.currentTime).toBe('9:35 PM')
    expect(custom.startTime).toBe('9:35 PM')
  })

  it('rejects an invalid start time', () => {
    expect(() => createInitialSimulationState({ startTime: '12:61 AM' })).toThrow('valid timestamp')
    expect(() => createInitialSimulationState({ startTime: 'midnight' })).toThrow('valid timestamp')
  })

  it('rejects a start location that is not in the case file', () => {
    expect(() => createInitialSimulationState({ startLocationId: 'L999' })).toThrow('not in the case file')
  })

  it('rejects an invalid case file', () => {
    expect(() => createInitialSimulationState({ caseFile: null })).toThrow('case file object')
    expect(() => createInitialSimulationState({ caseFile: { locations: [] } })).toThrow('evidence array')
  })
})

describe('simulation engine time advance', () => {
  const state = createInitialSimulationState()

  it('keeps the initial time within the allowed window using the exact same string', () => {
    expect(state.currentTime).toBe('9:00 PM')
  })

  it('accepts the case file’s incident time as the next tick if it is in the allowed set', () => {
    const tick = advanceTime(state, '10:00 PM')
    expect(tick.ok).toBe(true)
    expect(tick.state.currentTime).toBe('10:00 PM')
  })

  it('advances the clock to 10:24 PM in order', () => {
    let current = state
    for (const tick of ['9:05 PM', '9:30 PM', '9:48 PM', '10:00 PM', '10:24 PM']) {
      const result = advanceTime(current, tick)
      expect(result.ok).toBe(true)
      current = result.state
      expect(current.currentTime).toBe(tick)
    }
    expect(current.currentTime).toBe('10:24 PM')
  })

  it('only moves the clock forward', () => {
    const result = advanceTime(state, '9:00 PM')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('only move forward')
  })

  it('rejects a time before the simulation start', () => {
    const custom = createInitialSimulationState({ startTime: '9:30 PM' })
    const result = advanceTime(custom, '9:00 PM')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('only move forward')
  })

  it('rejects a time after the end window', () => {
    const result = advanceTime(state, '10:25 PM')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('10:24 PM')
  })

  it('rejects an invalid timestamp format', () => {
    const result = advanceTime(state, 'ten o\'clock')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('valid timestamp')
  })

  it('records each advance as an activity', () => {
    const result = advanceTime(state, '9:05 PM')
    expect(result.state.activityLog).toHaveLength(2)
    expect(result.state.activityLog[1].type).toBe('time-advanced')
    expect(result.state.activityLog[1].occurredAt).toBe('9:05 PM')
  })

  it('observes scheduled events whose time has arrived', () => {
    const before = state.scheduledEvents.find((event) => event.id === 'T001')
    expect(before.observed).toBe(false)

    const result = advanceTime(state, '9:05 PM')
    const after = result.state.scheduledEvents.find((event) => event.id === 'T001')
    expect(after.observed).toBe(true)
  })

  it('keeps future events unobserved', () => {
    const result = advanceTime(state, '9:05 PM')
    const lunch = result.state.scheduledEvents.find((event) => event.id === 'T008')
    expect(lunch.observed).toBe(false)
  })
})

describe('simulation engine movement', () => {
  const state = createInitialSimulationState()

  it('moves from the Main Hall to the Study', () => {
    const result = movePlayer(state, 'L001')
    expect(result.ok).toBe(true)
    expect(result.state.currentLocationId).toBe('L001')
    expect(result.state.lastMove).toMatchObject({
      fromLocationId: 'L002',
      toLocationId: 'L001',
    })
  })

  it('computes a real Dijkstra cost for the move', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)
    const result = movePlayer(state, 'L005')
    expect(result.ok).toBe(true)
    // The engine uses the pre-built graph, so compare the live state's cost.
    const direct = dijkstra(graph, 'L002', 'L005')
    expect(result.state.lastMove.cost).toBe(direct.totalCost)
    // Also confirm the engine's internal graph agrees.
    const engineDirect = dijkstra(state.graph, 'L002', 'L005')
    expect(result.move.cost).toBe(engineDirect.totalCost)
    expect(result.move.path).toEqual(engineDirect.path)
  })

  it('rejects staying in place', () => {
    const result = movePlayer(state, 'L002')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('already in that location')
  })

  it('rejects an unknown location ID', () => {
    const result = movePlayer(state, 'L999')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not in the case file')
  })

  it('rejects a move with no graph initialized', () => {
    const bare = createInitialSimulationState()
    bare.routeGraph = null
    const result = movePlayer(bare, 'L001')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not initialized')
  })

  it('records each move as an activity', () => {
    const result = movePlayer(state, 'L001')
    expect(result.state.activityLog[1].type).toBe('location-explored')
    expect(result.state.visitedLocationIds).toEqual(['L002', 'L001'])
  })

  it('updates the route cost with the real Dijkstra distance', () => {
    const move = movePlayer(state, 'L001')
    expect(move.state.routeCost).toBeGreaterThan(0)
    const liveDijkstra = dijkstra(state.graph, 'L002', 'L001')
    expect(move.state.routeCost).toBe(liveDijkstra.totalCost)
  })
})

describe('simulation engine clue discovery', () => {
  const state = createInitialSimulationState()

  it('discovers the Study clues when inspecting the Study', () => {
    const move = movePlayer(state, 'L001')
    const inspect = inspectLocation(move.state)
    expect(inspect.ok).toBe(true)
    expect(inspect.discovered).toContain('E001')
    expect(inspect.discovered).toContain('E002')
    expect(inspect.state.discoveredEvidenceIds).toContain('E001')
    expect(inspect.state.discoveredEvidenceIds).toContain('E002')
  })

  it('does not inspect a location before moving there', () => {
    const inspect = inspectLocation(state)
    expect(inspect.ok).toBe(false)
    expect(inspect.error).toContain('not in the case file')
  })

  it('records each discovery as an activity', () => {
    const move = movePlayer(state, 'L001')
    const inspect = inspectLocation(move.state)
    const discovery = inspect.state.activityLog.find((event) => event.type === 'evidence-discovered')
    expect(discovery).toBeTruthy()
    expect(discovery.label).toContain('E001')
  })

  it('never discovers a clue twice', () => {
    const move = movePlayer(state, 'L001')
    const first = inspectLocation(move.state)
    const second = inspectLocation(first.state)
    expect(second.discovered).toEqual([])
    expect(second.state.discoveredEvidenceIds).toEqual(first.state.discoveredEvidenceIds)
  })

  it('keeps sealed clues sealed in other rooms', () => {
    const move = movePlayer(state, 'L001')
    inspectLocation(move.state)
    const kitchen = movePlayer(move.state, 'L003')
    expect(kitchen.state.discoveredEvidenceIds).not.toContain('E005')
  })

  it('inspects a room with no new clues gracefully', () => {
    const move = movePlayer(state, 'L001')
    inspectLocation(move.state)
    const already = inspectLocation(move.state)
    expect(already.ok).toBe(true)
    expect(already.discovered).toEqual([])
  })

  it('returns the current discovered set after each inspection', () => {
    const move = movePlayer(state, 'L001')
    const inspected = inspectLocation(move.state)
    expect(inspected.state.discoveredEvidenceIds).toEqual(['E001', 'E002'])
  })
})

describe('simulation engine timeline observation', () => {
  const state = createInitialSimulationState()

  it('shows events at or before the current time', () => {
    const result = readVisibleEvents(state)
    expect(result.ok).toBe(true)
    expect(result.visibleEvents.some((event) => event.id === 'T001')).toBe(true)
    expect(result.visibleEvents.some((event) => event.id === 'T006')).toBe(false)
  })

  it('marks newly visible events as observed', () => {
    const result = readVisibleEvents(state)
    const dinner = result.state.scheduledEvents.find((event) => event.id === 'T001')
    expect(dinner.observed).toBe(true)
  })

  it('remains available after the clock advances', () => {
    const advanced = advanceTime(state, '9:48 PM').state
    const read = readVisibleEvents(advanced)
    expect(read.ok).toBe(true)
    expect(read.visibleEvents.some((event) => event.id === 'T005')).toBe(true)
  })

  it('does not throw when no new events are visible', () => {
    const advanced = advanceTime(state, '9:48 PM').state
    readVisibleEvents(advanced)
    const noNew = readVisibleEvents(advanced)
    expect(noNew.ok).toBe(true)
    expect(noNew.visibleEvents.length).toBeGreaterThanOrEqual(1)
  })
})

describe('simulation engine snapshot', () => {
  const state = createInitialSimulationState()

  it('returns a frozen snapshot of the current progress', () => {
    const result = takeSnapshot(state)
    expect(result.ok).toBe(true)
    expect(result.snapshot.currentLocationId).toBe('L002')
    expect(result.snapshot.discoveredEvidenceIds).toEqual([])
    expect(result.snapshot.status).toBe('running')
  })

  it('records incremental snapshot requests', () => {
    const first = takeSnapshot(state)
    const second = takeSnapshot(first.state)
    expect(first.snapshot.snapshotRequestCount).toBe(1)
    expect(second.snapshot.snapshotRequestCount).toBe(2)
  })

  it('does not mutate the live state', () => {
    const before = takeSnapshot(state)
    const after = takeSnapshot(before.state)
    expect(after.state.routeCost).toBe(before.state.routeCost)
    expect(after.state.discoveredEvidenceIds).toEqual(before.state.discoveredEvidenceIds)
  })
})

describe('simulation engine end and replay', () => {
  const state = createInitialSimulationState()

  it('ends the simulation', () => {
    const result = endSimulation(state)
    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('ended')
  })

  it('replays a deterministic action sequence', () => {
    const initial = createInitialSimulationState({ startTime: '9:00 PM', startLocationId: 'L002' })
    const actions = [
      { type: 'move', locationId: 'L001' },
      { type: 'inspect' },
      { type: 'advance', time: '9:05 PM' },
      { type: 'read' },
      { type: 'snapshot' },
      { type: 'end' },
    ]
    const result = replayState(initial, actions)
    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('ended')
    expect(result.state.discoveredEvidenceIds).toContain('E001')
    expect(result.history).toHaveLength(actions.length)
    expect(result.history[0].type).toBe('move')
    expect(result.history[4].type).toBe('snapshot')
    expect(result.history[4].snapshot).toBeTruthy()
  })

  it('rejects an unknown action type', () => {
    const bad = replayState(state, [{ type: 'teleport' }])
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('Unknown action type')
  })

  it('stops replay on the first failing action', () => {
    const actions = [
      { type: 'move', locationId: 'L999' },
      { type: 'inspect' },
    ]
    const result = replayState(state, actions)
    expect(result.ok).toBe(false)
    expect(result.history).toEqual([])
  })
})

describe('simulation engine immutability', () => {
  it('never mutates case001', () => {
    const before = JSON.stringify(case001)
    const initial = createInitialSimulationState()
    const moved = movePlayer(initial, 'L001').state
    const inspected = inspectLocation(moved).state
    const advanced = advanceTime(inspected, '10:24 PM').state
    const ended = endSimulation(advanced).state
    const replayed = replayState(initial, [
      { type: 'move', locationId: 'L001' },
      { type: 'inspect' },
      { type: 'end' },
    ]).state

    expect(JSON.stringify(case001)).toBe(before)
    expect(case001.evidence.every((record) => record.discovered === false)).toBe(true)
  })

  it('does not run the clock past the reported incident time without an explicit advance', () => {
    // The clock begins at 9:00 PM and stays there until the player advances it.
    expect(createInitialSimulationState().currentTime).toBe('9:00 PM')
  })

  it('returns frozen state from every operation', () => {
    const initial = createInitialSimulationState()
    const moved = movePlayer(initial, 'L001').state
    const inspected = inspectLocation(moved).state
    const advanced = advanceTime(inspected, '9:05 PM').state
    const observed = readVisibleEvents(advanced).state
    const snapshot = takeSnapshot(observed).state
    const ended = endSimulation(snapshot).state

    expect(Object.isFrozen(moved)).toBe(true)
    expect(Object.isFrozen(inspected)).toBe(true)
    expect(Object.isFrozen(advanced)).toBe(true)
    expect(Object.isFrozen(observed)).toBe(true)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(ended)).toBe(true)
  })

  it('never returns a live reference into the state', () => {
    const initial = createInitialSimulationState()
    const moved = movePlayer(initial, 'L001').state
    const inspected = inspectLocation(moved)
    const discoveredFromResult = inspected.discovered
    discoveredFromResult.push('E999')
    expect(inspected.state.discoveredEvidenceIds).not.toContain('E999')
  })
})
