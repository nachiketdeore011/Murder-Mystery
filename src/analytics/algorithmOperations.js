import { dijkstra } from '../dsa/dijkstra.js'

function sumNeighborEntries(graph, vertexIds, weighted = false) {
  const getNeighbors = weighted ? graph?.getWeightedNeighbors : graph?.getNeighbors
  if (typeof getNeighbors !== 'function' || !Array.isArray(vertexIds)) return 0
  return vertexIds.reduce((count, vertexId) => count + getNeighbors.call(graph, vertexId).length, 0)
}

/** Count adjacency entries consumed by the real traversal loops, not time. */
export function runGraphAlgorithmWithCounts(graph, algorithm, startId, targetId) {
  if (!graph) throw new TypeError('A graph is required to run an algorithm.')
  if (algorithm === 'BFS') {
    const result = graph.breadthFirstSearch(startId, targetId || undefined)
    return { result, adjacencyEntriesExamined: sumNeighborEntries(graph, result.traversalOrder) }
  }
  if (algorithm === 'DFS') {
    const result = graph.depthFirstSearch(startId, targetId || undefined)
    return { result, adjacencyEntriesExamined: sumNeighborEntries(graph, result.traversalOrder) }
  }
  if (algorithm === 'DIJKSTRA') {
    const result = dijkstra(graph, startId, targetId)
    // Dijkstra exits as soon as the target is finalized, before scanning its edges.
    const expandedVertices = result.found ? result.visitedOrder.slice(0, -1) : result.visitedOrder
    return { result, adjacencyEntriesExamined: sumNeighborEntries(graph, expandedVertices, true) }
  }
  throw new RangeError('Unsupported graph algorithm: ' + algorithm)
}

export function compareBfsAndDijkstra(graph, startId, targetId) {
  return {
    bfs: runGraphAlgorithmWithCounts(graph, 'BFS', startId, targetId),
    dijkstra: runGraphAlgorithmWithCounts(graph, 'DIJKSTRA', startId, targetId),
  }
}
