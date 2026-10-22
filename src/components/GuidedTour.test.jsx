import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import GuidedTour, { GUIDED_TOUR_STEPS } from './GuidedTour.jsx'

function collectElementIds(directory) {
  const ids = new Set()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.jsx')) continue
    const source = readFileSync(join(directory, entry.name), 'utf8')
    for (const match of source.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1])
  }
  return ids
}

describe('guided tour', () => {
  it('opens on the first investigation section', () => {
    const markup = renderToStaticMarkup(<GuidedTour onDismiss={() => {}} />)

    expect(markup).toContain('GUIDED TOUR')
    expect(markup).toContain('Crime Scene Map')
    expect(markup).toContain('Skip tour')
    expect(markup).toContain('Next section')
  })

  it('walks a first-time player through the sections that do the work', () => {
    expect(GUIDED_TOUR_STEPS.map((step) => step.section)).toEqual([
      'Crime Scene Map',
      'Intelligent Clue Search',
      'Suspects',
      'Deduction Lab',
      'Make Final Accusation',
    ])
  })

  it('points only at element ids that really exist on the page', () => {
    const sourceRoot = fileURLToPath(new URL('..', import.meta.url))
    const ids = new Set([
      ...collectElementIds(join(sourceRoot, 'components')),
      ...collectElementIds(join(sourceRoot, 'pages')),
    ])

    for (const step of GUIDED_TOUR_STEPS) {
      expect(ids.has(step.targetId)).toBe(true)
    }
  })
})
