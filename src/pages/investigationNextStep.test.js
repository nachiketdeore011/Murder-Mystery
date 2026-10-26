import { describe, expect, it } from 'vitest'
import { nextStepHint } from './Investigation.jsx'

const caseFile = {
  evidence: [{ id: 'E001' }, { id: 'E002' }, { id: 'E003' }],
  suspects: [{ id: 'S001' }, { id: 'S002' }],
}

const suspectEvents = caseFile.suspects.map((suspect, index) => ({
  id: `session-${index + 1}`,
  type: 'suspect-reviewed',
  recordType: 'suspect',
  recordId: suspect.id,
}))

const hintFor = (overrides = {}) => nextStepHint({
  activityLog: [],
  caseFile,
  discoveredEvidenceIds: new Set(),
  progress: {},
  ...overrides,
})

describe('nextStepHint', () => {
  it('points a fresh investigation at the crime scene map', () => {
    expect(hintFor()).toBe('Start by exploring the Crime Scene Map.')
  })

  it('asks for suspect profiles once a clue is in hand but suspects are unreviewed', () => {
    const hint = hintFor({
      activityLog: [suspectEvents[0]],
      discoveredEvidenceIds: new Set(['E001']),
    })

    expect(hint).toBe("Open each suspect's profile to review their account.")
  })

  it('moves on to the deduction lab after every suspect has been reviewed', () => {
    const hint = hintFor({
      activityLog: suspectEvents,
      discoveredEvidenceIds: new Set(['E001']),
    })

    expect(hint).toBe('Try the Deduction Lab to test a theory.')
  })

  it('announces readiness for the final accusation once every clue is discovered', () => {
    const hint = hintFor({
      activityLog: suspectEvents,
      discoveredEvidenceIds: new Set(['E001', 'E002', 'E003']),
    })

    expect(hint).toBe("You're ready to make a Final Accusation.")
  })

  it('replaces the hint with a review prompt once an accusation is recorded', () => {
    const hint = hintFor({
      activityLog: suspectEvents,
      discoveredEvidenceIds: new Set(['E001', 'E002', 'E003']),
      progress: { completion: { completedAt: '2026-01-01T00:00:00.000Z' } },
    })

    expect(hint).toBe('Accusation recorded — review the completed case or replay it.')
  })

  it('produces a different hint for each stage of an investigation', () => {
    const hints = [
      hintFor(),
      hintFor({ discoveredEvidenceIds: new Set(['E001']) }),
      hintFor({ activityLog: suspectEvents, discoveredEvidenceIds: new Set(['E001']) }),
      hintFor({ activityLog: suspectEvents, discoveredEvidenceIds: new Set(['E001', 'E002', 'E003']) }),
    ]

    expect(new Set(hints).size).toBe(hints.length)
  })
})
