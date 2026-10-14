import { createSuspectEvidenceRelationships } from './suspectEvidenceRelationships.js'

const NODE_TYPES = new Set(['suspect', 'location', 'evidence', 'timeline'])

function asIdSet(ids) {
  return ids instanceof Set ? ids : new Set(Array.isArray(ids) ? ids : [])
}

function addEdge(edges, edge, edgeIds) {
  if (edgeIds.has(edge.id)) return
  edgeIds.add(edge.id)
  edges.push(edge)
}

/**
 * Create a player-facing investigative relationship network from documented
 * case fields. Corridor routes are intentionally not included here. Evidence
 * nodes and every edge attached to them are limited to discovered evidence.
 *
 * `relatedSuspectIds` creates a cautious follow-up link, not a claim of guilt
 * or presence. Timeline links mean only that the event record names a person
 * or location; they do not independently establish where someone was.
 */
export function createEvidenceRelationshipNetwork(caseFile, discoveredEvidenceIds = new Set()) {
  const errors = []
  const nodes = []
  const edges = []
  const nodeIds = new Set()
  const edgeIds = new Set()
  const discoveredIds = asIdSet(discoveredEvidenceIds)
  const suspects = Array.isArray(caseFile?.suspects) ? caseFile.suspects : []
  const locations = Array.isArray(caseFile?.locations) ? caseFile.locations : []
  const evidence = Array.isArray(caseFile?.evidence) ? caseFile.evidence : []
  const events = Array.isArray(caseFile?.events) ? caseFile.events : []

  const addNode = (node) => {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate network node ID "${node.id}".`)
      return
    }
    nodeIds.add(node.id)
    nodes.push(node)
  }

  suspects.forEach((record) => {
    if (!record?.id) return errors.push('A suspect record is missing its ID.')
    addNode({
      id: `suspect:${record.id}`,
      type: 'suspect',
      recordType: 'suspect',
      recordId: record.id,
      label: record.name || record.id,
      description: record.biography || 'No profile description is available.',
    })
  })

  locations.forEach((record) => {
    if (!record?.id) return errors.push('A location record is missing its ID.')
    addNode({
      id: `location:${record.id}`,
      type: 'location',
      recordType: 'location',
      recordId: record.id,
      label: record.name || record.id,
      description: record.description || 'No location description is available.',
    })
  })

  evidence.forEach((record) => {
    if (!record?.id || !discoveredIds.has(record.id)) return
    addNode({
      id: `evidence:${record.id}`,
      type: 'evidence',
      recordType: 'evidence',
      recordId: record.id,
      label: record.title || record.id,
      description: record.description || 'No evidence description is available.',
      category: record.category || null,
      relevance: record.relevance || null,
      discoveredAt: record.discoveredAt || null,
    })
  })

  events.forEach((record) => {
    if (!record?.id) return errors.push('A timeline event is missing its ID.')
    addNode({
      id: `timeline:${record.id}`,
      type: 'timeline',
      recordType: 'timeline',
      recordId: record.id,
      label: record.title || record.id,
      description: record.description || 'No event description is available.',
      timestamp: record.timestamp || null,
      confirmed: record.confirmed === true,
    })
  })

  const addReferencedEdge = (edge, references) => {
    const missing = references.filter((id) => !nodeIds.has(id))
    if (missing.length) {
      errors.push(`Relationship "${edge.id}" references missing node(s): ${missing.join(', ')}.`)
      return
    }
    addEdge(edges, edge, edgeIds)
  }

  const locationIds = new Set(locations.map(({ id }) => id))
  const suspectIds = new Set(suspects.map(({ id }) => id))

  evidence.forEach((record) => {
    if (!record?.id || !discoveredIds.has(record.id)) return
    const evidenceNodeId = `evidence:${record.id}`
    if (record.discoveredAt) {
      const locationNodeId = `location:${record.discoveredAt}`
      if (!locationIds.has(record.discoveredAt)) {
        errors.push(`Evidence "${record.id}" references missing location "${record.discoveredAt}".`)
      } else {
        addReferencedEdge({
          id: `found-at:${record.id}:${record.discoveredAt}`,
          type: 'found-at',
          from: evidenceNodeId,
          to: locationNodeId,
          label: 'Found at',
        }, [evidenceNodeId, locationNodeId])
      }
    }
  })

  // Reuse the relationship source used by Task 9; it is a follow-up lead only.
  for (const relationship of createSuspectEvidenceRelationships(caseFile)) {
    if (!discoveredIds.has(relationship.evidenceId)) continue
    if (!suspectIds.has(relationship.suspectId)) {
      errors.push(`Evidence "${relationship.evidenceId}" references missing suspect "${relationship.suspectId}".`)
      continue
    }
    const edge = {
      id: `profile-follow-up:${relationship.evidenceId}:${relationship.suspectId}`,
      type: 'profile-follow-up',
      from: `evidence:${relationship.evidenceId}`,
      to: `suspect:${relationship.suspectId}`,
      label: 'Linked for follow-up',
      explanation: relationship.rationale,
    }
    addReferencedEdge(edge, [edge.from, edge.to])
  }

  events.forEach((event) => {
    if (!event?.id) return
    const eventNodeId = `timeline:${event.id}`
    if (event.locationId) {
      if (!locationIds.has(event.locationId)) {
        errors.push(`Timeline event "${event.id}" references missing location "${event.locationId}".`)
      } else {
        const edge = {
          id: `event-location:${event.id}:${event.locationId}`,
          type: 'event-location',
          from: eventNodeId,
          to: `location:${event.locationId}`,
          label: 'Location named in report',
          confirmed: event.confirmed === true,
        }
        addReferencedEdge(edge, [edge.from, edge.to])
      }
    }
    if (!Array.isArray(event.relatedSuspectIds)) return
    for (const suspectId of event.relatedSuspectIds) {
      if (!suspectIds.has(suspectId)) {
        errors.push(`Timeline event "${event.id}" references missing suspect "${suspectId}".`)
        continue
      }
      const edge = {
        id: `named-in-report:${event.id}:${suspectId}`,
        type: 'named-in-report',
        from: eventNodeId,
        to: `suspect:${suspectId}`,
        label: 'Named in report',
        confirmed: event.confirmed === true,
      }
      addReferencedEdge(edge, [edge.from, edge.to])
    }
  })

  const network = { nodes, edges, errors }
  return { ...network, validation: validateEvidenceRelationshipNetwork(network) }
}

/** Check that network records are typed and every edge has two valid endpoints. */
export function validateEvidenceRelationshipNetwork(network) {
  const errors = Array.isArray(network?.errors) ? [...network.errors] : []
  const nodes = Array.isArray(network?.nodes) ? network.nodes : []
  const edges = Array.isArray(network?.edges) ? network.edges : []
  const nodeIds = new Set()

  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !NODE_TYPES.has(node.type)) {
      errors.push('Every network node must have a string ID and a supported type.')
      continue
    }
    if (nodeIds.has(node.id)) errors.push(`Duplicate network node ID "${node.id}".`)
    nodeIds.add(node.id)
  }

  const edgeIds = new Set()
  for (const edge of edges) {
    if (!edge || typeof edge.id !== 'string' || !edge.type) {
      errors.push('Every network edge must have a string ID and relationship type.')
      continue
    }
    if (edgeIds.has(edge.id)) errors.push(`Duplicate network edge ID "${edge.id}".`)
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(`Relationship "${edge.id}" has a missing endpoint.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export const EVIDENCE_RELATIONSHIP_TYPES = Object.freeze([
  { id: 'found-at', label: 'Found at location' },
  { id: 'profile-follow-up', label: 'Profile follow-up link' },
  { id: 'event-location', label: 'Location named in report' },
  { id: 'named-in-report', label: 'Person named in report' },
])
