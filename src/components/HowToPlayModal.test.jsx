import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HowToPlayModal from './HowToPlayModal.jsx'

function renderModal() {
  return renderToStaticMarkup(<HowToPlayModal isOpen onClose={() => {}} />)
}

describe('how to play modal', () => {
  it('names the investigation sections that do each job', () => {
    const markup = renderModal()

    expect(markup).toContain('Crime Scene Map')
    expect(markup).toContain('Intelligent Clue Search')
    expect(markup).toContain('Suspects')
    expect(markup).toContain('Deduction Lab')
    expect(markup).toContain('Make Final Accusation')
  })

  it('explains how a sealed clue opens up', () => {
    const markup = renderModal()

    expect(markup).toContain('sealed until you inspect their card')
    expect(markup).toContain('Crime Scene Map')
  })

  it('keeps the existing dialog semantics', () => {
    const markup = renderModal()

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="how-to-play-title"')
    expect(markup).toContain('aria-describedby="how-to-play-description"')
    expect(markup).toContain('id="how-to-play-title"')
    expect(markup).toContain('id="how-to-play-description"')
  })

  it('renders nothing while it is closed', () => {
    expect(renderToStaticMarkup(<HowToPlayModal isOpen={false} onClose={() => {}} />)).toBe('')
  })
})
