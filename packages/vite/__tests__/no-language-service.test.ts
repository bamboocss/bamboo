import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * The compiler must never issue a TypeScript language-service query.
 *
 * The first one forces `synchronizeHostData` -> `createProgram`, which resolves, parses and
 * binds the whole transitive `.d.ts` closure of the project. `createTsProject` sets
 * `skipAddingFilesFromTsConfig`, `skipFileDependencyResolution` and `skipLoadingLibFiles`
 * precisely to avoid that, and none of them govern `createProgram` — so a single query
 * undoes all three. The note on `resolveDeclaration` in `@bamboocss/extractor` spells this
 * out and predicts the failure it causes inside a bundler: "a slow build and then an OOM".
 *
 * That is not hypothetical. A `findReferencesAsNodes` call in the survivor scan put a
 * 2,278-file app at 24,081 `SourceFileObject` instances and 4.4 GB of AST and symbols —
 * 80% of the heap — and the build OOMed at a 6 GB cap. The retained strings were
 * `googleapis`, `typescript` and `@vue/compiler-sfc`, none of which can contain a reference
 * to a Bamboo recipe binding.
 *
 * So this asserts the invariant directly rather than any particular call site. A future
 * `getDefinitions`, `getType` or `findReferences` anywhere in the compile path fails here
 * first, which is where the cost is cheapest to see.
 */
describe('the compile path never touches the language service', () => {
  const QUERIES = [
    'findReferencesAsNodes',
    'findReferences',
    'getDefinitions',
    'getDefinitionsAtPosition',
    'getImplementations',
    'getProgram',
  ] as const

  const countQueries = (fixture: ReturnType<typeof createFoldFixture>) => {
    const context = (fixture.ctx.project as unknown as { project: { _context: Record<string, unknown> } }).project
      ._context
    const service = context.languageService as Record<string, unknown>
    const seen: string[] = []

    for (const name of QUERIES) {
      const original = service[name]
      if (typeof original !== 'function') continue
      service[name] = function (this: unknown, ...args: unknown[]) {
        seen.push(name)
        return (original as (...a: unknown[]) => unknown).apply(this, args)
      }
    }

    return seen
  }

  const RECIPE = `cva({
    base: { display: 'flex' },
    variants: { tone: { quiet: { color: 'gray.500' }, loud: { color: 'red.500' } } },
  })`

  const cases: Array<[string, string]> = [
    ['a local recipe whose reference survives', `const b = ${RECIPE}\nexport const c = b\n`],
    ['a local recipe fully compiled', `const b = ${RECIPE}\nexport const c = b({ tone: 'loud' })\n`],
    ['an exported recipe', `export const b = ${RECIPE}\n`],
    ['an exported recipe read locally', `export const b = ${RECIPE}\nexport const c = b\n`],
    ['a re-exported recipe', `const b = ${RECIPE}\nexport { b }\n`],
    ['a recipe reached through a member access', `const b = ${RECIPE}\nexport const c = b.raw({ tone: 'loud' })\n`],
  ]

  test.each(cases)('%s', (_label, body) => {
    const fixture = createFoldFixture()
    const seen = countQueries(fixture)

    fixture.fold(`import { cva } from 'styled-system/css'\n${body}`, 'app/probe.tsx', true)

    expect(seen).toEqual([])
  })

  test('a consumer importing a recipe from another module', () => {
    const fixture = createFoldFixture()
    fixture.addFiles({ 'app/styles.ts': `import { cva } from 'styled-system/css'\nexport const b = ${RECIPE}\n` })
    const seen = countQueries(fixture)

    fixture.fold(`import { b } from './styles'\nexport const c = (t) => b({ tone: t })\n`, 'app/consumer.tsx', true)

    expect(seen).toEqual([])
  })
})
