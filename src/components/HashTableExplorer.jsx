import { useMemo, useState } from 'react'
import { HashTable } from '../dsa/HashTable.js'

function describeValue(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value || '(empty string)'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `Array with ${value.length} item${value.length === 1 ? '' : 's'}`
  if (value.name) return `${value.name}${value.role ? ` · ${value.role}` : ''}`
  if (value.title) return value.title
  if (value.id) return `Record ${value.id}`
  return 'Object value'
}

function HashTableExplorer({ caseIndex }) {
  const [table] = useState(() => new HashTable(4))
  const [revision, setRevision] = useState(0)
  const [keyInput, setKeyInput] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [operationResult, setOperationResult] = useState(null)
  const [isClearArmed, setIsClearArmed] = useState(false)

  const { buckets, stats } = useMemo(() => ({
    buckets: table.getBuckets(),
    stats: table.getStats(),
  }), [table, revision])

  const touchTable = () => setRevision((currentRevision) => currentRevision + 1)

  const handleInsert = (event) => {
    event.preventDefault()
    const wasPresent = table.has(keyInput)
    table.set(keyInput, valueInput)
    const bucketIndex = table.getBucketIndex(keyInput)
    touchTable()
    setOperationResult({
      kind: 'success',
      key: keyInput,
      bucketIndex,
      message: `${wasPresent ? 'Updated' : 'Inserted'} key ${keyInput === '' ? '“” (empty string)' : `“${keyInput}”`} in bucket ${bucketIndex}.`,
      value: valueInput,
    })
    setIsClearArmed(false)
  }

  const handleSearch = () => {
    const bucketIndex = table.getBucketIndex(keyInput)
    const found = table.has(keyInput)
    setOperationResult({
      kind: found ? 'success' : 'neutral',
      key: keyInput,
      bucketIndex,
      message: found
        ? `Found key ${keyInput === '' ? '“” (empty string)' : `“${keyInput}”`} in bucket ${bucketIndex}.`
        : `No entry for ${keyInput === '' ? 'the empty string key' : `“${keyInput}”`} in bucket ${bucketIndex}.`,
      value: found ? table.get(keyInput) : undefined,
    })
    setIsClearArmed(false)
  }

  const handleDelete = () => {
    const bucketIndex = table.getBucketIndex(keyInput)
    const deleted = table.delete(keyInput)
    if (deleted) touchTable()
    setOperationResult({
      kind: deleted ? 'success' : 'neutral',
      key: keyInput,
      bucketIndex,
      message: deleted
        ? `Deleted key ${keyInput === '' ? '“” (empty string)' : `“${keyInput}”`} from bucket ${bucketIndex}.`
        : `No entry to delete for ${keyInput === '' ? 'the empty string key' : `“${keyInput}”`} in bucket ${bucketIndex}.`,
    })
    setIsClearArmed(false)
  }

  const loadCaseExamples = () => {
    const examples = [
      ['S001', caseIndex.getSuspectById('S001')],
      ['E004', caseIndex.getEvidenceById('E004')],
      ['L003', caseIndex.getLocationById('L003')],
    ].filter(([, record]) => Boolean(record))

    examples.forEach(([id, record]) => table.set(id, record))
    touchTable()
    setOperationResult({
      kind: 'success',
      message: `Loaded ${examples.length} records from the current case. The explorer has its own table; case data remains unchanged.`,
    })
    setIsClearArmed(false)
  }

  const clearTable = () => {
    table.clear()
    touchTable()
    setOperationResult({ kind: 'success', message: 'The explorer table has been cleared.' })
    setIsClearArmed(false)
  }

  const activeBucketIndex = operationResult?.bucketIndex ?? null
  const currentKeyBucket = table.getBucketIndex(keyInput)

  return (
    <section aria-labelledby="hash-table-title" className="investigation-section hash-table-explorer">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">CASE INDEXING</span>
          <h2 id="hash-table-title">Hash Table Explorer</h2>
        </div>
        <span className="section-count">Separate chaining · string keys</span>
      </div>
      <p className="section-intro">
        A deterministic FNV-1a hash maps each string key to a bucket. When keys map to the same bucket, a chain stores them together so neither entry is lost.
        Above a 0.75 load factor, the table doubles its buckets and rehashes its entries. Lookup is average O(1), and worst-case O(n) when many keys share a bucket.
      </p>

      <div className="hash-table-layout">
        <div className="hash-table-controls">
          <form className="hash-table-form" onSubmit={handleInsert}>
            <label className="hash-field" htmlFor="hash-table-key">
              String key
              <input
                autoComplete="off"
                id="hash-table-key"
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="e.g. E004"
                type="text"
                value={keyInput}
              />
            </label>
            <label className="hash-field" htmlFor="hash-table-value">
              Value
              <input
                id="hash-table-value"
                onChange={(event) => setValueInput(event.target.value)}
                placeholder="Enter a value"
                type="text"
                value={valueInput}
              />
            </label>
            <div className="hash-action-row">
              <button className="button button-primary" type="submit">Insert / update</button>
              <button className="button button-secondary" onClick={handleSearch} type="button">Search key</button>
              <button className="button button-secondary" onClick={handleDelete} type="button">Delete key</button>
            </div>
          </form>

          <div className="hash-example-actions">
            <button className="hash-text-action" onClick={loadCaseExamples} type="button">Load current case examples</button>
            {!isClearArmed ? (
              <button className="hash-clear-action" disabled={stats.entryCount === 0} onClick={() => setIsClearArmed(true)} type="button">
                Clear table
              </button>
            ) : (
              <div className="hash-clear-confirm" role="group" aria-label="Confirm clearing the table">
                <span>Clear all {stats.entryCount} entries?</span>
                <button className="hash-clear-action is-confirm" onClick={clearTable} type="button">Confirm clear</button>
                <button className="hash-text-action" onClick={() => setIsClearArmed(false)} type="button">Cancel</button>
              </div>
            )}
          </div>

          <p className="hash-current-bucket">Current key maps to bucket <strong>{currentKeyBucket}</strong> at the present capacity.</p>
          <div aria-live="polite" className={`hash-operation-result${operationResult ? ` is-${operationResult.kind}` : ''}`}>
            {operationResult ? (
              <>
                <p>{operationResult.message}</p>
                {operationResult.bucketIndex !== undefined && operationResult.value !== undefined && (
                  <p className="hash-result-value"><span>Stored value</span>{describeValue(operationResult.value)}</p>
                )}
              </>
            ) : <p>Choose an operation to inspect or change this independent table.</p>}
          </div>
        </div>

        <dl className="hash-table-stats" aria-label="Hash table statistics">
          <div><dt>Entries</dt><dd>{stats.entryCount}</dd></div>
          <div><dt>Buckets</dt><dd>{stats.bucketCount}</dd></div>
          <div><dt>Load factor</dt><dd>{stats.loadFactor.toFixed(2)}</dd></div>
          <div><dt>Collisions</dt><dd>{stats.collisionCount}</dd></div>
        </dl>
      </div>

      <div className="hash-buckets-heading">
        <div>
          <span className="section-kicker">LIVE STRUCTURE</span>
          <h3>Bucket chains</h3>
        </div>
        <span className="hash-bucket-note">Highlighted bucket is the last operated-on key</span>
      </div>
      <div className="hash-bucket-grid" aria-label="Hash table bucket visualization">
        {buckets.map((bucket, bucketIndex) => (
          <article
            aria-label={`Bucket ${bucketIndex}, ${bucket.length} ${bucket.length === 1 ? 'entry' : 'entries'}${bucket.length > 1 ? ', collision chain' : ''}`}
            className={`hash-bucket${bucket.length > 1 ? ' has-collision' : ''}${activeBucketIndex === bucketIndex ? ' is-active' : ''}`}
            key={bucketIndex}
          >
            <div className="hash-bucket-heading">
              <span>Bucket {bucketIndex}</span>
              {bucket.length > 1 && <span className="hash-collision-badge">Collision · {bucket.length}</span>}
            </div>
            {bucket.length ? (
              <ul className="hash-chain-list">
                {bucket.map(([key, value]) => (
                  <li className="hash-chain-entry" key={key}>
                    <code>{key === '' ? '(empty string)' : key}</code>
                    <span>{describeValue(value)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="hash-bucket-empty">Empty</p>}
          </article>
        ))}
      </div>
      <p className="hash-table-footnote">Case examples use real CASE-001 records. This practice table is separate from the game’s case lookup indexes.</p>
    </section>
  )
}

export default HashTableExplorer
