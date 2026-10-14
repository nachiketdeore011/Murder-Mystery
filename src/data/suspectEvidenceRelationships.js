/**
 * Case-specific investigation-priority rules.
 *
 * The source case only records relatedSuspectIds; it does not say that a clue
 * proves involvement or contradicts an alibi. Under this explicit educational
 * rule, each existing link is a lead worth one follow-up point. It is not a
 * guilt point, and no contradictory relationships are asserted by this case.
 * Keeping the relationship list derived from the source records prevents IDs
 * from drifting away from case001.js.
 */
export const SUSPECT_RANKING_CONFIG = Object.freeze({
  points: Object.freeze({ supporting: 1, contradicting: 1, neutral: 0 }),
  minimumDirectionalClues: 2,
  priorityThresholds: Object.freeze({ high: 4, moderate: 2 }),
})

const FOLLOW_UP_RATIONALE =
  'The case record explicitly links this clue to the profile. Under the educational rule, that link warrants follow-up only; it does not establish presence or responsibility.'

export function createSuspectEvidenceRelationships(caseFile) {
  if (!caseFile || !Array.isArray(caseFile.evidence)) return []

  return caseFile.evidence.flatMap((item) => {
    if (!item || typeof item.id !== 'string' || !Array.isArray(item.relatedSuspectIds)) return []
    return item.relatedSuspectIds
      .filter((suspectId) => typeof suspectId === 'string')
      .map((suspectId) => ({
        suspectId,
        evidenceId: item.id,
        stance: 'supporting',
        rationale: FOLLOW_UP_RATIONALE,
      }))
  })
}

export default createSuspectEvidenceRelationships
