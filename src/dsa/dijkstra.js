import { MinPriorityQueue } from './MinPriorityQueue.js'

function resultBase(startVertexId, targetVertexId) {
  return {
    valid: false,
    found: false,
    error: null,
    message: null,
    startVertexId,
    targetVertexId,
    path: [],
    totalCost: null,
    distances: new Map(),
    predecessors: new Map(),
    visitedOrder: [],
    visitedCount: 0,
  }
}

/**
 * Find a minimum-total-weight path using Dijkstra's algorithm.
 * With adjacency lists and this binary heap, the typical bound is
 * O((V + E) log V), with lazy queue entries ignored when they become stale.
 */
export function dijkstra(graph, startVertexId, targetVertexId) {
  const result = resultBase(startVertexId, targetVertexId)
  if (!graph || typeof graph.hasVertex !== 'function' || typeof graph.getVertices !== 'function'
    || typeof graph.getWeightedNeighbors !== 'function') {
    result.error = 'A weighted graph with vertex and neighbor lookup methods is required.'
    return result
  }
  if (!graph.hasVertex(startVertexId)) {
    result.error = `Start vertex "${startVertexId}" does not exist.`
    return result
  }
  if (!graph.hasVertex(targetVertexId)) {
    result.error = `Target vertex "${targetVertexId}" does not exist.`
    return result
  }

  const vertices = graph.getVertices()
  const distances = new Map(vertices.map((vertexId) => [vertexId, Infinity]))
  const predecessors = new Map()
  const queue = new MinPriorityQueue()
  const finalized = new Set()
  const visitedOrder = []

  distances.set(startVertexId, 0)
  predecessors.set(startVertexId, null)
  queue.enqueue(startVertexId, 0)

  while (!queue.isEmpty()) {
    const entry = queue.dequeue()
    const currentVertexId = entry.value
    if (entry.priority !== distances.get(currentVertexId) || finalized.has(currentVertexId)) continue

    finalized.add(currentVertexId)
    visitedOrder.push(currentVertexId)
    if (currentVertexId === targetVertexId) break

    for (const { neighborId, weight } of graph.getWeightedNeighbors(currentVertexId)) {
      if (finalized.has(neighborId)) continue
      const candidateDistance = distances.get(currentVertexId) + weight
      if (candidateDistance >= distances.get(neighborId)) continue

      distances.set(neighborId, candidateDistance)
      predecessors.set(neighborId, currentVertexId)
      queue.enqueue(neighborId, candidateDistance)
    }
  }

  const found = finalized.has(targetVertexId)
  const path = []
  if (found) {
    let currentVertexId = targetVertexId
    while (currentVertexId !== null && currentVertexId !== undefined) {
      path.push(currentVertexId)
      currentVertexId = predecessors.get(currentVertexId)
    }
    path.reverse()
  }

  return {
    ...result,
    valid: true,
    found,
    message: found ? null : `No route connects "${startVertexId}" to "${targetVertexId}".`,
    path: found ? path : [],
    totalCost: found ? distances.get(targetVertexId) : null,
    distances,
    predecessors,
    visitedOrder,
    visitedCount: visitedOrder.length,
  }
}

export default dijkstra
