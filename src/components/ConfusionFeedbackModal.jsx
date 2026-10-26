import { useEffect, useRef, useState } from 'react'

// The question is deliberately optional: a player can send the note, or send
// nothing and still flag that something was unclear.
const FEEDBACK_QUESTION = 'What was confusing just now?'

function ConfusionFeedbackModal({ isOpen, onClose, onSubmit }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const noteRef = useRef(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) return undefined

    const previouslyFocusedElement = document.activeElement
    noteRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => {
    if (!isOpen) setNote('')
  }, [isOpen])

  if (!isOpen) return null

  const send = () => {
    onSubmit(note.trim())
    setNote('')
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-describedby="confusion-feedback-description"
        aria-labelledby="confusion-feedback-title"
        aria-modal="true"
        className="confusion-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="modal-topline">
          <span className="section-kicker">FIELD NOTE · CONFUSION</span>
          <button
            aria-label="Close feedback"
            className="modal-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <h2 id="confusion-feedback-title">Something confusing?</h2>
        <p className="modal-intro" id="confusion-feedback-description">
          {FEEDBACK_QUESTION} One optional note, kept in this browser session only.
        </p>
        <label className="confusion-field" htmlFor="confusion-feedback-note">
          Your note (optional)
          <textarea
            id="confusion-feedback-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="I could not tell where to find the sealed clues."
            ref={noteRef}
            rows={4}
            value={note}
          />
        </label>
        <div className="confusion-actions">
          <button className="button button-primary" onClick={send} type="button">Send note</button>
          <button className="button button-secondary" onClick={onClose} type="button">Cancel</button>
        </div>
        <p className="modal-note">Notes are never sent anywhere. They join this session&rsquo;s activity feed so the investigation can be improved.</p>
      </section>
    </div>
  )
}

export default ConfusionFeedbackModal
