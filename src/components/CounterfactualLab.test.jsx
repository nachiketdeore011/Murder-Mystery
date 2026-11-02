import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CounterfactualLab from './CounterfactualLab.jsx'
import { case001 } from '../data/case001.js'

function renderLab(discoveredEvidenceIds) {
  return renderToStaticMarkup(
    <CounterfactualLab
      caseFile={case001}
      discoveredEvidenceIds={new Set(discoveredEvidenceIds)}
      onSelectEvidence={vi.fn()}
    />,
  )
}

describe('counterfactual theory lab', () => {
  it('stays inactive until the investigator discovers a clue', () => {
    const markup = renderLab([])

    expect(markup).toContain('Discover a clue to activate the lab.')
    expect(markup).not.toContain('Study key checkout sheet')
  })

  it('only offers discovered clues as scenario inputs', () => {
    const markup = renderLab(['E001', 'E003'])

    expect(markup).toContain('Counterfactual Theory Lab')
    expect(markup).toContain('Study key checkout sheet')
    expect(markup).toContain('Main Hall CCTV stills')
    expect(markup).not.toContain('Ledger review page')
    expect(markup).toContain('Baseline compared with the current what-if scenario')
  })
})
