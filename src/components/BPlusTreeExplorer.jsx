import { useMemo, useState } from 'react'
import { BPlusTree } from '../dsa/BPlusTree.js'

function createDemoTree(evidenceRecords, order) {
  const tree = new BPlusTree(order)
  // Seed with real case IDs but generic demo values. This editable copy never
  // holds or mutates the source evidence records or the read-only case index.
  evidenceRecords.forEach(({ id }) => tree.insert(id, `Case evidence record ${id}`))
  return tree
}

function nodeWidth(node) {
  return Math.max(68, node.keys.length * 45 + 20)
}

function layoutBPlusTree(root, order) {
  if (!root) return { nodes: [], edges: [], leafLinks: [], width: 640, height: 220 }

  let leafCount = 0
  let maximumDepth = 0
  const leaves = []
  const nodes = []
  const edges = []
  const positionsById = new Map()
  const maxNodeWidth = Math.max(120, (order - 1) * 45 + 20)
  const leafSlot = maxNodeWidth + 48
  const top = 55
  const levelGap = 124

  function position(node, depth) {
    maximumDepth = Math.max(maximumDepth, depth)
    const nodePosition = { id: node.id, type: node.type, keys: node.keys, depth, y: top + depth * levelGap, x: 0, width: nodeWidth(node) }
    nodes.push(nodePosition)

    if (node.type === 'leaf') {
      nodePosition.x = 34 + leafCount * leafSlot + leafSlot / 2
      positionsById.set(node.id, nodePosition)
      leaves.push({ ...nodePosition, previousLeafId: node.previousLeafId, nextLeafId: node.nextLeafId })
      leafCount += 1
      return nodePosition.x
    }

    const childCenters = node.children.map((child) => position(child, depth + 1))
    nodePosition.x = (childCenters[0] + childCenters[childCenters.length - 1]) / 2
    positionsById.set(node.id, nodePosition)
    node.children.forEach((child) => {
      const childPosition = positionsById.get(child.id)
      edges.push({ id: `${node.id}-${child.id}`, x1: nodePosition.x, y1: nodePosition.y + 25, x2: childPosition.x, y2: childPosition.y - 25 })
    })
    return nodePosition.x
  }

  position(root, 0)
  const leafLinks = leaves
    .filter((leaf) => leaf.nextLeafId)
    .map((leaf) => {
      const nextLeaf = positionsById.get(leaf.nextLeafId)
      return {
        id: `${leaf.id}-next-${leaf.nextLeafId}`,
        x1: leaf.x + leaf.width / 2,
        x2: nextLeaf.x - nextLeaf.width / 2,
        y: leaf.y + 55,
      }
    })

  return {
    nodes,
    edges,
    leaves,
    leafLinks,
    width: Math.max(640, 68 + leafCount * leafSlot),
    height: top + maximumDepth * levelGap + 116,
  }
}

function BPlusTreeDiagram({ structure, order, highlightNodeIds = [], highlightKeys = [], label, diagramId }) {
  const layout = useMemo(() => layoutBPlusTree(structure, order), [structure, order])
  const highlightedNodes = new Set(highlightNodeIds)
  const highlightedKeys = new Set(highlightKeys)

  if (!layout.nodes.length) {
    return <div className="bplus-empty-state">The B+ Tree is empty. Insert a key to see its nodes here.</div>
  }

  return (
    <div className="bplus-diagram-scroll" role="region" aria-label={`${label} diagram; scroll horizontally if needed`} tabIndex="0">
      <svg
        aria-label={`${label} with ${layout.nodes.filter((node) => node.type === 'leaf').length} leaves and ${layout.nodes.filter((node) => node.type === 'internal').length} internal nodes`}
        className="bplus-diagram"
        height={layout.height}
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
      >
        <defs>
          <marker id={`${diagramId}-next-arrow`} markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5" viewBox="0 0 7 7">
            <path d="M 0 0 L 7 3.5 L 0 7 z" />
          </marker>
        </defs>
        <g className="bplus-tree-edges" aria-hidden="true">
          {layout.edges.map((edge) => <line key={edge.id} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />)}
        </g>
        <g className="bplus-leaf-links" aria-hidden="true">
          {layout.leafLinks.map((link) => (
            <g key={link.id}>
              <line markerEnd={`url(#${diagramId}-next-arrow)`} x1={link.x1} x2={link.x2} y1={link.y} y2={link.y} />
              <text textAnchor="middle" x={(link.x1 + link.x2) / 2} y={link.y + 13}>NEXT</text>
            </g>
          ))}
        </g>
        {layout.nodes.map((node) => {
          const hasPathHighlight = highlightedNodes.has(node.id)
          const isLeaf = node.type === 'leaf'
          const keyCellWidth = (node.width - 12) / Math.max(node.keys.length, 1)
          return (
            <g
              className={`bplus-node ${isLeaf ? 'is-leaf' : 'is-internal'}${hasPathHighlight ? ' is-path-node' : ''}`}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
            >
              <title>{`${isLeaf ? 'Leaf' : 'Internal'} node: ${node.keys.join(', ') || 'no keys'}${hasPathHighlight ? ', visited by search' : ''}`}</title>
              <rect className="bplus-node-body" height="50" rx="2" width={node.width} x={-node.width / 2} y="-25" />
              {node.keys.map((key, index) => {
                const x = -node.width / 2 + 6 + index * keyCellWidth
                const isRangeMatch = isLeaf && highlightedKeys.has(key)
                return (
                  <g className={isRangeMatch ? 'is-range-key' : ''} key={`${node.id}:${key}`}>
                    {isRangeMatch && <rect className="bplus-range-cell" height="38" width={keyCellWidth} x={x} y="-19" />}
                    {index > 0 && <line className="bplus-cell-divider" x1={x} x2={x} y1="-18" y2="18" />}
                    <text className="bplus-node-key" dominantBaseline="middle" textAnchor="middle" textLength={key.length > 8 ? 38 : undefined} x={x + keyCellWidth / 2} y="0">{key}</text>
                  </g>
                )
              })}
              <text className="bplus-node-type" textAnchor="middle" x="0" y="38">{isLeaf ? 'LEAF' : 'INDEX'}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function IndexStats({ stats }) {
  return (
    <dl className="bplus-stats">
      <div><dt>Height</dt><dd>{stats.height}</dd></div>
      <div><dt>Indexed keys</dt><dd>{stats.keyCount}</dd></div>
      <div><dt>Leaf nodes</dt><dd>{stats.leafCount}</dd></div>
      <div><dt>Internal nodes</dt><dd>{stats.internalNodeCount}</dd></div>
      <div><dt>Order</dt><dd>{stats.order}</dd></div>
    </dl>
  )
}

function EntryList({ entries, discoveredEvidenceIds, onSelectEvidence, selectedEvidenceId }) {
  if (!entries.length) return <p className="bplus-empty-list">No records match this query.</p>
  return (
    <ul className="bplus-entry-list">
      {entries.map((record) => {
        const isDiscovered = discoveredEvidenceIds.has(record.id)
        return (
          <li key={record.id}>
            <button
              aria-pressed={selectedEvidenceId === record.id}
              className={`bplus-entry-button${isDiscovered ? '' : ' is-sealed'}${selectedEvidenceId === record.id ? ' is-selected' : ''}`}
              onClick={() => onSelectEvidence(record.id)}
              type="button"
            >
              <code>{record.id}</code>
              <span>{isDiscovered ? `${record.title} · ${record.category}` : 'Sealed evidence record'}</span>
              <small>{isDiscovered ? 'Open details' : 'Not yet discovered'}</small>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function BPlusTreeExplorer({ caseFile, evidenceIndex, discoveredEvidenceIds, onSelectEvidence, selectedEvidenceId }) {
  const [demoTree, setDemoTree] = useState(() => createDemoTree(caseFile.evidence, 4))
  const [demoRevision, setDemoRevision] = useState(0)
  const [demoKey, setDemoKey] = useState('')
  const [demoValue, setDemoValue] = useState('')
  const [demoSearchKey, setDemoSearchKey] = useState('')
  const [demoSearch, setDemoSearch] = useState(null)
  const [demoMessage, setDemoMessage] = useState('The editable tree is an isolated copy seeded with CASE-001 evidence IDs.')
  const [demoEntries, setDemoEntries] = useState(null)
  const [caseLookupKey, setCaseLookupKey] = useState('')
  const [caseLookup, setCaseLookup] = useState(null)
  const [caseRangeStart, setCaseRangeStart] = useState('E003')
  const [caseRangeEnd, setCaseRangeEnd] = useState('E007')
  const [caseRangeResults, setCaseRangeResults] = useState(null)
  const [caseIndexMessage, setCaseIndexMessage] = useState('Select a direct lookup or inclusive ID range to query the read-only evidence index.')
  const [validationMessage, setValidationMessage] = useState(null)
  const [showAllCaseRecords, setShowAllCaseRecords] = useState(false)

  const demoStructure = useMemo(() => demoTree.getStructure(), [demoTree, demoRevision])
  const evidenceStructure = evidenceIndex.getStructure()
  const demoStats = demoTree.getStats()
  const evidenceStats = evidenceIndex.getEvidenceIndexStats()
  const caseRangeKeys = caseRangeResults?.map((record) => record.id) ?? []
  const evidenceRecordsToShow = showAllCaseRecords
    ? evidenceIndex.getAllEvidenceIndexed()
    : caseRangeResults

  const bumpDemoRevision = () => {
    setDemoRevision((revision) => revision + 1)
    setDemoEntries(null)
    setValidationMessage(null)
  }

  const handleDemoInsert = (event) => {
    event.preventDefault()
    const inserted = demoTree.insert(demoKey, demoValue)
    bumpDemoRevision()
    setDemoSearch(null)
    setDemoMessage(inserted ? `Inserted “${demoKey}” into the practice index.` : `Updated the value for “${demoKey}”.`)
  }

  const handleDemoSearch = (event) => {
    event.preventDefault()
    const path = demoTree.getSearchPath(demoSearchKey)
    const found = demoTree.has(demoSearchKey)
    setDemoSearch({
      key: demoSearchKey,
      found,
      value: found ? demoTree.search(demoSearchKey) : undefined,
      pathIds: path.path.map(({ id }) => id),
    })
    setDemoMessage(found
      ? `Found “${demoSearchKey}” in the editable B+ Tree.`
      : `No key “${demoSearchKey}” exists in the editable B+ Tree.`)
  }

  const handleDemoDelete = () => {
    const removed = demoTree.delete(demoSearchKey)
    if (removed) bumpDemoRevision()
    setDemoSearch(null)
    setDemoMessage(removed
      ? `Deleted “${demoSearchKey}” and rebalanced the editable B+ Tree.`
      : `No key “${demoSearchKey}” was available to delete.`)
  }

  const resetDemoTree = () => {
    setDemoTree(createDemoTree(caseFile.evidence, demoTree.order))
    setDemoRevision((revision) => revision + 1)
    setDemoEntries(null)
    setDemoSearch(null)
    setDemoKey('')
    setDemoValue('')
    setDemoSearchKey('')
    setDemoMessage('The practice index has been restored from the real evidence IDs. Case data is unchanged.')
    setValidationMessage(null)
  }

  const changeDemoOrder = (event) => {
    const nextOrder = Number(event.target.value)
    const replacement = new BPlusTree(nextOrder)
    demoTree.getAllEntries().forEach(({ key, value }) => replacement.insert(key, value))
    setDemoTree(replacement)
    setDemoRevision((revision) => revision + 1)
    setDemoSearch(null)
    setDemoEntries(null)
    setDemoMessage(`Rebuilt the practice tree at order ${nextOrder}; its current entries were preserved.`)
    setValidationMessage(null)
  }

  const showAllDemoEntries = () => {
    setDemoEntries(demoTree.getAllEntries())
  }

  const validateDemoTree = () => {
    const result = demoTree.validate()
    setValidationMessage(result.valid
      ? `Practice tree is valid: ${demoStats.keyCount} keys, height ${demoStats.height}.`
      : `Practice tree validation found: ${result.errors.join(' ')}`)
  }

  const handleCaseLookup = (event) => {
    event.preventDefault()
    const path = evidenceIndex.getSearchPath(caseLookupKey)
    const record = evidenceIndex.getEvidenceById(caseLookupKey)
    setCaseRangeResults(null)
    setShowAllCaseRecords(false)
    setCaseLookup({ key: caseLookupKey, found: Boolean(record), record, pathIds: path.path.map(({ id }) => id) })
    setCaseIndexMessage(record
      ? discoveredEvidenceIds.has(record.id)
        ? `Found ${record.id} in the evidence index.`
        : `${record.id} is indexed; its details remain sealed until it is inspected.`
      : `No evidence record with ID “${caseLookupKey}” exists in this case.`)
  }

  const handleCaseRangeSearch = (event) => {
    event.preventDefault()
    setCaseLookup(null)
    setShowAllCaseRecords(false)
    if (caseRangeStart > caseRangeEnd) {
      setCaseRangeResults([])
      setCaseIndexMessage('The start ID must sort at or before the end ID.')
      return
    }
    const records = evidenceIndex.searchEvidenceRange(caseRangeStart, caseRangeEnd)
    setCaseRangeResults(records)
    setCaseIndexMessage(`Inclusive B+ Tree range returned ${records.length} record${records.length === 1 ? '' : 's'} in lexicographic ID order.`)
  }

  const showAllEvidenceRecords = () => {
    setCaseLookup(null)
    setCaseRangeResults(null)
    setShowAllCaseRecords((visible) => !visible)
    setCaseIndexMessage(showAllCaseRecords ? 'Showing only index controls.' : 'All case evidence IDs are listed in B+ Tree order; sealed details remain hidden.')
  }

  const validateEvidenceTree = () => {
    const result = evidenceIndex.validateEvidenceIndex()
    setCaseIndexMessage(result.valid
      ? `Evidence index structure is valid (${evidenceStats.keyCount} records).`
      : `Evidence index validation found: ${result.errors.join(' ')}`)
  }

  const casePathIds = caseLookup?.pathIds ?? []
  const demoPathIds = demoSearch?.pathIds ?? []
  const caseLookupRecord = caseLookup?.record
  const caseLookupDiscovered = caseLookupRecord && discoveredEvidenceIds.has(caseLookupRecord.id)

  return (
    <section aria-labelledby="bplus-explorer-title" className="investigation-section bplus-explorer">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">ORDERED STORAGE INDEX</span>
          <h2 id="bplus-explorer-title">B+ Tree Explorer</h2>
        </div>
        <span className="section-count">Multiway tree · linked leaves</span>
      </div>
      <p className="section-intro">Explore a database-style index over the mansion evidence IDs. The case index is read-only; the practice tree is an independent copy.</p>

      <div className="bplus-explainer">
        <div>
          <span className="section-kicker">HOW THE INDEX WORKS</span>
          <h3>Wide branches, ordered records</h3>
          <p>A B+ Tree is a balanced multiway search tree. Internal nodes hold separator keys that direct a search; the complete key/value records live only in leaves. Every leaf stays at the same depth, and linked leaves let a range query continue through adjacent keys without returning to the root. Insertions split full nodes; deletions borrow from siblings or merge nodes, updating separators as the tree changes.</p>
          <p>Order <strong>m</strong> here means an internal node can have at most <strong>m children</strong> and <strong>m−1 separators</strong>; a leaf holds at most <strong>m−1 entries</strong>. This in-memory model teaches the index structure used by databases and storage systems; real performance also depends on page size, disk access and caching.</p>
          <div className="bplus-structure-comparison" aria-label="Data structure use comparison">
            <span><strong>Hash Table</strong>direct lookup by key</span>
            <span><strong>BST</strong>binary ordering and traversals</span>
            <span><strong>B+ Tree</strong>multiway index and ordered ranges</span>
          </div>
          <p className="bplus-complexity-note"><strong>Complexity:</strong> search O(log<sub>m</sub> n) tree navigation; insert/delete O(log<sub>m</sub> n) plus split or rebalance work; range search O(log<sub>m</sub> n + k) for k returned records; full ordered traversal O(n). A B+ Tree is useful for ordered ranges, not universally faster than hashing.</p>
        </div>
        <div className="bplus-complexity-table-wrap">
          <table className="bplus-complexity-table">
            <caption>B+ Tree operation costs</caption>
            <thead><tr><th scope="col">Operation</th><th scope="col">Cost</th></tr></thead>
            <tbody>
              <tr><th scope="row">Search</th><td>O(log<sub>m</sub> n)</td></tr>
              <tr><th scope="row">Insert / delete</th><td>O(log<sub>m</sub> n) + rebalance</td></tr>
              <tr><th scope="row">Range result (k)</th><td>O(log<sub>m</sub> n + k)</td></tr>
              <tr><th scope="row">Full traversal</th><td>O(n)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <article className="bplus-case-index" aria-labelledby="bplus-case-index-title">
        <div className="bplus-panel-heading">
          <div><span className="section-kicker">CASE-001 · SOURCE RECORDS</span><h3 id="bplus-case-index-title">Evidence ID index</h3></div>
          <span className="bplus-read-only">Read-only index</span>
        </div>
        <p className="bplus-panel-intro">This B+ Tree stores each original evidence record under its existing ID. Searches and ranges never mark clues as discovered.</p>
        <IndexStats stats={evidenceStats} />

        <div className="bplus-index-controls">
          <form className="bplus-control-form" onSubmit={handleCaseLookup}>
            <label className="bplus-field">Direct lookup by evidence ID
              <input onChange={(event) => setCaseLookupKey(event.target.value)} placeholder="e.g. E004" value={caseLookupKey} />
            </label>
            <button className="button button-secondary" type="submit">Search index</button>
          </form>
          <form className="bplus-control-form bplus-range-form" onSubmit={handleCaseRangeSearch}>
            <label className="bplus-field">Start ID
              <input onChange={(event) => setCaseRangeStart(event.target.value)} placeholder="E001" value={caseRangeStart} />
            </label>
            <label className="bplus-field">End ID
              <input onChange={(event) => setCaseRangeEnd(event.target.value)} placeholder="E012" value={caseRangeEnd} />
            </label>
            <button className="button button-primary" type="submit">Run inclusive range</button>
          </form>
        </div>

        <div className="bplus-button-row">
          <button className="button button-secondary" onClick={showAllEvidenceRecords} type="button">{showAllCaseRecords ? 'Hide all IDs' : 'View all IDs in order'}</button>
          <button className="button button-secondary" onClick={validateEvidenceTree} type="button">Validate evidence index</button>
        </div>
        <div className="bplus-live-message" aria-live="polite">{caseIndexMessage}</div>

        {caseLookup && caseLookup.found && (
          <div className="bplus-lookup-result">
            <span className="section-kicker">DIRECT LOOKUP RESULT</span>
            <p><strong>{caseLookupRecord.id}</strong>{caseLookupDiscovered ? ` · ${caseLookupRecord.title} (${caseLookupRecord.category})` : ' · Sealed evidence record; inspect the clue in the Evidence section to reveal details.'}</p>
            {caseLookupDiscovered && <button className="bplus-inline-action" onClick={() => onSelectEvidence(caseLookupRecord.id)} type="button">Open evidence details</button>}
          </div>
        )}

        {evidenceRecordsToShow && (
          <div className="bplus-index-results">
            <div className="bplus-results-heading"><span className="section-kicker">{showAllCaseRecords ? 'ALL INDEXED RECORDS' : 'RANGE RESULTS'}</span><span>{evidenceRecordsToShow.length} record{evidenceRecordsToShow.length === 1 ? '' : 's'}</span></div>
            <EntryList entries={evidenceRecordsToShow} discoveredEvidenceIds={discoveredEvidenceIds} onSelectEvidence={onSelectEvidence} selectedEvidenceId={selectedEvidenceId} />
          </div>
        )}

        <div className="bplus-diagram-heading"><span className="section-kicker">CASE INDEX STRUCTURE</span><span>Amber path = last lookup · gold cells = range results</span></div>
        <BPlusTreeDiagram
          highlightKeys={caseRangeKeys}
          highlightNodeIds={casePathIds}
          label="CASE-001 evidence B+ Tree"
          order={evidenceStats.order}
          structure={evidenceStructure}
          diagramId="case-evidence-index"
        />
        <div className="bplus-legend"><span><i className="bplus-legend-internal" />Internal separator node</span><span><i className="bplus-legend-leaf" />Record leaf</span><span><i className="bplus-legend-link" />Next-leaf scan link</span></div>
      </article>

      <article className="bplus-practice" aria-labelledby="bplus-practice-title">
        <div className="bplus-panel-heading">
          <div><span className="section-kicker">ISOLATED PRACTICE STRUCTURE</span><h3 id="bplus-practice-title">Edit a B+ Tree</h3></div>
          <button className="bplus-reset-button" onClick={resetDemoTree} type="button">Reset demo</button>
        </div>
        <p className="bplus-panel-intro">Try splits, value updates, searches, deletions and rebalancing here. This tree uses the actual B+ Tree class but cannot change the source case index.</p>

        <div className="bplus-demo-controls">
          <form className="bplus-demo-form" onSubmit={handleDemoInsert}>
            <label className="bplus-field">String key
              <input onChange={(event) => setDemoKey(event.target.value)} placeholder="e.g. E013" value={demoKey} />
            </label>
            <label className="bplus-field">Value
              <input onChange={(event) => setDemoValue(event.target.value)} placeholder="Short label or note" value={demoValue} />
            </label>
            <button className="button button-primary" type="submit">Insert / update</button>
          </form>
          <form className="bplus-demo-form bplus-demo-search" onSubmit={handleDemoSearch}>
            <label className="bplus-field">Search or delete key
              <input onChange={(event) => setDemoSearchKey(event.target.value)} placeholder="Enter a key" value={demoSearchKey} />
            </label>
            <div className="bplus-demo-actions">
              <button className="button button-secondary" type="submit">Search</button>
              <button className="button button-secondary" onClick={handleDemoDelete} type="button">Delete</button>
            </div>
          </form>
          <label className="bplus-field bplus-order-field">Order (max internal children)
            <select onChange={changeDemoOrder} value={demoTree.order}>
              {[3, 4, 5, 6].map((order) => <option key={order} value={order}>{order}</option>)}
            </select>
          </label>
        </div>

        <div className="bplus-live-message" aria-live="polite">{demoMessage}</div>
        {demoSearch && (
          <div className={`bplus-lookup-result${demoSearch.found ? ' is-found' : ''}`}>
            <span className="section-kicker">SEARCH PATH</span>
            <p>{demoSearch.found ? <>Found <strong>{demoSearch.key}</strong> with value “{demoSearch.value}”.</> : <>Key <strong>{demoSearch.key}</strong> was not found.</>}</p>
            {demoSearch.pathIds.length > 0 && <p className="bplus-search-path">Visited nodes: {demoSearch.pathIds.join(' → ')}</p>}
          </div>
        )}

        <IndexStats stats={demoStats} />
        <div className="bplus-button-row">
          <button className="button button-secondary" onClick={showAllDemoEntries} type="button">Show all entries in order</button>
          <button className="button button-secondary" onClick={validateDemoTree} type="button">Validate demo tree</button>
        </div>
        {validationMessage && <div className="bplus-live-message" aria-live="polite">{validationMessage}</div>}
        {demoEntries && (
          <div className="bplus-demo-entries" aria-label="Editable tree entries in ascending order">
            <span className="section-kicker">ALL PRACTICE ENTRIES · ASCENDING KEY</span>
            <ol>{demoEntries.map(({ key, value }) => <li key={key}><code>{key}</code><span>{value}</span></li>)}</ol>
          </div>
        )}
        <div className="bplus-diagram-heading"><span className="section-kicker">LIVE PRACTICE TREE</span><span>Search path highlighted in amber</span></div>
        <BPlusTreeDiagram
          highlightNodeIds={demoPathIds}
          label="Editable B+ Tree practice structure"
          order={demoTree.order}
          structure={demoStructure}
          diagramId="practice-tree"
        />
        <div className="bplus-legend"><span><i className="bplus-legend-internal" />Internal separator node</span><span><i className="bplus-legend-leaf" />Record leaf</span><span><i className="bplus-legend-link" />Next-leaf scan link</span></div>
      </article>
    </section>
  )
}

export default BPlusTreeExplorer
