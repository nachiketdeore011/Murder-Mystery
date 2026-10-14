/**
 * Stable binary min-heap. Insert/remove are O(log V) when the heap has O(V)
 * entries (O(log n) for n entries); peek, isEmpty, and size are O(1). In
 * Dijkstra, lazy duplicate entries can make n larger than V.
 */
export class MinPriorityQueue {
  #heap = []
  #nextSequence = 0

  enqueue(value, priority) {
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      throw new TypeError('A priority must be a finite number.')
    }
    const entry = { value, priority, sequence: this.#nextSequence }
    this.#nextSequence += 1
    this.#heap.push(entry)
    this.#bubbleUp(this.#heap.length - 1)
    return this.#heap.length
  }

  dequeue() {
    if (this.#heap.length === 0) return null
    if (this.#heap.length === 1) return this.#toPublicEntry(this.#heap.pop())

    const minimum = this.#heap[0]
    this.#heap[0] = this.#heap.pop()
    this.#bubbleDown(0)
    return this.#toPublicEntry(minimum)
  }

  peek() {
    return this.#heap.length === 0 ? null : this.#toPublicEntry(this.#heap[0])
  }

  isEmpty() {
    return this.#heap.length === 0
  }

  size() {
    return this.#heap.length
  }

  #toPublicEntry({ value, priority }) {
    return { value, priority }
  }

  #comesBefore(first, second) {
    return first.priority < second.priority
      || (first.priority === second.priority && first.sequence < second.sequence)
  }

  #bubbleUp(startIndex) {
    let index = startIndex
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (!this.#comesBefore(this.#heap[index], this.#heap[parentIndex])) break
      ;[this.#heap[index], this.#heap[parentIndex]] = [this.#heap[parentIndex], this.#heap[index]]
      index = parentIndex
    }
  }

  #bubbleDown(startIndex) {
    let index = startIndex
    while (true) {
      const leftIndex = index * 2 + 1
      const rightIndex = leftIndex + 1
      let smallestIndex = index

      if (leftIndex < this.#heap.length && this.#comesBefore(this.#heap[leftIndex], this.#heap[smallestIndex])) {
        smallestIndex = leftIndex
      }
      if (rightIndex < this.#heap.length && this.#comesBefore(this.#heap[rightIndex], this.#heap[smallestIndex])) {
        smallestIndex = rightIndex
      }
      if (smallestIndex === index) return
      ;[this.#heap[index], this.#heap[smallestIndex]] = [this.#heap[smallestIndex], this.#heap[index]]
      index = smallestIndex
    }
  }
}

export default MinPriorityQueue
