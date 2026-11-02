import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { case001 } from '../data/case001.js'
import { caseSolution } from '../data/caseSolution.js'
import { createGraphFromLocations } from '../dsa/Graph.js'
import { dijkstra } from '../dsa/dijkstra.js'
import {
  buildCaseSimulation,
  describeRouteChoice,
  evaluateSimulationAccusation,
} from './caseSimulation.js'

const sourceRoot = fileURLToPath(new URL('..', import.meta.url))

function readPageAndComponentSources() {
  const sources = []
  for (const directory of ['components', 'pages']) {
    const absolute = join(sourceRoot, directory)
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.jsx')) {
        sources.push({ path: `${directory}/${entry.name}`, source: readFileSync(join(absolute, entry.name), 'utf8') })
      }
    }
  }
  return sources
}

const playerFacingSources = readPageAndComponentSources()

function stepById(simulation, id) {
  const step = simulation.steps.find((entry) => entry.id === id)
  expect(step, `the simulation has no step "${id}"`).toBeTruthy()
  return step
}

describe('case simulation walkthrough', () => {
  const simulation = buildCaseSimulation()

  it('walks the case from the incident report to the resolution', () => {
    expect(simulation.steps.length).toBeGreaterThanOrEqual(10)
    expect(simulation.steps[0].id).toBe('briefing')
    expect(simulation.steps.at(-1).id).toBe('epilogue')
    expect(simulation.totals.discoveredCount).toBe(simulation.steps.at(-1).discoveredIds.length)
  })

  it('names only sections and element ids that exist on the investigation page', () => {
    const sources = playerFacingSources.map((entry) => entry.source).join('\n')

    for (const step of simulation.steps) {
      expect(sources, `"${step.section}" is not a section of the game`).toContain(step.section)
      expect(sources, `no element carries id="${step.targetId}"`).toContain(`id="${step.targetId}"`)
    }
  })

  it('never discovers a clue twice and never loses one', () => {
    let previous = 0
    for (const step of simulation.steps) {
      const discovered = step.discoveredIds
      expect(new Set(discovered).size).toBe(discovered.length)
      expect(discovered.length).toBeGreaterThanOrEqual(previous)
      previous = discovered.length
      for (const id of discovered) expect(case001.evidence.some((record) => record.id === id)).toBe(true)
    }
  })

  it('collects exactly the clues the reconstruction depends on, essentials first', () => {
    const collected = simulation.steps
      .filter((step) => step.id.startsWith('clue-'))
      .map((step) => step.id.replace('clue-', ''))

    expect(collected).toEqual([...caseSolution.essentialEvidenceIds, ...caseSolution.contextualEvidenceIds])
  })

  it('leaves the case file untouched', () => {
    const before = JSON.stringify(case001)
    buildCaseSimulation()

    expect(JSON.stringify(case001)).toBe(before)
    expect(case001.evidence.every((record) => record.discovered === false)).toBe(true)
  })

  it('charges each walk a real Dijkstra shortest-path cost', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)

    expect(simulation.routes.length).toBeGreaterThan(0)
    for (const route of simulation.routes) {
      const run = dijkstra(graph, route.fromLocationId, route.toLocationId)
      expect(route.cost).toBe(run.totalCost)
      expect(route.path).toEqual(run.path)
    }
    expect(simulation.totals.routeCost).toBe(simulation.routes.reduce((total, route) => total + route.cost, 0))
  })

  it('recommends the room the reconstruction needs first, not the cheapest one', () => {
    const roomStep = stepById(simulation, 'choose-room')
    const cheapest = roomStep.choice.options[0]
    const recommended = roomStep.choice.options.find((option) => option.id === roomStep.choice.recommendedId)

    expect(recommended.id).toBe(case001.evidence.find((record) => record.id === caseSolution.essentialEvidenceIds[0]).discoveredAt)
    expect(cheapest.cost).toBeLessThan(recommended.cost)
    expect(recommended.holdsIncidentRoom).toBe(true)
  })

  it('scores the room choice honestly', () => {
    const roomStep = stepById(simulation, 'choose-room')
    const recommendedId = roomStep.choice.recommendedId
    const recommended = roomStep.choice.options.find((option) => option.id === recommendedId)
    const contextRoom = roomStep.choice.options.find((option) => option.id === 'L003')
    const library = roomStep.choice.options.find((option) => option.id === 'L005')

    expect(describeRouteChoice({ option: recommended, recommendedId }).tone).toBe('recommended')
    expect(describeRouteChoice({ option: contextRoom, recommendedId }).tone).toBe('useful')
    expect(describeRouteChoice({ option: library, recommendedId }).tone).toBe('detour')
    expect(describeRouteChoice({ option: library, recommendedId }).message).toContain(library.pathNames.join(' → '))
  })

  it('shows prefix matches that came out of the Trie, and the fragment it rejects', () => {
    const searchStep = stepById(simulation, 'search')

    expect(searchStep.detail.matches.length).toBeGreaterThan(0)
    expect(searchStep.detail.matches.every((match) => match.matchingWords.length > 0)).toBe(true)
    expect(searchStep.detail.matches.some((match) => match.id === caseSolution.essentialEvidenceIds[2])).toBe(true)
    expect(searchStep.detail.nearMissCount).toBe(0)
    expect(searchStep.result).toContain(String(searchStep.detail.stats.recordCount))
  })

  it('reports sealed search hits as sealed before anything is discovered', () => {
    const searchStep = stepById(simulation, 'search')
    const sealed = searchStep.detail.matches.filter((match) => match.type === 'evidence')

    expect(searchStep.discoveredIds).toEqual([])
    expect(sealed.length).toBeGreaterThan(0)
    expect(sealed.every((match) => match.isUnlocked === false)).toBe(true)
  })

  it('keeps undiscovered clues out of the ranking, the theory and the network', () => {
    const hiddenIds = case001.evidence
      .filter((record) => !stepById(simulation, 'ranking').discoveredIds.includes(record.id))
      .map((record) => record.id)
    const surfaced = [
      stepById(simulation, 'ranking'),
      stepById(simulation, 'deduction'),
      stepById(simulation, 'network'),
    ]

    for (const step of surfaced) {
      const payload = JSON.stringify({ detail: step.detail, result: step.result })
      for (const id of hiddenIds) {
        expect(payload, `step "${step.id}" leaked undiscovered clue ${id}`).not.toContain(id)
      }
    }
  })

  it('ranks only the conflicts clue does, and says it is a priority rather than guilt', () => {
    const rankingStep = stepById(simulation, 'ranking')
    const scored = rankingStep.detail.rows.filter((row) => row.directionalEvidenceCount > 0)

    expect(scored.map((row) => row.id)).toEqual([caseSolution.culpritSuspectId])
    expect(rankingStep.detail.hasMeaningfulEvidence).toBe(true)
    expect(scored[0].priorityLabel).toBe('High investigation priority')
    expect(rankingStep.algorithm.detail).toContain('Identical input')
  })

  it('evaluates the theory with the deduction engine and keeps uncertainty visible', () => {
    const deductionStep = stepById(simulation, 'deduction')

    expect(deductionStep.detail.status).toBe('supported')
    expect(deductionStep.detail.supporting.length).toBe(simulation.totals.discoveredCount)
    expect(deductionStep.detail.rulesEvaluated.some((rule) => rule.result === 'unresolved')).toBe(true)
    expect(deductionStep.result).toContain('not whether')
  })

  it('solves the case with the recommended accusation, through the game evaluator', () => {
    const accusationStep = stepById(simulation, 'accusation')
    const outcome = accusationStep.choice.recommendedOutcome

    expect(outcome.valid).toBe(true)
    expect(outcome.outcome).toBe('case_solved')
    expect(outcome.reasoningAssessment).toBe('well_supported')
    expect(outcome.correctSuspect).toBe(true)
    expect(outcome.missingEssentialEvidenceIds).toEqual([])
    expect(accusationStep.choice.recommendedSuspectId).toBe(caseSolution.culpritSuspectId)
    expect(accusationStep.choice.recommendedEvidenceIds).toEqual([...caseSolution.essentialEvidenceIds])
  })

  it('scores a reader accusation with the same evaluator', () => {
    const accusationStep = stepById(simulation, 'accusation')
    const discoveredEvidenceIds = accusationStep.discoveredIds

    const reasoning = 'Citing the records the investigation actually uncovered.'
    const wrongSuspect = evaluateSimulationAccusation({
      discoveredEvidenceIds,
      explanation: reasoning,
      selectedEvidenceIds: accusationStep.choice.recommendedEvidenceIds,
      selectedSuspectId: 'S001',
    })
    const noEvidence = evaluateSimulationAccusation({
      discoveredEvidenceIds,
      explanation: reasoning,
      selectedEvidenceIds: [],
      selectedSuspectId: caseSolution.culpritSuspectId,
    })
    const unexplained = evaluateSimulationAccusation({
      discoveredEvidenceIds,
      selectedEvidenceIds: accusationStep.choice.recommendedEvidenceIds,
      selectedSuspectId: caseSolution.culpritSuspectId,
    })
    const contextualOnly = evaluateSimulationAccusation({
      discoveredEvidenceIds,
      explanation: reasoning,
      selectedEvidenceIds: [...caseSolution.contextualEvidenceIds],
      selectedSuspectId: caseSolution.culpritSuspectId,
    })

    expect(wrongSuspect.outcome).toBe('promising_reasoning_incorrect')
    expect(noEvidence.outcome).toBe('insufficient_evidence')
    expect(unexplained.valid).toBe(false)
    expect(contextualOnly.outcome).toBe('correct_incomplete')
  })

  it('refuses evidence the reader never discovered', () => {
    const accusationStep = stepById(simulation, 'accusation')
    const undiscoveredId = case001.evidence
      .find((record) => !accusationStep.discoveredIds.includes(record.id)).id

    const result = evaluateSimulationAccusation({
      discoveredEvidenceIds: accusationStep.discoveredIds,
      explanation: 'Testing an undocumented citation.',
      selectedEvidenceIds: [undiscoveredId],
      selectedSuspectId: caseSolution.culpritSuspectId,
    })

    expect(result.valid).toBe(false)
  })

  it('keeps the reconstruction honest in every player-facing line', () => {
    const copy = simulation.steps
      .map((step) => [step.coach, step.action, step.result, step.algorithm.detail, step.note?.text || ''].join(' '))
      .join(' ')

    expect(simulation.disclaimer).toContain('follows the case file')
    expect(copy).toMatch(/does not establish|never establishes/)
    expect(stepById(simulation, 'epilogue').result).toBe(caseSolution.solutionLimits)
    expect(copy).not.toMatch(/\bproves guilt\b|\bdefinitely\b/)
  })
})
