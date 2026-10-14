function validateKey(key) {
  if (typeof key !== 'string') {
    throw new TypeError('BinarySearchTree keys must be strings.')
  }
}

function compareKeys(leftKey, rightKey) {
  if (leftKey < rightKey) return -1
  if (leftKey > rightKey) return 1
  return 0
}

function copyRecord(node) {
  return node ? Object.freeze({ key: node.key, value: node.value }) : null
}

/** A node used internally by BinarySearchTree. Keys are compared as strings. */
export class TreeNode {
  constructor(key, value) {
    validateKey(key)
    this.key = key
    this.value = value
    this.left = null
    this.right = null
  }
}

/**
 * An unbalanced binary search tree with case-sensitive UTF-16 lexicographic
 * string-key ordering. Insert/search/delete are typically O(log n) for a
 * reasonably balanced tree and O(n) in the worst case. Traversals are O(n).
 * Height counts nodes on the longest root-to-leaf path: empty is 0, leaf is 1.
 */
export class BinarySearchTree {
  #root = null
  #nodeCount = 0

  /** Insert or update a string key. Returns true for a new key, false on update. */
  insert(key, value) {
    validateKey(key)
    if (!this.#root) {
      this.#root = new TreeNode(key, value)
      this.#nodeCount += 1
      return true
    }

    let current = this.#root
    while (true) {
      const comparison = compareKeys(key, current.key)
      if (comparison === 0) {
        current.value = value
        return false
      }

      const side = comparison < 0 ? 'left' : 'right'
      if (current[side]) {
        current = current[side]
      } else {
        current[side] = new TreeNode(key, value)
        this.#nodeCount += 1
        return true
      }
    }
  }

  /** Return a frozen { key, value } snapshot, or null when the key is absent. */
  search(key) {
    validateKey(key)
    let current = this.#root
    while (current) {
      const comparison = compareKeys(key, current.key)
      if (comparison === 0) return copyRecord(current)
      current = comparison < 0 ? current.left : current.right
    }
    return null
  }

  has(key) {
    return this.search(key) !== null
  }

  /** Remove a key, returning true only when a node was removed. */
  delete(key) {
    validateKey(key)
    let parent = null
    let current = this.#root

    while (current && current.key !== key) {
      parent = current
      current = compareKeys(key, current.key) < 0 ? current.left : current.right
    }
    if (!current) return false

    if (current.left && current.right) {
      let successorParent = current
      let successor = current.right
      while (successor.left) {
        successorParent = successor
        successor = successor.left
      }

      if (successorParent !== current) {
        successorParent.left = successor.right
        successor.right = current.right
      }
      successor.left = current.left
      this.#replaceNode(parent, current, successor)
    } else {
      this.#replaceNode(parent, current, current.left ?? current.right)
    }

    this.#nodeCount -= 1
    return true
  }

  /** Return detached node records in ascending lexicographic key order. */
  inOrderTraversal() {
    const result = []
    const stack = []
    let current = this.#root

    // Descend left, visit the node, then continue through its right subtree.
    while (current || stack.length) {
      while (current) {
        stack.push(current)
        current = current.left
      }
      current = stack.pop()
      result.push(copyRecord(current))
      current = current.right
    }
    return result
  }

  preOrderTraversal() {
    if (!this.#root) return []
    const result = []
    const stack = [this.#root]

    // Visit each node before pushing its right and left children.
    while (stack.length) {
      const current = stack.pop()
      result.push(copyRecord(current))
      if (current.right) stack.push(current.right)
      if (current.left) stack.push(current.left)
    }
    return result
  }

  postOrderTraversal() {
    if (!this.#root) return []
    const result = []
    const stack = [this.#root]

    // Collect root-right-left, then reverse to visit left-right-root.
    while (stack.length) {
      const current = stack.pop()
      result.push(copyRecord(current))
      if (current.left) stack.push(current.left)
      if (current.right) stack.push(current.right)
    }
    return result.reverse()
  }

  levelOrderTraversal() {
    if (!this.#root) return []
    const result = []
    const queue = [this.#root]

    // Process the queue from front to back, adding each node's children last.
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]
      result.push(copyRecord(current))
      if (current.left) queue.push(current.left)
      if (current.right) queue.push(current.right)
    }
    return result
  }

  getMin() {
    let current = this.#root
    if (!current) return null
    while (current.left) current = current.left
    return copyRecord(current)
  }

  getMax() {
    let current = this.#root
    if (!current) return null
    while (current.right) current = current.right
    return copyRecord(current)
  }

  /** Height is counted in nodes (levels): empty=0 and a single node=1. */
  height() {
    if (!this.#root) return 0
    let maximumLevel = 0
    const queue = [{ node: this.#root, level: 1 }]
    for (let head = 0; head < queue.length; head += 1) {
      const { node, level } = queue[head]
      maximumLevel = Math.max(maximumLevel, level)
      if (node.left) queue.push({ node: node.left, level: level + 1 })
      if (node.right) queue.push({ node: node.right, level: level + 1 })
    }
    return maximumLevel
  }

  size() {
    return this.#nodeCount
  }

  isEmpty() {
    return this.#nodeCount === 0
  }

  clear() {
    this.#root = null
    this.#nodeCount = 0
  }

  getStats() {
    return { nodeCount: this.#nodeCount, height: this.height() }
  }

  /** Return a detached tree-shaped snapshot for visualization consumers. */
  toStructure() {
    if (!this.#root) return null
    const snapshot = { key: this.#root.key, value: this.#root.value, left: null, right: null }
    const queue = [{ node: this.#root, snapshot }]

    for (let head = 0; head < queue.length; head += 1) {
      const { node, snapshot: nodeSnapshot } = queue[head]
      if (node.left) {
        nodeSnapshot.left = { key: node.left.key, value: node.left.value, left: null, right: null }
        queue.push({ node: node.left, snapshot: nodeSnapshot.left })
      }
      if (node.right) {
        nodeSnapshot.right = { key: node.right.key, value: node.right.value, left: null, right: null }
        queue.push({ node: node.right, snapshot: nodeSnapshot.right })
      }
    }
    return snapshot
  }

  #replaceNode(parent, current, replacement) {
    if (!parent) {
      this.#root = replacement
    } else if (parent.left === current) {
      parent.left = replacement
    } else {
      parent.right = replacement
    }
  }
}

export default BinarySearchTree
