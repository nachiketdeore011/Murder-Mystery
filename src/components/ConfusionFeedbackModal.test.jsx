import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ConfusionFeedbackModal from './ConfusionFeedbackModal.jsx'

function renderModal(overrides = {}) {
  return renderToStaticMarkup(
    <ConfusionFeedbackModal isOpen onClose={() => {}} onSubmit={() => {}} {...overrides} />,
  )
}

describe('confusion feedback modal', () => {
  it('asks one question with an optional note field', () => {
    const markup = renderModal()

    expect(markup).toContain('Something confusing?')
    expect(markup).toContain('What was confusing just now?')
    expect(markup).toContain('<textarea')
    expect(markup).toContain('id="confusion-feedback-note"')
    expect(markup).toContain('(optional)')
  })

  it('keeps the how-to-play dialog semantics', () => {
    const markup = renderModal()

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="confusion-feedback-title"')
    expect(markup).toContain('aria-describedby="confusion-feedback-description"')
    expect(markup).toContain('id="confusion-feedback-title"')
    expect(markup).toContain('id="confusion-feedback-description"')
  })

  it('offers a labelled send action and a cancel action', () => {
    const markup = renderModal()

    expect(markup).toContain('Send note')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('aria-label="Close feedback"')
  })

  it('says the note stays in this session and is never sent anywhere', () => {
    expect(renderModal()).toContain('never sent anywhere')
  })

  it('renders nothing while it is closed', () => {
    expect(renderToStaticMarkup(<ConfusionFeedbackModal isOpen={false} onClose={() => {}} onSubmit={() => {}} />)).toBe('')
  })
})
