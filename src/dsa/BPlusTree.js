function validateKey(key) {
  if (typeof key !== 'string') {
    throw new TypeError('BPlusTree keys must be strings.')
  }
}

function compareKeys(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function lowerBound(keys, key) {
  let low = 0
  let high = keys.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (compareKeys(keys[middle], key) < 0) low = middle + 1
    else high = middle
  }
  return low
}

class LeafNode {
  constructor(parent = null) {
    this.isLeaf = true
    this.keys = []
    this.values = []
    this.parent = parent
    this.next = null
    this.prev = null
  }
}

class InternalNode {
  constructor(parent = null) {
    this.isLeaf = false
    this.keys = []
    this.children = []
    this.parent = parent
  }
}

/**
 * In-memory B+ Tree with case-sensitive UTF-16 lexicographic string keys.
 * `order` means the maximum number of children in an internal node. Internal
 * nodes therefore hold at most order - 1 separators, and leaves hold at most
 * order - 1 key/value entries. Non-root internal nodes need ceil(order / 2)
 * children; non-root leaves need ceil((order - 1) / 2) entries. All records
 * live in leaves; internal keys are separators equal to the minimum key in
 * the child immediately to their right.
 *
 * With fixed order m, search/insert/delete visit O(log_m n) nodes and may do
 * bounded O(m) work at each level for local array edits. Range scans are
 * O(log_m n + k); full ordered traversal is O(n). This is an educational,
 * in-memory structure rather than a disk-backed database index.
 */
export class BPlusTree {
  #root = null
  #entryCount = 0
  #order

  constructor(order = 4) {
    if (!Number.isSafeInteger(order) || order < 3) {
      throw new RangeError('BPlusTree order must be an integer of at least 3 (maximum internal children).')
    }
    this.#order = order
  }

  get order() {
    return this.#order
  }

  /** Insert a new string key or update it; returns true only for a new key. */
  insert(key, value) {
    validateKey(key)
    if (!this.#root) this.#root = new LeafNode()

    const leaf = this.#findLeaf(key)
    const index = lowerBound(leaf.keys, key)
    if (leaf.keys[index] === key) {
      leaf.values[index] = value
      return false
    }

    leaf.keys.splice(index, 0, key)
    leaf.values.splice(index, 0, value)
    this.#entryCount += 1

    if (leaf.keys.length > this.#maxLeafKeys) this.#splitLeaf(leaf)
    else this.#refreshAncestors(leaf.parent)
    return true
  }

  /** Return the stored value, or undefined when the key is absent. */
  /** Return the stored value, or undefined when the string key is absent. */
  search(key) {
    validateKey(key)
    const leaf = this.#findLeaf(key)
    if (!leaf) return undefined
    const index = lowerBound(leaf.keys, key)
    return leaf.keys[index] === key ? leaf.values[index] : undefined
  }

  /** Return whether a key is present; unlike search, this distinguishes an undefined value. */
  has(key) {
    validateKey(key)
    const leaf = this.#findLeaf(key)
    if (!leaf) return false
    const index = lowerBound(leaf.keys, key)
    return leaf.keys[index] === key
  }

  /** Remove a key and rebalance; returns false if the key was absent. */
  delete(key) {
    validateKey(key)
    const leaf = this.#findLeaf(key)
    if (!leaf) return false
    const index = lowerBound(leaf.keys, key)
    if (leaf.keys[index] !== key) return false

    leaf.keys.splice(index, 1)
    leaf.values.splice(index, 1)
    this.#entryCount -= 1

    if (leaf === this.#root) {
      if (leaf.keys.length === 0) this.#root = null
      return true
    }

    if (leaf.keys.length >= this.#minimumLeafKeys) {
      this.#refreshAncestors(leaf.parent)
      return true
    }

    this.#rebalanceLeaf(leaf)
    return true
  }

  /** Inclusive ordered scan. Invalid ranges (start > end) return an empty list. */
  rangeSearch(startKey, endKey) {
    validateKey(startKey)
    validateKey(endKey)
    if (compareKeys(startKey, endKey) > 0) return []

    const result = []
    let leaf = this.#findLeaf(startKey)
    while (leaf) {
      for (let index = 0; index < leaf.keys.length; index += 1) {
        const key = leaf.keys[index]
        if (compareKeys(key, endKey) > 0) return result
        if (compareKeys(key, startKey) >= 0) result.push({ key, value: leaf.values[index] })
      }
      leaf = leaf.next
    }
    return result
  }

  /** Return all key/value entries in ascending key order by following leaf links. */
  getAllEntries() {
    const result = []
    let leaf = this.#leftmostLeaf()
    while (leaf) {
      for (let index = 0; index < leaf.keys.length; index += 1) {
        result.push({ key: leaf.keys[index], value: leaf.values[index] })
      }
      leaf = leaf.next
    }
    return result
  }

  /** Return the smallest { key, value } entry, or undefined when empty. */
  getMin() {
    const leaf = this.#leftmostLeaf()
    return leaf ? { key: leaf.keys[0], value: leaf.values[0] } : undefined
  }

  /** Return the largest { key, value } entry, or undefined when empty. */
  getMax() {
    let leaf = this.#leftmostLeaf()
    if (!leaf) return undefined
    while (leaf.next) leaf = leaf.next
    const index = leaf.keys.length - 1
    return { key: leaf.keys[index], value: leaf.values[index] }
  }

  size() {
    return this.#entryCount
  }

  isEmpty() {
    return this.#entryCount === 0
  }

  clear() {
    this.#root = null
    this.#entryCount = 0
  }

  /** Height counts node levels: empty is 0 and a leaf root is 1. */
  getStats() {
    if (!this.#root) {
      return { height: 0, keyCount: 0, leafCount: 0, internalNodeCount: 0, order: this.#order }
    }

    let height = 0
    let leafCount = 0
    let internalNodeCount = 0
    const queue = [{ node: this.#root, depth: 1 }]
    for (let head = 0; head < queue.length; head += 1) {
      const { node, depth } = queue[head]
      height = Math.max(height, depth)
      if (node.isLeaf) leafCount += 1
      else {
        internalNodeCount += 1
        for (const child of node.children) queue.push({ node: child, depth: depth + 1 })
      }
    }
    return { height, keyCount: this.#entryCount, leafCount, internalNodeCount, order: this.#order }
  }

  /**
   * Return the structural search path as detached node IDs and key snapshots.
   * IDs match those returned by getStructure(), so UI consumers can highlight
   * the actual nodes visited without receiving mutable internal nodes.
   */
  getSearchPath(key) {
    validateKey(key)
    const path = []
    if (!this.#root) return { key, found: false, path }

    let node = this.#root
    let nodeId = 'root'
    while (!node.isLeaf) {
      const childIndex = this.#childIndex(node, key)
      path.push({ id: nodeId, type: 'internal', keys: [...node.keys], childIndex })
      node = node.children[childIndex]
      nodeId = `${nodeId}.${childIndex}`
    }
    const index = lowerBound(node.keys, key)
    const found = node.keys[index] === key
    path.push({ id: nodeId, type: 'leaf', keys: [...node.keys], found })
    return { key, found, path }
  }

  /** Return detached keys and child structure for visualization consumers. */
  getStructure() {
    if (!this.#root) return null
    const leafIds = new Map()
    const idQueue = [{ node: this.#root, id: 'root' }]
    for (let head = 0; head < idQueue.length; head += 1) {
      const { node, id } = idQueue[head]
      if (node.isLeaf) leafIds.set(node, id)
      else node.children.forEach((child, index) => idQueue.push({ node: child, id: `${id}.${index}` }))
    }

    const clone = (node, id) => {
      if (node.isLeaf) {
        return {
          id,
          type: 'leaf',
          keys: [...node.keys],
          children: [],
          previousLeafId: node.prev ? leafIds.get(node.prev) : null,
          nextLeafId: node.next ? leafIds.get(node.next) : null,
        }
      }
      return {
        id,
        type: 'internal',
        keys: [...node.keys],
        children: node.children.map((child, index) => clone(child, `${id}.${index}`)),
      }
    }
    return clone(this.#root, 'root')
  }

  /** Check occupancy, separator/range rules, leaf depth/links and entry count. */
  validate() {
    const errors = []
    if (!this.#root) {
      if (this.#entryCount !== 0) errors.push('An empty root has a non-zero entry count.')
      return { valid: errors.length === 0, errors }
    }

    if (this.#root.parent !== null) errors.push('The root must not have a parent.')
    const leafDepths = new Set()
    const leaves = []
    const allKeys = []

    const checkNode = (node, expectedParent, depth, lowerKey, upperKey, isRoot) => {
      if (!node || typeof node !== 'object') {
        errors.push('A child pointer does not reference a node.')
        return { minimum: undefined, maximum: undefined }
      }
      if (node.parent !== expectedParent) errors.push('A node has an incorrect parent reference.')
      for (let index = 1; index < node.keys.length; index += 1) {
        if (compareKeys(node.keys[index - 1], node.keys[index]) >= 0) {
          errors.push('Keys within a node must be strictly sorted.')
          break
        }
      }

      if (node.isLeaf) {
        leaves.push(node)
        leafDepths.add(depth)
        if (node.keys.length !== node.values.length) errors.push('Leaf key and value counts must match.')
        if (node.keys.length > this.#maxLeafKeys) errors.push('A leaf exceeds the maximum entry count.')
        if (isRoot && node.keys.length === 0) errors.push('An empty leaf root should be represented by a null root.')
        if (!isRoot && node.keys.length < this.#minimumLeafKeys) errors.push('A non-root leaf is below minimum occupancy.')

        for (const key of node.keys) {
          if (typeof key !== 'string') errors.push('Leaf keys must be strings.')
          if (lowerKey !== undefined && compareKeys(key, lowerKey) < 0) errors.push(`Leaf key "${key}" is below its separator range.`)
          if (upperKey !== undefined && compareKeys(key, upperKey) >= 0) errors.push(`Leaf key "${key}" is above its separator range.`)
          allKeys.push(key)
        }
        return { minimum: node.keys[0], maximum: node.keys[node.keys.length - 1] }
      }

      if (!Array.isArray(node.children)) {
        errors.push('An internal node must have a child array.')
        return { minimum: undefined, maximum: undefined }
      }
      if (node.children.length !== node.keys.length + 1) errors.push('Internal nodes must have one more child than separator keys.')
      if (node.children.length > this.#order) errors.push('An internal node exceeds the maximum child count.')
      if (isRoot && node.children.length < 2) errors.push('An internal root must have at least two children.')
      if (!isRoot && node.children.length < this.#minimumInternalChildren) errors.push('A non-root internal node is below minimum occupancy.')

      let minimum
      let maximum
      for (let index = 0; index < node.children.length; index += 1) {
        const childLower = index === 0 ? lowerKey : node.keys[index - 1]
        const childUpper = index >= node.keys.length ? upperKey : node.keys[index]
        const bounds = checkNode(node.children[index], node, depth + 1, childLower, childUpper, false)
        if (index === 0) minimum = bounds.minimum
        maximum = bounds.maximum
        if (index > 0 && bounds.minimum !== undefined && node.keys[index - 1] !== bounds.minimum) {
          errors.push('Each separator must equal the minimum key in its right child subtree.')
        }
      }
      return { minimum, maximum }
    }

    checkNode(this.#root, null, 1, undefined, undefined, true)
    if (leafDepths.size > 1) errors.push('All leaves must occur at the same depth.')

    for (let index = 0; index < leaves.length; index += 1) {
      const expectedPrevious = index > 0 ? leaves[index - 1] : null
      const expectedNext = index + 1 < leaves.length ? leaves[index + 1] : null
      if (leaves[index].prev !== expectedPrevious) errors.push('Leaf previous links do not match tree order.')
      if (leaves[index].next !== expectedNext) errors.push('Leaf next links do not match tree order.')
    }

    for (let index = 1; index < allKeys.length; index += 1) {
      if (compareKeys(allKeys[index - 1], allKeys[index]) >= 0) {
        errors.push('Leaf entries must be globally sorted and unique.')
        break
      }
    }
    if (new Set(allKeys).size !== allKeys.length) errors.push('Each key must appear exactly once in the leaves.')
    if (allKeys.length !== this.#entryCount) errors.push('The reported entry count does not match leaf entries.')

    return { valid: errors.length === 0, errors }
  }

  get #maxLeafKeys() {
    return this.#order - 1
  }

  get #minimumLeafKeys() {
    return Math.ceil((this.#order - 1) / 2)
  }

  get #minimumInternalChildren() {
    return Math.ceil(this.#order / 2)
  }

  #findLeaf(key) {
    let node = this.#root
    while (node && !node.isLeaf) node = node.children[this.#childIndex(node, key)]
    return node
  }

  #childIndex(node, key) {
    let low = 0
    let high = node.keys.length
    // Equality belongs to the right child because separators are right minima.
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (compareKeys(key, node.keys[middle]) >= 0) low = middle + 1
      else high = middle
    }
    return low
  }

  #leftmostLeaf() {
    let node = this.#root
    while (node && !node.isLeaf) node = node.children[0]
    return node
  }

  #subtreeMinimum(node) {
    let current = node
    while (!current.isLeaf) current = current.children[0]
    return current.keys[0]
  }

  #rebuildSeparators(node) {
    if (node && !node.isLeaf) {
      node.keys = node.children.slice(1).map((child) => this.#subtreeMinimum(child))
    }
  }

  #refreshAncestors(node) {
    let current = node
    while (current) {
      this.#rebuildSeparators(current)
      current = current.parent
    }
  }

  #splitLeaf(leaf) {
    const right = new LeafNode(leaf.parent)
    const splitIndex = Math.ceil(leaf.keys.length / 2)
    right.keys = leaf.keys.splice(splitIndex)
    right.values = leaf.values.splice(splitIndex)
    right.next = leaf.next
    if (right.next) right.next.prev = right
    right.prev = leaf
    leaf.next = right
    this.#insertSiblingAfter(leaf, right)
  }

  #insertSiblingAfter(left, right) {
    const parent = left.parent
    if (!parent) {
      const newRoot = new InternalNode()
      newRoot.children = [left, right]
      left.parent = newRoot
      right.parent = newRoot
      this.#rebuildSeparators(newRoot)
      this.#root = newRoot
      return
    }

    const leftIndex = parent.children.indexOf(left)
    parent.children.splice(leftIndex + 1, 0, right)
    right.parent = parent
    this.#rebuildSeparators(parent)
    if (parent.children.length > this.#order) this.#splitInternal(parent)
    else this.#refreshAncestors(parent.parent)
  }

  #splitInternal(node) {
    const right = new InternalNode(node.parent)
    const splitIndex = Math.ceil(node.children.length / 2)
    right.children = node.children.splice(splitIndex)
    for (const child of right.children) child.parent = right
    this.#rebuildSeparators(node)
    this.#rebuildSeparators(right)
    this.#insertSiblingAfter(node, right)
  }

  #rebalanceLeaf(leaf) {
    const parent = leaf.parent
    const index = parent.children.indexOf(leaf)
    const left = index > 0 ? parent.children[index - 1] : null
    const right = index + 1 < parent.children.length ? parent.children[index + 1] : null

    if (left && left.keys.length > this.#minimumLeafKeys) {
      leaf.keys.unshift(left.keys.pop())
      leaf.values.unshift(left.values.pop())
      this.#refreshAncestors(parent)
      return
    }
    if (right && right.keys.length > this.#minimumLeafKeys) {
      leaf.keys.push(right.keys.shift())
      leaf.values.push(right.values.shift())
      this.#refreshAncestors(parent)
      return
    }

    if (left) {
      left.keys.push(...leaf.keys)
      left.values.push(...leaf.values)
      left.next = leaf.next
      if (leaf.next) leaf.next.prev = left
      parent.children.splice(index, 1)
    } else if (right) {
      leaf.keys.push(...right.keys)
      leaf.values.push(...right.values)
      leaf.next = right.next
      if (right.next) right.next.prev = leaf
      parent.children.splice(index + 1, 1)
    }
    this.#rebalanceInternal(parent)
  }

  #rebalanceInternal(node) {
    if (node === this.#root) {
      if (node.children.length === 0) {
        this.#root = null
      } else if (node.children.length === 1) {
        this.#root = node.children[0]
        this.#root.parent = null
      } else {
        this.#rebuildSeparators(node)
      }
      return
    }

    if (node.children.length >= this.#minimumInternalChildren) {
      this.#refreshAncestors(node)
      return
    }

    const parent = node.parent
    const index = parent.children.indexOf(node)
    const left = index > 0 ? parent.children[index - 1] : null
    const right = index + 1 < parent.children.length ? parent.children[index + 1] : null

    if (left && left.children.length > this.#minimumInternalChildren) {
      const movedChild = left.children.pop()
      movedChild.parent = node
      node.children.unshift(movedChild)
      this.#rebuildSeparators(left)
      this.#rebuildSeparators(node)
      this.#refreshAncestors(parent)
      return
    }
    if (right && right.children.length > this.#minimumInternalChildren) {
      const movedChild = right.children.shift()
      movedChild.parent = node
      node.children.push(movedChild)
      this.#rebuildSeparators(node)
      this.#rebuildSeparators(right)
      this.#refreshAncestors(parent)
      return
    }

    if (left) {
      left.children.push(...node.children)
      for (const child of node.children) child.parent = left
      this.#rebuildSeparators(left)
      parent.children.splice(index, 1)
    } else if (right) {
      node.children.push(...right.children)
      for (const child of right.children) child.parent = node
      this.#rebuildSeparators(node)
      parent.children.splice(index + 1, 1)
    }
    this.#rebuildSeparators(parent)
    this.#rebalanceInternal(parent)
  }
}

export default BPlusTree
