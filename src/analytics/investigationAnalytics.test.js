import { describe, expect, it } from 'vitest'
import { calculateInvestigationMetrics } from './investigationAnalytics.js'
import { appendSessionActivity, getActivityDescription } from './activityLog.js'

const caseFile = {
  evidence: [
    { id: 'E001', title: 'Open clue', category: 'Document', discoveredAt: 'L001', relatedSuspectIds: ['S001'] },
    { id: 'E002', title: 'SECRET cobaltquartz clue', category: 'Secret category', discoveredAt: 'L002', relatedSuspectIds: ['S002'] },
  ],
  suspects: [{ id: 'S001', name: 'One' }, { id: 'S002', name: 'Two' }],
  locations: [{ id: 'L001', name: 'Study' }, { id: 'L002', name: 'Library' }],
  events: [
    { id: 'T002', timestamp: '10:00 PM', title: 'Late' },
    { id: 'T001', timestamp: '9:00 PM', title: 'Early' },
  ],
}

describe('calculateInvestigationMetrics', () => {
  it('derives progress and activity counts from current records and session actions', () => {
    const metrics = calculateInvestigationMetrics({
      caseFile,
      discoveredEvidenceIds: new Set(['E001', 'unknown']),
      progress: { journalEntries: [{ id: 'J1' }], bookmarks: { suspects: ['S001', 'S001'], evidence: ['E001'], locations: [] } },
      activityLog: [
        { type: 'suspect-reviewed', recordType: 'suspect', recordId: 'S001' },
        { type: 'suspect-reviewed', recordType: 'suspect', recordId: 'S001' },
        { type: 'location-explored', recordType: 'location', recordId: 'L001' },
        { type: 'timeline-reviewed', recordType: 'timeline', recordId: 'T002' },
      ],
      deductionChecks: [{ result: 'satisfied' }, { result: 'unresolved' }],
      caseStatus: 'Investigating',
    })

    expect(metrics.evidence).toMatchObject({ total: 2, discovered: 1, undiscovered: 1, percentage: 50 })
    expect(metrics.evidence.discoveredRecords.map(({ id }) => id)).toEqual(['E001'])
    expect(metrics.evidence.byCategory).toEqual([{ category: 'Document', count: 1 }])
    expect(metrics.suspects).toMatchObject({ total: 2, investigated: 1 })
    expect(metrics.locations).toMatchObject({ total: 2, explored: 1 })
    expect(metrics.locations.records).toEqual([
      { id: 'L001', name: 'Study', explored: true, discoveredEvidenceCount: 1 },
      { id: 'L002', name: 'Library', explored: false, discoveredEvidenceCount: 0 },
    ])
    expect(metrics.timeline.events.map(({ id }) => id)).toEqual(['T001', 'T002'])
    expect(metrics.timeline.reviewed).toBe(1)
    expect(metrics.journalEntryCount).toBe(1)
    expect(metrics.bookmarkCount).toBe(2)
    expect(metrics.deductionChecks).toEqual({ satisfied: 1, total: 2 })
  })

  it('updates the evidence breakdown when discovery state changes and handles empty data', () => {
    const empty = calculateInvestigationMetrics()
    expect(empty.evidence).toMatchObject({ total: 0, discovered: 0, undiscovered: 0, percentage: 0 })
    const updated = calculateInvestigationMetrics({ caseFile, discoveredEvidenceIds: ['E001', 'E002'] })
    expect(updated.evidence.percentage).toBe(100)
    expect(updated.evidence.byCategory).toContainEqual({ category: 'Secret category', count: 1 })
  })

  it('counts exploration from the current run after a replay boundary', () => {
    const metrics = calculateInvestigationMetrics({
      caseFile,
      activityLog: [
        { type: 'location-explored', recordType: 'location', recordId: 'L001' },
        { type: 'replay-started' },
        { type: 'location-explored', recordType: 'location', recordId: 'L002' },
      ],
    })
    expect(metrics.locations.explored).toBe(1)
    expect(metrics.locations.records.map(({ explored }) => explored)).toEqual([false, true])
  })

  it('does not return undiscovered evidence titles, categories, or suspect links', () => {
    const metrics = calculateInvestigationMetrics({ caseFile, discoveredEvidenceIds: [] })
    expect(metrics.evidence.discoveredRecords).toEqual([])
    expect(metrics.evidence.byCategory).toEqual([])
    expect(JSON.stringify(metrics)).not.toContain('cobaltquartz')
    expect(metrics.suspects.records).toEqual([
      { id: 'S001', discoveredLinkedEvidenceCount: 0 },
      { id: 'S002', discoveredLinkedEvidenceCount: 0 },
    ])
  })
})

describe('session activity log', () => {
  it('appends bounded immutable entries and presents an accurate description', () => {
    const initial = [{ id: 'session-1', type: 'suspect-reviewed', occurredAt: '2026-01-01T00:00:00.000Z', recordType: 'suspect', recordId: 'S001', label: 'Rahul' }]
    const next = appendSessionActivity(initial, {
      id: 'session-2', type: 'evidence-discovered', occurredAt: '2026-01-01T00:01:00.000Z', recordType: 'evidence', recordId: 'E001', label: 'Ledger',
    }, 1)
    expect(initial).toHaveLength(1)
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('session-2')
    expect(getActivityDescription(next[0])).toBe('Evidence discovered: Ledger')
  })

  it('rejects malformed activity records', () => {
    expect(() => appendSessionActivity([], { id: 'bad', type: 'fictional-action', occurredAt: '2026-01-01' })).toThrow()
  })

  it('preserves the latest reset boundary when the bounded log rolls over', () => {
    const priorEvents = Array.from({ length: 4 }, (_, index) => ({
      id: 'prior-' + index, type: 'suspect-reviewed', occurredAt: '2026-01-01T00:00:00.000Z', recordType: 'suspect', recordId: 'S001',
    }))
    const afterReset = appendSessionActivity(priorEvents, {
      id: 'reset', type: 'replay-started', occurredAt: '2026-01-01T00:01:00.000Z',
    }, 3)
    const bounded = appendSessionActivity(afterReset, {
      id: 'current', type: 'location-explored', occurredAt: '2026-01-01T00:02:00.000Z', recordType: 'location', recordId: 'L002',
    }, 3)
    expect(bounded.map(({ id }) => id)).toEqual(['prior-3', 'reset', 'current'])
  })
})
