import { useEffect, useMemo, useState } from 'react'
import {
  createEvidenceRelationshipNetwork,
  EVIDENCE_RELATIONSHIP_TYPES,
} from '../data/crimeSceneNetwork.js'

const NODE_TYPES = [
  { id: 'suspect', label: 'Suspects' },
  { id: 'location', label: 'Locations' },
  { id: 'evidence', label: 'Discovered evidence' },
  { id: 'timeline', label: 'Timeline reports' },
]

const COLUMN_X = { suspect: 115, location: 335, evidence: 555, timeline: 775 }
const NODE_WIDTH = 184
const NODE_HEIGHT = 56

function wrapNodeLabel(value) {
  const words = String(value || '').split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const currentLine = lines[lines.length - 1]
    if (`${currentLine} ${word}`.trim().length <= 23) {
      lines[lines.length - 1] = `${currentLine} ${word}`.trim()
    } else if (lines.length < 2) {
      lines.push(word)
    }
  }
  if (lines[1] && words.join(' ').length > lines.join(' ').length) {
    lines[1] = `${lines[1].slice(0, 20)}…`
  }
  return lines
}

function EvidenceRelationshipNetwork({
  caseFile,
  caseIndex,
  discoveredEvidenceIds,
  onOpenRecord,
  onSelectTimelineEvent,
  onRequestJournalEntry,
}) {
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all')
  const [relationshipFilter, setRelationshipFilter] = useState('all')
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  const network = useMemo(
    () => createEvidenceRelationshipNetwork(caseFile, discoveredEvidenceIds),
    [caseFile, discoveredEvidenceIds],
  )
  const visibleNodes = useMemo(
    () => network.nodes.filter((node) => nodeTypeFilter === 'all' || node.type === nodeTypeFilter),
    [network.nodes, nodeTypeFilter],
  )
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(({ id }) => id)), [visibleNodes])
  const visibleEdges = useMemo(() => network.edges.filter((edge) => (
    (relationshipFilter === 'all' || edge.type === relationshipFilter)
    && visibleNodeIds.has(edge.from)
    && visibleNodeIds.has(edge.to)
  )), [network.edges, relationshipFilter, visibleNodeIds])

  useEffect(() => {
    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) setSelectedNodeId(null)
  }, [selectedNodeId, visibleNodeIds])

  const layout = useMemo(() => {
    const grouped = Object.fromEntries(NODE_TYPES.map(({ id }) => [id, []]))
    visibleNodes.forEach((node) => grouped[node.type]?.push(node))
    const positions = new Map()
    let maxCount = 0
    for (const { id } of NODE_TYPES) {
      maxCount = Math.max(maxCount, grouped[id].length)
      grouped[id].forEach((node, index) => {
        positions.set(node.id, { x: COLUMN_X[id], y: 60 + index * 78 })
      })
    }
    return { positions, height: Math.max(310, 94 + maxCount * 78) }
  }, [visibleNodes])

  const selectedNode = visibleNodes.find(({ id }) => id === selectedNodeId) ?? null
  const selectedRecord = selectedNode
    ? selectedNode.type === 'suspect' ? caseIndex.getSuspectById(selectedNode.recordId)
      : selectedNode.type === 'location' ? caseIndex.getLocationById(selectedNode.recordId)
        : selectedNode.type === 'evidence' && discoveredEvidenceIds.has(selectedNode.recordId)
          ? caseIndex.getEvidenceById(selectedNode.recordId)
          : selectedNode.type === 'timeline' ? caseIndex.getTimelineEventById(selectedNode.recordId) : null
    : null
  const selectedEdges = selectedNode
    ? network.edges.filter(({ from, to }) => from === selectedNode.id || to === selectedNode.id)
    : []
  const connectedNodeIds = useMemo(() => new Set(selectedEdges.flatMap(({ from, to }) => [from, to])), [selectedEdges])
  const connectedSuspectIds = selectedNode?.type === 'evidence'
    ? selectedEdges.filter(({ type }) => type === 'profile-follow-up')
      .map((edge) => edge.from === selectedNode.id ? edge.to : edge.from)
      .map((id) => id.replace(/^suspect:/, ''))
    : []

  const clearFilters = () => {
    setNodeTypeFilter('all')
    setRelationshipFilter('all')
    setSelectedNodeId(null)
  }

  const openSelectedRecord = () => {
    if (!selectedNode) return
    if (selectedNode.type === 'timeline') {
      onSelectTimelineEvent?.(selectedNode.recordId)
      return
    }
    if (selectedNode.type === 'evidence' && !discoveredEvidenceIds.has(selectedNode.recordId)) return
    onOpenRecord?.(selectedNode.recordType, selectedNode.recordId)
  }

  return (
    <section aria-labelledby="evidence-network-title" className="investigation-section evidence-network-section" id="evidence-relationship-network">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">DOCUMENTED CASE LINKS</span>
          <h2 id="evidence-network-title">Evidence Relationship Network</h2>
        </div>
        <span className="section-count">{visibleNodes.length} visible records · {visibleEdges.length} documented links</span>
      </div>
      <p className="section-intro">This network organizes recorded relationships, not mansion corridors. A link can guide follow-up, but it does not prove guilt or establish that a person was physically present.</p>

      {network.validation.valid ? (
        <>
          <div className="evidence-network-controls">
            <label htmlFor="evidence-network-node-filter">Record type
              <select id="evidence-network-node-filter" onChange={(event) => setNodeTypeFilter(event.target.value)} value={nodeTypeFilter}>
                <option value="all">All record types</option>
                {NODE_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label htmlFor="evidence-network-edge-filter">Relationship
              <select id="evidence-network-edge-filter" onChange={(event) => setRelationshipFilter(event.target.value)} value={relationshipFilter}>
                <option value="all">All documented relationships</option>
                {EVIDENCE_RELATIONSHIP_TYPES.map(({ id, label }) => (
                  network.edges.some((edge) => edge.type === id) && <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
            <button className="button button-secondary network-reset-button" onClick={clearFilters} type="button">Clear selection and filters</button>
          </div>

          <div aria-label="Evidence relationship graph" className="network-visualization-scroll" role="region" tabIndex={0}>
            <svg
              aria-labelledby="evidence-network-svg-title evidence-network-svg-description"
              className="evidence-network-svg"
              role="group"
              viewBox={`0 0 890 ${layout.height}`}
              style={{ minHeight: `${layout.height}px` }}
            >
              <title id="evidence-network-svg-title">Documented case relationship network</title>
              <desc id="evidence-network-svg-description">Select a node to inspect a suspect, location, discovered evidence record, or timeline report. Evidence records appear only after discovery.</desc>
              {NODE_TYPES.map(({ id, label }) => (
                <text className="evidence-network-column-label" key={id} textAnchor="middle" x={COLUMN_X[id]} y="22">{label}</text>
              ))}
              <g className="evidence-network-edges" aria-hidden="true">
                {visibleEdges.map((edge) => {
                  const from = layout.positions.get(edge.from)
                  const to = layout.positions.get(edge.to)
                  if (!from || !to) return null
                  const active = selectedNode && (edge.from === selectedNode.id || edge.to === selectedNode.id)
                  const dim = selectedNode && !active
                  const fromX = from.x + (to.x >= from.x ? NODE_WIDTH / 2 : -NODE_WIDTH / 2)
                  const toX = to.x + (from.x >= to.x ? NODE_WIDTH / 2 : -NODE_WIDTH / 2)
                  const curveX = (fromX + toX) / 2
                  return (
                    <path
                      className={`evidence-network-edge is-${edge.type}${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`}
                      d={`M ${fromX} ${from.y} C ${curveX} ${from.y}, ${curveX} ${to.y}, ${toX} ${to.y}`}
                      key={edge.id}
                    >
                      <title>{edge.label}{edge.confirmed === false ? ' · unverified report' : ''}</title>
                    </path>
                  )
                })}
              </g>
              {visibleNodes.map((node) => {
                const position = layout.positions.get(node.id)
                const selected = node.id === selectedNodeId
                const connected = selectedNodeId && connectedNodeIds.has(node.id)
                const dim = selectedNodeId && !selected && !connected
                const labelLines = wrapNodeLabel(node.label)
                return (
                  <g
                    aria-label={`${node.type}: ${node.label} (${node.recordId})${node.type === 'evidence' ? ', discovered evidence' : ''}`}
                    aria-pressed={selected}
                    className={`evidence-network-node is-${node.type}${selected ? ' is-selected' : ''}${connected ? ' is-connected' : ''}${dim ? ' is-dim' : ''}`}
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedNodeId(node.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <title>{node.label} ({node.recordId})</title>
                    <rect height={NODE_HEIGHT} rx="4" width={NODE_WIDTH} x={position.x - NODE_WIDTH / 2} y={position.y - NODE_HEIGHT / 2} />
                    <text className="evidence-network-node-id" textAnchor="middle" x={position.x} y={position.y - 8}>{node.recordId}</text>
                    {labelLines.map((line, index) => (
                      <text className="evidence-network-node-label" key={`${node.id}-label-${index}`} textAnchor="middle" x={position.x} y={position.y + 7 + index * 12}>{line}</text>
                    ))}
                  </g>
                )
              })}
              {!visibleNodes.length && <text className="evidence-network-empty" textAnchor="middle" x="445" y="160">No records match these filters.</text>}
            </svg>
          </div>

          <ul aria-label="Evidence network legend" className="evidence-network-legend">
            <li><span className="network-node-key is-suspect" />Suspect</li>
            <li><span className="network-node-key is-location" />Location</li>
            <li><span className="network-node-key is-evidence" />Discovered evidence</li>
            <li><span className="network-node-key is-timeline" />Timeline report</li>
            <li><span className="network-edge-key is-follow-up" />Profile link for follow-up only</li>
            <li><span className="network-edge-key is-report" />Reported association</li>
          </ul>

          <details className="evidence-network-list-fallback">
            <summary>Open the accessible relationship list</summary>
            <ul>
              {visibleNodes.map((node) => (
                <li key={node.id}>
                  <button aria-pressed={selectedNodeId === node.id} onClick={() => setSelectedNodeId(node.id)} type="button">
                    <span>{node.type}</span><strong>{node.label}</strong><small>{node.recordId}</small>
                  </button>
                </li>
              ))}
            </ul>
            <ul aria-label="Visible documented links" className="evidence-network-link-list">
              {visibleEdges.map((edge) => (
                <li key={edge.id}>{network.nodes.find(({ id }) => id === edge.from)?.label} — {edge.label} — {network.nodes.find(({ id }) => id === edge.to)?.label}</li>
              ))}
            </ul>
          </details>

          {selectedNode && (
            <aside aria-live="polite" className="evidence-network-detail">
              <div className="section-heading-row">
                <div><span className="section-kicker">{selectedNode.type.toUpperCase()} · {selectedNode.recordId}</span><h3>{selectedNode.label}</h3></div>
                <button aria-label="Clear selected network node" className="network-close-button" onClick={() => setSelectedNodeId(null)} type="button">Clear</button>
              </div>
              {selectedNode.type === 'suspect' && selectedRecord && <><p><strong>{selectedRecord.role}</strong></p><p>{selectedRecord.biography}</p></>}
              {selectedNode.type === 'location' && selectedRecord && <p>{selectedRecord.description}</p>}
              {selectedNode.type === 'evidence' && selectedRecord && discoveredEvidenceIds.has(selectedNode.recordId) && (
                <>
                  <p>{selectedRecord.description}</p>
                  {selectedRecord.relevance && <p className="network-detail-note"><strong>Investigator note:</strong> {selectedRecord.relevance}</p>}
                  <p className="network-detail-note">This record is discovered. Its association with a profile is a lead for follow-up, not proof of responsibility.</p>
                </>
              )}
              {selectedNode.type === 'timeline' && selectedRecord && (
                <>
                  <p><strong>{selectedRecord.timestamp}</strong> · {selectedRecord.confirmed ? 'Confirmed report' : 'Unverified account'}</p>
                  <p>{selectedRecord.description}</p>
                  <p className="network-detail-note">A report’s named person or location does not independently prove physical presence.</p>
                </>
              )}
              <div className="network-detail-links">
                {selectedNode.type !== 'timeline' && <button className="button button-secondary" onClick={openSelectedRecord} type="button">Open existing record</button>}
                {selectedNode.type === 'timeline' && <button className="button button-secondary" onClick={openSelectedRecord} type="button">Jump to timeline report</button>}
                {['suspect', 'location', 'evidence'].includes(selectedNode.type) && (
                  <button className="button button-secondary" onClick={() => onRequestJournalEntry?.(selectedNode.recordType, selectedNode.recordId)} type="button">Add linked journal note</button>
                )}
                {selectedNode.type === 'suspect' && <a className="network-text-link" href="#suspect-analysis">Review Suspect Analysis</a>}
                {selectedNode.type === 'evidence' && connectedSuspectIds.length > 0 && <>
                  <a className="network-text-link" href="#suspect-analysis">Review linked suspect analysis</a>
                  <a className="network-text-link" href="#deduction-lab">Open Deduction Lab</a>
                </>}
              </div>
              {selectedEdges.length > 0 && (
                <div className="network-selected-links">
                  <span className="detail-label">Documented links</span>
                  <ul>{selectedEdges.map((edge) => {
                    const otherId = edge.from === selectedNode.id ? edge.to : edge.from
                    const otherNode = network.nodes.find(({ id }) => id === otherId)
                    return <li key={edge.id}><span>{edge.label}</span>{otherNode?.label}{edge.confirmed === false && <small>Unverified report</small>}</li>
                  })}</ul>
                </div>
              )}
            </aside>
          )}
        </>
      ) : (
        <p className="network-validation-error" role="alert">The documented relationship data could not be validated: {network.validation.errors.join(' ')}</p>
      )}
    </section>
  )
}

export default EvidenceRelationshipNetwork
