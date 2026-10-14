import { useMemo, useState } from 'react'
import { normalizeTrieWord, Trie } from '../dsa/Trie.js'

function getTrieLayout(root) {
  const nodes = []
  const edges = []
  let leafIndex = 0
  let maximumDepth = 0
  const horizontalGap = 52
  const verticalGap = 62

  function visit(node, depth) {
    maximumDepth = Math.max(maximumDepth, depth)
    const childPositions = node.children.map((child) => visit(child, depth + 1))
    const x = childPositions.length
      ? (childPositions[0].x + childPositions[childPositions.length - 1].x) / 2
      : 34 + leafIndex++ * horizontalGap
    const positioned = {
      id: node.id,
      character: node.character || 'ROOT',
      prefix: node.prefix,
      terminal: node.terminal,
      word: node.word,
      depth,
      x,
      y: 34 + depth * verticalGap,
    }
    nodes.push(positioned)
    childPositions.forEach((child) => edges.push({ id: `${positioned.id}:${child.id}`, parent: positioned, child }))
    return positioned
  }

  visit(root, 0)
  return {
    nodes,
    edges,
    width: Math.max(460, 68 + Math.max(leafIndex, 1) * horizontalGap),
    height: Math.max(128, 72 + (maximumDepth + 1) * verticalGap),
  }
}

function addWordPaths(word, prefixSet, terminalSet = null) {
  const normalized = normalizeTrieWord(word).normalized
  let path = ''
  for (const character of normalized) {
    path += character
    prefixSet.add(path)
  }
  terminalSet?.add(normalized)
}

function TrieDiagram({ structure, highlightedWords, queryPrefix, label }) {
  const layout = getTrieLayout(structure)
  const highlightedPrefixes = new Set()
  const terminalWords = new Set()
  highlightedWords.forEach((word) => addWordPaths(word, highlightedPrefixes, terminalWords))
  if (queryPrefix) addWordPaths(queryPrefix, highlightedPrefixes)

  return (
    <div aria-label={`${label} diagram; scroll to inspect the character paths`} className="trie-diagram-scroll" role="region" tabIndex="0">
      <svg
        aria-label={`${label} with ${layout.nodes.filter(({ terminal }) => terminal).length} stored words`}
        className="trie-diagram"
        height={layout.height}
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
      >
        <g aria-hidden="true" className="trie-diagram-edges">
          {layout.edges.map(({ id, parent, child }) => (
            <line key={id} x1={parent.x} x2={child.x} y1={parent.y + 14} y2={child.y - 14} />
          ))}
        </g>
        {layout.nodes.map((node) => {
          const isOnPath = highlightedPrefixes.has(node.prefix)
          const isResultWord = node.terminal && terminalWords.has(normalizeTrieWord(node.word).normalized)
          return (
            <g
              className={`trie-diagram-node${node.terminal ? ' is-terminal' : ''}${isOnPath ? ' is-path-match' : ''}${isResultWord ? ' is-word-match' : ''}`}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
            >
              <title>{node.terminal ? `Word ends here: ${node.word}` : `Character ${node.character || 'root'}, prefix ${node.prefix || 'empty'}`}</title>
              <circle r={node.character === 'ROOT' ? 15 : 13} />
              <text dominantBaseline="middle" textAnchor="middle">{node.character === 'ROOT' ? 'ROOT' : node.character}</text>
              {node.terminal && <text className="trie-terminal-marker" textAnchor="middle" y="27">END</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TrieStats({ stats }) {
  return (
    <dl className="trie-stats">
      <div><dt>Words</dt><dd>{stats.wordCount}</dd></div>
      <div><dt>Trie nodes (root included)</dt><dd>{stats.nodeCount}</dd></div>
      <div><dt>Longest word</dt><dd>{stats.maximumWordLength}</dd></div>
    </dl>
  )
}

function RelatedRecords({ payloads, onSelectRecord }) {
  if (!payloads?.length) return null
  return (
    <ul className="trie-related-records">
      {payloads.map((payload, index) => {
        if (payload.type === 'practice') {
          return <li key={`practice:${index}`}><span>{payload.title}</span></li>
        }
        return (
          <li key={`${payload.type}:${payload.id}`}>
            <button onClick={() => onSelectRecord(payload)} type="button">
              <span>{payload.type === 'timeline' ? 'Timeline' : payload.type}</span>
              <code>{payload.id}</code>
              <strong>{payload.title}</strong>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function TrieExplorer({ clueSearchIndex, onSelectRecord }) {
  const [demoTrie] = useState(() => new Trie())
  const [revision, setRevision] = useState(0)
  const [insertWord, setInsertWord] = useState('')
  const [insertValue, setInsertValue] = useState('')
  const [exactQuery, setExactQuery] = useState('')
  const [prefixQuery, setPrefixQuery] = useState('')
  const [exactResult, setExactResult] = useState(null)
  const [prefixResults, setPrefixResults] = useState([])
  const [highlightedWords, setHighlightedWords] = useState([])
  const [highlightedPrefix, setHighlightedPrefix] = useState('')
  const [message, setMessage] = useState('The practice Trie is separate from the production clue-search index.')
  const structure = useMemo(() => demoTrie.getStructure(), [demoTrie, revision])
  const entries = useMemo(() => demoTrie.getAllEntries(), [demoTrie, revision])
  const stats = demoTrie.getStats()
  const casePreset = useMemo(
    () => clueSearchIndex.getAllIndexedWords().filter(({ word }) => Array.from(word).length >= 3).slice(0, 32),
    [clueSearchIndex],
  )

  const refreshDemo = () => setRevision((current) => current + 1)

  const handleInsert = (event) => {
    event.preventDefault()
    try {
      const inserted = demoTrie.insert(insertWord, { type: 'practice', title: insertValue.trim() || `Practice value for ${insertWord.trim()}` })
      refreshDemo()
      setExactResult(null)
      setPrefixResults([])
      setHighlightedWords([])
      setHighlightedPrefix('')
      setMessage(inserted ? `Inserted “${insertWord.trim()}” into the practice Trie.` : `“${insertWord.trim()}” was already indexed; one word remains and its existing value associations are retained.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleExactSearch = (event) => {
    event.preventDefault()
    try {
      const found = demoTrie.search(exactQuery)
      const matchedEntry = found ? demoTrie.autocomplete(exactQuery, 1).find(
        ({ word }) => normalizeTrieWord(word).normalized === normalizeTrieWord(exactQuery).normalized,
      ) : null
      setExactResult(found ? matchedEntry : null)
      setPrefixResults([])
      setHighlightedWords(found ? [matchedEntry.word] : [])
      setHighlightedPrefix(exactQuery)
      setMessage(found ? `Exact word found: ${matchedEntry.word}.` : `No complete word matches “${exactQuery.trim()}”.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handlePrefixSearch = (event) => {
    event.preventDefault()
    try {
      if (!prefixQuery.trim()) {
        setPrefixResults([])
        setHighlightedWords([])
        setHighlightedPrefix('')
        setMessage('Enter a prefix to check for matching words.')
        return
      }
      const hasPrefix = demoTrie.startsWith(prefixQuery)
      const matches = hasPrefix ? demoTrie.autocomplete(prefixQuery, 12) : []
      setPrefixResults(matches)
      setExactResult(null)
      setHighlightedWords(matches.map(({ word }) => word))
      setHighlightedPrefix(prefixQuery)
      setMessage(hasPrefix
        ? `Prefix exists. ${matches.length} autocomplete result${matches.length === 1 ? '' : 's'} shown for “${prefixQuery.trim()}”.`
        : `No word begins with “${prefixQuery.trim()}”.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleDelete = () => {
    try {
      const removed = demoTrie.delete(exactQuery)
      if (removed) refreshDemo()
      setExactResult(null)
      setPrefixResults([])
      setHighlightedWords([])
      setHighlightedPrefix(exactQuery)
      setMessage(removed ? `Deleted “${exactQuery.trim()}” from the practice Trie.` : `No complete word “${exactQuery.trim()}” was available to delete.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const loadCasePreset = () => {
    demoTrie.clear()
    for (const { word, records } of casePreset) {
      for (const record of records) demoTrie.insert(word, record)
    }
    refreshDemo()
    setExactResult(null)
    setPrefixResults([])
    setHighlightedWords([])
    setHighlightedPrefix('')
    setMessage(`Loaded ${casePreset.length} words sampled from real CASE-001 indexed records. The case index is unchanged.`)
  }

  const resetDemo = () => {
    demoTrie.clear()
    refreshDemo()
    setInsertWord('')
    setInsertValue('')
    setExactQuery('')
    setPrefixQuery('')
    setExactResult(null)
    setPrefixResults([])
    setHighlightedWords([])
    setHighlightedPrefix('')
    setMessage('The independent practice Trie has been reset; case records and search index are unchanged.')
  }

  const selectPayload = (payload) => {
    if (payload.type === 'practice') {
      setMessage(`Practice value: ${payload.title}.`)
      return
    }
    const result = onSelectRecord(payload)
    setMessage(result || `Selected ${payload.type} record ${payload.id}.`)
  }

  return (
    <section aria-labelledby="trie-explorer-title" className="investigation-section trie-explorer">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">PREFIX-BASED INDEX</span>
          <h2 id="trie-explorer-title">Trie Explorer</h2>
        </div>
        <span className="section-count">Word and prefix search</span>
      </div>
      <p className="section-intro">A Trie stores characters along shared paths. Exact search checks a complete word; prefix search follows a partial path and can return many completions. This word index complements the Hash Table, BST, B+ Tree and Graph rather than replacing them.</p>

      <div className="trie-concept-panel">
        <div>
          <span className="section-kicker">HOW IT WORKS</span>
          <h3>Follow the characters</h3>
          <p>Each edge stores one character. Words with the same beginning share their path, and a terminal marker shows where a complete word ends. A word Trie searches prefixes from the start of each token; it does not find arbitrary text in the middle of a word.</p>
          <p>Case-data terms are tokenized from real evidence, suspect, location and reported-event fields. Punctuation separates tokens, matching is case-insensitive, and record associations are retained when several records use the same word.</p>
        </div>
        <div className="trie-complexity-wrap">
          <table className="trie-complexity-table">
            <caption>Expected operation cost</caption>
            <thead><tr><th scope="col">Operation</th><th scope="col">Cost</th></tr></thead>
            <tbody>
              <tr><th scope="row">Insert / exact / prefix</th><td>O(L)</td></tr>
              <tr><th scope="row">Autocomplete</th><td>O(L + V + R)</td></tr>
              <tr><th scope="row">Delete</th><td>O(L)</td></tr>
            </tbody>
          </table>
          <p>L is the word or prefix length; V is the matching-subtree nodes visited, and R is the returned output size. Child lookups use a Map. Index construction depends on the total text processed.</p>
        </div>
      </div>

      <article aria-labelledby="trie-practice-title" className="trie-workbench">
        <div className="trie-panel-heading">
          <div><span className="section-kicker">INDEPENDENT DEMO</span><h3 id="trie-practice-title">Practice Trie</h3></div>
          <div className="trie-toolbar">
            <button className="button button-secondary" onClick={loadCasePreset} type="button">Load CASE-001 word sample ({casePreset.length})</button>
            <button className="button button-secondary" disabled={demoTrie.isEmpty()} onClick={resetDemo} type="button">Reset Trie</button>
          </div>
        </div>

        <div className="trie-statement" aria-live="polite">{message}</div>
        <TrieStats stats={stats} />

        <div className="trie-control-grid">
          <form className="trie-control-form" onSubmit={handleInsert}>
            <label className="trie-field">Word to insert
              <input onChange={(event) => setInsertWord(event.target.value)} placeholder="e.g. clue" value={insertWord} />
            </label>
            <label className="trie-field">Optional value
              <input onChange={(event) => setInsertValue(event.target.value)} placeholder="A short note" value={insertValue} />
            </label>
            <button className="button button-primary" type="submit">Insert word</button>
          </form>

          <form className="trie-control-form trie-search-form" onSubmit={handleExactSearch}>
            <label className="trie-field">Exact search or delete
              <input onChange={(event) => setExactQuery(event.target.value)} placeholder="Complete word" value={exactQuery} />
            </label>
            <div className="trie-inline-actions">
              <button className="button button-secondary" type="submit">Search exact</button>
              <button className="button button-secondary" disabled={!exactQuery.trim()} onClick={handleDelete} type="button">Delete word</button>
            </div>
          </form>

          <form className="trie-control-form trie-search-form" onSubmit={handlePrefixSearch}>
            <label className="trie-field">Prefix autocomplete
              <input onChange={(event) => setPrefixQuery(event.target.value)} placeholder="e.g. inv" value={prefixQuery} />
            </label>
            <button className="button button-secondary" type="submit">Check prefix</button>
          </form>
        </div>

        {(exactResult || prefixResults.length > 0) && (
          <div className="trie-result-panel" aria-live="polite">
            {exactResult && (
              <div className="trie-result-group">
                <h4>Exact match · {exactResult.word}</h4>
                <RelatedRecords onSelectRecord={selectPayload} payloads={exactResult.payloads} />
              </div>
            )}
            {prefixResults.length > 0 && (
              <div className="trie-result-group">
                <h4>Autocomplete results · {prefixResults.length}</h4>
                <ol className="trie-autocomplete-list">
                  {prefixResults.map(({ word, payloads }) => (
                    <li key={normalizeTrieWord(word).normalized}>
                      <code>{word}</code>
                      <RelatedRecords onSelectRecord={selectPayload} payloads={payloads} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="trie-diagram-heading"><span className="section-kicker">ACTUAL CHARACTER TREE</span><span>Gold path = current prefix · filled node = complete word</span></div>
        {demoTrie.isEmpty()
          ? <div className="trie-empty-state">Load the CASE-001 word sample or insert a word to build the Trie.</div>
          : <TrieDiagram highlightedWords={highlightedWords} label="Practice Trie" queryPrefix={highlightedPrefix} structure={structure} />}

        <details className="trie-word-list">
          <summary>View all indexed words ({entries.length})</summary>
          {entries.length
            ? <ol>{entries.map(({ word }) => <li key={normalizeTrieWord(word).normalized}><code>{word}</code></li>)}</ol>
            : <p>The Trie is empty.</p>}
        </details>
        <p className="trie-data-note">The CASE-001 preset is a small sample of words and record associations drawn from the production index. This demo owns a separate Trie; insertions and deletions here do not change live clue search or evidence discovery.</p>
      </article>
    </section>
  )
}

export default TrieExplorer
