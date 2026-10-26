import { useMemo, useState } from 'react'
import GraphVisualization from './GraphVisualization.jsx'
import { createGraphFromLocations } from '../dsa/Graph.js'
import { compareBfsAndDijkstra, runGraphAlgorithmWithCounts } from '../analytics/algorithmOperations.js'

function edgeKey(firstId, secondId) {
  return [firstId, secondId].sort().join('|')
}

function formatLocations(vertexIds, locationById) {
  return vertexIds.map((id) => `${locationById.get(id)?.name ?? id} (${id})`).join(' \u2192 ')
}

function routeWeight(graph, route) {
  if (!graph || route.length === 0) return null
  return route.slice(1).reduce((total, vertexId, index) => (
    total + graph.getEdgeWeight(route[index], vertexId)
  ), 0)
}

function routeEdgeKeys(route) {
  return new Set(route.slice(1).map((vertexId, index) => edgeKey(route[index], vertexId)))
}

function GraphExplorer({ locations, corridorWeights = [], discoveredEvidenceIds = new Set(), onSelectLocation }) {
  const graphState = useMemo(() => {
    try {
      return { graph: createGraphFromLocations(locations, corridorWeights), error: null }
    } catch (error) {
      return { graph: null, error: error.message }
    }
  }, [locations, corridorWeights])
  const [startLocationId, setStartLocationId] = useState(() => locations[0]?.id ?? '')
  const [targetLocationId, setTargetLocationId] = useState(() => locations.length > 1 ? locations[locations.length - 1].id : '')
  const [selectedMapLocationId, setSelectedMapLocationId] = useState(null)
  const [algorithmRun, setAlgorithmRun] = useState(null)

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations])
  const graph = graphState.graph
  const vertices = graph?.getVertices() ?? []
  const adjacentLocationIds = useMemo(
    () => new Set(graph && selectedMapLocationId ? graph.getNeighbors(selectedMapLocationId) : []),
    [graph, selectedMapLocationId],
  )
  const locationsWithDiscoveredEvidence = useMemo(() => new Set(locations
    .filter((location) => location.evidenceIds?.some((evidenceId) => discoveredEvidenceIds.has(evidenceId)))
    .map((location) => location.id)), [locations, discoveredEvidenceIds])
  const edges = useMemo(() => {
    if (!graph) return []
    return graph.getVertices().flatMap((vertexId) => graph.getWeightedNeighbors(vertexId)
      .filter(({ neighborId }) => vertexId.localeCompare(neighborId) < 0)
      .map(({ neighborId, weight }) => ({ firstId: vertexId, secondId: neighborId, weight })))
  }, [graph])

  const isComparison = algorithmRun?.algorithm === 'COMPARE'
  const isTraversalComparison = algorithmRun?.algorithm === 'TRAVERSAL_COMPARE'
  const bfsResult = isComparison || isTraversalComparison ? algorithmRun.bfsResult : null
  const dfsResult = isTraversalComparison ? algorithmRun.dfsResult : null
  const highlightedTraversal = algorithmRun?.highlightedTraversal === 'DFS' ? dfsResult : bfsResult
  const result = isComparison
    ? algorithmRun.dijkstraResult
    : isTraversalComparison ? highlightedTraversal : algorithmRun?.result ?? null
  const dijkstraResult = isComparison || algorithmRun?.algorithm === 'DIJKSTRA' ? result : null
  const visitedOrder = result?.visitedOrder ?? result?.traversalOrder ?? []
  const visitedIds = useMemo(() => new Set(visitedOrder), [visitedOrder])
  const bfsRoute = bfsResult?.targetReachable ? bfsResult.route : []
  const dijkstraRoute = dijkstraResult?.found ? dijkstraResult.path : []
  const isBfsRun = algorithmRun?.algorithm === 'BFS' || (isTraversalComparison && algorithmRun.highlightedTraversal !== 'DFS')
  const isDfsRun = algorithmRun?.algorithm === 'DFS' || (isTraversalComparison && algorithmRun.highlightedTraversal === 'DFS')
  const primaryRoute = isBfsRun && result?.targetReachable
    ? result.route
    : isDfsRun && result?.targetReachable ? result.route
    : dijkstraResult?.found ? dijkstraResult.path : []
  const secondaryRoute = isComparison ? bfsRoute : []
  const primaryRouteAlgorithm = isBfsRun ? 'BFS' : isDfsRun ? 'DFS' : 'DIJKSTRA'
  const routeIds = useMemo(() => new Set(primaryRoute), [primaryRoute])
  const routeEdges = useMemo(() => routeEdgeKeys(primaryRoute), [primaryRoute])
  const secondaryRouteIds = useMemo(() => new Set(secondaryRoute), [secondaryRoute])
  const secondaryRouteEdges = useMemo(() => routeEdgeKeys(secondaryRoute), [secondaryRoute])
  const currentLocationId = result?.valid && visitedOrder.length ? visitedOrder[visitedOrder.length - 1] : null

  const clearResult = () => setAlgorithmRun(null)
  const runBfs = () => {
    if (!graph || !startLocationId) return
    setAlgorithmRun({ algorithm: 'BFS', ...runGraphAlgorithmWithCounts(graph, 'BFS', startLocationId, targetLocationId) })
  }
  const runDfs = () => {
    if (!graph || !startLocationId) return
    setAlgorithmRun({ algorithm: 'DFS', ...runGraphAlgorithmWithCounts(graph, 'DFS', startLocationId, targetLocationId) })
  }
  const runDijkstra = () => {
    if (!graph || !startLocationId || !targetLocationId) return
    setAlgorithmRun({ algorithm: 'DIJKSTRA', ...runGraphAlgorithmWithCounts(graph, 'DIJKSTRA', startLocationId, targetLocationId) })
  }
  const runComparison = () => {
    if (!graph || !startLocationId || !targetLocationId) return
    const comparison = compareBfsAndDijkstra(graph, startLocationId, targetLocationId)
    setAlgorithmRun({
      algorithm: 'COMPARE',
      bfsResult: comparison.bfs.result,
      bfsAdjacencyEntriesExamined: comparison.bfs.adjacencyEntriesExamined,
      dijkstraResult: comparison.dijkstra.result,
      dijkstraAdjacencyEntriesExamined: comparison.dijkstra.adjacencyEntriesExamined,
    })
  }
  const runTraversalComparison = () => {
    if (!graph || !startLocationId) return
    const bfs = runGraphAlgorithmWithCounts(graph, 'BFS', startLocationId, targetLocationId)
    const dfs = runGraphAlgorithmWithCounts(graph, 'DFS', startLocationId, targetLocationId)
    setAlgorithmRun({
      algorithm: 'TRAVERSAL_COMPARE',
      bfsResult: bfs.result,
      bfsAdjacencyEntriesExamined: bfs.adjacencyEntriesExamined,
      dfsResult: dfs.result,
      dfsAdjacencyEntriesExamined: dfs.adjacencyEntriesExamined,
      highlightedTraversal: 'BFS',
    })
  }
  const highlightTraversal = (traversal) => {
    setAlgorithmRun((current) => current?.algorithm === 'TRAVERSAL_COMPARE'
      ? { ...current, highlightedTraversal: traversal }
      : current)
  }
  const changeStartLocation = (locationId) => {
    setStartLocationId(locationId)
    clearResult()
  }
  const selectMapLocation = (locationId) => {
    setSelectedMapLocationId(locationId)
    changeStartLocation(locationId)
    onSelectLocation?.(locationId)
  }
  const changeTargetLocation = (locationId) => {
    setTargetLocationId(locationId)
    clearResult()
  }

  const algorithmTitle = {
    BFS: 'Breadth-First Search',
    DFS: 'Depth-First Search',
    DIJKSTRA: "Dijkstra's Shortest Path",
    COMPARE: 'BFS and Dijkstra comparison',
    TRAVERSAL_COMPARE: 'BFS and DFS traversal comparison',
  }

  return (
    <section aria-labelledby="graph-explorer-title" className="investigation-section graph-explorer" id="crime-scene-map">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">PHYSICAL CRIME SCENE</span>
          <h2 id="graph-explorer-title">Crime Scene Map</h2>
          <span className="algorithm-tag">Graph · Dijkstra shortest path</span>
        </div>
        <span className="section-count">{vertices.length} locations · {edges.length} corridors</span>
      </div>
      <p className="section-intro">Select a location to inspect its existing record and highlight adjacent rooms. Markers identify locations with at least one discovered clue; sealed clue details stay out of this map. Corridor costs are illustrative travel units, not measured distances.</p>

      {graphState.error ? (
        <p className="graph-error" role="alert">The mansion graph could not be built: {graphState.error}</p>
      ) : vertices.length === 0 ? (
        <p className="graph-empty">No mansion locations are available to explore.</p>
      ) : (
        <div className="graph-explorer-layout">
          <div className="graph-map-column">
            <GraphVisualization
              currentLocationId={currentLocationId}
              adjacentLocationIds={adjacentLocationIds}
              discoveredLocationIds={locationsWithDiscoveredEvidence}
              edges={edges}
              locations={locations}
              onSelectStart={selectMapLocation}
              primaryRouteAlgorithm={primaryRouteAlgorithm}
              routeEdges={routeEdges}
              routeIds={routeIds}
              secondaryRouteAlgorithm="BFS"
              secondaryRouteEdges={secondaryRouteEdges}
              secondaryRouteIds={secondaryRouteIds}
              startLocationId={startLocationId}
              selectedLocationId={selectedMapLocationId}
              targetLocationId={targetLocationId}
              visitedIds={visitedIds}
            />
            <ul aria-label="Graph visualization legend" className="graph-legend">
              <li><span className="legend-swatch is-start" />Start</li>
              <li><span className="legend-swatch is-target" />Destination</li>
              <li><span className="legend-swatch is-visited" />Visited / finalized</li>
              <li><span className="legend-swatch is-current" />Current (last finalized)</li>
              <li><span className="legend-swatch is-adjacent" />Adjacent to selected room</li>
              <li><span aria-hidden="true" className="legend-inspected-mark">•</span>Discovered clue at location</li>
              {(isBfsRun || isComparison) && <li><span className="legend-swatch is-bfs-route" />BFS fewest edges</li>}
              {isDfsRun && <li><span className="legend-swatch is-dfs-route" />DFS tree route</li>}
              {(algorithmRun?.algorithm === 'DIJKSTRA' || isComparison) && <li><span className="legend-swatch is-dijkstra-route" />Dijkstra least cost</li>}
              <li><span className="legend-weight-swatch">n</span>Corridor cost</li>
            </ul>
          </div>

          <div className="graph-control-column">
            <div className="graph-controls">
              <label className="graph-control-label" htmlFor="graph-start-location">Starting location</label>
              <select
                id="graph-start-location"
                onChange={(event) => changeStartLocation(event.target.value)}
                value={startLocationId}
              >
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
              </select>
              <label className="graph-control-label" htmlFor="graph-target-location">Destination</label>
              <select
                id="graph-target-location"
                onChange={(event) => changeTargetLocation(event.target.value)}
                value={targetLocationId}
              >
                <option value="">No destination selected</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
              </select>
              <div className="graph-action-row">
                <button className="button button-primary graph-run-button" disabled={!graph || !startLocationId} onClick={runBfs} type="button">Run BFS</button>
                <button className="button button-secondary graph-run-button" disabled={!graph || !startLocationId} onClick={runDfs} type="button">Run DFS</button>
                <button className="button button-secondary graph-run-button" disabled={!graph || !startLocationId} onClick={runTraversalComparison} type="button">Compare BFS and DFS</button>
                <button className="button button-secondary graph-run-button" disabled={!graph || !startLocationId || !targetLocationId} onClick={runDijkstra} type="button">Run Dijkstra</button>
                <button className="button button-secondary graph-run-button" disabled={!graph || !startLocationId || !targetLocationId} onClick={runComparison} type="button">Compare BFS and Dijkstra</button>
              </div>
              <button className="graph-reset-button" disabled={!algorithmRun} onClick={clearResult} type="button">Reset visualization</button>
              <p className="graph-control-hint">Neighbors are processed by ascending location ID for repeatable BFS and DFS traversals. Counters show adjacency entries processed by algorithm loops, not time; each undirected corridor contributes two entries. BFS/DFS take O(V + E); Dijkstra uses a binary heap and takes O((V + E) log V).</p>
            </div>

            <section aria-live="polite" aria-labelledby="graph-results-title" className="graph-results">
              <div className="graph-results-heading">
                <span className="section-kicker">ALGORITHM RESULTS</span>
                <h3 id="graph-results-title">{algorithmRun ? algorithmTitle[algorithmRun.algorithm] : 'Ready to explore'}</h3>
              </div>
              {!algorithmRun ? (
                <p className="graph-result-copy">Run BFS to find a route with the fewest corridor edges, run Dijkstra to minimize total corridor cost, or compare both results for the same locations.</p>
              ) : !result?.valid ? (
                <p className="graph-error" role="alert">{result?.error ?? 'The requested graph operation could not be completed.'}</p>
              ) : (
                <>
                  <dl className="graph-result-meta">
                    <div><dt>Starting location</dt><dd>{locationById.get(startLocationId)?.name ?? startLocationId}</dd></div>
                    {targetLocationId && (
                      <div><dt>Destination</dt><dd>{locationById.get(targetLocationId)?.name ?? targetLocationId}</dd></div>
                    )}
                    <div><dt>Vertices visited / finalized</dt><dd>{result.visitedCount} of {vertices.length}</dd></div>
                    {!isComparison && !isTraversalComparison && <div><dt>Adjacency entries examined</dt><dd>{algorithmRun.adjacencyEntriesExamined}</dd></div>}
                  </dl>

                  {algorithmRun.algorithm === 'BFS' && (
                    <>
                      <div className="graph-result-block">
                        <span className="detail-label">Traversal order</span>
                        <p>{formatLocations(result.traversalOrder, locationById)}</p>
                      </div>
                      {result.targetVertexId && (
                        <div className="graph-result-block">
                          <span className="detail-label">Fewest-edge route</span>
                          {result.targetReachable
                            ? <><p>{formatLocations(result.route, locationById)}</p><p className="route-edge-count">{result.route.length - 1} edges · total corridor cost {routeWeight(graph, result.route)}</p></>
                            : <p className="graph-unreachable">No route connects these locations in the current graph.</p>}
                        </div>
                      )}
                      <p className="graph-result-copy">BFS explores by distance in number of edges. Its route minimizes the edge count, not the sum of corridor costs.</p>
                    </>
                  )}

                  {isTraversalComparison && (
                    <>
                      <div className="graph-comparison-grid">
                        <article className="graph-comparison-card bfs-comparison-card">
                          <h4>BFS · level by level</h4>
                          <p>{formatLocations(bfsResult.traversalOrder, locationById)}</p>
                          <small>{bfsResult.visitedCount} vertices · {algorithmRun.bfsAdjacencyEntriesExamined} adjacency entries examined</small>
                          {targetLocationId && bfsResult.targetReachable && <small>Route: {formatLocations(bfsResult.route, locationById)} · {bfsResult.route.length - 1} edges</small>}
                          <button className="graph-reset-button" aria-pressed={algorithmRun.highlightedTraversal === 'BFS'} onClick={() => highlightTraversal('BFS')} type="button">Highlight BFS traversal</button>
                        </article>
                        <article className="graph-comparison-card dijkstra-comparison-card">
                          <h4>DFS · depth before backtracking</h4>
                          <p>{formatLocations(dfsResult.traversalOrder, locationById)}</p>
                          <small>{dfsResult.visitedCount} vertices · {algorithmRun.dfsAdjacencyEntriesExamined} adjacency entries examined</small>
                          {targetLocationId && dfsResult.targetReachable && <small>Discovery-tree route: {formatLocations(dfsResult.route, locationById)} · not a shortest-path guarantee</small>}
                          <button className="graph-reset-button" aria-pressed={algorithmRun.highlightedTraversal === 'DFS'} onClick={() => highlightTraversal('DFS')} type="button">Highlight DFS traversal</button>
                        </article>
                      </div>
                      <p className="graph-result-copy">Both traverse the reachable component. BFS uses a queue to visit layers; DFS uses a stack to follow a branch before backtracking. Neither changes the graph.</p>
                    </>
                  )}

                  {algorithmRun.algorithm === 'DFS' && (
                    <>
                      <div className="graph-result-block">
                        <span className="detail-label">Traversal order</span>
                        <p>{formatLocations(result.traversalOrder, locationById)}</p>
                      </div>
                      <div className="graph-result-block">
                        <span className="detail-label">DFS discovery-tree route</span>
                        {result.targetVertexId && result.targetReachable
                          ? <><p>{formatLocations(result.route, locationById)}</p><p className="route-edge-count">{result.route.length - 1} edges · {routeWeight(graph, result.route)} travel units; DFS does not optimize route length or cost</p></>
                          : result.targetVertexId
                            ? <p className="graph-unreachable">The destination is not reachable from the selected start.</p>
                            : <p>Select a destination to show the route found by DFS.</p>}
                      </div>
                      <p className="graph-result-copy">DFS follows the lowest-ID available neighbor as far as possible, then backtracks. This traversal does not find a shortest route.</p>
                    </>
                  )}

                  {algorithmRun.algorithm === 'DIJKSTRA' && (
                    <>
                      <div className="graph-result-block">
                        <span className="detail-label">Finalized order</span>
                        <p>{formatLocations(result.visitedOrder, locationById)}</p>
                      </div>
                      <div className="graph-result-block">
                        <span className="detail-label">Minimum-total-cost route</span>
                        {result.found
                          ? <><p>{formatLocations(result.path, locationById)}</p><p className="route-edge-count">Total cost: {result.totalCost} travel units · {result.path.length - 1} edges</p></>
                          : <p className="graph-unreachable">{result.message}</p>}
                      </div>
                      <p className="graph-result-copy">Dijkstra finalizes the nearest unsettled location and relaxes its outgoing corridors. With non-negative weights, the resulting route minimizes the sum of corridor costs.</p>
                    </>
                  )}

                  {isComparison && (
                    <>
                      <div className="graph-result-block">
                        <span className="detail-label">Dijkstra finalized order</span>
                        <p>{formatLocations(result.visitedOrder, locationById)}</p>
                      </div>
                      <div className="graph-comparison-grid">
                        <article className="graph-comparison-card bfs-comparison-card">
                          <h4>BFS · fewest edges</h4>
                          {bfsResult.targetReachable
                            ? <><p>{formatLocations(bfsResult.route, locationById)}</p><small>{bfsResult.route.length - 1} edges · total weight {routeWeight(graph, bfsResult.route)}</small></>
                            : <p className="graph-unreachable">No route found.</p>}
                          <small>{bfsResult.visitedCount} vertices visited · {algorithmRun.bfsAdjacencyEntriesExamined} adjacency entries examined</small>
                        </article>
                        <article className="graph-comparison-card dijkstra-comparison-card">
                          <h4>Dijkstra · least total cost</h4>
                          {result.found
                            ? <><p>{formatLocations(result.path, locationById)}</p><small>{result.path.length - 1} edges · total weight {result.totalCost}</small></>
                            : <p className="graph-unreachable">No route found.</p>}
                          <small>{result.visitedCount} vertices finalized · {algorithmRun.dijkstraAdjacencyEntriesExamined} adjacency entries examined</small>
                        </article>
                      </div>
                      <div className="graph-result-block">
                        <span className="detail-label">Route comparison</span>
                        <p>{!bfsResult.targetReachable && !result.found
                          ? 'Neither algorithm found a route between these locations.'
                          : JSON.stringify(bfsResult.route ?? []) === JSON.stringify(result.path)
                            ? 'Both algorithms returned the same route.'
                            : 'The algorithms returned different routes.'}</p>
                      </div>
                      <p className="graph-result-copy">BFS optimizes edge count in an unweighted view. Dijkstra minimizes total weight across non-negative corridor costs, so a BFS route can cost more when corridor weights differ. The values here are illustrative travel units.</p>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  )
}

export default GraphExplorer
