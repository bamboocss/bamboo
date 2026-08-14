import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/**
 * Lines this change added or touched that no test executes.
 *
 * A *report*, deliberately, not a gate. Plenty of uncovered lines are correct — a defensive
 * `throw` for a case the type system already rules out is meant never to run, and failing a build
 * over one would teach everybody to route around the check. What this is for is the other kind:
 * code that cannot run at all.
 *
 * `packages/core/src/layers.ts` had a private `Map` that was declared, iterated once, and written
 * nowhere, so its loop body was unreachable from the day it was written. Nothing in CI saw it:
 * knip 6 has no class-member analysis at all, and every static tool that does — `tsc
 * --noUnusedLocals`, ESLint's `no-unused-private-class-members` — asks whether a symbol is
 * *referenced*. It was: the loop read it. "Never written, therefore always empty" is a dataflow
 * property, and coverage is the only signal in this repo that can see it.
 *
 * Scoped to the diff because a whole-repo uncovered list is thousands of lines nobody reads, and
 * the question worth asking on a pull request is only ever about what it changed.
 */

const base = process.argv[2] ?? 'origin/main'
const coverageFile = process.argv[3] ?? 'coverage/coverage-final.json'
const root = process.cwd()

const changed = () => {
  try {
    // `...` — what this branch added, not what has landed on the base since it forked.
    const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
    return new Set(out.split('\n').filter(Boolean))
  } catch {
    return undefined
  }
}

let coverage
try {
  coverage = JSON.parse(readFileSync(coverageFile, 'utf8'))
} catch {
  console.log('No coverage report found — nothing to say.')
  process.exit(0)
}

const files = changed()
if (!files) {
  console.log(`Could not diff against \`${base}\` — skipping.`)
  process.exit(0)
}

/** Statement and branch counts share a shape: a map of id to execution count. */
const uncoveredLines = (info) => {
  const lines = new Set()
  for (const [id, count] of Object.entries(info.s ?? {})) {
    if (count === 0) lines.add(info.statementMap[id]?.start?.line)
  }
  for (const [id, counts] of Object.entries(info.b ?? {})) {
    // A branch is only interesting here when *no* arm ran; a partially-taken branch is
    // ordinary under-testing rather than something that cannot run.
    if (Array.isArray(counts) && counts.every((n) => n === 0)) {
      for (const loc of info.branchMap?.[id]?.locations ?? []) lines.add(loc.start?.line)
    }
  }
  return [...lines].filter((line) => typeof line === 'number').sort((a, b) => a - b)
}

const rows = []
for (const [absolute, info] of Object.entries(coverage)) {
  const path = relative(root, resolve(absolute))
  if (!files.has(path)) continue
  const lines = uncoveredLines(info)
  if (lines.length) rows.push({ path, lines })
}

if (!rows.length) {
  console.log('Every line this change touches is executed by a test. ✅')
  process.exit(0)
}

/** `12, 13, 14, 19` reads as `12-14, 19`. */
const ranges = (lines) => {
  const out = []
  let start = lines[0]
  let prev = lines[0]
  for (const line of lines.slice(1)) {
    if (line === prev + 1) {
      prev = line
      continue
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = prev = line
  }
  out.push(start === prev ? `${start}` : `${start}-${prev}`)
  return out
}

console.log('### Lines with no test coverage\n')
console.log('Changed files only. Not a gate — a defensive `throw` is *meant* to be unreachable.')
console.log('Worth a look when a line could never run at all.\n')
console.log('| file | lines |')
console.log('| --- | --- |')
for (const { path, lines } of rows.sort((a, b) => b.lines.length - a.lines.length)) {
  console.log(`| \`${path}\` | ${ranges(lines).join(', ')} |`)
}
