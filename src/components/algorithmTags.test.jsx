import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import EvidenceRelationshipNetwork from './EvidenceRelationshipNetwork.jsx'
import GraphExplorer from './GraphExplorer.jsx'
import IntelligentClueSearch from './IntelligentClueSearch.jsx'
import SuspectAnalysis from './SuspectAnalysis.jsx'
import { createCaseIndex } from '../data/caseIndex.js'
import { createClueSearchIndex } from '../data/clueSearchIndex.js'
import { case001 } from '../data/case001.js'

const caseIndex = createCaseIndex(case001)
const discoveredEvidenceIds = new Set(['E001'])

describe('algorithm tags on gameplay sections', () => {
  it('labels the crime scene map with the graph algorithm behind it', () => {
    const markup = renderToStaticMarkup(
      <GraphExplorer
        corridorWeights={case001.corridorWeights}
        discoveredEvidenceIds={discoveredEvidenceIds}
        locations={case001.locations}
        onSelectLocation={vi.fn()}
      />,
    )

    expect(markup).toContain('algorithm-tag')
    expect(markup).toContain('Graph · Dijkstra shortest path')
  })

  it('labels the clue search with its trie prefix index', () => {
    const markup = renderToStaticMarkup(
      <IntelligentClueSearch
        clueSearchIndex={createClueSearchIndex(case001)}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onSelectResult={vi.fn()}
      />,
    )

    expect(markup).toContain('algorithm-tag')
    expect(markup).toContain('Trie · prefix search')
  })

  it('labels the evidence network and suspect analysis with their algorithms', () => {
    const networkMarkup = renderToStaticMarkup(
      <EvidenceRelationshipNetwork
        caseFile={case001}
        caseIndex={caseIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onOpenRecord={vi.fn()}
        onRequestJournalEntry={vi.fn()}
        onSelectTimelineEvent={vi.fn()}
      />,
    )
    const analysisMarkup = renderToStaticMarkup(
      <SuspectAnalysis
        caseFile={case001}
        caseIndex={caseIndex}
        discoveredEvidenceIds={discoveredEvidenceIds}
        onSelectEvidence={vi.fn()}
      />,
    )

    expect(networkMarkup).toContain('Graph relationships')
    expect(analysisMarkup).toContain('Ranking algorithm')
  })
})
