function validateVertexId(vertexId) {
  if (typeof vertexId !== 'string' || vertexId.trim() === '') {
    throw new TypeError('A graph vertex ID must be a non-empty string.')
  }
}

function validateWeight(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new TypeError('An edge weight must be a finite, non-negative number.')
  }
}

/**
 * An undirected weighted graph backed by an adjacency list.
 * BFS and DFS sort neighbor IDs before processing, so their traversal order is
 * deterministic and remains O(V + E) for an adjacency-list representation.
 */
export class Graph {
  #adjacencyList = new Map()

  addVertex(vertexId) {
    validateVertexId(vertexId)
    if (this.#adjacencyList.has(vertexId)) return false
    this.#adjacencyList.set(vertexId, new Map())
    return true
  }

  /** Add an undirected edge, or update its weight if the edge already exists. */
  addEdge(firstVertexId, secondVertexId, weight = 1) {
    validateVertexId(firstVertexId)
    validateVertexId(secondVertexId)
    validateWeight(weight)
    this.#assertVerticesExist(firstVertexId, secondVertexId)

    const firstNeighbors = this.#adjacencyList.get(firstVertexId)
    const secondNeighbors = this.#adjacencyList.get(secondVertexId)
    if (firstNeighbors.has(secondVertexId)) {
      if (firstNeighbors.get(secondVertexId) === weight) return false
      firstNeighbors.set(secondVertexId, weight)
      secondNeighbors.set(firstVertexId, weight)
      return true
    }

    firstNeighbors.set(secondVertexId, weight)
    secondNeighbors.set(firstVertexId, weight)
    return true
  }

  /** Update an existing undirected edge; return false if there is no such edge. */
  updateEdgeWeight(firstVertexId, secondVertexId, weight) {
    validateWeight(weight)
    if (!this.hasEdge(firstVertexId, secondVertexId)) return false
    return this.addEdge(firstVertexId, secondVertexId, weight)
  }

  hasVertex(vertexId) {
    return this.#adjacencyList.has(vertexId)
  }

  /** Return neighbor IDs only, preserving the original traversal API. */
  getNeighbors(vertexId) {
    if (!this.hasVertex(vertexId)) return []
    return [...this.#adjacencyList.get(vertexId).keys()]
  }

  /** Return fresh neighbor/weight records; mutating them cannot change the graph. */
  getWeightedNeighbors(vertexId) {
    if (!this.hasVertex(vertexId)) return []
    return [...this.#adjacencyList.get(vertexId)].map(([neighborId, weight]) => ({ neighborId, weight }))
  }

  getVertices() {
    return [...this.#adjacencyList.keys()]
  }

  hasEdge(firstVertexId, secondVertexId) {
    return this.#adjacencyList.get(firstVertexId)?.has(secondVertexId) ?? false
  }

  /** Return the edge weight, or undefined when the edge does not exist. */
  getEdgeWeight(firstVertexId, secondVertexId) {
    return this.#adjacencyList.get(firstVertexId)?.get(secondVertexId)
  }

  removeEdge(firstVertexId, secondVertexId) {
    const firstNeighbors = this.#adjacencyList.get(firstVertexId)
    const secondNeighbors = this.#adjacencyList.get(secondVertexId)
    if (!firstNeighbors || !secondNeighbors || !firstNeighbors.has(secondVertexId)) return false

    firstNeighbors.delete(secondVertexId)
    secondNeighbors.delete(firstVertexId)
    return true
  }

  breadthFirstSearch(startVertexId, targetVertexId = undefined) {
    if (!this.hasVertex(startVertexId)) {
      return this.#invalidBfsResult(startVertexId, targetVertexId, `Start vertex "${startVertexId}" does not exist.`)
    }
    if (targetVertexId !== undefined && !this.hasVertex(targetVertexId)) {
      return this.#invalidBfsResult(startVertexId, targetVertexId, `Target vertex "${targetVertexId}" does not exist.`)
    }

    const queue = [startVertexId]
    let head = 0
    const visited = new Set([startVertexId])
    const parents = new Map([[startVertexId, null]])
    const traversalOrder = []

    while (head < queue.length) {
      const currentVertex = queue[head]
      head += 1
      traversalOrder.push(currentVertex)

      const neighbors = this.getNeighbors(currentVertex).sort()
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        parents.set(neighbor, currentVertex)
        queue.push(neighbor)
      }
    }

    const targetSelected = targetVertexId !== undefined
    const targetReachable = targetSelected ? parents.has(targetVertexId) : null
    const route = targetSelected && targetReachable
      ? this.#reconstructRoute(startVertexId, targetVertexId, parents)
      : targetSelected ? [] : null

    return {
      valid: true,
      error: null,
      startVertexId,
      targetVertexId: targetSelected ? targetVertexId : null,
      traversalOrder,
      parents,
      route,
      targetReachable,
      visitedCount: traversalOrder.length,
    }
  }

  depthFirstSearch(startVertexId, targetVertexId = undefined) {
    if (!this.hasVertex(startVertexId)) {
      return {
        valid: false,
        error: `Start vertex "${startVertexId}" does not exist.`,
        startVertexId,
        targetVertexId: targetVertexId ?? null,
        traversalOrder: [],
        parents: new Map(),
        route: targetVertexId === undefined ? null : [],
        targetReachable: targetVertexId === undefined ? null : false,
        visitedCount: 0,
      }
    }
    if (targetVertexId !== undefined && !this.hasVertex(targetVertexId)) {
      return {
        valid: false,
        error: `Target vertex "${targetVertexId}" does not exist.`,
        startVertexId,
        targetVertexId,
        traversalOrder: [],
        parents: new Map(),
        route: [],
        targetReachable: false,
        visitedCount: 0,
      }
    }

    const traversalOrder = [startVertexId]
    const visited = new Set([startVertexId])
    const parents = new Map([[startVertexId, null]])
    const stack = [{ vertexId: startVertexId, neighbors: this.getNeighbors(startVertexId).sort(), nextNeighborIndex: 0 }]

    // A frame-based stack mirrors recursive preorder DFS while avoiding call-stack limits.
    while (stack.length > 0) {
      const currentFrame = stack[stack.length - 1]
      if (currentFrame.nextNeighborIndex >= currentFrame.neighbors.length) {
        stack.pop()
        continue
      }

      const nextVertexId = currentFrame.neighbors[currentFrame.nextNeighborIndex]
      currentFrame.nextNeighborIndex += 1
      if (visited.has(nextVertexId)) continue

      visited.add(nextVertexId)
      parents.set(nextVertexId, currentFrame.vertexId)
      traversalOrder.push(nextVertexId)
      stack.push({
        vertexId: nextVertexId,
        neighbors: this.getNeighbors(nextVertexId).sort(),
        nextNeighborIndex: 0,
      })
    }

    const targetSelected = targetVertexId !== undefined
    const targetReachable = targetSelected ? parents.has(targetVertexId) : null
    const route = targetSelected && targetReachable
      ? this.#reconstructRoute(startVertexId, targetVertexId, parents)
      : targetSelected ? [] : null

    return {
      valid: true,
      error: null,
      startVertexId,
      targetVertexId: targetSelected ? targetVertexId : null,
      traversalOrder,
      parents,
      route,
      targetReachable,
      visitedCount: traversalOrder.length,
    }
  }

  #assertVerticesExist(firstVertexId, secondVertexId) {
    if (!this.hasVertex(firstVertexId)) {
      throw new Error(`Cannot add edge: vertex "${firstVertexId}" does not exist.`)
    }
    if (!this.hasVertex(secondVertexId)) {
      throw new Error(`Cannot add edge: vertex "${secondVertexId}" does not exist.`)
    }
  }

  #invalidBfsResult(startVertexId, targetVertexId, error) {
    return {
      valid: false,
      error,
      startVertexId,
      targetVertexId: targetVertexId ?? null,
      traversalOrder: [],
      parents: new Map(),
      route: null,
      targetReachable: null,
      visitedCount: 0,
    }
  }

  #reconstructRoute(startVertexId, targetVertexId, parents) {
    const route = []
    let currentVertex = targetVertexId
    while (currentVertex !== null) {
      route.push(currentVertex)
      currentVertex = parents.get(currentVertex)
    }
    route.reverse()
    return route[0] === startVertexId ? route : []
  }
}

function canonicalEdgeKey(firstId, secondId) {
  return JSON.stringify([firstId, secondId].sort())
}

/** Build a graph from location data and optional unique corridor-weight records. */
export function createGraphFromLocations(locations, corridorWeights = []) {
  if (!Array.isArray(locations)) {
    throw new TypeError('Locations must be provided as an array.')
  }
  if (!Array.isArray(corridorWeights)) {
    throw new TypeError('Corridor weights must be provided as an array.')
  }

  const graph = new Graph()
  for (const location of locations) {
    if (!location || typeof location.id !== 'string' || location.id.trim() === '') {
      throw new TypeError('Every location must have a non-empty string ID.')
    }
    if (!graph.addVertex(location.id)) {
      throw new Error(`Duplicate location ID "${location.id}" cannot be used as a graph vertex.`)
    }
  }

  for (const location of locations) {
    if (!Array.isArray(location.connectedLocationIds)) {
      throw new TypeError(`Location "${location.id}" must provide connectedLocationIds as an array.`)
    }
    for (const neighborId of location.connectedLocationIds) {
      if (!graph.hasVertex(neighborId)) {
        throw new Error(`Invalid connection from "${location.id}" to "${neighborId}": location ID does not exist.`)
      }
      graph.addEdge(location.id, neighborId)
    }
  }

  const configuredEdges = new Set()
  for (const corridor of corridorWeights) {
    if (!corridor || typeof corridor !== 'object') {
      throw new TypeError('Each corridor weight must be an object with from, to, and weight fields.')
    }
    const { from, to, weight } = corridor
    if (!graph.hasVertex(from) || !graph.hasVertex(to)) {
      throw new Error(`Invalid weighted corridor from "${from}" to "${to}": location ID does not exist.`)
    }
    if (!graph.hasEdge(from, to)) {
      throw new Error(`Invalid weighted corridor from "${from}" to "${to}": corridor does not exist in location connections.`)
    }
    const key = canonicalEdgeKey(from, to)
    if (configuredEdges.has(key)) {
      throw new Error(`Duplicate corridor weight configuration for "${from}" and "${to}".`)
    }
    graph.updateEdgeWeight(from, to, weight)
    configuredEdges.add(key)
  }

  return graph
}
