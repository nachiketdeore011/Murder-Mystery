/**
 * Canonical fictional reconstruction for CASE-001. The source project had no
 * ending, so this solution uses only existing record IDs and modest
 * clarifications to E001, E008 and E012. It is circumstantial, not a claim of
 * forensic proof. This module is imported only by the post-confirmation
 * accusation flow; client-side code is not a security boundary.
 */
export const caseSolution = Object.freeze({
  caseId: 'CASE-001',
  culpritSuspectId: 'S005',
  essentialEvidenceIds: Object.freeze(['E001', 'E008', 'E012']),
  supportingEvidenceIds: Object.freeze(['E001', 'E008', 'E012']),
  contextualEvidenceIds: Object.freeze(['E006']),
  timelineEventIds: Object.freeze(['T004', 'T006']),
  explanation:
    'The intended reconstruction is that Suresh Patil caused Arvind Malhotra’s death. The key checkout initials resemble S.P. but remain uncertain; the unanswered Study call came from a service handset assigned to the caretaker post; and the Garden card’s 9:44 entry was added after Suresh reported the incident. Together with his documented concern about losing responsibilities, these facts make his account the strongest explanation in this fictional case. They remain circumstantial: the records do not establish the exact act, method, or time of death.',
  solutionLimits:
    'The case does not include forensic proof or an independently established time of death. The configured ending is an educational story resolution, not a real-world standard for determining guilt.',
})

export default caseSolution
