import { describe, expect, it } from 'vitest'
import { Graph } from '../dsa/Graph.js'
import { compareBfsAndDijkstra, runGraphAlgorithmWithCounts } from './algorithmOperations.js'

function createGraph() {
  const graph = new Graph()
  for (const id of ['A', 'B', 'C', 'D']) graph.addVertex(id)
  graph.addEdge('A', 'B', 1)
  graph.addEdge('A', 'C', 4)
  graph.addEdge('B', 'D', 2)
  graph.addEdge('C', 'D', 1)
  return graph
}

describe('algorithm operation counts', () => {
  it('preserves BFS and DFS results while counting actual adjacency entries', () => {
    const graph = createGraph()
    const before = graph.getVertices().map((id) => [id, graph.getWeightedNeighbors(id)])
    const bfs = runGraphAlgorithmWithCounts(graph, 'BFS', 'A', 'D')
    const dfs = runGraphAlgorithmWithCounts(graph, 'DFS', 'A', 'D')

    expect(bfs.result.traversalOrder).toEqual(graph.breadthFirstSearch('A', 'D').traversalOrder)
    expect(bfs.result.route).toEqual(['A', 'B', 'D'])
    expect(bfs.adjacencyEntriesExamined).toBe(8)
    expect(dfs.result.traversalOrder).toEqual(graph.depthFirstSearch('A', 'D').traversalOrder)
    expect(dfs.adjacencyEntriesExamined).toBe(8)
    expect(graph.getVertices().map((id) => [id, graph.getWeightedNeighbors(id)])).toEqual(before)
  })

  it('compares the real minimum-edge BFS route with Dijkstra total cost', () => {
    const graph = createGraph()
    const comparison = compareBfsAndDijkstra(graph, 'A', 'D')
    expect(comparison.bfs.result.route).toEqual(['A', 'B', 'D'])
    expect(comparison.dijkstra.result.path).toEqual(['A', 'B', 'D'])
    expect(comparison.dijkstra.result.totalCost).toBe(3)
    expect(comparison.bfs.adjacencyEntriesExamined).toBe(8)
    expect(comparison.dijkstra.adjacencyEntriesExamined).toBe(4)
  })

  it('counts Dijkstra edge scans before early target finalization only', () => {
    const graph = createGraph()
    const result = runGraphAlgorithmWithCounts(graph, 'DIJKSTRA', 'A', 'A')
    expect(result.result.path).toEqual(['A'])
    expect(result.result.totalCost).toBe(0)
    expect(result.adjacencyEntriesExamined).toBe(0)
  })
})
