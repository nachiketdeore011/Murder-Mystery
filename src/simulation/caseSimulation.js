import { evaluateAccusation } from '../algorithms/caseResolution.js'
import { evaluateTheory } from '../algorithms/deductionEngine.js'
import { rankSuspects } from '../algorithms/suspectRanking.js'
import { case001 } from '../data/case001.js'
import { caseSolution } from '../data/caseSolution.js'
import { createCaseIndex } from '../data/caseIndex.js'
import { createClueSearchIndex } from '../data/clueSearchIndex.js'
import { createEvidenceRelationshipNetwork } from '../data/crimeSceneNetwork.js'
import { createSuspectEvidenceRelationships } from '../data/suspectEvidenceRelationships.js'
import { createGraphFromLocations } from '../dsa/Graph.js'
import { dijkstra } from '../dsa/dijkstra.js'

// Dinner service began in the Main Hall, so a session opens there.
export const SIMULATION_START_LOCATION_ID = 'L002'

// A prefix with several real matches, plus a mid-word fragment that the Trie
// is designed to reject, so the search step can show the rule it enforces.
export const SIMULATION_SEARCH_PREFIX = 'ga'
export const SIMULATION_SEARCH_NEAR_MISS = 'arden'

// The walkthrough follows the case file's own field names. Player-facing copy
// keeps saying "clue"; these keys stay "evidence" like the rest of the app.
function filedInName(caseFile, locationId) {
  const location = caseFile.locations.find((record) => record.id === locationId)
  return location ? location.name : 'an unlisted room'
}

function makeRouteStep({ caseFile, graph, fromLocationId, toLocationId, title }) {
  const run = dijkstra(graph, fromLocationId, toLocationId)
  return {
    fromLocationId,
    toLocationId,
    fromName: filedInName(caseFile, fromLocationId),
    toName: filedInName(caseFile, toLocationId),
    cost: run.totalCost,
    path: run.path,
    pathNames: run.path.map((id) => filedInName(caseFile, id)),
    visitedCount: run.visitedCount,
    title,
  }
}

/**
 * Replay CASE-001 as a step-by-step session.
 *
 * The route follows the configured reconstruction so a reader can watch one
 * coherent solution. Every figure in the returned steps (travel costs, prefix
 * matches, ranking scores, deduction findings, the accusation verdict) is
 * computed here by the same tested modules the game itself uses. Nothing in
 * this module invents a result, and nothing writes to player progress.
 */
export function buildCaseSimulation({ caseFile = case001, solution = caseSolution } = {}) {
  const caseIndex = createCaseIndex(caseFile)
  const graph = createGraphFromLocations(caseFile.locations, caseFile.corridorWeights)
  const evidenceById = new Map(caseFile.evidence.map((record) => [record.id, record]))

  const essentialEvidenceIds = [...solution.essentialEvidenceIds]
  const contextualEvidenceIds = [...solution.contextualEvidenceIds]
  const relevantEvidenceIds = new Set([...essentialEvidenceIds, ...contextualEvidenceIds])
  // Clues are collected in the order the reconstruction depends on them.
  const clueOrder = [...essentialEvidenceIds, ...contextualEvidenceIds]

  const discovered = []
  const steps = []
  const routes = []

  const pushStep = (step) => {
    steps.push({ ...step, stepNumber: steps.length + 1, discoveredIds: [...discovered] })
  }

  // 1. Read the incident report.
  pushStep({
    id: 'briefing',
    kind: 'walk',
    phase: 'ORIENT',
    section: 'Reported incident',
    targetId: 'investigation-title',
    title: 'Read the incident report',
    coach: `A session opens on the case overview. Nothing is proven yet: ${caseFile.victim} was found unresponsive in the Study at about ${caseFile.incidentTime}, and five people were inside ${caseFile.location}.`,
    action: 'Read the briefing and the initial objective.',
    result: `Reported: ${caseFile.briefing}`,
    note: { label: 'Initial objective', text: caseFile.objective },
    algorithm: {
      label: 'No algorithm yet',
      detail: 'The first move is reading, not computing. The objective names the only useful early work: separate what is confirmed from what still needs corroboration.',
    },
  })

  // 2. Decision — where to walk first.
  const routeOptions = caseFile.locations
    .filter((location) => location.id !== SIMULATION_START_LOCATION_ID)
    .map((location) => {
      const run = dijkstra(graph, SIMULATION_START_LOCATION_ID, location.id)
      return {
        id: location.id,
        name: location.name,
        description: location.description,
        cost: run.totalCost,
        pathNames: run.path.map((id) => filedInName(caseFile, id)),
        filedClueIds: [...location.evidenceIds],
        relevantClueIds: location.evidenceIds.filter((id) => relevantEvidenceIds.has(id)),
        holdsIncidentRoom: caseFile.events.some((event) => event.locationId === location.id && event.id === 'T006'),
      }
    })
    .sort((left, right) => left.cost - right.cost || (left.id < right.id ? -1 : 1))

  // The reconstruction needs E001 from the Study first, so that is the
  // recommended door. Cheapest is a different question from most useful.
  const firstClueRoomId = evidenceById.get(clueOrder[0])?.discoveredAt || 'L001'

  pushStep({
    id: 'choose-room',
    kind: 'decision',
    phase: 'ORIENT',
    section: 'Crime Scene Map',
    targetId: 'crime-scene-map',
    title: 'Choose the first room to enter',
    coach: 'Dinner ended in the Main Hall, so the session starts there. Pick any room to see what it costs to reach and what is filed inside it, then continue.',
    action: 'Walk the mansion from the Crime Scene Map.',
    result: 'The map runs Dijkstra over the corridor graph, so every room is shown at its least cumulative travel cost — not at its advertised distance.',
    algorithm: {
      label: 'Graph · Dijkstra shortest path',
      detail: `Each corridor carries an illustrative weight. From the Main Hall the fewest-cost route is recomputed per destination: ${routeOptions.slice(0, 3).map((option) => `${option.name} ${option.cost}`).join(', ')}, and so on. Reachability and travel time are never treated as evidence of where anyone was.`,
    },
    choice: {
      kind: 'route',
      prompt: `Where does the detective go first? The incident was reported in the ${filedInName(caseFile, 'L001')}.`,
      fromLocationId: SIMULATION_START_LOCATION_ID,
      fromName: filedInName(caseFile, SIMULATION_START_LOCATION_ID),
      recommendedId: firstClueRoomId,
      options: routeOptions,
    },
  })

  // 3. Search the index for a lead by word prefix.
  const clueSearchIndex = createClueSearchIndex(caseFile)
  const prefixMatches = clueSearchIndex.searchCluesByPrefix(SIMULATION_SEARCH_PREFIX, { limit: 8 })
  const nearMissMatches = clueSearchIndex.searchCluesByPrefix(SIMULATION_SEARCH_NEAR_MISS)
  const searchStats = clueSearchIndex.getClueSearchStats()

  pushStep({
    id: 'search',
    kind: 'walk',
    phase: 'SEARCH',
    section: 'Intelligent Clue Search',
    targetId: 'intelligent-search-title',
    title: 'Search before you walk',
    coach: 'Typing the start of a word is usually faster than opening rooms one by one. The box searches every clue, profile, room and reported event at once.',
    action: `Type "${SIMULATION_SEARCH_PREFIX}" into Intelligent Clue Search.`,
    result: `${prefixMatches.length} indexed records match the prefix "${SIMULATION_SEARCH_PREFIX}", across ${searchStats.recordCount} indexed records and ${searchStats.recordWordAssociations} word associations.`,
    algorithm: {
      label: 'Trie · prefix search',
      detail: `The index is a Trie of whole words. It matches from the start of a word only, which is why "${SIMULATION_SEARCH_NEAR_MISS}" returns ${nearMissMatches.length} results even though it appears inside a matched word.`,
    },
    detail: {
      kind: 'search',
      prefix: SIMULATION_SEARCH_PREFIX,
      matches: prefixMatches.map((match) => ({
        id: match.id,
        type: match.type,
        title: match.title,
        matchingWords: [...match.matchingWords],
        isUnlocked: match.type !== 'evidence' || discovered.includes(match.id),
      })),
      nearMissPrefix: SIMULATION_SEARCH_NEAR_MISS,
      nearMissCount: nearMissMatches.length,
      stats: searchStats,
    },
  })

  // 4-7. Walk the mansion and collect the clues the reconstruction needs.
  let currentLocationId = SIMULATION_START_LOCATION_ID
  let routeCost = 0

  for (const evidenceId of clueOrder) {
    const record = evidenceById.get(evidenceId)
    if (!record) continue
    const roomId = record.discoveredAt
    const isEssential = essentialEvidenceIds.includes(evidenceId)
    const route = currentLocationId === roomId
      ? null
      : makeRouteStep({
        caseFile,
        graph,
        fromLocationId: currentLocationId,
        toLocationId: roomId,
        title: `Walk to the ${filedInName(caseFile, roomId)}`,
      })
    if (route) {
      routeCost += route.cost
      routes.push(route)
      currentLocationId = roomId
    }
    discovered.push(evidenceId)

    pushStep({
      id: `clue-${evidenceId}`,
      kind: 'walk',
      phase: 'COLLECT',
      section: 'Clue Register',
      targetId: 'evidence-title',
      title: `Collect ${evidenceId}`,
      coach: route
        ? `Travel from the ${route.fromName} to the ${route.toName}, then open the Clue Register and inspect the sealed card for ${evidenceId}.`
        : `Open the Clue Register and inspect the sealed card for ${evidenceId}. The ${filedInName(caseFile, roomId)} is where it was filed.`,
      action: `Inspect the sealed card "${record.title}" (${record.category}).`,
      result: record.description,
      route,
      detail: {
        kind: 'clue',
        evidenceId,
        title: record.title,
        category: record.category,
        filedAtId: roomId,
        filedAtName: filedInName(caseFile, roomId),
        timestamp: record.timestamp,
        reliability: record.reliability,
        relevance: record.relevance,
        relatedSuspectIds: [...record.relatedSuspectIds],
        weight: isEssential ? 'essential' : 'context',
      },
      algorithm: {
        label: 'Hash table index · O(1) lookup',
        detail: 'A clue is stored once against its ID. Inspecting the card is a direct lookup, and the register rebuilds its ordered list from the same source array — the index never edits the case records.',
      },
    })
  }

  // 8. Read the five accounts.
  const profileRows = caseFile.suspects.map((suspect) => ({
    id: suspect.id,
    name: suspect.name,
    role: suspect.role,
    alibi: suspect.alibi,
    motive: suspect.motive,
    linkedClueCount: suspect.evidenceIds.filter((id) => discovered.includes(id)).length,
    linkedClueTitles: suspect.evidenceIds
      .filter((id) => discovered.includes(id))
      .map((id) => `${id} ${evidenceById.get(id)?.title || ''}`.trim()),
  }))

  pushStep({
    id: 'suspects',
    kind: 'walk',
    phase: 'COMPARE',
    section: 'Suspects',
    targetId: 'suspects-title',
    title: 'Read every account, not just the loud one',
    coach: 'Each profile holds a biography, a possible motive and a stated alibi. Reading all five first is what makes the later comparison mean anything.',
    action: 'Open all five suspect cards.',
    result: `${profileRows.length} accounts recorded. The stated alibis are accounts the case file reports, not verified facts, and no profile carries more weight than another yet.`,
    detail: { kind: 'suspects', rows: profileRows },
    algorithm: {
      label: 'No scoring yet',
      detail: 'Nothing here is ranked. Suspect profile associations with clues are only follow-up leads; per the case file, a link warrants follow-up and never establishes presence or responsibility.',
    },
  })

  // 9. Rank the profiles by discovered evidence only.
  const ranking = rankSuspects({
    caseIndex,
    discoveredEvidenceIds: new Set(discovered),
    evidence: caseFile.evidence,
    relationships: createSuspectEvidenceRelationships(caseFile),
    suspects: caseFile.suspects,
    timeline: caseFile.events,
  })

  pushStep({
    id: 'ranking',
    kind: 'walk',
    phase: 'COMPARE',
    section: 'Suspect Analysis',
    targetId: 'suspect-analysis',
    title: 'Rank what you have actually found',
    coach: 'Suspect Analysis re-scores every profile after each discovery, using only clues you hold. It is an investigation priority — a queue, not a verdict.',
    action: `Re-run the ranking with ${discovered.length} clues discovered.`,
    result: ranking.rankedSuspects
      .filter((row) => row.directionalEvidenceCount > 0)
      .map((row) => `${row.name}: ${row.score > 0 ? '+' : ''}${row.score} (${row.priorityLabel})`)
      .join(' · ') || 'No profile has a discovered directional clue yet.',
    detail: {
      kind: 'ranking',
      rows: ranking.rankedSuspects.map((row) => ({
        id: row.id,
        name: row.name,
        initials: row.initials,
        rankPosition: row.rankPosition,
        score: row.score,
        priorityLabel: row.priorityLabel,
        supportingCount: row.supportingCount,
        directionalEvidenceCount: row.directionalEvidenceCount,
        explanation: row.explanation,
      })),
      warnings: [...ranking.dataWarnings],
      hasMeaningfulEvidence: ranking.hasMeaningfulEvidence,
    },
    algorithm: {
      label: 'Ranking algorithm · hash tables',
      detail: 'Suspects, clues and timeline events are indexed in hash tables for direct lookup, then each discovered relationship adds points once. Identical input always produces the same ranking.',
    },
  })

  // 10. Test one theory in the lab.
  const theory = evaluateTheory({
    discoveredEvidenceIds: new Set(discovered),
    evidence: caseFile.evidence,
    locations: caseFile.locations,
    suspects: caseFile.suspects,
    suspectId: solution.culpritSuspectId,
    timeline: caseFile.events,
  })
  const theorySuspect = caseIndex.getSuspectById(solution.culpritSuspectId)

  pushStep({
    id: 'deduction',
    kind: 'walk',
    phase: 'COMPARE',
    section: 'Deduction Lab',
    targetId: 'deduction-lab',
    title: `Test the theory: ${theorySuspect?.name || solution.culpritSuspectId}`,
    coach: 'The lab takes one theory at a time and splits the discovered clues into those that support it, those that conflict with it, and those that are only context.',
    action: `Evaluate the theory that ${theorySuspect?.name || 'this profile'} deserves further investigation.`,
    result: theory.explanation,
    detail: {
      kind: 'deduction',
      status: theory.status,
      supporting: theory.supportingFacts.map((fact) => ({ id: fact.evidenceId, title: fact.title })),
      contradicting: theory.contradictingFacts.map((fact) => ({ id: fact.id, title: fact.title })),
      neutral: theory.neutralFacts.map((fact) => ({ id: fact.evidenceId, title: fact.title })),
      unresolvedQuestions: [...theory.unresolvedQuestions],
      rulesEvaluated: theory.rulesEvaluated.map((rule) => ({ ruleId: rule.ruleId, title: rule.title, result: rule.result, explanation: rule.explanation })),
      warnings: [...theory.dataWarnings],
    },
    algorithm: {
      label: 'Deduction rules · structured checks',
      detail: 'Rules are checked only against explicit, verified observations. Travel paths and narrative alibis are never used to infer a location, so an unresolved rule stays unresolved instead of becoming a guess.',
    },
  })

  // 11. Read the network of links you have earned.
  const network = createEvidenceRelationshipNetwork(caseFile, new Set(discovered))

  pushStep({
    id: 'network',
    kind: 'walk',
    phase: 'COMPARE',
    section: 'Clue Network',
    targetId: 'evidence-relationship-network',
    title: 'See how the clues connect',
    coach: 'The network draws the links the case file already documents: which room a clue was filed in, who it names, and which reported event puts someone at a place.',
    action: `Draw the network from ${discovered.length} discovered clues.`,
    result: `${network.nodes.length} nodes and ${network.edges.length} links, from clue to room, clue to profile, and event to profile. Sealed clues and their links stay hidden until they are uncovered.`,
    detail: {
      kind: 'network',
      nodeCount: network.nodes.length,
      edgeCount: network.edges.length,
      nodeCounts: network.nodes.reduce((totals, node) => ({ ...totals, [node.type]: (totals[node.type] || 0) + 1 }), {}),
      edgeTypes: [...new Set(network.edges.map((edge) => edge.type))],
      errors: [...network.errors],
      validation: network.validation,
    },
    algorithm: {
      label: 'Graph relationships',
      detail: 'Every node is typed and every link must resolve at both ends, so a broken reference surfaces as an error instead of a silent gap.',
    },
  })

  // 12. Decision — name a suspect and cite clues.
  const accusationOptions = caseFile.suspects.map((suspect) => ({
    id: suspect.id,
    name: suspect.name,
    role: suspect.role,
    initials: suspect.initials,
  }))
  const defaultEvidenceIds = essentialEvidenceIds.filter((id) => discovered.includes(id))

  const recommendedAccusation = evaluateSimulationAccusation({
    caseFile,
    discoveredEvidenceIds: discovered,
    explanation: solution.explanation,
    selectedEvidenceIds: defaultEvidenceIds,
    selectedSuspectId: solution.culpritSuspectId,
    solution,
  })

  pushStep({
    id: 'accusation',
    kind: 'decision',
    phase: 'CONCLUDE',
    section: 'Make Final Accusation',
    targetId: 'final-accusation',
    title: 'Name a suspect and cite your clues',
    coach: 'The accusation asks for three things: one suspect, the clues that carry the argument, and a short explanation. Guesswork and an unsupported case are scored differently.',
    action: 'Submit the accusation.',
    result: 'The verdict below is produced live by the same evaluator the game uses, against the case file\'s configured reconstruction.',
    detail: {
      kind: 'accusation',
      suspects: accusationOptions,
      clueOptions: discovered.map((id) => {
        const record = evidenceById.get(id)
        return {
          id,
          title: record.title,
          category: record.category,
          filedAtName: filedInName(caseFile, record.discoveredAt),
          weight: essentialEvidenceIds.includes(id) ? 'essential' : 'context',
        }
      }),
      explanation: solution.explanation,
    },
    choice: {
      kind: 'accusation',
      prompt: 'Who did it, and which clues carry the case?',
      recommendedSuspectId: solution.culpritSuspectId,
      recommendedEvidenceIds: defaultEvidenceIds,
      recommendedOutcome: recommendedAccusation,
    },
    algorithm: {
      label: 'Case resolution · outcome scoring',
      detail: 'A correct suspect with incomplete citations is a different outcome from a supported case. The evaluator looks only at IDs and authored relationships; it never interprets prose or claims proof.',
    },
  })

  // 13. What the ending does and does not establish.
  pushStep({
    id: 'epilogue',
    kind: 'walk',
    phase: 'CONCLUDE',
    section: 'Make Final Accusation',
    targetId: 'final-accusation',
    title: 'Read the ending for what it is',
    coach: 'A confirmed accusation ends the case and records it, but the reconstruction stays circumstantial. The case file says so, and the simulation keeps saying so.',
    action: 'Read the resolution note.',
    result: solution.solutionLimits,
    note: {
      label: 'Where the real session goes from here',
      text: 'A real session adds what this walkthrough skips: journal notes and bookmarks on any record, the clue-search box used freely, evidence export and import, and the algorithm explorers (Trie, B+Tree, BST, hash table, algorithm performance lab) that show each structure working on this case.',
    },
    algorithm: {
      label: 'Replayable, not derived',
      detail: 'The reconstruction is authored data validated against the case file, so a replay can start clean without changing any record.',
    },
  })

  return {
    caseId: caseFile.id,
    title: caseFile.title,
    culpritSuspectId: solution.culpritSuspectId,
    culpritName: caseIndex.getSuspectById(solution.culpritSuspectId)?.name || solution.culpritSuspectId,
    disclaimer:
      'This walkthrough follows the case file\'s own reconstruction so you can watch one coherent solution. A real session reaches the same place by exploring: sealed clues are opened one card at a time, and the ranking and deduction results change as you go.',
    startLocationId: SIMULATION_START_LOCATION_ID,
    searchPrefix: SIMULATION_SEARCH_PREFIX,
    steps,
    routes,
    totals: {
      stepCount: steps.length,
      clueTotal: caseFile.evidence.length,
      discoveredCount: discovered.length,
      essentialCount: essentialEvidenceIds.length,
      contextualCount: contextualEvidenceIds.length,
      routeCost,
    },
  }
}

/** Score an accusation with the game's own evaluator. Read-only. */
export function evaluateSimulationAccusation({
  caseFile = case001,
  solution = caseSolution,
  selectedSuspectId,
  selectedEvidenceIds = [],
  discoveredEvidenceIds = [],
  explanation = '',
} = {}) {
  return evaluateAccusation({
    caseFile,
    discoveredEvidenceIds,
    evidence: caseFile.evidence,
    events: caseFile.events,
    explanation,
    selectedEvidenceIds,
    selectedSuspectId,
    solution,
    suspects: caseFile.suspects,
  })
}

/**
 * Turn a room choice into honest feedback: what it costs, what is filed there,
 * and whether the reconstruction actually needs anything from it.
 */
export function describeRouteChoice({ option, recommendedId } = {}) {
  if (!option) return { tone: 'unknown', message: 'Choose a room on the map to see what it holds.' }
  const costLine = `${option.pathNames.join(' → ')} · ${option.cost} cost units`
  const filedLine = option.filedClueIds.length
    ? `${option.filedClueIds.length} clue card${option.filedClueIds.length === 1 ? '' : 's'} filed here (${option.filedClueIds.join(', ')}).`
    : 'Nothing is filed here on the current record.'
  if (option.id === recommendedId) {
    return {
      tone: 'recommended',
      message: `The reconstruction starts here. ${filedLine} ${costLine}.`,
    }
  }
  if (option.relevantClueIds.length) {
    return {
      tone: 'useful',
      message: `Not the first door the reconstruction opens, but ${option.relevantClueIds.join(', ')} will matter later. ${costLine}.`,
    }
  }
  return {
    tone: 'detour',
    message: `A real session is allowed to look here, but no clue the reconstruction cites is filed in this room. ${filedLine} ${costLine}.`,
  }
}

export default buildCaseSimulation
