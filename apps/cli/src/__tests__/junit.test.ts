import { describe, it, expect } from 'vitest'
import { toJunitXml } from '../junit.js'

describe('toJunitXml', () => {
  it('produces valid XML envelope', () => {
    const xml = toJunitXml({ suiteName: 'my-suite', cases: [] })
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<testsuites name="mcpbench">')
    expect(xml).toContain('<testsuite name="my-suite"')
    expect(xml).toContain('tests="0"')
    expect(xml).toContain('failures="0"')
  })

  it('all-pass report produces no failure elements', () => {
    const xml = toJunitXml({
      suiteName: 'suite',
      cases: [
        { name: 'scenario-1', classname: 'mcpbench.server', score: 8.0, passed: true },
        { name: 'scenario-2', classname: 'mcpbench.server', score: 9.0, passed: true },
      ],
    })
    expect(xml).not.toContain('<failure')
    expect(xml).toContain('tests="2"')
    expect(xml).toContain('failures="0"')
  })

  it('failed case produces failure element', () => {
    const xml = toJunitXml({
      suiteName: 'suite',
      cases: [
        {
          name: 'bad-scenario',
          classname: 'mcpbench.server',
          score: 4.0,
          passed: false,
          failureMessage: 'Score 4.0 below baseline 7.0',
        },
      ],
    })
    expect(xml).toContain('<failure')
    expect(xml).toContain('Score 4.0 below baseline 7.0')
    expect(xml).toContain('failures="1"')
  })

  it('XML-escapes special characters in scenario names', () => {
    const xml = toJunitXml({
      suiteName: 'suite',
      cases: [
        {
          name: 'scenario with <special> & "chars"',
          classname: 'mcpbench.server',
          score: 7.0,
          passed: true,
        },
      ],
    })
    expect(xml).toContain('&lt;special&gt;')
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&quot;chars&quot;')
    expect(xml).not.toContain('<special>')
  })

  it('XML-escapes & in failure messages', () => {
    const xml = toJunitXml({
      suiteName: 'suite',
      cases: [
        {
          name: 'test',
          classname: 'cls',
          score: 3.0,
          passed: false,
          failureMessage: 'Score < 7 & baseline > 0',
        },
      ],
    })
    expect(xml).toContain('&lt;')
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&gt;')
  })
})
