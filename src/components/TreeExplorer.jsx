import { useMemo, useState } from 'react'
import { BinarySearchTree } from '../dsa/BinarySearchTree.js'

const TRAVERSALS = [
  { id: 'inOrder', label: 'In-order' },
  { id: 'preOrder', label: 'Pre-order' },
  { id: 'postOrder', label: 'Post-order' },
  { id: 'levelOrder', label: 'Level-order' },
]

const TRAVERSAL_METHODS = {
  inOrder: 'inOrderTraversal',
  preOrder: 'preOrderTraversal',
  postOrder: 'postOrderTraversal',
  levelOrder: 'levelOrderTraversal',
}

function buildDetectiveClueTree(evidence) {
  const tree = new BinarySearchTree()
  const sortedEvidence = [...evidence].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ))

  // Insert medians first so the read-only example is easy to inspect. The BST
  // still performs every comparison and stores the original evidence records.
  const insertMedianFirst = (start, end) => {
    if (start >= end) return
    const middle = Math.floor((start + end) / 2)
    const record = sortedEvidence[middle]
    tree.insert(record.id, record)
    insertMedianFirst(start, middle)
    insertMedianFirst(middle + 1, end)
  }

  insertMedianFirst(0, sortedEvidence.length)
  return tree
}

function makeTreeDiagram(root) {
  if (!root) return { nodes: [], edges: [], width: 560, height: 230 }

  const nodesByKey = new Map()
  const pending = [{ node: root, depth: 0, parentKey: null }]
  let maximumDepth = 0

  while (pending.length) {
    const { node, depth, parentKey } = pending.pop()
    const positionedNode = { key: node.key, value: node.value, depth, parentKey, order: 0 }
    nodesByKey.set(node.key, positionedNode)
    maximumDepth = Math.max(maximumDepth, depth)
    if (node.right) pending.push({ node: node.right, depth: depth + 1, parentKey: node.key })
    if (node.left) pending.push({ node: node.left, depth: depth + 1, parentKey: node.key })
  }

  const inOrderNodes = []
  const stack = []
  let current = root
  while (current || stack.length) {
    while (current) {
      stack.push(current)
      current = current.left
    }
    current = stack.pop()
    const positionedNode = nodesByKey.get(current.key)
    positionedNode.order = inOrderNodes.length
    inOrderNodes.push(positionedNode)
    current = current.right
  }

  const horizontalGap = 108
  const verticalGap = 92
  const nodes = inOrderNodes.map((node) => ({
    ...node,
    x: 48 + node.order * horizontalGap,
    y: 46 + node.depth * verticalGap,
  }))
  const positionsByKey = new Map(nodes.map((node) => [node.key, node]))
  const edges = nodes
    .filter((node) => node.parentKey !== null)
    .map((node) => {
      const parent = positionsByKey.get(node.parentKey)
      return { id: `${node.parentKey}-${node.key}`, x1: parent.x, y1: parent.y, x2: node.x, y2: node.y }
    })

  return {
    nodes,
    edges,
    width: Math.max(560, 96 + nodes.length * horizontalGap),
    height: Math.max(230, 92 + (maximumDepth + 1) * verticalGap),
  }
}

function TreeDiagram({ root, highlightedKey, visitOrder = [], label }) {
  const layout = makeTreeDiagram(root)
  const visitNumbers = new Map(visitOrder.map((record, index) => [record.key, index + 1]))

  if (!layout.nodes.length) {
    return <div className="tree-empty-state">The tree is empty. Insert a string key to begin.</div>
  }

  return (
    <div className="tree-diagram-scroll" role="region" aria-label={`${label} diagram; scroll horizontally if needed`} tabIndex="0">
      <svg
        aria-label={`${label} binary search tree with ${layout.nodes.length} nodes`}
        className="tree-diagram"
        height={layout.height}
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
      >
        <g className="tree-edges" aria-hidden="true">
          {layout.edges.map((edge) => (
            <line key={edge.id} x1={edge.x1} y1={edge.y1 + 25} x2={edge.x2} y2={edge.y2 - 25} />
          ))}
        </g>
        {layout.nodes.map((node) => {
          const isHighlighted = node.key === highlightedKey
          const visitNumber = visitNumbers.get(node.key)
          return (
            <g className={`tree-node${isHighlighted ? ' is-highlighted' : ''}`} key={node.key} transform={`translate(${node.x} ${node.y})`}>
              <title>{`${node.key}${visitNumber ? `, visit ${visitNumber}` : ''}${isHighlighted ? ', search match' : ''}`}</title>
              <circle r="25" />
              <text className="tree-node-key" dominantBaseline="middle" textAnchor="middle">{node.key}</text>
              {visitNumber && <text className="tree-visit-number" textAnchor="middle" y="43">{visitNumber}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TraversalSequence({ records, showValues = false }) {
  if (!records.length) return <p className="tree-sequence-empty">Run a traversal to display its visit order.</p>

  return (
    <ol className="tree-sequence" aria-label="Traversal visit order">
      {records.map((record, index) => (
        <li key={`${record.key}-${index}`}>
          <span className="tree-sequence-number">{index + 1}</span>
          <code>{record.key}</code>
          {showValues && <span className="tree-sequence-value">{record.value}</span>}
        </li>
      ))}
    </ol>
  )
}

function TreeStats({ tree }) {
  const stats = tree.getStats()
  const minimum = tree.getMin()
  const maximum = tree.getMax()

  return (
    <dl className="tree-stats">
      <div><dt>Nodes</dt><dd>{stats.nodeCount}</dd></div>
      <div><dt>Height</dt><dd>{stats.height}</dd></div>
      <div><dt>Minimum key</dt><dd>{minimum?.key ?? '—'}</dd></div>
      <div><dt>Maximum key</dt><dd>{maximum?.key ?? '—'}</dd></div>
    </dl>
  )
}

function TreeExplorer({ caseFile, discoveredEvidenceIds }) {
  const [practiceTree] = useState(() => new BinarySearchTree())
  const [practiceRevision, setPracticeRevision] = useState(0)
  const [practiceKey, setPracticeKey] = useState('')
  const [practiceValue, setPracticeValue] = useState('')
  const [practiceSearchKey, setPracticeSearchKey] = useState('')
  const [practiceHighlight, setPracticeHighlight] = useState(null)
  const [practiceTraversal, setPracticeTraversal] = useState('inOrder')
  const [practiceVisitOrder, setPracticeVisitOrder] = useState([])
  const [practiceMessage, setPracticeMessage] = useState('Your editable tree is separate from the case evidence index.')

  const [clueSearchKey, setClueSearchKey] = useState('')
  const [clueSearchResult, setClueSearchResult] = useState(null)
  const [clueHighlight, setClueHighlight] = useState(null)
  const [clueTraversal, setClueTraversal] = useState('inOrder')
  const [clueVisitOrder, setClueVisitOrder] = useState([])
  const clueTree = useMemo(() => buildDetectiveClueTree(caseFile.evidence), [caseFile.evidence])
  const practiceStructure = useMemo(() => practiceTree.toStructure(), [practiceTree, practiceRevision])
  const clueStructure = clueTree.toStructure()

  const runPracticeTraversal = () => {
    const records = practiceTree[TRAVERSAL_METHODS[practiceTraversal]]()
    setPracticeVisitOrder(records)
    setPracticeMessage(`${TRAVERSALS.find(({ id }) => id === practiceTraversal)?.label} traversal visited ${records.length} node${records.length === 1 ? '' : 's'}.`)
  }

  const handlePracticeInsert = (event) => {
    event.preventDefault()
    const isNew = practiceTree.insert(practiceKey, practiceValue)
    setPracticeRevision((revision) => revision + 1)
    setPracticeHighlight(practiceKey)
    setPracticeVisitOrder([])
    setPracticeMessage(isNew ? `Inserted “${practiceKey}” into the practice tree.` : `Updated the value stored at “${practiceKey}”.`)
  }

  const handlePracticeSearch = (event) => {
    event.preventDefault()
    const result = practiceTree.search(practiceSearchKey)
    setPracticeHighlight(result ? result.key : null)
    setPracticeMessage(result
      ? `Found “${result.key}” with value “${result.value}”.`
      : `No node with key “${practiceSearchKey}” exists in the practice tree.`)
  }

  const handlePracticeDelete = () => {
    const removed = practiceTree.delete(practiceSearchKey)
    if (removed) setPracticeRevision((revision) => revision + 1)
    setPracticeHighlight(null)
    setPracticeVisitOrder([])
    setPracticeMessage(removed
      ? `Deleted “${practiceSearchKey}” from the practice tree.`
      : `No node with key “${practiceSearchKey}” was available to delete.`)
  }

  const resetPracticeTree = () => {
    practiceTree.clear()
    setPracticeRevision((revision) => revision + 1)
    setPracticeHighlight(null)
    setPracticeVisitOrder([])
    setPracticeKey('')
    setPracticeValue('')
    setPracticeSearchKey('')
    setPracticeMessage('The editable practice tree has been reset. Case evidence is unchanged.')
  }

  const runClueSearch = (event) => {
    event.preventDefault()
    const result = clueTree.search(clueSearchKey)
    setClueHighlight(result ? result.key : null)
    setClueSearchResult(result)
  }

  const runClueTraversal = () => {
    const records = clueTree[TRAVERSAL_METHODS[clueTraversal]]()
    setClueVisitOrder(records)
    setClueHighlight(null)
  }

  const clueSearchIsDiscovered = clueSearchResult && discoveredEvidenceIds.has(clueSearchResult.key)

  return (
    <section aria-labelledby="tree-explorer-title" className="investigation-section tree-explorer">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">ORDERED RECORD INDEX</span>
          <h2 id="tree-explorer-title">Tree Explorer</h2>
        </div>
        <span className="section-count">Binary Search Tree</span>
      </div>
      <p className="section-intro">Explore how string keys shape a tree. The editable practice tree and the read-only case clue tree are separate structures.</p>

      <div className="tree-concept-panel">
        <div className="tree-concept-copy">
          <span className="section-kicker">THE STRUCTURE</span>
          <h3>Compare, then follow a branch</h3>
          <p>A Binary Search Tree (BST) stores one key at each node. Keys smaller than a node go in its left subtree; larger keys go in its right subtree. Insert and search compare keys and follow one branch at a time. Here, evidence records are ordered by ID, not by importance or guilt relevance.</p>
          <p>In-order visits left, root, right; pre-order visits root, left, right; post-order visits left, right, root; level-order visits one row at a time. In-order traversal produces sorted keys because of the BST ordering rule. An ordinary BST can become unbalanced when keys arrive in sorted order.</p>
        </div>
        <div className="tree-complexity-wrap">
          <table className="tree-complexity-table">
            <caption>Time complexity</caption>
            <thead><tr><th scope="col">Operation</th><th scope="col">Typical*</th><th scope="col">Worst</th></tr></thead>
            <tbody>
              <tr><th scope="row">Search</th><td>O(log n)</td><td>O(n)</td></tr>
              <tr><th scope="row">Insert</th><td>O(log n)</td><td>O(n)</td></tr>
              <tr><th scope="row">Delete</th><td>O(log n)</td><td>O(n)</td></tr>
              <tr><th scope="row">Traversal</th><td>O(n)</td><td>O(n)</td></tr>
            </tbody>
          </table>
          <p>*Typical search, insertion and deletion assume a reasonably balanced tree. This ordinary BST does not rebalance itself.</p>
        </div>
      </div>

      <div className="tree-explorer-grid">
        <article className="tree-workbench" aria-labelledby="practice-tree-title">
          <div className="tree-panel-heading">
            <div><span className="section-kicker">INTERACTIVE DEMO</span><h3 id="practice-tree-title">Practice tree</h3></div>
            <button className="tree-reset-button" onClick={resetPracticeTree} type="button" disabled={practiceTree.isEmpty()}>Reset tree</button>
          </div>

          <form className="tree-form" onSubmit={handlePracticeInsert}>
            <label className="tree-field">String key
              <input onChange={(event) => setPracticeKey(event.target.value)} placeholder="e.g. E004" value={practiceKey} />
            </label>
            <label className="tree-field">Value
              <input onChange={(event) => setPracticeValue(event.target.value)} placeholder="Short note or label" value={practiceValue} />
            </label>
            <button className="button button-primary" type="submit">Insert / update</button>
          </form>

          <form className="tree-form tree-search-form" onSubmit={handlePracticeSearch}>
            <label className="tree-field">Search or delete key
              <input onChange={(event) => setPracticeSearchKey(event.target.value)} placeholder="Enter a key" value={practiceSearchKey} />
            </label>
            <div className="tree-action-row">
              <button className="button button-secondary" type="submit">Search</button>
              <button className="button button-secondary" onClick={handlePracticeDelete} type="button">Delete</button>
            </div>
          </form>

          <div className="tree-operation-message" aria-live="polite">{practiceMessage}</div>
          <TreeStats tree={practiceTree} />

          <div className="tree-traversal-controls">
            <label className="tree-field">Traversal order
              <select onChange={(event) => setPracticeTraversal(event.target.value)} value={practiceTraversal}>
                {TRAVERSALS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <button className="button button-secondary" onClick={runPracticeTraversal} type="button" disabled={practiceTree.isEmpty()}>Run traversal</button>
          </div>

          <div className="tree-diagram-heading"><span className="section-kicker">TREE DIAGRAM</span><span>Gold node = search match</span></div>
          <TreeDiagram highlightedKey={practiceHighlight} label="Practice tree" root={practiceStructure} visitOrder={practiceVisitOrder} />
          <div className="tree-sequence-heading"><span className="section-kicker">VISIT SEQUENCE</span></div>
          <TraversalSequence records={practiceVisitOrder} showValues />
        </article>

        <article className="tree-workbench clue-tree-workbench" aria-labelledby="detective-tree-title">
          <div className="tree-panel-heading">
            <div><span className="section-kicker">CASE-001 · READ ONLY</span><h3 id="detective-tree-title">Detective Clue Tree</h3></div>
            <span className="tree-record-count">{clueTree.size()} evidence IDs</span>
          </div>
          <p className="tree-panel-intro">This tree indexes the existing evidence records by their IDs. Searching and traversing never discovers clues or changes the case file.</p>

          <form className="tree-form tree-clue-search" onSubmit={runClueSearch}>
            <label className="tree-field">Find evidence ID
              <input onChange={(event) => setClueSearchKey(event.target.value)} placeholder="e.g. E004" value={clueSearchKey} />
            </label>
            <button className="button button-secondary" type="submit">Find ID</button>
          </form>
          {clueSearchResult && (
            <div className={`tree-operation-message${clueSearchIsDiscovered ? ' is-success' : ''}`} aria-live="polite">
              {clueSearchIsDiscovered
                ? <><strong>{clueSearchResult.key}</strong> — {clueSearchResult.value.title} ({clueSearchResult.value.category}).</>
                : <><strong>{clueSearchResult.key}</strong> is indexed. Its details remain sealed until it is inspected in the Evidence section.</>}
            </div>
          )}
          {clueSearchKey && !clueSearchResult && <div className="tree-operation-message" aria-live="polite">No evidence record with ID “{clueSearchKey}” exists in this case tree.</div>}

          <TreeStats tree={clueTree} />
          <div className="tree-traversal-controls">
            <label className="tree-field">Traversal order
              <select onChange={(event) => setClueTraversal(event.target.value)} value={clueTraversal}>
                {TRAVERSALS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <button className="button button-secondary" onClick={runClueTraversal} type="button">Run traversal</button>
          </div>

          <div className="tree-diagram-heading"><span className="section-kicker">EVIDENCE ID ORDER</span><span>Selected ID is highlighted</span></div>
          <TreeDiagram highlightedKey={clueHighlight} label="Detective Clue Tree" root={clueStructure} visitOrder={clueVisitOrder} />
          <div className="tree-sequence-heading"><span className="section-kicker">VISIT SEQUENCE</span></div>
          <TraversalSequence records={clueVisitOrder} />
          <p className="tree-privacy-note">Clue titles and descriptions stay hidden here until the matching evidence is discovered.</p>
        </article>
      </div>
    </section>
  )
}

export default TreeExplorer
