import { describe, expect, it } from 'vitest'
import { Graph, createGraphFromLocations } from './Graph.js'
import { dijkstra } from './dijkstra.js'
import { case001 } from '../data/case001.js'

function makeWeightedGraph(vertexIds, edges) {
  const graph = new Graph()
  vertexIds.forEach((vertexId) => graph.addVertex(vertexId))
  edges.forEach(([first, second, weight]) => graph.addEdge(first, second, weight))
  return graph
}

function routeCost(graph, path) {
  return path.slice(1).reduce((total, vertexId, index) => (
    total + graph.getEdgeWeight(path[index], vertexId)
  ), 0)
}

describe('Dijkstra shortest path', () => {
  it('returns the known minimum-cost route and finalization order', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B', 8], ['A', 'C', 2], ['C', 'B', 1], ['B', 'D', 2], ['C', 'D', 7], ['D', 'E', 1],
    ])
    const result = dijkstra(graph, 'A', 'E')
    expect(result.valid).toBe(true)
    expect(result.found).toBe(true)
    expect(result.path).toEqual(['A', 'C', 'B', 'D', 'E'])
    expect(result.totalCost).toBe(6)
    expect(result.visitedOrder).toEqual(['A', 'C', 'B', 'D', 'E'])
  })

  it('can choose a higher-edge-count route than BFS when its total weight is lower', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)
    const bfs = graph.breadthFirstSearch('L001', 'L006')
    const shortestWeighted = dijkstra(graph, 'L001', 'L006')
    expect(bfs.route).toEqual(['L001', 'L002', 'L006'])
    expect(shortestWeighted.path).toEqual(['L001', 'L004', 'L002', 'L006'])
    expect(shortestWeighted.totalCost).toBe(4)
    expect(shortestWeighted.path.length - 1).toBeGreaterThan(bfs.route.length - 1)
    expect(routeCost(graph, bfs.route)).toBe(7)
  })

  it('reports an unreachable target without throwing', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C'], [['A', 'B', 1]])
    const result = dijkstra(graph, 'A', 'C')
    expect(result.valid).toBe(true)
    expect(result.found).toBe(false)
    expect(result.path).toEqual([])
    expect(result.totalCost).toBeNull()
    expect(result.distances.get('C')).toBe(Infinity)
    expect(result.message).toContain('No route connects')
  })

  it('returns a clear result for an invalid starting vertex', () => {
    const result = dijkstra(makeWeightedGraph(['A'], []), 'missing', 'A')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Start vertex "missing" does not exist')
    expect(result.visitedOrder).toEqual([])
  })

  it('returns a clear result for an invalid target vertex', () => {
    const result = dijkstra(makeWeightedGraph(['A'], []), 'A', 'missing')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Target vertex "missing" does not exist')
    expect(result.visitedOrder).toEqual([])
  })

  it('handles a start that is also the target', () => {
    const result = dijkstra(makeWeightedGraph(['A', 'B'], [['A', 'B', 1]]), 'A', 'A')
    expect(result.found).toBe(true)
    expect(result.path).toEqual(['A'])
    expect(result.totalCost).toBe(0)
    expect(result.visitedOrder).toEqual(['A'])
  })

  it('handles zero-weight edges', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C'], [['A', 'B', 0], ['B', 'C', 2], ['A', 'C', 4]])
    const result = dijkstra(graph, 'A', 'C')
    expect(result.path).toEqual(['A', 'B', 'C'])
    expect(result.totalCost).toBe(2)
    expect(result.distances.get('B')).toBe(0)
  })

  it('returns a valid minimum route when multiple paths have equal cost', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C', 'D'], [
      ['A', 'B', 2], ['B', 'D', 3], ['A', 'C', 1], ['C', 'D', 4],
    ])
    const result = dijkstra(graph, 'A', 'D')
    expect(result.found).toBe(true)
    expect(result.totalCost).toBe(5)
    expect(result.path[0]).toBe('A')
    expect(result.path.at(-1)).toBe('D')
    expect(routeCost(graph, result.path)).toBe(5)
    expect(result.path.every((vertexId, index) => index === 0 || graph.hasEdge(result.path[index - 1], vertexId))).toBe(true)
  })

  it('handles cycles without finalizing a vertex more than once', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C', 'D'], [
      ['A', 'B', 1], ['B', 'C', 1], ['C', 'A', 4], ['C', 'D', 1], ['A', 'D', 10],
    ])
    const result = dijkstra(graph, 'A', 'D')
    expect(result.path).toEqual(['A', 'B', 'C', 'D'])
    expect(result.totalCost).toBe(3)
    expect(new Set(result.visitedOrder).size).toBe(result.visitedOrder.length)
  })

  it('does not mutate the input graph', () => {
    const graph = makeWeightedGraph(['A', 'B', 'C'], [['A', 'B', 2], ['B', 'C', 3]])
    const before = graph.getVertices().map((vertexId) => ({
      vertexId,
      neighbors: graph.getWeightedNeighbors(vertexId),
    }))
    dijkstra(graph, 'A', 'C')
    expect(graph.getVertices().map((vertexId) => ({
      vertexId,
      neighbors: graph.getWeightedNeighbors(vertexId),
    }))).toEqual(before)
  })
})
