function normalizeInput(word) {
  if (typeof word !== 'string') {
    throw new TypeError('Trie words and prefixes must be strings.')
  }

  const display = word.trim().normalize('NFC')
  return { display, normalized: display.toLowerCase() }
}

/** Return the trimmed NFC display spelling and case-insensitive lookup key. */
export function normalizeTrieWord(word) {
  return normalizeInput(word)
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

class TrieNode {
  constructor() {
    this.children = new Map()
    this.isTerminal = false
    this.word = null
    this.payloads = []
  }
}

/**
 * Case-insensitive prefix tree for strings. Input is trimmed, normalized to
 * Unicode NFC, and lowercased for matching; the first spelling is retained
 * for display. Empty strings cannot be inserted, while an empty prefix means
 * the root and can be used to list all words (with autocomplete's limit).
 *
 * Re-inserting a normalized word preserves the first display spelling and
 * adds a distinct payload association without increasing the word count.
 * Payload associations are de-duplicated with Array.includes equality (object
 * values therefore use reference identity; primitive values use SameValueZero).
 * Search and insertion are O(L) expected with Map child lookup. Autocomplete
 * is O(L + V + R), where V is the matching-subtree nodes visited and R is the
 * returned words/payload associations. Deletion is O(L) expected.
 */
export class Trie {
  #root = new TrieNode()
  #wordCount = 0

  insert(word, payload) {
    const { display, normalized } = normalizeInput(word)
    if (!normalized) throw new TypeError('Trie words cannot be empty after trimming.')

    let node = this.#root
    for (const character of normalized) {
      if (!node.children.has(character)) node.children.set(character, new TrieNode())
      node = node.children.get(character)
    }

    const isNewWord = !node.isTerminal
    if (isNewWord) {
      node.isTerminal = true
      node.word = display
      this.#wordCount += 1
    }

    if (payload !== undefined && !node.payloads.includes(payload)) node.payloads.push(payload)
    return isNewWord
  }

  search(word) {
    const { normalized } = normalizeInput(word)
    if (!normalized) return false
    return this.#findNode(normalized)?.isTerminal ?? false
  }

  startsWith(prefix) {
    const { normalized } = normalizeInput(prefix)
    if (!normalized) return this.#wordCount > 0
    return this.#findNode(normalized) !== null
  }

  /** Returns sorted { word, payloads } records; invalid limits throw RangeError. */
  autocomplete(prefix, limit = 10) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new RangeError('Autocomplete limit must be a non-negative integer.')
    }
    if (limit === 0) return []

    const { normalized } = normalizeInput(prefix)
    const startNode = normalized ? this.#findNode(normalized) : this.#root
    if (!startNode) return []

    const results = []
    const stack = [{ node: startNode, fullWord: normalized }]
    while (stack.length && results.length < limit) {
      const { node, fullWord } = stack.pop()
      if (node.isTerminal) {
        results.push({ word: node.word, payloads: [...node.payloads] })
      }

      const children = [...node.children.entries()].sort(([left], [right]) => compareStrings(left, right))
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const [character, child] = children[index]
        stack.push({ node: child, fullWord: `${fullWord}${character}` })
      }
    }
    return results
  }

  delete(word) {
    const { normalized } = normalizeInput(word)
    if (!normalized) return false

    const path = []
    let node = this.#root
    for (const character of normalized) {
      const child = node.children.get(character)
      if (!child) return false
      path.push({ parent: node, character, child })
      node = child
    }
    if (!node.isTerminal) return false

    node.isTerminal = false
    node.word = null
    node.payloads = []
    this.#wordCount -= 1

    for (let index = path.length - 1; index >= 0; index -= 1) {
      const { parent, character, child } = path[index]
      if (child.isTerminal || child.children.size > 0) break
      parent.children.delete(character)
    }
    return true
  }

  getAllWords() {
    return this.getAllEntries().map(({ word }) => word)
  }

  getAllEntries() {
    return this.autocomplete('', Number.MAX_SAFE_INTEGER)
  }

  getPayloads(word) {
    const { normalized } = normalizeInput(word)
    if (!normalized) return []
    const node = this.#findNode(normalized)
    return node?.isTerminal ? [...node.payloads] : []
  }

  size() {
    return this.#wordCount
  }

  isEmpty() {
    return this.#wordCount === 0
  }

  clear() {
    this.#root = new TrieNode()
    this.#wordCount = 0
  }

  getStats() {
    let nodeCount = 0
    let maximumWordLength = 0
    const stack = [{ node: this.#root, depth: 0 }]
    while (stack.length) {
      const { node, depth } = stack.pop()
      nodeCount += 1
      if (node.isTerminal) maximumWordLength = Math.max(maximumWordLength, depth)
      for (const child of node.children.values()) stack.push({ node: child, depth: depth + 1 })
    }
    return { wordCount: this.#wordCount, nodeCount, maximumWordLength }
  }

  /** Returns a detached character tree without exposing mutable Trie nodes. */
  getStructure() {
    const root = { id: 'root', character: '', prefix: '', terminal: false, word: null, children: [] }
    const pending = [{ source: this.#root, target: root }]
    let nextId = 0

    while (pending.length) {
      const { source, target } = pending.pop()
      const children = [...source.children.entries()].sort(([left], [right]) => compareStrings(left, right))
      target.terminal = source.isTerminal
      target.word = source.isTerminal ? source.word : null
      target.children = children.map(([character, child]) => ({
        id: `trie-node-${++nextId}`,
        character,
        prefix: `${target.prefix}${character}`,
        terminal: child.isTerminal,
        word: child.isTerminal ? child.word : null,
        children: [],
      }))
      children.forEach(([, child], index) => pending.push({ source: child, target: target.children[index] }))
    }
    return root
  }

  #findNode(normalizedWord) {
    let node = this.#root
    for (const character of normalizedWord) {
      node = node.children.get(character)
      if (!node) return null
    }
    return node
  }
}

export default Trie
