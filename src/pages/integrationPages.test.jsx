import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { case001 } from '../data/case001.js'
import About from './About.jsx'
import CaseFilesPlaceholder from './CaseFilesPlaceholder.jsx'

function renderCaseFiles({ discoveredEvidenceIds = new Set(), progress = {} } = {}) {
  return renderToStaticMarkup(
    <CaseFilesPlaceholder
      caseFile={case001}
      discoveredEvidenceIds={discoveredEvidenceIds}
      onOpenCase={vi.fn()}
      progress={progress}
    />,
  )
}

describe('integration placeholder pages', () => {
  it('shows the initial case status and an open action when no progress exists', () => {
    const markup = renderCaseFiles()

    expect(markup).toContain('UNINVESTIGATED')
    expect(markup).toContain('Open investigation')
    expect(markup).toContain(case001.title)
  })

  it('shows saved investigation progress and a resume action', () => {
    const markup = renderCaseFiles({ discoveredEvidenceIds: new Set(['E001']) })

    expect(markup).toContain('IN PROGRESS')
    expect(markup).toContain('Resume investigation')
  })

  it('recognizes saved journal and bookmark activity even before evidence is discovered', () => {
    const journalMarkup = renderCaseFiles({
      progress: { journalEntries: [{ id: 'note-1' }], bookmarks: { suspects: [], evidence: [], locations: [] } },
    })
    const bookmarkMarkup = renderCaseFiles({
      progress: { journalEntries: [], bookmarks: { suspects: [], evidence: ['E001'], locations: [] } },
    })

    expect(journalMarkup).toContain('IN PROGRESS')
    expect(journalMarkup).toContain('Resume investigation')
    expect(bookmarkMarkup).toContain('IN PROGRESS')
    expect(bookmarkMarkup).toContain('Resume investigation')
  })

  it('offers review when an accusation has been recorded', () => {
    const markup = renderCaseFiles({ progress: { completion: { selectedSuspectId: 'S001' } } })

    expect(markup).toContain('ACCUSATION RECORDED')
    expect(markup).toContain('Review completed case')
  })

  it('describes the implemented DSA features instead of listing them as future work', () => {
    const markup = renderToStaticMarkup(<About />)

    expect(markup).toContain('Graph traversal with BFS and DFS')
    expect(markup).toContain('B+ Tree evidence range indexing')
    expect(markup).toContain('Trie prefix search')
    expect(markup).toContain('not probabilities of guilt')
    expect(markup).not.toContain('future work')
  })
})
