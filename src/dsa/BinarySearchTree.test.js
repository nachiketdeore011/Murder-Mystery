import { describe, expect, it } from 'vitest'
import { BinarySearchTree, TreeNode } from './BinarySearchTree.js'

function makeTree(entries) {
  const tree = new BinarySearchTree()
  entries.forEach(([key, value = key]) => tree.insert(key, value))
  return tree
}

function keys(records) {
  return records.map(({ key }) => key)
}

function expectValidOrdering(structure, minimum = null, maximum = null) {
  if (!structure) return
  if (minimum !== null) expect(structure.key > minimum).toBe(true)
  if (maximum !== null) expect(structure.key < maximum).toBe(true)
  expectValidOrdering(structure.left, minimum, structure.key)
  expectValidOrdering(structure.right, structure.key, maximum)
}

describe('BinarySearchTree', () => {
  it('creates an empty tree with the documented height convention', () => {
    const tree = new BinarySearchTree()
    expect(tree.isEmpty()).toBe(true)
    expect(tree.size()).toBe(0)
    expect(tree.height()).toBe(0)
    expect(tree.getStats()).toEqual({ nodeCount: 0, height: 0 })
    expect(tree.getMin()).toBeNull()
    expect(tree.getMax()).toBeNull()
    expect(tree.toStructure()).toBeNull()
  })

  it('inserts and searches a single node', () => {
    const tree = new BinarySearchTree()
    expect(tree.insert('E004', 'staff note')).toBe(true)
    expect(tree.search('E004')).toEqual({ key: 'E004', value: 'staff note' })
    expect(tree.has('E004')).toBe(true)
    expect(tree.size()).toBe(1)
    expect(tree.height()).toBe(1)
  })

  it('inserts several unsorted keys while preserving lexicographic ordering', () => {
    const tree = makeTree([['D'], ['B'], ['F'], ['A'], ['C'], ['E'], ['G']])
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    expect(tree.size()).toBe(7)
    expectValidOrdering(tree.toStructure())
  })

  it('returns a clear not-found result and checks presence', () => {
    const tree = makeTree([['B'], ['A'], ['C']])
    expect(tree.search('B')).toEqual({ key: 'B', value: 'B' })
    expect(tree.search('missing')).toBeNull()
    expect(tree.has('A')).toBe(true)
    expect(tree.has('missing')).toBe(false)
  })

  it('updates duplicate keys without increasing node count', () => {
    const tree = makeTree([['B', 'old'], ['A'], ['C']])
    expect(tree.insert('B', 'updated')).toBe(false)
    expect(tree.search('B')).toEqual({ key: 'B', value: 'updated' })
    expect(tree.size()).toBe(3)
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'B', 'C'])
  })

  it('returns in-order traversal in ascending key order', () => {
    const tree = makeTree([['M'], ['C'], ['T'], ['A'], ['E'], ['R'], ['Z']])
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'C', 'E', 'M', 'R', 'T', 'Z'])
  })

  it('returns pre-order traversal as root-left-right', () => {
    const tree = makeTree([['D'], ['B'], ['F'], ['A'], ['C'], ['E'], ['G']])
    expect(keys(tree.preOrderTraversal())).toEqual(['D', 'B', 'A', 'C', 'F', 'E', 'G'])
  })

  it('returns post-order traversal as left-right-root', () => {
    const tree = makeTree([['D'], ['B'], ['F'], ['A'], ['C'], ['E'], ['G']])
    expect(keys(tree.postOrderTraversal())).toEqual(['A', 'C', 'B', 'E', 'G', 'F', 'D'])
  })

  it('returns level-order traversal using breadth-first queue order', () => {
    const tree = makeTree([['D'], ['B'], ['F'], ['A'], ['C'], ['E'], ['G']])
    expect(keys(tree.levelOrderTraversal())).toEqual(['D', 'B', 'F', 'A', 'C', 'E', 'G'])
  })

  it('deletes a leaf node', () => {
    const tree = makeTree([['B'], ['A'], ['C']])
    expect(tree.delete('A')).toBe(true)
    expect(tree.search('A')).toBeNull()
    expect(keys(tree.inOrderTraversal())).toEqual(['B', 'C'])
    expect(tree.size()).toBe(2)
  })

  it('deletes a node with only a left child', () => {
    const tree = makeTree([['B'], ['A'], ['D'], ['C']])
    expect(tree.delete('D')).toBe(true)
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'B', 'C'])
    expectValidOrdering(tree.toStructure())
  })

  it('deletes a node with only a right child', () => {
    const tree = makeTree([['B'], ['A'], ['C'], ['D']])
    expect(tree.delete('C')).toBe(true)
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'B', 'D'])
    expectValidOrdering(tree.toStructure())
  })

  it('deletes a two-child node by transplanting its in-order successor', () => {
    const tree = makeTree([['M'], ['C'], ['T'], ['A'], ['E'], ['R'], ['Z'], ['D'], ['F']])
    expect(tree.delete('C')).toBe(true)
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'D', 'E', 'F', 'M', 'R', 'T', 'Z'])
    expect(tree.size()).toBe(8)
    expectValidOrdering(tree.toStructure())
  })

  it('deletes the root node and preserves both subtrees', () => {
    const tree = makeTree([['M'], ['C'], ['T'], ['A'], ['E'], ['R'], ['Z']])
    expect(tree.delete('M')).toBe(true)
    expect(tree.search('M')).toBeNull()
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'C', 'E', 'R', 'T', 'Z'])
    expect(tree.size()).toBe(6)
    expectValidOrdering(tree.toStructure())
  })

  it('returns false when deleting a missing key', () => {
    const tree = makeTree([['A'], ['B']])
    expect(tree.delete('missing')).toBe(false)
    expect(tree.size()).toBe(2)
  })

  it('tracks size after insertions, updates, and deletions', () => {
    const tree = new BinarySearchTree()
    tree.insert('B', 1)
    tree.insert('A', 2)
    tree.insert('C', 3)
    tree.insert('B', 4)
    expect(tree.size()).toBe(3)
    expect(tree.delete('A')).toBe(true)
    expect(tree.size()).toBe(2)
    expect(tree.delete('C')).toBe(true)
    expect(tree.size()).toBe(1)
  })

  it('returns minimum and maximum key records', () => {
    const tree = makeTree([['M'], ['C'], ['T'], ['A'], ['Z']])
    expect(tree.getMin()).toEqual({ key: 'A', value: 'A' })
    expect(tree.getMax()).toEqual({ key: 'Z', value: 'Z' })
  })

  it('reports height as node levels for empty, single, and multi-level trees', () => {
    const tree = new BinarySearchTree()
    expect(tree.height()).toBe(0)
    tree.insert('D', 'root')
    expect(tree.height()).toBe(1)
    ;[['B', 'left'], ['F', 'right'], ['A', 'left-left'], ['C', 'left-right'], ['E', 'right-left'], ['G', 'right-right']]
      .forEach(([key, value]) => tree.insert(key, value))
    expect(tree.height()).toBe(3)
    expect(tree.getStats()).toEqual({ nodeCount: 7, height: 3 })
  })

  it('clears all nodes and permits reuse', () => {
    const tree = makeTree([['B'], ['A'], ['C']])
    tree.clear()
    expect(tree.isEmpty()).toBe(true)
    expect(tree.size()).toBe(0)
    expect(tree.inOrderTraversal()).toEqual([])
    expect(tree.insert('new', 1)).toBe(true)
    expect(tree.search('new')).toEqual({ key: 'new', value: 1 })
  })

  it('remains functional when sorted insertion creates an unbalanced tree', () => {
    const tree = new BinarySearchTree()
    for (let index = 0; index < 100; index += 1) {
      tree.insert(`K${String(index).padStart(3, '0')}`, index)
    }
    expect(tree.height()).toBe(100)
    expect(tree.search('K050')).toEqual({ key: 'K050', value: 50 })
    expect(tree.getMin().key).toBe('K000')
    expect(tree.getMax().key).toBe('K099')
    expect(tree.delete('K050')).toBe(true)
    expect(tree.has('K050')).toBe(false)
    expect(tree.size()).toBe(99)
  })

  it('returns empty arrays for all traversals on an empty tree', () => {
    const tree = new BinarySearchTree()
    expect(tree.inOrderTraversal()).toEqual([])
    expect(tree.preOrderTraversal()).toEqual([])
    expect(tree.postOrderTraversal()).toEqual([])
    expect(tree.levelOrderTraversal()).toEqual([])
  })

  it('preserves BST ordering through multiple inserts and deletes', () => {
    const tree = makeTree([['H'], ['D'], ['L'], ['B'], ['F'], ['J'], ['N'], ['A'], ['C'], ['E'], ['G']])
    for (const key of ['D', 'L', 'A', 'H']) {
      expect(tree.delete(key)).toBe(true)
      expectValidOrdering(tree.toStructure())
    }
    expect(keys(tree.inOrderTraversal())).toEqual(['B', 'C', 'E', 'F', 'G', 'J', 'N'])
  })

  it('returns detached search and structure snapshots', () => {
    const tree = makeTree([['B'], ['A'], ['C']])
    const searched = tree.search('B')
    expect(Object.isFrozen(searched)).toBe(true)
    expect(() => { searched.key = 'broken' }).toThrow()
    const structure = tree.toStructure()
    structure.left.key = 'Z'
    structure.right = null
    expect(keys(tree.inOrderTraversal())).toEqual(['A', 'B', 'C'])
  })

  it('requires string keys and exposes a TreeNode with the specified fields', () => {
    const tree = new BinarySearchTree()
    expect(() => tree.insert(4, 'value')).toThrow('keys must be strings')
    expect(() => tree.search(null)).toThrow('keys must be strings')
    const node = new TreeNode('K', 'value')
    expect(node).toMatchObject({ key: 'K', value: 'value', left: null, right: null })
  })
})
