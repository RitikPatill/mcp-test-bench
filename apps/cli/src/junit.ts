export interface JunitCase {
  name: string
  classname: string
  score: number
  passed: boolean
  failureMessage?: string
}

export interface JunitReport {
  suiteName: string
  cases: JunitCase[]
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function toJunitXml(report: JunitReport): string {
  const total = report.cases.length
  const failures = report.cases.filter((c) => !c.passed).length

  const cases = report.cases
    .map((c) => {
      const attrs = `name="${xmlEscape(c.name)}" classname="${xmlEscape(c.classname)}"`
      if (!c.passed && c.failureMessage) {
        return `    <testcase ${attrs}>\n      <failure message="${xmlEscape(c.failureMessage)}">${xmlEscape(c.failureMessage)}</failure>\n    </testcase>`
      }
      return `    <testcase ${attrs}/>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<testsuites name="mcpbench">',
    `  <testsuite name="${xmlEscape(report.suiteName)}" tests="${total}" failures="${failures}">`,
    cases,
    '  </testsuite>',
    '</testsuites>',
  ].join('\n')
}
