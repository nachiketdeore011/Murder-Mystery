import { describe, expect, it } from 'vitest'
import { case001 } from '../data/case001.js'
import { caseSolution } from '../data/caseSolution.js'
import { evaluateAccusation, validateCaseSolution } from './caseResolution.js'

const completeEvidenceIds = ['E001', 'E008', 'E012']
const explanation = 'The key record, routed call, and late-added card make the Garden account unreliable.'

function evaluate(overrides = {}) {
  return evaluateAccusation({
    selectedSuspectId: 'S005',
    selectedEvidenceIds: completeEvidenceIds,
    explanation,
    discoveredEvidenceIds: completeEvidenceIds,
    suspects: case001.suspects,
    evidence: case001.evidence,
    events: case001.events,
    caseFile: case001,
    solution: caseSolution,
    ...overrides,
  })
}

describe('CASE-001 solution and accusation evaluation', () => {
  it('references an existing suspect, evidence records, and timeline events', () => {
    expect(validateCaseSolution(caseSolution, { caseFile: case001 })).toEqual({ valid: true, errors: [] })
    expect(case001.suspects.some((suspect) => suspect.id === caseSolution.culpritSuspectId)).toBe(true)
    expect([...caseSolution.essentialEvidenceIds, ...caseSolution.supportingEvidenceIds]
      .every((id) => case001.evidence.some((record) => record.id === id))).toBe(true)
  })

  it('marks the correct suspect and all essential citations as a solved case', () => {
    const result = evaluate()
    expect(result).toMatchObject({
      valid: true,
      selectedSuspectId: 'S005',
      correctSuspect: true,
      evidenceComplete: true,
      outcome: 'case_solved',
      reasoningAssessment: 'well_supported',
    })
    expect(result.supportingEvidenceIds).toEqual(completeEvidenceIds)
    expect(result.missingEssentialEvidenceIds).toEqual([])
  })

  it('separates a correct guess from a complete evidence-supported accusation', () => {
    const result = evaluate({ selectedEvidenceIds: ['E001'], discoveredEvidenceIds: ['E001'] })
    expect(result.outcome).toBe('correct_incomplete')
    expect(result.correctSuspect).toBe(true)
    expect(result.evidenceComplete).toBe(false)
    expect(result.missingEssentialEvidenceIds).toEqual(['E008', 'E012'])
  })

  it('does not treat a ranking score as the solution or automatically choose a suspect', () => {
    const result = evaluate({ selectedSuspectId: 'S001' })
    expect(result.outcome).toBe('promising_reasoning_incorrect')
    expect(result.correctSuspect).toBe(false)
    expect(result.selectedSuspectId).toBe('S001')
  })

  it('rejects unknown suspect IDs without disclosing the configured culprit', () => {
    const result = evaluate({ selectedSuspectId: 'S999' })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('Select a suspect')
    expect(result.errors.join(' ')).not.toContain(caseSolution.culpritSuspectId)
  })

  it('rejects unknown and undiscovered evidence references', () => {
    const unknown = evaluate({ selectedEvidenceIds: ['E999'] })
    expect(unknown.valid).toBe(false)
    const hidden = evaluate({ selectedEvidenceIds: ['E002'], discoveredEvidenceIds: [] })
    expect(hidden.valid).toBe(false)
    expect(hidden.errors.join(' ')).toContain('unavailable or undiscovered')
    expect(hidden.errors.join(' ')).not.toContain(case001.evidence.find((item) => item.id === 'E002').title)
  })

  it('deduplicates repeated evidence IDs rather than counting a clue twice', () => {
    const result = evaluate({ selectedEvidenceIds: ['E001', 'E001', 'E008', 'E012'] })
    expect(result.valid).toBe(true)
    expect(result.supportingEvidenceIds).toEqual(completeEvidenceIds)
    expect(result.supportingEvidenceIds).toHaveLength(3)
  })

  it('returns insufficient evidence when no cited clue is relevant to the configured solution', () => {
    const result = evaluate({ selectedEvidenceIds: ['E004'], discoveredEvidenceIds: ['E004'] })
    expect(result.outcome).toBe('insufficient_evidence')
    expect(result.reasoningAssessment).toBe('insufficient')
    expect(result.supportingEvidenceIds).toEqual([])
    expect(result.missingEssentialEvidenceIds).toEqual(completeEvidenceIds)
  })

  it('treats contextual evidence as context rather than decisive support', () => {
    const result = evaluate({ selectedEvidenceIds: ['E006'], discoveredEvidenceIds: ['E006'] })
    expect(result.outcome).toBe('correct_incomplete')
    expect(result.contextualEvidenceIds).toEqual(['E006'])
    expect(result.supportingEvidenceIds).toEqual([])
    expect(result.reasoningAssessment).toBe('limited_context')
  })

  it('requires a nonempty explanation and enforces the documented character limit', () => {
    expect(evaluate({ explanation: '   ' })).toMatchObject({ valid: false })
    expect(evaluate({ explanation: 'x'.repeat(2001) })).toMatchObject({ valid: false })
    expect(evaluate({ explanation: 'A concise theory.' }).valid).toBe(true)
  })

  it('recalculates when newly discovered evidence becomes available', () => {
    const partial = evaluate({ selectedEvidenceIds: ['E001'], discoveredEvidenceIds: ['E001'] })
    const complete = evaluate({ selectedEvidenceIds: completeEvidenceIds, discoveredEvidenceIds: completeEvidenceIds })
    expect(partial.outcome).toBe('correct_incomplete')
    expect(complete.outcome).toBe('case_solved')
  })

  it('accepts the application’s Set-based discovery state without changing it', () => {
    const discovered = new Set(completeEvidenceIds)
    const result = evaluate({ discoveredEvidenceIds: discovered })
    expect(result.outcome).toBe('case_solved')
    expect([...discovered]).toEqual(completeEvidenceIds)
  })

  it('is deterministic and does not mutate case records or discovery input', () => {
    const caseBefore = JSON.stringify(case001)
    const discovered = [...completeEvidenceIds]
    const before = [...discovered]
    const first = evaluate({ discoveredEvidenceIds: discovered })
    const second = evaluate({ discoveredEvidenceIds: discovered })
    expect(first).toEqual(second)
    expect(discovered).toEqual(before)
    expect(JSON.stringify(case001)).toBe(caseBefore)
  })

  it('handles missing solution configuration without throwing or exposing an answer', () => {
    const result = evaluate({ solution: null })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('unavailable or incomplete')
    expect(result.errors.join(' ')).not.toContain('S005')
  })

  it('detects incomplete solution references during explicit configuration validation', () => {
    const invalid = validateCaseSolution({ ...caseSolution, essentialEvidenceIds: ['E999'] }, { caseFile: case001 })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.join(' ')).toContain('missing evidence')
  })

  it('does not infer support from a selected but unrelated record or long explanation', () => {
    const result = evaluate({
      selectedEvidenceIds: ['E004'],
      discoveredEvidenceIds: ['E004'],
      explanation: 'x'.repeat(1500),
    })
    expect(result.outcome).toBe('insufficient_evidence')
    expect(result.supportingEvidenceIds).toEqual([])
  })
})
