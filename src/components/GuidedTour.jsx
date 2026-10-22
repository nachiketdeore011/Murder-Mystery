import { useEffect, useRef, useState } from 'react'

// The tour walks a first-time player through the sections that do the work.
export const GUIDED_TOUR_STEPS = Object.freeze([
  {
    id: 'crime-scene-map',
    section: 'Crime Scene Map',
    targetId: 'crime-scene-map',
    text: 'Travel between mansion rooms. Every clue is filed in one of them, and the map shows how much of each room you have uncovered.',
  },
  {
    id: 'intelligent-clue-search',
    section: 'Intelligent Clue Search',
    targetId: 'intelligent-search-title',
    text: 'Find clues fast by typing the start of any word. The search runs on a Trie prefix index, so it matches from the beginning of a word only.',
  },
  {
    id: 'suspects',
    section: 'Suspects',
    targetId: 'suspects-title',
    text: 'Open each suspect card for their account and motive, then compare follow-up priorities in Suspect Analysis.',
  },
  {
    id: 'deduction-lab',
    section: 'Deduction Lab',
    targetId: 'deduction-lab',
    text: 'Test one theory at a time. The lab shows which discovered clues support it and which documented facts conflict with it.',
  },
  {
    id: 'final-accusation',
    section: 'Make Final Accusation',
    targetId: 'final-accusation',
    text: 'Name one suspect, cite the clues that matter, and explain your reasoning.',
  },
])

function GuidedTour({ onDismiss }) {
  const [stepIndex, setStepIndex] = useState(0)
  const titleRef = useRef(null)
  const previouslyFocusedElement = useRef(null)

  useEffect(() => {
    previouslyFocusedElement.current = document.activeElement
    // preventScroll matters: the banner is fixed to the bottom of the viewport,
    // and a plain focus() would drag the page down to the end of the case file.
    titleRef.current?.focus({ preventScroll: true })
    return () => {
      previouslyFocusedElement.current?.focus?.({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onDismiss('skipped')
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [stepIndex])

  const step = GUIDED_TOUR_STEPS[stepIndex]
  const isLastStep = stepIndex === GUIDED_TOUR_STEPS.length - 1

  const showStep = (nextIndex) => {
    setStepIndex(nextIndex)
    const target = document.getElementById(GUIDED_TOUR_STEPS[nextIndex].targetId)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside aria-label="Guided tour" className="guided-tour" role="region">
      <div className="guided-tour-inner">
        <div aria-live="polite" className="guided-tour-copy">
          <span className="section-kicker">GUIDED TOUR · STEP {stepIndex + 1} OF {GUIDED_TOUR_STEPS.length}</span>
          <span className="guided-tour-title" ref={titleRef} tabIndex={-1}>{step.section}</span>
          <span className="guided-tour-text">{step.text}</span>
        </div>
        <div className="guided-tour-actions">
          <button className="button button-secondary" onClick={() => onDismiss('skipped')} type="button">Skip tour</button>
          <button
            className="button button-primary"
            onClick={() => (isLastStep ? onDismiss('completed') : showStep(stepIndex + 1))}
            type="button"
          >
            {isLastStep ? 'Finish tour' : 'Next section'}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default GuidedTour
