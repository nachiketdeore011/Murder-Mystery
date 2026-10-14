import { describe, expect, it } from 'vitest'
import { createGraphFromLocations } from '../dsa/Graph.js'
import { dijkstra } from '../dsa/dijkstra.js'
import { case001 } from './case001.js'
import { createEvidenceRelationshipNetwork, validateEvidenceRelationshipNetwork } from './crimeSceneNetwork.js'

describe('crime scene network data', () => {
  it('represents all six real locations with unique IDs and valid edge endpoints', () => {
    const network = createEvidenceRelationshipNetwork(case001, new Set())
    const locationIds = network.nodes.filter(({ type }) => type === 'location').map(({ recordId }) => recordId)
    const allNodeIds = network.nodes.map(({ id }) => id)

    expect(locationIds).toEqual(case001.locations.map(({ id }) => id))
    expect(new Set(allNodeIds).size).toBe(allNodeIds.length)
    expect(network.edges.every((edge) => allNodeIds.includes(edge.from) && allNodeIds.includes(edge.to))).toBe(true)
  })

  it('builds the physical route graph from all six source locations and configured corridors', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)
    const edges = graph.getVertices().flatMap((locationId) => graph.getWeightedNeighbors(locationId)
      .filter(({ neighborId }) => locationId.localeCompare(neighborId) < 0)
      .map(({ neighborId, weight }) => ({ from: locationId, to: neighborId, weight })))

    expect(graph.getVertices()).toEqual(case001.locations.map(({ id }) => id))
    expect(edges).toHaveLength(case001.corridorWeights.length)
    expect(edges).toEqual(expect.arrayContaining(case001.corridorWeights.map(({ from, to, weight }) => ({ from, to, weight }))))
  })

  it('keeps the physical route graph separate from evidence relationships', () => {
    const network = createEvidenceRelationshipNetwork(case001, new Set(['E001']))
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)

    expect(network.edges.some(({ type }) => type === 'corridor')).toBe(false)
    expect(network.edges.some(({ from, to }) => graph.hasVertex(from) || graph.hasVertex(to))).toBe(false)
    expect(graph.hasVertex('E001')).toBe(false)
    expect(network.validation.valid).toBe(true)
  })

  it('includes only discovered evidence and its documented links', () => {
    const network = createEvidenceRelationshipNetwork(case001, new Set(['E001']))
    const evidenceNodes = network.nodes.filter(({ type }) => type === 'evidence')
    const evidenceEdges = network.edges.filter(({ from, to }) => from === 'evidence:E001' || to === 'evidence:E001')

    expect(evidenceNodes.map(({ recordId }) => recordId)).toEqual(['E001'])
    expect(evidenceEdges.map(({ type }) => type).sort()).toEqual(['found-at', 'profile-follow-up'])
    expect(evidenceEdges.find(({ type }) => type === 'profile-follow-up').to).toBe('suspect:S005')
    expect(JSON.stringify(network)).not.toContain('Ledger review page')
    expect(JSON.stringify(network)).not.toContain('Garden lantern maintenance card')
  })

  it('does not invent suspect or contradiction links for a clue without explicit related IDs', () => {
    const network = createEvidenceRelationshipNetwork(case001, new Set(['E004']))
    const evidenceEdges = network.edges.filter(({ from, to }) => from === 'evidence:E004' || to === 'evidence:E004')

    expect(evidenceEdges.map(({ type }) => type)).toEqual(['found-at'])
    expect(network.edges.some(({ type }) => type === 'contradicts')).toBe(false)
    expect(network.nodes.some(({ type }) => type === 'culprit')).toBe(false)
  })

  it('labels timeline links as report metadata rather than proof of presence', () => {
    const network = createEvidenceRelationshipNetwork(case001, new Set())
    const eventLocation = network.edges.find(({ id }) => id === 'event-location:T002:L001')
    const eventSuspect = network.edges.find(({ id }) => id === 'named-in-report:T002:S003')

    expect(eventLocation.label).toBe('Location named in report')
    expect(eventLocation.confirmed).toBe(false)
    expect(eventSuspect.label).toBe('Named in report')
    expect(eventSuspect.confirmed).toBe(false)
  })

  it('validates all relationship endpoints and reports invalid source references', () => {
    const validNetwork = createEvidenceRelationshipNetwork(case001, new Set(['E002']))
    expect(validateEvidenceRelationshipNetwork(validNetwork).valid).toBe(true)

    const invalidNetwork = createEvidenceRelationshipNetwork({
      ...case001,
      evidence: [{ ...case001.evidence[0], discoveredAt: 'L999', relatedSuspectIds: ['S999'] }],
    }, new Set(['E001']))
    expect(invalidNetwork.validation.valid).toBe(false)
    expect(invalidNetwork.validation.errors.join(' ')).toContain('missing location "L999"')
    expect(invalidNetwork.validation.errors.join(' ')).toContain('missing suspect "S999"')
  })

  it('uses existing graph algorithms for route selection without changing the graph', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)
    const verticesBefore = graph.getVertices()
    const neighborsBefore = graph.getVertices().map((id) => [id, graph.getWeightedNeighbors(id)])

    const bfs = graph.breadthFirstSearch('L001', 'L006')
    const dfs = graph.depthFirstSearch('L001', 'L006')
    const weighted = dijkstra(graph, 'L001', 'L006')

    expect(bfs.route[0]).toBe('L001')
    expect(bfs.route.at(-1)).toBe('L006')
    expect(dfs.targetReachable).toBe(true)
    expect(dfs.route[0]).toBe('L001')
    expect(dfs.route.at(-1)).toBe('L006')
    expect(weighted.path[0]).toBe('L001')
    expect(weighted.path.at(-1)).toBe('L006')
    expect(graph.getVertices()).toEqual(verticesBefore)
    expect(graph.getVertices().map((id) => [id, graph.getWeightedNeighbors(id)])).toEqual(neighborsBefore)
  })

  it('does not mutate case records or discovery metadata while building the network', () => {
    const before = structuredClone(case001)
    createEvidenceRelationshipNetwork(case001, new Set(['E003', 'E010']))
    expect(case001).toEqual(before)
  })
})
