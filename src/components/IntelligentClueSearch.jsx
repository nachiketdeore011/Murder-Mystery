import { useMemo, useState } from 'react'

function getCurrentWordPrefix(value) {
  return value.match(/[\p{L}\p{N}]+$/u)?.[0] ?? ''
}

function HighlightedSuggestion({ word, prefix }) {
  const splitAt = Math.min(word.length, prefix.length)
  return <>{splitAt > 0 && <mark>{word.slice(0, splitAt)}</mark>}{word.slice(splitAt)}</>
}

function getTypeLabel(type) {
  return type === 'timeline' ? 'Timeline event' : type[0].toUpperCase() + type.slice(1)
}

function IntelligentClueSearch({ clueSearchIndex, discoveredEvidenceIds, onSelectResult }) {
  const [query, setQuery] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const prefix = getCurrentWordPrefix(query)
  const suggestions = useMemo(
    () => prefix ? clueSearchIndex.getClueSearchSuggestions(prefix, 8) : [],
    [clueSearchIndex, prefix],
  )
  const results = useMemo(
    () => prefix ? clueSearchIndex.searchCluesByPrefix(prefix, { limit: 12 }) : [],
    [clueSearchIndex, prefix],
  )
  const suggestionsOpen = suggestions.length > 0 && !suggestionsDismissed

  const chooseSuggestion = (word) => {
    setQuery(word)
    setActiveSuggestion(-1)
    setSuggestionsDismissed(true)
    setStatusMessage(`Showing records associated with “${word}”.`)
  }

  const chooseResult = (result) => {
    const message = onSelectResult(result)
    setStatusMessage(message || `Selected ${getTypeLabel(result.type).toLowerCase()}: ${result.title}.`)
    setSuggestionsDismissed(true)
    setActiveSuggestion(-1)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setSuggestionsDismissed(false)
      setActiveSuggestion((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setSuggestionsDismissed(false)
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Escape') {
      setSuggestionsDismissed(true)
      setActiveSuggestion(-1)
    } else if (event.key === 'Enter' && suggestionsOpen && activeSuggestion >= 0) {
      event.preventDefault()
      chooseSuggestion(suggestions[activeSuggestion].word)
    } else if (event.key === 'Enter' && results.length) {
      event.preventDefault()
      chooseResult(results[0])
    }
  }

  return (
    <section aria-labelledby="intelligent-search-title" className="investigation-section intelligent-clue-search">
      <div className="section-heading-row">
        <div>
          <span className="section-kicker">WORD-PREFIX INDEX</span>
          <h2 id="intelligent-search-title">Intelligent Clue Search</h2>
        </div>
        <span className="section-count">Trie · case records</span>
      </div>
      <p className="section-intro">Search words from evidence, profiles, rooms and reported events. Prefix matching starts at the beginning of a word; it does not search inside a word.</p>

      <div className="intelligent-search-controls">
        <label className="control-label" htmlFor="intelligent-clue-input">Word or partial word
          <input
            aria-activedescendant={suggestionsOpen && activeSuggestion >= 0 ? `clue-suggestion-${activeSuggestion}` : undefined}
            aria-autocomplete="list"
            aria-controls="intelligent-clue-suggestions"
            aria-expanded={suggestionsOpen}
            autoComplete="off"
            id="intelligent-clue-input"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveSuggestion(-1)
              setSuggestionsDismissed(false)
              setStatusMessage('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="Try rah, study, gar, or interru"
            role="combobox"
            value={query}
          />
        </label>
        <button
          className="button button-secondary"
          disabled={!query}
          onClick={() => {
            setQuery('')
            setActiveSuggestion(-1)
            setSuggestionsDismissed(false)
            setStatusMessage('Search cleared.')
          }}
          type="button"
        >Clear search</button>
      </div>

      {suggestionsOpen && (
        <ul aria-label="Word prefix suggestions" className="clue-suggestion-list" id="intelligent-clue-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              aria-selected={activeSuggestion === index}
              className={activeSuggestion === index ? 'is-active' : ''}
              id={`clue-suggestion-${index}`}
              key={suggestion.word.toLowerCase()}
              onClick={() => chooseSuggestion(suggestion.word)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveSuggestion(index)}
              role="option"
            >
              <span><HighlightedSuggestion prefix={prefix} word={suggestion.word} /></span>
              <small>{suggestion.records.length} linked record{suggestion.records.length === 1 ? '' : 's'}</small>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="intelligent-search-status">
        {statusMessage || (prefix
          ? `${results.length} matching record${results.length === 1 ? '' : 's'} shown for words beginning “${prefix}”.`
          : 'Type at least one letter to see word suggestions and matching records.')}
      </div>

      {prefix && results.length > 0 && (
        <ul aria-label="Matching case records" className="clue-search-results">
          {results.map((result) => {
            const isSealed = result.type === 'evidence' && !discoveredEvidenceIds.has(result.id)
            return (
              <li key={`${result.type}:${result.id}`}>
                <button className="clue-search-result" onClick={() => chooseResult(result)} type="button">
                  <span className="clue-result-meta"><span>{getTypeLabel(result.type)}</span><code>{result.id}</code></span>
                  <strong>{result.title}</strong>
                  <span className="clue-result-matches">Matched: {result.matchingWords.slice(0, 3).join(', ')}</span>
                  {isSealed && <small className="clue-result-sealed">Sealed · search does not discover evidence</small>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {prefix && results.length === 0 && <p className="intelligent-search-empty">No case records contain a word beginning with “{prefix}”. Try another prefix.</p>}
    </section>
  )
}

export default IntelligentClueSearch
