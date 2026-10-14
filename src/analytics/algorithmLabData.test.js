import { describe, expect, it } from 'vitest'
import { createDiscoveredEvidenceLab } from './algorithmLabData.js'

const caseFile = {
  id: 'CASE-X',
  evidence: [
    { id: 'E001', title: 'Blue ledger', category: 'Document', description: 'A blue ledger page.', discoveredAt: 'L1', relatedSuspectIds: [] },
    { id: 'E002', title: 'Cobaltquartz cipher', category: 'Secret', description: 'Hidden cobaltquartz details.', discoveredAt: 'L1', relatedSuspectIds: [] },
  ],
  suspects: [{ id: 'S001', name: 'Rahul', role: 'Heir', biography: 'A case profile.', motive: 'None known.', alibi: 'Reported.' }],
  locations: [{ id: 'L1', name: 'Study', description: 'A room.', evidenceIds: ['E001', 'E002'] }],
  events: [{ id: 'T001', title: 'Report', description: 'A reported case event.' }],
}

describe('discovered evidence algorithm lab indexes', () => {
  it('populates all four real structures from discovered records only', () => {
    const lab = createDiscoveredEvidenceLab(caseFile, new Set(['E001']))
    expect(lab.discoveredRecords.map(({ id }) => id)).toEqual(['E001'])
    expect(lab.hashTable.get('E001')).toBe(caseFile.evidence[0])
    expect(lab.hashTable.has('E002')).toBe(false)
    expect(lab.binarySearchTree.search('E001').value).toBe(caseFile.evidence[0])
    expect(lab.binarySearchTree.search('E002')).toBeNull()
    expect(lab.evidenceIndex.searchEvidenceRange('E000', 'E999').map(({ id }) => id)).toEqual(['E001'])
    expect(lab.clueSearchIndex.searchCluesByPrefix('cobal')).toEqual([])
    expect(lab.clueSearchIndex.searchCluesByPrefix('blu').some(({ id }) => id === 'E001')).toBe(true)
  })

  it('rebuilds independently when the discovery set changes without mutating case records', () => {
    const before = JSON.stringify(caseFile)
    const hidden = createDiscoveredEvidenceLab(caseFile, [])
    const visible = createDiscoveredEvidenceLab(caseFile, ['E002'])
    expect(hidden.discoveredRecords).toEqual([])
    expect(visible.hashTable.get('E002')).toBe(caseFile.evidence[1])
    expect(visible.clueSearchIndex.searchCluesByPrefix('cobal').map(({ id }) => id)).toContain('E002')
    expect(JSON.stringify(caseFile)).toBe(before)
  })
})
