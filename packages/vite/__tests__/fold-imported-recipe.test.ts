import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

/**
 * A recipe declared in one module and called in another.
 *
 * These calls were not declined — they were invisible. The parser recognised an inline recipe
 * by the name the *file* bound, so a binding that arrived through an import matched nothing:
 * the extractor never recorded the call, the fold never saw it, and it appeared in neither the
 * folded nor the skipped tally. A build reporting "0 unfolded calls" could be shipping
 * hundreds of them, which is what made `strict` untrustworthy rather than merely incomplete.
 */

const STYLES = `import { cva } from 'styled-system/css'
export const textInput = cva({
  base: { display: 'flex' },
  variants: { size: { sm: { padding: '2' }, lg: { padding: '8' } } },
})
`

const compiledClass = (result: { folded: Array<{ kind: string; className: string }> }) =>
  result.folded.find((entry) => entry.kind === 'class')?.className

describe('a recipe imported from another module', () => {
  test('folds to the class its own module would produce', () => {
    const { fold, addFiles, getStyleSetCss } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(1)
    expect(result.skipped).toHaveLength(0)

    const className = result.folded[0]!.className
    const css = getStyleSetCss()
    for (const selector of selectorsFor(className)) expect(css).toContain(selector)
  })

  /**
   * Declaration atoms depend only on the selected styles, not on which module called the
   * recipe, so local and imported compilation must agree exactly.
   */
  test('the class matches the same config declared locally', () => {
    const imported = createFoldFixture()
    imported.addFiles({ 'app/styles.ts': STYLES })
    const across = imported.fold(
      `import { textInput } from './styles'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    const local = createFoldFixture().fold(`${STYLES}export const cls = textInput({ size: 'sm' })\n`, 'app/local.tsx')

    expect(compiledClass(across)).toBe(compiledClass(local))
  })

  test.each([
    ['a barrel re-export', { 'app/index.ts': `export { textInput } from './styles'\n` }, './index', 'textInput'],
    ['a star re-export', { 'app/all.ts': `export * from './styles'\n` }, './all', 'textInput'],
    ['a renaming re-export', { 'app/index.ts': `export { textInput as field } from './styles'\n` }, './index', 'field'],
  ])('resolves through %s', (_label, extra, specifier, binding) => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES, ...extra })

    const result = fold(
      `import { ${binding} } from '${specifier}'\nexport const cls = ${binding}({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    expect(result.folded, `declined: ${result.skipped.map((s) => s.reason).join(', ') || 'none'}`).toHaveLength(1)
  })

  test('an alias at the call site folds under the declaring name', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput as ti } from './styles'\nexport const cls = ti({ size: 'lg' })\n`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('p_8')
  })

  /**
   * The declaring module is a dependency of this fold. Without the edge, editing the config
   * leaves every consumer holding a literal named after the config it used to be.
   */
  test('the declaring module is registered as a dependency', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    expect(result.dependencies.some((path) => path.endsWith('app/styles.ts'))).toBe(true)
  })

  test('a plain imported function is left alone', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/util.ts': `export const helper = (x) => x\n` })

    const result = fold(`import { helper } from './util'\nexport const cls = helper({ size: 'sm' })\n`, 'app/use.tsx')

    expect(result.folded).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
    expect(result.code).toContain("helper({ size: 'sm' })")
  })
})

describe('the helper import a lowered axis needs', () => {
  const dynamic = `import { textInput } from './styles'\nexport const cls = (size) => textInput({ size })\n`

  /**
   * The case that used to decline having resolved everything else. A file calling an imported
   * recipe need not import the css module at all, and `ensureRecipeHelperImport` gave up
   * rather than writing a declaration — so the whole call stayed runtime for want of an
   * import statement.
   */
  test('is added when the file has none to extend', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(dynamic, 'app/use.tsx')

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`import { cvaMap } from 'styled-system/css'`)
    expect(result.code).toContain('cvaMap([size]')
  })

  /**
   * A directive stops being one as soon as a statement precedes it, and `'use client'` on a
   * component calling a recipe is exactly the shape this runs into. The import goes after the
   * last existing one for that reason.
   */
  test('goes after the last import, leaving a directive prologue first', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(`'use client'\n${dynamic}`, 'app/use.tsx')

    expect(result.folded).toHaveLength(1)
    expect(result.code.startsWith(`'use client'`)).toBe(true)
    expect(result.code.indexOf('cvaMap')).toBeGreaterThan(result.code.indexOf(`from './styles'`))
  })

  test('an existing css import is extended rather than duplicated', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(`import { css } from 'styled-system/css'\n${dynamic}`, 'app/use.tsx')

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`import { css, cvaMap } from 'styled-system/css'`)
    expect(result.code.match(/from 'styled-system\/css'/g)).toHaveLength(1)
  })

  /**
   * Two call sites need one binding. A declaration per call would redeclare the name.
   */
  test('is written once for two calls', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'
export const a = (size) => textInput({ size })
export const b = (size) => textInput({ size })
`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(2)
    expect(result.code.match(/import \{ cvaMap \}/g)).toHaveLength(1)
  })

  /**
   * A binding of that name already in the file would be shadowed by the one being added, or
   * would collide with it. Declining is the only safe answer.
   */
  test('is refused when the name is already taken', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'\nconst cvaMap = 1\nexport const cls = (size) => textInput({ size })\n`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('recipe-call')
  })
})

describe('which declaration a name resolves to', () => {
  /**
   * An explicit export shadows one arriving through `export *`, and resolving it the other
   * way folded the call against a config it would never have run — with a class the
   * stylesheet also carries, so nothing downstream could notice. It also disagreed with dev,
   * where `cva` still runs.
   */
  test('a local export wins over a star export of the same name', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({
      'app/other.ts': `import { cva } from 'styled-system/css'\nexport const textInput = cva({ base: { display: 'grid' } })\n`,
      'app/styles.ts': `${STYLES}export * from './other'\n`,
    })

    const across = fold(
      `import { textInput } from './styles'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )
    const local = createFoldFixture().fold(`${STYLES}export const cls = textInput({ size: 'sm' })\n`, 'app/local.tsx')

    expect(across.folded).toHaveLength(1)
    expect(compiledClass(across)).toBe(compiledClass(local))
  })

  /**
   * `import { x } … export { x }` is the commonest barrel idiom, and reads as a local export
   * rather than a re-export — so it has to consult what the file imported, not only what it
   * declared.
   */
  test('an import re-exported under a separate statement resolves', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({
      'app/styles.ts': STYLES,
      'app/index.ts': `import { textInput } from './styles'\nexport { textInput }\n`,
    })

    const result = fold(
      `import { textInput } from './index'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    expect(result.folded, `declined: ${result.skipped.map((s) => s.reason).join(', ') || 'none'}`).toHaveLength(1)
  })

  /**
   * A cycle of `export *` truncates whichever side the walk reaches second. Caching that
   * partial answer made a binding's visibility depend on which consumer the bundler
   * transformed first — the discovery-order dependence the design exists to avoid.
   */
  test('a cycle of star exports resolves the same from either side', () => {
    const files = {
      'app/a.ts': `import { cva } from 'styled-system/css'\nexport const fromA = cva({ base: { display: 'flex' } })\nexport * from './b'\n`,
      'app/b.ts': `import { cva } from 'styled-system/css'\nexport const fromB = cva({ base: { display: 'grid' } })\nexport * from './a'\n`,
    }

    const bFirst = createFoldFixture()
    bFirst.addFiles(files)
    const viaB = bFirst.fold(`import { fromA } from './b'\nexport const cls = fromA({})\n`, 'app/use.tsx')

    const aFirst = createFoldFixture()
    aFirst.addFiles(files)
    const viaA = aFirst.fold(`import { fromB } from './a'\nexport const cls = fromB({})\n`, 'app/use.tsx')

    expect(viaB.folded).toHaveLength(1)
    expect(viaA.folded).toHaveLength(1)
  })
})

describe('the shared config cache', () => {
  /**
   * The cache lives for a build, and `addSourceFile` — which every transformed module goes
   * through — implements overwriting by forgetting that file's whole node tree. A cached
   * entry holding a node therefore threw on the *second* consumer, and the fold's catch
   * turned that into a module with no folds at all and no skips to report: `strict` saw a
   * clean build while those calls stayed at runtime.
   */
  test('survives the declaring module being re-added between consumers', () => {
    const { ctx, foldWithCache, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const first = foldWithCache(
      `import { textInput } from './styles'\nexport const a = textInput({ size: 'sm' })\n`,
      'app/a.tsx',
    )

    // What the transform hook does to the declaring module when the bundler reaches it.
    ctx.project.addSourceFile('app/styles.ts', STYLES)

    const second = foldWithCache(
      `import { textInput } from './styles'\nexport const b = textInput({ size: 'sm' })\n`,
      'app/b.tsx',
    )

    expect(first.folded).toHaveLength(1)
    expect(second.folded).toHaveLength(1)
    expect(second.folded[0]!.className).toBe(first.folded[0]!.className)
    expect(second.dependencies.some((path) => path.endsWith('app/styles.ts'))).toBe(true)
  })

  test('a second consumer still gets the helper import written', () => {
    const { ctx, foldWithCache, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    foldWithCache(`import { textInput } from './styles'\nexport const a = (s) => textInput({ size: s })\n`, 'app/a.tsx')
    ctx.project.addSourceFile('app/styles.ts', STYLES)
    const second = foldWithCache(
      `import { textInput } from './styles'\nexport const b = (s) => textInput({ size: s })\n`,
      'app/b.tsx',
    )

    expect(second.folded).toHaveLength(1)
    expect(second.code).toContain(`import { cvaMap } from 'styled-system/css'`)
  })
})

describe('splitVariantProps on an imported recipe', () => {
  test('lowers in a file with no css import of its own', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'
export const Field = (props) => {
  const [variant, rest] = textInput.splitVariantProps(props)
  return textInput(variant) + JSON.stringify(rest)
}
`,
      'app/use.tsx',
    )

    expect(result.code).not.toContain('splitVariantProps')
    expect(result.code).toContain('splitProps(props, ["size"])')
  })
})

describe('what stays declined', () => {
  /**
   * `export * as ns` binds one object called `ns`; it re-exports no individual name. Reading
   * it as `export *` folded an import that resolves to nothing at runtime.
   */
  test('a namespace re-export does not make its names importable', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES, 'app/index.ts': `export * as styles from './styles'\n` })

    const result = fold(
      `import { textInput } from './index'\nexport const cls = textInput({ size: 'sm' })\n`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(0)
  })

  /**
   * Two stars carrying the same name make it ambiguous — importing it is a link error, not a
   * choice between them — so neither config may be folded against.
   */
  test('a name two star exports both carry', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({
      'app/one.ts': `import { cva } from 'styled-system/css'\nexport const dup = cva({ base: { display: 'flex' } })\n`,
      'app/two.ts': `import { cva } from 'styled-system/css'\nexport const dup = cva({ base: { display: 'grid' } })\n`,
      'app/index.ts': `export * from './one'\nexport * from './two'\n`,
    })

    const result = fold(`import { dup } from './index'\nexport const cls = dup({})\n`, 'app/use.tsx')

    expect(result.folded).toHaveLength(0)
  })

  test('a recipe name declared twice in the exporting module', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({
      'app/styles.ts': `import { cva } from 'styled-system/css'
export const dupe = cva({ base: { display: 'flex' } })
export const dupe = cva({ base: { display: 'grid' } })
`,
    })

    const result = fold(`import { dupe } from './styles'\nexport const cls = dupe({})\n`, 'app/use.tsx')

    expect(result.folded).toHaveLength(0)
  })
})

describe('more than one recipe from one module', () => {
  test('a recipe declared twice in the exporting module', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({
      'app/styles.ts': `import { cva } from 'styled-system/css'
export const textInput = cva({ base: { display: 'flex' } })
export const other = cva({ base: { display: 'grid' } })
`,
    })

    // Distinct names resolve independently; this pins that the second one folds too rather
    // than the pair being treated as ambiguous.
    const result = fold(`import { other } from './styles'\nexport const cls = other({})\n`, 'app/use.tsx')
    expect(result.folded).toHaveLength(1)
  })

  /**
   * A local declaration wins over the import, and it is not a recipe. Folding against the
   * imported config here would emit a class for a call that never runs it.
   */
  test('a call inside a scope that rebinds the name', () => {
    const { fold, addFiles } = createFoldFixture()
    addFiles({ 'app/styles.ts': STYLES })

    const result = fold(
      `import { textInput } from './styles'
export const f = () => {
  const textInput = (props) => 'local'
  return textInput({ size: 'sm' })
}
`,
      'app/use.tsx',
    )

    expect(result.folded).toHaveLength(0)
    expect(result.code).toContain(`textInput({ size: 'sm' })`)
  })
})
