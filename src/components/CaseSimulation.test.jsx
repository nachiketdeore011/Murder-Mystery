import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CaseSimulation, { SimulationAccusationForm } from './CaseSimulation.jsx'
import { case001 } from '../data/case001.js'
import { buildCaseSimulation } from '../simulation/caseSimulation.js'

function renderSimulation() {
  return renderToStaticMarkup(
    <CaseSimulation
      caseFile={case001}
      onOpenInvestigation={vi.fn()}
      onReturnHome={vi.fn()}
    />,
  )
}

const simulation = buildCaseSimulation()
const accusationStep = simulation.steps.find((step) => step.id === 'accusation')

describe('case simulation player', () => {
  it('opens on the first step with the step list and the controls', () => {
    const markup = renderSimulation()

    expect(markup).toContain('SIMULATION')
    expect(markup).toContain('Reported incident')
    expect(markup).toContain('Step 1 of ' + simulation.steps.length)
    expect(markup).toContain('aria-current="step"')
    expect(markup).toContain('Next step')
    expect(markup).toContain('Auto-play steps')
    expect(markup).toContain('Restart')
    expect(markup).toContain('Open the real investigation')
  })

  it('announces step changes through a live region', () => {
    const markup = renderSimulation()

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('Step 1 of ' + simulation.steps.length + ': Read the incident report')
  })

  it('shows the walkthrough disclaimer instead of pretending the route is discoverable', () => {
    const markup = renderSimulation()

    expect(markup).toContain('follows the case file')
    expect(markup).toContain('sealed clues are opened one card at a time')
  })

  it('carries the algorithm tag and the clue counter for the current step', () => {
    const markup = renderSimulation()

    expect(markup).toContain('algorithm-tag')
    expect(markup).toContain('No algorithm yet')
    expect(markup).toContain('clues discovered')
    expect(markup).toContain('0<span> / 12</span>')
  })

  it('lists every step of the walkthrough in order', () => {
    const markup = renderSimulation()

    for (const step of simulation.steps) {
      expect(markup, `the rail is missing "${step.title}"`).toContain(step.title)
    }
  })

  it('does not show the accusation form before the accusation step', () => {
    expect(renderSimulation()).not.toContain('Submit accusation')
  })

  it('asks for a suspect, cited clues and reasoning at the accusation', () => {
    const markup = renderToStaticMarkup(
      <SimulationAccusationForm
        caseFile={case001}
        choice={{ ...accusationStep.choice, suspects: accusationStep.detail.suspects }}
        clueOptions={accusationStep.detail.clueOptions}
        discoveredEvidenceIds={accusationStep.discoveredIds}
        simulation={simulation}
      />,
    )

    expect(markup).toContain(accusationStep.choice.prompt)
    expect(markup).toContain('Cite the clues that carry your case')
    expect(markup).toContain('type="radio"')
    expect(markup).toContain('type="checkbox"')
    expect(markup).toContain('Explain your reasoning')
    for (const suspect of case001.suspects) expect(markup).toContain(suspect.name)
    for (const clue of accusationStep.detail.clueOptions) expect(markup).toContain(clue.title)
  })

  it('keeps the reconstruction\u2019s answer hidden until it is asked for', () => {
    const markup = renderToStaticMarkup(
      <SimulationAccusationForm
        caseFile={case001}
        choice={{ ...accusationStep.choice, suspects: accusationStep.detail.suspects }}
        clueOptions={accusationStep.detail.clueOptions}
        discoveredEvidenceIds={accusationStep.discoveredIds}
        simulation={simulation}
      />,
    )

    expect(markup).not.toContain('The reconstruction names')
    expect(markup).not.toContain('Show the reconstruction')
  })
})
