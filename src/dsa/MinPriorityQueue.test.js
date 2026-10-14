import { describe, expect, it } from 'vitest'
import { MinPriorityQueue } from './MinPriorityQueue.js'

describe('MinPriorityQueue', () => {
  it('dequeues the smallest priority first', () => {
    const queue = new MinPriorityQueue()
    queue.enqueue('slow', 8)
    queue.enqueue('fast', 2)
    queue.enqueue('middle', 5)
    expect(queue.dequeue()).toEqual({ value: 'fast', priority: 2 })
  })

  it('maintains priority order over multiple insertions and removals', () => {
    const queue = new MinPriorityQueue()
    ;[['A', 9], ['B', 4], ['C', 7], ['D', 1], ['E', 6], ['F', 2]].forEach(([value, priority]) => {
      queue.enqueue(value, priority)
    })
    expect(Array.from({ length: 6 }, () => queue.dequeue().value)).toEqual(['D', 'F', 'B', 'E', 'C', 'A'])
    expect(queue.isEmpty()).toBe(true)
  })

  it('preserves insertion order for equal priorities', () => {
    const queue = new MinPriorityQueue()
    queue.enqueue('first', 3)
    queue.enqueue('second', 3)
    queue.enqueue('earlier', 1)
    queue.enqueue('third', 3)
    expect([queue.dequeue().value, queue.dequeue().value, queue.dequeue().value, queue.dequeue().value])
      .toEqual(['earlier', 'first', 'second', 'third'])
  })

  it('handles empty operations and reports its size', () => {
    const queue = new MinPriorityQueue()
    expect(queue.dequeue()).toBeNull()
    expect(queue.peek()).toBeNull()
    expect(queue.isEmpty()).toBe(true)
    queue.enqueue('A', 0)
    expect(queue.peek()).toEqual({ value: 'A', priority: 0 })
    expect(queue.size()).toBe(1)
    expect(queue.dequeue()).toEqual({ value: 'A', priority: 0 })
    expect(queue.size()).toBe(0)
  })

  it('keeps the heap valid after mixed insertions and removals', () => {
    const queue = new MinPriorityQueue()
    queue.enqueue('eight', 8)
    queue.enqueue('three', 3)
    queue.enqueue('five', 5)
    expect(queue.dequeue()).toEqual({ value: 'three', priority: 3 })
    queue.enqueue('one', 1)
    queue.enqueue('two', 2)
    expect(queue.dequeue()).toEqual({ value: 'one', priority: 1 })
    queue.enqueue('zero', 0)
    expect(Array.from({ length: queue.size() }, () => queue.dequeue().priority)).toEqual([0, 2, 5, 8])
  })

  it('rejects non-finite priorities', () => {
    const queue = new MinPriorityQueue()
    expect(() => queue.enqueue('bad', Infinity)).toThrow('finite number')
  })
})
