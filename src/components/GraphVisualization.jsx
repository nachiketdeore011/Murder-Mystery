import { useEffect, useState } from 'react'

const NODE_POSITIONS = {
  L001: { x: 380, y: 70 },
  L002: { x: 390, y: 220 },
  L003: { x: 140, y: 290 },
  L004: { x: 320, y: 365 },
  L005: { x: 610, y: 340 },
  L006: { x: 625, y: 140 },
}

const COMPACT_NODE_POSITIONS = {
  L001: { x: 200, y: 70 },
  L002: { x: 320, y: 190 },
  L003: { x: 320, y: 350 },
  L004: { x: 200, y: 470 },
  L005: { x: 80, y: 350 },
  L006: { x: 80, y: 190 },
}

function getWeightLabelPositions(edges, locations, nodePositions) {
  const positions = new Map()
  const occupiedLabels = []
  const fractions = [0.5, 0.36, 0.64, 0.25, 0.75, 0.15, 0.85]

  for (const { firstId, secondId } of edges) {
    const first = nodePositions[firstId]
    const second = nodePositions[secondId]
    if (!first || !second) continue
    let selected = null
    for (const fraction of fractions) {
      const candidate = {
        x: first.x + (second.x - first.x) * fraction,
        y: first.y + (second.y - first.y) * fraction,
      }
      const overlapsNode = locations.some((location) => {
        const node = nodePositions[location.id]
        return node && Math.abs(candidate.x - node.x) < 86 && Math.abs(candidate.y - node.y) < 38
      })
      const overlapsLabel = occupiedLabels.some((label) => (
        Math.abs(candidate.x - label.x) < 30 && Math.abs(candidate.y - label.y) < 22
      ))
      if (!overlapsNode && !overlapsLabel) {
        selected = candidate
        break
      }
    }
    selected ??= { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    const key = `${firstId}|${secondId}`
    positions.set(key, selected)
    occupiedLabels.push(selected)
  }
  return positions
}

function GraphVisualization({
  locations,
  edges,
  adjacentLocationIds = new Set(),
  discoveredLocationIds = new Set(),
  selectedLocationId = null,
  startLocationId,
  targetLocationId,
  visitedIds,
  routeIds,
  routeEdges,
  secondaryRouteIds,
  secondaryRouteEdges,
  primaryRouteAlgorithm,
  secondaryRouteAlgorithm,
  currentLocationId,
  onSelectStart,
}) {
  const [isCompact, setIsCompact] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches
  ))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 520px)')
    const updateLayout = (event) => setIsCompact(event.matches)
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  const nodePositions = isCompact ? COMPACT_NODE_POSITIONS : NODE_POSITIONS
  const weightLabelPositions = getWeightLabelPositions(edges, locations, nodePositions)

  return (
    <figure className="graph-figure">
      <svg
        aria-labelledby="mansion-graph-title mansion-graph-description"
        className="mansion-graph-svg"
        role="group"
        viewBox={isCompact ? '0 0 400 540' : '0 0 760 440'}
      >
        <title id="mansion-graph-title">Malhotra Mansion location graph</title>
        <desc id="mansion-graph-description">
          Six locations connected by weighted, undirected corridors. Labels show illustrative travel costs. Select a node to set the starting location; colors reflect traversal and route results.
        </desc>
        <g aria-hidden="true" className="graph-edges">
          {edges.map(({ firstId, secondId }) => {
            const first = nodePositions[firstId]
            const second = nodePositions[secondId]
            if (!first || !second) return null
            const edgeKey = `${firstId}|${secondId}`
            const isPrimaryRouteEdge = routeEdges.has(edgeKey)
            const isSecondaryRouteEdge = secondaryRouteEdges.has(edgeKey)
            const primaryClass = isPrimaryRouteEdge ? ` is-route is-${primaryRouteAlgorithm.toLowerCase()}-route` : ''
            const secondaryClass = isSecondaryRouteEdge ? ` is-${secondaryRouteAlgorithm.toLowerCase()}-route` : ''
            return (
              <line
                className={`graph-edge${primaryClass}${secondaryClass}`}
                key={edgeKey}
                x1={first.x}
                x2={second.x}
                y1={first.y}
                y2={second.y}
              />
            )
          })}
        </g>

        <g aria-hidden="true" className="graph-edge-labels">
          {edges.map(({ firstId, secondId, weight }) => {
            const position = weightLabelPositions.get(`${firstId}|${secondId}`)
            if (!position) return null
            return (
              <g className="graph-edge-weight" key={`${firstId}|${secondId}-weight`} transform={`translate(${position.x} ${position.y})`}>
                <rect height="18" rx="2" width="28" x="-14" y="-9" />
                <text dominantBaseline="central" textAnchor="middle" y="0">{weight}</text>
              </g>
            )
          })}
        </g>

        {locations.map((location) => {
          const position = nodePositions[location.id]
          if (!position) return null
          const isStart = location.id === startLocationId
          const isTarget = location.id === targetLocationId
          const isVisited = visitedIds.has(location.id)
          const isPrimaryRoute = routeIds.has(location.id)
          const isSecondaryRoute = secondaryRouteIds.has(location.id)
          const isRoute = isPrimaryRoute || isSecondaryRoute
          const isCurrent = location.id === currentLocationId
          const isAdjacent = adjacentLocationIds.has(location.id)
          const isSelected = location.id === selectedLocationId
          const hasDiscoveredEvidence = discoveredLocationIds.has(location.id)
          const stateClasses = [
            'graph-node',
            isStart && 'is-start',
            isTarget && 'is-target',
            isVisited && 'is-visited',
            isAdjacent && 'is-adjacent',
            isSelected && 'is-selected-location',
            isRoute && 'is-route',
            isPrimaryRoute && `is-${primaryRouteAlgorithm.toLowerCase()}-route`,
            isSecondaryRoute && `is-${secondaryRouteAlgorithm.toLowerCase()}-route`,
            isCurrent && 'is-current',
          ].filter(Boolean).join(' ')

          return (
            <g
              aria-label={`Inspect ${location.name} and set it as the starting location${isStart ? ', currently selected' : ''}${hasDiscoveredEvidence ? ', has discovered evidence' : ''}`}
              aria-pressed={isStart}
              className={stateClasses}
              key={location.id}
              onClick={() => onSelectStart(location.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectStart(location.id)
                }
              }}
              role="button"
              tabIndex={0}
            >
              {isCurrent && <rect className="graph-current-ring" height="74" rx="5" width="156" x={position.x - 78} y={position.y - 37} />}
              {isRoute && <rect className="graph-route-ring" height="68" rx="4" width="150" x={position.x - 75} y={position.y - 34} />}
              <rect className="graph-node-body" height="58" rx="3" width="142" x={position.x - 71} y={position.y - 29} />
              {hasDiscoveredEvidence && <circle aria-hidden="true" className="graph-discovered-marker" cx={position.x + 61} cy={position.y - 19} r="4" />}
              <text className="graph-node-id" textAnchor="middle" x={position.x} y={position.y - 5}>{location.id}</text>
              <text className="graph-node-name" textAnchor="middle" x={position.x} y={position.y + 14}>{location.name}</text>
              {isStart && <text className="graph-node-tag start-tag" textAnchor="middle" x={position.x} y={position.y - 39}>START</text>}
              {isTarget && <text className="graph-node-tag target-tag" textAnchor="middle" x={position.x} y={position.y + 43}>DESTINATION</text>}
            </g>
          )
        })}
      </svg>
      <figcaption className="graph-caption">Select a location node to inspect its existing record, highlight adjacent rooms, and set the route starting point.</figcaption>
    </figure>
  )
}

export default GraphVisualization
