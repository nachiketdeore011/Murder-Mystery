import { useMemo, useState } from 'react'
import GraphExplorer from './GraphExplorer.jsx'
import { createDiscoveredEvidenceLab } from '../analytics/algorithmLabData.js'

function ResultLink({ record, type = 'evidence', onOpenRecord }) {
  if (!record) return null
  const title = record.title || record.name || record.id
  return (
    <button className="analytics-record-link" onClick={() => onOpenRecord(type, record.id)} type="button">
      <span>{record.id} · {type}</span><strong>{title}</strong>
    </button>
  )
}

function AlgorithmPerformanceLab({ caseFile, discoveredEvidenceIds, onOpenRecord, onActivity }) {
  const lab = useMemo(
    () => createDiscoveredEvidenceLab(caseFile, discoveredEvidenceIds),
    [caseFile, discoveredEvidenceIds],
  )
  const [exactKey, setExactKey] = useState('')
  const [prefix, setPrefix] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState(null)

  const normalizedExactKey = exactKey.trim()
  const hashMatch = normalizedExactKey ? lab.hashTable.get(normalizedExactKey) : undefined
  const bstMatch = normalizedExactKey ? lab.binarySearchTree.search(normalizedExactKey)?.value : undefined
  const hashBucket = normalizedExactKey ? lab.hashTable.getBucketIndex(normalizedExactKey) : null
  const prefixResults = useMemo(() => prefix.trim()
    ? lab.clueSearchIndex.searchCluesByPrefix(prefix, { limit: 8 })
    : [], [lab, prefix])
  const rangeResults = useMemo(() => rangeStart.trim() && rangeEnd.trim()
    ? lab.evidenceIndex.searchEvidenceRange(rangeStart.trim(), rangeEnd.trim())
    : [], [lab, rangeStart, rangeEnd])
  const orderedRecords = lab.binarySearchTree.inOrderTraversal()
  const hashBuckets = lab.hashTable.getBuckets()
  const tableStats = lab.hashTable.getStats()
  const bPlusStats = lab.evidenceIndex.getEvidenceIndexStats()
  const selectedLocation = caseFile.locations.find((location) => location.id === selectedLocationId)

  return (
    <section aria-labelledby="algorithm-lab-title" className="analytics-section algorithm-lab-section" id="algorithm-performance-lab">
      <div className="analytics-section-heading">
        <div><span className="section-kicker">REAL DATA STRUCTURES · NO TIMING CLAIMS</span><h2 id="algorithm-lab-title">Algorithm Performance Lab</h2></div>
        <span className="analytics-section-count">{lab.discoveredRecords.length} discovered records indexed</span>
      </div>
      <p className="analytics-section-intro">These controls run the project’s existing algorithms and fresh indexes built from the current case state. Hidden evidence is excluded from each search demonstration.</p>

      <GraphExplorer
        corridorWeights={caseFile.corridorWeights}
        discoveredEvidenceIds={discoveredEvidenceIds}
        locations={caseFile.locations}
        onSelectLocation={(locationId) => {
          setSelectedLocationId(locationId)
          const location = caseFile.locations.find((record) => record.id === locationId)
          if (location) onActivity?.('location-explored', { recordType: 'location', recordId: location.id, label: location.name })
        }}
      />
      {selectedLocation && (
        <aside aria-live="polite" className="analytics-selected-location">
          <div><span className="section-kicker">SELECTED LOCATION · {selectedLocation.id}</span><strong>{selectedLocation.name}</strong><p>{selectedLocation.description}</p></div>
          <button className="button button-secondary" onClick={() => onOpenRecord('location', selectedLocation.id)} type="button">Open location record</button>
        </aside>
      )}

      <div className="analytics-learning-grid">
        <article className="analytics-learning-card">
          <span className="section-kicker">PREFIX SEARCH · TRIE</span>
          <h3>Find a clue by word prefix</h3>
          <label className="analytics-field">Word or prefix
            <input aria-label="Trie prefix query" onChange={(event) => setPrefix(event.target.value)} placeholder="For example, a prefix from a discovered record" type="search" value={prefix} />
          </label>
          <p className="analytics-help">A standard word Trie matches the start of indexed words, not arbitrary substrings. It searches visible case text and currently discovered evidence only.</p>
          {prefix.trim() ? prefixResults.length ? (
            <ul className="analytics-search-results">
              {prefixResults.map((result) => (
                <li key={result.type + ':' + result.id}>
                  <ResultLink onOpenRecord={onOpenRecord} record={result.record} type={result.type} />
                  <small>Matching words: {result.matchingWords.join(', ')}</small>
                </li>
              ))}
            </ul>
          ) : <p className="analytics-empty" role="status">No visible case record contains a word with that prefix.</p> : <p className="analytics-empty">Enter a prefix to search the current visible record index.</p>}
          <p className="analytics-complexity">Lookup: O(L) expected; collecting results also visits matching Trie nodes.</p>
        </article>

        <article className="analytics-learning-card">
          <span className="section-kicker">DIRECT LOOKUP · HASH TABLE</span>
          <h3>Look up an evidence ID</h3>
          <label className="analytics-field">Exact evidence key
            <input aria-label="Exact evidence ID lookup" onChange={(event) => setExactKey(event.target.value)} placeholder="Enter a discovered evidence ID" type="search" value={exactKey} />
          </label>
          <p className="analytics-help">This custom separate-chaining table is rebuilt from discovered evidence, so an undiscovered ID returns no record.</p>
          {normalizedExactKey && (
            <div aria-live="polite" className="analytics-lookup-result">
              <p>Bucket {hashBucket} · {hashMatch ? 'key found' : 'key not found'}</p>
              {hashMatch ? <ResultLink onOpenRecord={onOpenRecord} record={hashMatch} /> : <p className="analytics-empty">No discovered evidence uses that exact ID.</p>}
            </div>
          )}
          <div className="analytics-stat-line"><span>{tableStats.entryCount} entries</span><span>{tableStats.bucketCount} buckets</span><span>{tableStats.collisionCount} collisions</span></div>
          <div className="hash-bucket-grid" aria-label="Current discovered evidence hash table buckets">
            {hashBuckets.map((bucket, index) => (
              <div className={'hash-bucket' + (bucket.length > 1 ? ' has-collision' : '')} key={index}>
                <strong>Bucket {index}{bucket.length > 1 ? ' · collision' : ''}</strong>
                {bucket.length ? bucket.map(([id, record]) => <span key={id}>{id} · {record.title}</span>) : <span className="is-empty">Empty</span>}
              </div>
            ))}
          </div>
          <p className="analytics-complexity">Average lookup O(1), worst case O(n); hashing the key itself takes O(K).</p>
        </article>

        <article className="analytics-learning-card">
          <span className="section-kicker">ORDERED LOOKUP · BST</span>
          <h3>Search and traverse evidence IDs</h3>
          <label className="analytics-field">Search exact evidence ID
            <input aria-label="BST evidence ID lookup" onChange={(event) => setExactKey(event.target.value)} placeholder="Enter a discovered evidence ID" type="search" value={exactKey} />
          </label>
          {normalizedExactKey && <p aria-live="polite" className="analytics-lookup-result">{bstMatch ? 'BST search found ' + bstMatch.id + ' · ' + bstMatch.title : 'BST search did not find that discovered key.'}</p>}
          <p className="analytics-help">The real BST is populated from the same discovered record set. Its in-order traversal produces lexicographically ordered evidence IDs.</p>
          {orderedRecords.length ? (
            <ol className="bst-order-list" aria-label="BST in-order traversal">
              {orderedRecords.map(({ key, value }, index) => <li key={key}><span>{index + 1}</span><strong>{key}</strong><small>{value.title}</small></li>)}
            </ol>
          ) : <p className="analytics-empty">Discover evidence to populate this BST.</p>}
          <p className="analytics-complexity">Search is typically O(log n) when reasonably balanced, O(n) worst case. Traversal is O(n).</p>
        </article>

        <article className="analytics-learning-card">
          <span className="section-kicker">ORDERED RANGE · B+ TREE</span>
          <h3>Scan an inclusive evidence ID range</h3>
          <div className="analytics-range-fields">
            <label className="analytics-field">Start ID<input aria-label="B+ Tree range start ID" onChange={(event) => setRangeStart(event.target.value)} placeholder="Start key" value={rangeStart} /></label>
            <label className="analytics-field">End ID<input aria-label="B+ Tree range end ID" onChange={(event) => setRangeEnd(event.target.value)} placeholder="End key" value={rangeEnd} /></label>
          </div>
          <p className="analytics-help">Both endpoints are included when present. The index contains discovered evidence only, and the B+ Tree scans linked leaves in key order.</p>
          {rangeStart.trim() && rangeEnd.trim() ? rangeResults.length ? (
            <ul className="analytics-search-results">{rangeResults.map((record) => <li key={record.id}><ResultLink onOpenRecord={onOpenRecord} record={record} /></li>)}</ul>
          ) : <p className="analytics-empty" role="status">No discovered evidence lies in that ID range.</p> : <p className="analytics-empty">Enter both endpoints to run a range query.</p>}
          <div className="analytics-stat-line"><span>Height {bPlusStats.height}</span><span>{bPlusStats.leafCount} leaves</span><span>{bPlusStats.internalNodeCount} internal nodes</span></div>
          <p className="analytics-complexity">Lookup is typically O(log n); a range returning k entries is approximately O(log n + k).</p>
        </article>
      </div>
    </section>
  )
}

export default AlgorithmPerformanceLab
