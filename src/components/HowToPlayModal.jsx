import { useEffect, useRef } from 'react'

// Each step names a section that is really on the Investigation page so a
// first-time player can find the tool that does the job.
const investigationSteps = [
  {
    id: 'explore',
    section: 'Crime Scene Map',
    text: 'Travel between mansion rooms. Every clue is filed in one of them.',
  },
  {
    id: 'search',
    section: 'Intelligent Clue Search',
    text: 'Find clues fast by typing the start of any word. The search runs on a Trie prefix index.',
  },
  {
    id: 'people',
    section: 'Suspects',
    text: 'Open each suspect card for their account and motive, then compare follow-up priorities in Suspect Analysis.',
  },
  {
    id: 'timeline',
    section: 'Deduction Lab',
    text: 'Walk the reported Timeline, then test one theory at a time in the Deduction Lab.',
  },
  {
    id: 'accuse',
    section: 'Make Final Accusation',
    text: 'Name one suspect, cite the clues that matter, and explain your reasoning.',
  },
]

function HowToPlayModal({ isOpen, onClose }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const previouslyFocusedElement = document.activeElement
    closeButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElement?.focus?.()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="how-to-play-title"
        aria-modal="true"
        aria-describedby="how-to-play-description"
        className="how-to-play-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="modal-topline">
          <span className="section-kicker">FIELD GUIDE · 01</span>
          <button
            aria-label="Close how to play"
            className="modal-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <h2 id="how-to-play-title">How to play</h2>
        <p className="modal-intro" id="how-to-play-description">
          Build a case from what you find. Every conclusion should be grounded
          in evidence.
        </p>
        <ol className="instruction-list">
          {investigationSteps.map((step, index) => (
            <li key={step.id}>
              <span aria-hidden="true" className="instruction-number">
                0{index + 1}
              </span>
              <span className="instruction-copy">
                <span className="instruction-section">{step.section}</span>
                <span className="instruction-text">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="modal-hint">
          Clues stay sealed until you uncover them, and every clue is filed in a
          room on the Crime Scene Map. Exploring the map is how you learn which
          room holds a clue.
        </p>
        <p className="modal-note">The current case is fully playable and can be replayed. Algorithmic scores and deductions support investigation; they do not prove guilt.</p>
      </section>
    </div>
  )
}

export default HowToPlayModal
