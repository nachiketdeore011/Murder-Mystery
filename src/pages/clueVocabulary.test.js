import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Player-facing surfaces of the investigation flow. The algorithm explorer
// sections and the analytics dashboard are deliberately excluded: there
// "record" names a tree, table or index entry rather than a clue.
const PLAYER_FACING_FILES = [
  'pages/Investigation.jsx',
  'components/EvidenceCard.jsx',
  'components/IntelligentClueSearch.jsx',
  'components/InvestigationJournal.jsx',
  'components/FinalAccusation.jsx',
  'components/DeductionLab.jsx',
  'components/EvidenceRelationshipNetwork.jsx',
  'components/SuspectAnalysis.jsx',
]

const RETIRED_PHRASES = [
  'Bookmark record',
  'evidence records discovered',
  'Locked record',
  'EVIDENCE RECORD',
  'Inspect discovered record',
  'Open discovered record',
  'Search discovered evidence',
  'matching discovered record',
  'No discovered records',
  'essential records cited',
]

const sourceRoot = fileURLToPath(new URL('..', import.meta.url))

function readSource(relativePath) {
  return readFileSync(join(sourceRoot, relativePath), 'utf8')
}

describe('player-facing clue vocabulary', () => {
  it('never calls a clue a record on the player-facing surfaces', () => {
    for (const relativePath of PLAYER_FACING_FILES) {
      const source = readSource(relativePath)
      for (const phrase of RETIRED_PHRASES) {
        expect(source, `${relativePath} still uses "${phrase}"`).not.toContain(phrase)
      }
    }
  })

  it('keeps the clue wording in place where it was introduced', () => {
    expect(readSource('pages/Investigation.jsx')).toContain('Bookmark this clue')
    expect(readSource('pages/Investigation.jsx')).toContain('clues discovered')
    expect(readSource('pages/Investigation.jsx')).toContain('<h2 id="evidence-title">Clue Register</h2>')
    expect(readSource('components/EvidenceCard.jsx')).toContain('Sealed clue')
  })

  it('leaves the internal evidence identifiers untouched', () => {
    const investigation = readSource('pages/Investigation.jsx')

    expect(investigation).toContain('discoveredEvidenceIds')
    expect(investigation).toContain('evidence-title')
    expect(investigation).toContain('getEvidenceById')
  })
})
