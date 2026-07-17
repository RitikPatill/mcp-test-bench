import { describe, it, expect } from 'vitest'
import { VERSION } from './index'

describe('core', () => {
  it('exports the correct VERSION', () => {
    expect(VERSION).toBe('0.0.1')
  })
})
