import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EvidenceCard from './EvidenceCard.jsx'

const sealedEvidence = {
  id: 'E003',
  title: 'Main Hall CCTV stills',
  category: 'Digital record',
  description: 'Two still images place Rahul and Meera in the Main Hall at 9:41 PM.',
  reliability: 'medium',
}

function renderCard({ isDiscovered = false, locationName = 'Main Hall' } = {}) {
  return renderToStaticMarkup(
    <EvidenceCard
      evidence={sealedEvidence}
      isDiscovered={isDiscovered}
      locationName={locationName}
      onDiscover={() => {}}
      onInspect={() => {}}
    />,
  )
}

describe('evidence card', () => {
  it('tells the player where a sealed clue is filed and how to open it', () => {
    const markup = renderCard()

    expect(markup).toContain('Filed in the Main Hall.')
    expect(markup).toContain('Sealed until you inspect it.')
    expect(markup).toContain('Inspect clue')
  })

  it('names the room in the accessible label of the inspect action', () => {
    expect(renderCard()).toContain('aria-label="Inspect the clue filed in the Main Hall"')
  })

  it('does not promise a room when the case data has none', () => {
    const markup = renderCard({ locationName: null })

    expect(markup).toContain('Filed in an unlisted room.')
  })

  it('shows the clue itself once it is discovered', () => {
    const markup = renderCard({ isDiscovered: true })

    expect(markup).toContain('Main Hall CCTV stills')
    expect(markup).toContain('View details')
    expect(markup).not.toContain('Filed in the Main Hall.')
  })
})
