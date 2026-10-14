import { describe, expect, it } from 'vitest'
import { createGraphFromLocations, Graph } from './Graph.js'
import { case001 } from '../data/case001.js'

function graphWith(vertices, edges = []) {
  const graph = new Graph()
  vertices.forEach((vertexId) => graph.addVertex(vertexId))
  edges.forEach(([first, second]) => graph.addEdge(first, second))
  return graph
}

describe('Graph', () => {
  it('inserts vertices once and returns copies of its vertex list', () => {
    const graph = new Graph()
    expect(graph.addVertex('A')).toBe(true)
    expect(graph.addVertex('A')).toBe(false)
    const vertices = graph.getVertices()
    vertices.push('PHANTOM')
    expect(graph.getVertices()).toEqual(['A'])
    expect(graph.hasVertex('A')).toBe(true)
    expect(graph.hasVertex('PHANTOM')).toBe(false)
  })

  it('inserts undirected edges in both adjacency lists', () => {
    const graph = graphWith(['A', 'B'])
    expect(graph.addEdge('A', 'B')).toBe(true)
    expect(graph.hasEdge('A', 'B')).toBe(true)
    expect(graph.hasEdge('B', 'A')).toBe(true)
    expect(graph.getNeighbors('A')).toEqual(['B'])
    expect(graph.getNeighbors('B')).toEqual(['A'])
  })

  it('returns a copy of a vertex neighbor list', () => {
    const graph = graphWith(['A', 'B'], [['A', 'B']])
    const neighbors = graph.getNeighbors('A')
    neighbors.push('C')
    expect(graph.getNeighbors('A')).toEqual(['B'])
    expect(graph.hasVertex('C')).toBe(false)
  })

  it('handles duplicate edges without duplicate neighbors', () => {
    const graph = graphWith(['A', 'B'])
    expect(graph.addEdge('A', 'B')).toBe(true)
    expect(graph.addEdge('B', 'A')).toBe(false)
    expect(graph.getNeighbors('A')).toEqual(['B'])
    expect(graph.getNeighbors('B')).toEqual(['A'])
  })

  it('stores undirected edge weights and returns detached neighbor records', () => {
    const graph = graphWith(['A', 'B'])
    expect(graph.addEdge('A', 'B', 2.5)).toBe(true)
    expect(graph.getEdgeWeight('A', 'B')).toBe(2.5)
    expect(graph.getEdgeWeight('B', 'A')).toBe(2.5)
    const weightedNeighbors = graph.getWeightedNeighbors('A')
    weightedNeighbors[0].weight = 999
    weightedNeighbors.push({ neighborId: 'C', weight: 1 })
    expect(graph.getWeightedNeighbors('A')).toEqual([{ neighborId: 'B', weight: 2.5 }])
    expect(graph.getNeighbors('A')).toEqual(['B'])
  })

  it('does not duplicate an edge and updates its weight in both directions', () => {
    const graph = graphWith(['A', 'B'])
    expect(graph.addEdge('A', 'B', 4)).toBe(true)
    expect(graph.addEdge('B', 'A', 4)).toBe(false)
    expect(graph.addEdge('B', 'A', 7)).toBe(true)
    expect(graph.getNeighbors('A')).toEqual(['B'])
    expect(graph.getEdgeWeight('A', 'B')).toBe(7)
    expect(graph.getEdgeWeight('B', 'A')).toBe(7)
    expect(graph.updateEdgeWeight('A', 'B', 3)).toBe(true)
    expect(graph.getEdgeWeight('B', 'A')).toBe(3)
  })

  it('allows zero weights and rejects negative, non-finite, and non-numeric weights', () => {
    const graph = graphWith(['A', 'B'])
    expect(graph.addEdge('A', 'B', 0)).toBe(true)
    expect(graph.getEdgeWeight('B', 'A')).toBe(0)
    for (const invalidWeight of [-1, Number.NaN, Infinity, -Infinity, '2', null]) {
      expect(() => graph.addEdge('A', 'B', invalidWeight)).toThrow('finite, non-negative number')
    }
    expect(() => graph.updateEdgeWeight('A', 'B', -1)).toThrow('finite, non-negative number')
  })

  it('removes an edge from both vertices and safely handles repeated removal', () => {
    const graph = graphWith(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']])
    expect(graph.removeEdge('A', 'B')).toBe(true)
    expect(graph.hasEdge('A', 'B')).toBe(false)
    expect(graph.hasEdge('B', 'A')).toBe(false)
    expect(graph.removeEdge('A', 'B')).toBe(false)
    expect(graph.removeEdge('missing', 'B')).toBe(false)
    expect(graph.getNeighbors('A')).toEqual(['C'])
  })

  it('returns a deterministic breadth-first traversal order', () => {
    const graph = graphWith(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'C'], ['A', 'B'], ['B', 'D'], ['C', 'D'], ['D', 'E'],
    ])
    expect(graph.breadthFirstSearch('A').traversalOrder).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('reconstructs a route with the minimum number of edges', () => {
    const graph = graphWith(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'], ['B', 'D'], ['D', 'E'], ['A', 'C'], ['C', 'E'],
    ])
    const result = graph.breadthFirstSearch('A', 'E')
    expect(result.valid).toBe(true)
    expect(result.route).toEqual(['A', 'C', 'E'])
    expect(result.route.length - 1).toBe(2)
    expect(result.parents.get('E')).toBe('C')
  })

  it('returns an unreachable target without throwing', () => {
    const graph = graphWith(['A', 'B', 'C'], [['A', 'B']])
    const result = graph.breadthFirstSearch('A', 'C')
    expect(result.valid).toBe(true)
    expect(result.targetReachable).toBe(false)
    expect(result.route).toEqual([])
    expect(result.traversalOrder).toEqual(['A', 'B'])
  })

  it('returns a deterministic depth-first traversal in ascending neighbor order', () => {
    const graph = graphWith(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'C'], ['A', 'B'], ['B', 'D'], ['C', 'D'], ['D', 'E'],
    ])
    expect(graph.depthFirstSearch('A').traversalOrder).toEqual(['A', 'B', 'D', 'C', 'E'])
  })

  it('reconstructs a route from the actual DFS discovery tree without claiming shortest path', () => {
    const graph = graphWith(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'C'], ['A', 'B'], ['B', 'D'], ['C', 'D'], ['D', 'E'],
    ])
    const result = graph.depthFirstSearch('A', 'E')
    expect(result.valid).toBe(true)
    expect(result.traversalOrder).toEqual(['A', 'B', 'D', 'C', 'E'])
    expect(result.route).toEqual(['A', 'B', 'D', 'E'])
    expect(result.parents.get('E')).toBe('D')
  })

  it('handles an unreachable DFS destination and a start-equals-target route', () => {
    const graph = graphWith(['A', 'B', 'C'], [['A', 'B']])
    const unreachable = graph.depthFirstSearch('A', 'C')
    const same = graph.depthFirstSearch('A', 'A')
    expect(unreachable.valid).toBe(true)
    expect(unreachable.targetReachable).toBe(false)
    expect(unreachable.route).toEqual([])
    expect(same.targetReachable).toBe(true)
    expect(same.route).toEqual(['A'])
  })

  it('returns a clear invalid result for an unknown DFS target', () => {
    const result = graphWith(['A']).depthFirstSearch('A', 'missing')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Target vertex "missing" does not exist')
    expect(result.route).toEqual([])
  })

  it('visits each vertex once when DFS encounters a cycle', () => {
    const graph = graphWith(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'D']])
    const result = graph.depthFirstSearch('A')
    expect(result.traversalOrder).toEqual(['A', 'B', 'C', 'D'])
    expect(new Set(result.traversalOrder).size).toBe(4)
  })

  it('returns a clear invalid result for an unknown start vertex', () => {
    const graph = graphWith(['A'])
    const bfs = graph.breadthFirstSearch('missing')
    const dfs = graph.depthFirstSearch('missing')
    expect(bfs.valid).toBe(false)
    expect(bfs.error).toContain('Start vertex "missing" does not exist')
    expect(bfs.traversalOrder).toEqual([])
    expect(dfs.valid).toBe(false)
    expect(dfs.error).toContain('Start vertex "missing" does not exist')
    expect(dfs.visitedCount).toBe(0)
  })

  it('handles an empty graph with clear invalid traversal results', () => {
    const graph = new Graph()
    expect(graph.getVertices()).toEqual([])
    expect(graph.breadthFirstSearch('L001').error).toContain('Start vertex "L001" does not exist')
    expect(graph.depthFirstSearch('L001').traversalOrder).toEqual([])
  })

  it('returns a clear invalid result for an unknown BFS target', () => {
    const result = graphWith(['A']).breadthFirstSearch('A', 'missing')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Target vertex "missing" does not exist')
    expect(result.traversalOrder).toEqual([])
  })

  it('rejects invalid location references instead of creating phantom vertices', () => {
    const locations = [
      { id: 'L001', connectedLocationIds: ['L999'] },
      { id: 'L002', connectedLocationIds: [] },
    ]
    expect(() => createGraphFromLocations(locations)).toThrow('Invalid connection from "L001" to "L999"')
    const graph = new Graph()
    graph.addVertex('A')
    expect(() => graph.addEdge('A', 'missing')).toThrow('vertex "missing" does not exist')
    expect(graph.getVertices()).toEqual(['A'])
  })

  it('builds the mansion graph from the six case locations and their connections', () => {
    const graph = createGraphFromLocations(case001.locations)
    expect(graph.getVertices()).toEqual(['L001', 'L002', 'L003', 'L004', 'L005', 'L006'])
    expect(graph.getNeighbors('L001').sort()).toEqual(['L002', 'L004', 'L005'])
    expect(graph.getNeighbors('L006')).toEqual(['L002'])
    expect(graph.getNeighbors('L002')).toContain('L006')
  })

  it('builds configured mansion corridor weights once and consistently in both directions', () => {
    const graph = createGraphFromLocations(case001.locations, case001.corridorWeights)
    expect(graph.getVertices()).toHaveLength(6)
    expect(graph.getEdgeWeight('L001', 'L002')).toBe(6)
    expect(graph.getEdgeWeight('L002', 'L001')).toBe(6)
    expect(graph.getEdgeWeight('L001', 'L004')).toBe(1)
    expect(() => createGraphFromLocations(case001.locations, [
      { from: 'L001', to: 'L006', weight: 3 },
    ])).toThrow('corridor does not exist')
    expect(() => createGraphFromLocations(case001.locations, [
      { from: 'L001', to: 'L002', weight: 2 },
      { from: 'L002', to: 'L001', weight: 4 },
    ])).toThrow('Duplicate corridor weight configuration')
  })

  it('keeps disconnected components separate during BFS and DFS', () => {
    const graph = graphWith(['A', 'B', 'C', 'D'], [['A', 'B'], ['C', 'D']])
    const bfs = graph.breadthFirstSearch('A')
    const dfs = graph.depthFirstSearch('A')
    expect(bfs.traversalOrder).toEqual(['A', 'B'])
    expect(dfs.traversalOrder).toEqual(['A', 'B'])
    expect(bfs.traversalOrder).not.toContain('C')
    expect(dfs.traversalOrder).not.toContain('D')
  })
})
