import { describe, expect, it } from 'vitest'
import { sealedClueHint } from './Investigation.jsx'

describe('sealed clue hint', () => {
  it('names the room the clue was filed in and the action that uncovers it', () => {
    const hint = sealedClueHint('E003', 'Main Hall')

    expect(hint).toContain('E003 is still sealed.')
    expect(hint).toContain('It was filed in the Main Hall.')
    expect(hint).toContain('inspect the sealed card')
  })

  it('still explains the next step when the case data has no room for the clue', () => {
    const hint = sealedClueHint('E099', undefined)

    expect(hint).toContain('E099 is still sealed.')
    expect(hint).not.toContain('filed in the')
    expect(hint).toContain('inspect the sealed card')
  })
})
