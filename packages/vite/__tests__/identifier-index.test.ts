import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph'
import { expect, test } from 'vitest'
import { identifierIndex } from '../src/fold-analysis'

/**
 * `identifierIndex` against the obvious implementation of the same thing.
 *
 * It walks compiler nodes and wraps only the buckets a caller reads, because
 * `getDescendantsOfKind(SyntaxKind.Identifier)` takes ts-morph's token path — `Identifier` sorts
 * below `SyntaxKind.FirstNode` — and materialises every brace and comma in the file on the way to
 * the identifiers. That is a real reimplementation of a traversal, so it is held to the output of
 * the thing it replaced rather than to a description of it.
 *
 * Identity and order both matter downstream: `localReferencesTo` compares a candidate against the
 * declaration with `===`, and the survivor report takes the first entry in document order.
 *
 * The fixtures below are the cases where the two traversals could plausibly disagree, and one of
 * them did while this was being written — `ts.forEachChild` does not descend into JSDoc, so a name
 * appearing only in a `@type` annotation went missing until the walk was taught to. A missing
 * reference reads as "nothing uses this binding", which is the direction that ships broken output.
 */
const REFERENCE = (sourceFile: SourceFile) => {
  const index = new Map<string, Node[]>()
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const text = identifier.getText()
    const known = index.get(text)
    if (known) known.push(identifier)
    else index.set(text, [identifier])
  }
  return index
}

/** Shapes chosen for where the two walks diverge, not for coverage of the language. */
const FIXTURES: Record<string, string> = {
  // `ts.forEachChild` skips JSDoc; the token path does not.
  'jsdoc.tsx':
    '/** @type {import("x").Y} */\nconst a = 1\n/** @param {Foo} b */\nfunction f(b) { return b }\nexport { a, f }',
  'jsdoc-typedef.tsx': '/** @typedef {import("./m").Thing} Thing */\n/** @type {Thing} */\nlet t\nexport { t }',
  // Keyed on the resolved name, so both spellings have to land in one bucket.
  'escaped.tsx': 'const \\u0062adge = 1\nexport const y = badge\nexport const z = \\u0062adge',
  'jsx.tsx': 'export const V = ({ p }) => <div id={p} data-x="1"><span key={p} /></div>',
  'decorators.tsx': 'declare const d: any\nclass C { @d m() {} @d p = 1\n  static { const s = 1 } }',
  'namespace.tsx': 'namespace N { export import q = require("m")\n  export const z = q }',
  'shadowed.tsx': 'const b = 1\nfunction f() { const b = 2; return b }\nexport { b, f }',
  'types.tsx': 'type T = { a: number }\ninterface I extends T { b: string }\nconst c: I = null as any\nexport { c }',
}

const sandbox = () => {
  try {
    return execSync(`find sandbox/*/src -name '*.tsx' -o -name '*.ts'`, { maxBuffer: 6e7 })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((file, index) => [`sandbox-${index}.tsx`, readFileSync(file, 'utf8')] as const)
  } catch {
    return []
  }
}

test('the index returns exactly what a wrapped whole-tree walk did', () => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 2 } })
  const corpus = [...sandbox(), ...Object.entries(FIXTURES)]

  let names = 0
  const problems: string[] = []

  for (const [name, text] of corpus) {
    const sourceFile = project.createSourceFile(name, text, { overwrite: true })
    const expected = REFERENCE(sourceFile)
    const actual = identifierIndex(sourceFile)

    for (const [key, wanted] of expected) {
      names++
      const got = actual.get(key)

      if (got.length !== wanted.length) {
        problems.push(`${name} "${key}": ${wanted.length} nodes -> ${got.length}`)
        continue
      }
      for (const [position, node] of wanted.entries()) {
        if (got[position] !== node) problems.push(`${name} "${key}"[${position}]: identity or order changed`)
      }
    }
  }

  expect(problems).toEqual([])
  // The sandbox glob is the bulk of it; a corpus that silently shrank to the fixtures would still
  // pass every assertion above and prove almost nothing.
  expect(names).toBeGreaterThan(500)
})

test('a name the module never spells comes back empty rather than undefined', () => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 2 } })
  const sourceFile = project.createSourceFile('empty.tsx', 'export const a = 1')

  expect(identifierIndex(sourceFile).get('nothingHere')).toEqual([])
})
