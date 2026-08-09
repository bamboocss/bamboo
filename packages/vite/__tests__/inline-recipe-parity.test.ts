import { loadConfigAndCreateContext } from '@bamboocss/node'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { lowerRecipeCall, type RecipeConfig } from '../src/fold-recipe'
import { getRecipeIdentity } from '@bamboocss/shared'
import { Project, SyntaxKind } from 'ts-morph'

/**
 * What the fold writes for an inline recipe call, against what the browser would have computed.
 *
 * The fold derives class names from `getRecipeIdentity` and `getRecipeClassNames`, which is the
 * same code the generated `cva` runs — so this is not two implementations being compared. What
 * it does check is the layer above them: which selection the fold decides to pass, once defaults
 * are merged and an unresolvable property has disqualified the call. That layer *is* a second
 * implementation of `cvaFn`'s prologue, and it is where a divergence would put a wrong class
 * string in the bundle with nothing to report it.
 *
 * A mismatch here renders elements with the wrong styles and no diagnostic, which is the reason
 * to compare against the real artifact rather than against a fixture's expectations.
 */
const here = dirname(fileURLToPath(import.meta.url))
const cwd = join(here, '../../../sandbox/codegen')

let ctx: Awaited<ReturnType<typeof loadConfigAndCreateContext>>
let cva: (config: RecipeConfig) => (props?: Record<string, unknown>) => string

beforeAll(async () => {
  ctx = await loadConfigAndCreateContext({ cwd })
  const generated = await import(join(cwd, 'styled-system/css/index.mjs'))
  cva = generated.cva as never
}, 60_000)

/** Lower `badge(<selection>)` the way the fold would, given `config`. */
const foldOf = (config: RecipeConfig, argSource: string, resolvedSelection?: Record<string, unknown>) => {
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile('t.ts', `badge(${argSource})`)
  const call = file.getDescendantsOfKind(SyntaxKind.CallExpression)[0]!

  const entry = config ? { config, name: getRecipeIdentity(config), box: undefined } : undefined
  return lowerRecipeCall(call, entry, ctx, resolvedSelection)
}

const CONFIGS: Array<{ label: string; config: RecipeConfig }> = [
  {
    label: 'single variant',
    config: { base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' }, b: { color: 'green.300' } } } },
  },
  {
    label: 'with a default',
    config: {
      base: { display: 'flex' },
      variants: { size: { sm: { padding: '2' }, md: { padding: '4' } } },
      defaultVariants: { size: 'md' },
    },
  },
  {
    label: 'multi-axis with defaults',
    config: {
      base: {},
      variants: {
        size: { sm: { padding: '2' }, md: { padding: '4' } },
        tone: { a: { color: 'red.300' }, b: { color: 'blue.300' } },
        flag: { true: { fontWeight: 'bold' }, false: {} },
      },
      defaultVariants: { size: 'sm', tone: 'a' },
    },
  },
  {
    label: 'a value containing a space',
    config: { base: {}, variants: { size: { 'x large': { padding: '8' }, sm: { padding: '2' } } } },
  },
  {
    label: 'a declared className',
    config: { className: 'badge', base: {}, variants: { tone: { a: { color: 'red.300' } } } },
  },
  {
    label: 'compound variants, which name no class of their own',
    config: {
      base: {},
      variants: { size: { sm: {}, md: {} }, tone: { a: {}, b: {} } },
      compoundVariants: [{ size: 'sm', tone: 'a', css: { outline: '1px solid' } }],
    },
  },
  {
    label: 'a default naming a value the config does not declare',
    config: { base: {}, variants: { size: { sm: {} } }, defaultVariants: { size: 'nope' } },
  },
]

const SELECTIONS = [
  { source: '', props: {} },
  { source: '{}', props: {} },
  { source: `{ size: 'sm' }`, props: { size: 'sm' } },
  { source: `{ size: 'md' }`, props: { size: 'md' } },
  { source: `{ size: 'bogus' }`, props: { size: 'bogus' } },
  { source: `{ tone: 'a' }`, props: { tone: 'a' } },
  { source: `{ tone: 'b', size: 'md' }`, props: { tone: 'b', size: 'md' } },
  { source: `{ flag: true }`, props: { flag: true } },
  { source: `{ flag: false }`, props: { flag: false } },
  { source: `{ size: 'x large' }`, props: { size: 'x large' } },
  { source: `{ size: 'sm', tone: 'a' }`, props: { size: 'sm', tone: 'a' } },
  { source: `{ size: 'sm', tone: 'a', flag: true }`, props: { size: 'sm', tone: 'a', flag: true } },
]

/**
 * A config that lives in another module.
 *
 * The extractor does not resolve one — `cva(badgeConfig)` comes back as `{}` rather than as the
 * imported object. That empty result is not an empty config, and folding against it produced the
 * identity of `{}`: a class with no rules behind it, substituted in place of the call that would
 * have produced the real ones, leaving the element permanently unstyled with nothing to report.
 */
describe('a config imported from another module', () => {
  test('declines rather than folding against an unresolved config', async () => {
    const { createFoldFixture } = await import('./fixture')
    const { fold, addFiles } = createFoldFixture()

    addFiles({
      'app/cfg.ts': `export const badgeConfig = { base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } }\n`,
    })

    const code = `import { cva } from 'styled-system/css'\nimport { badgeConfig } from './cfg'\nconst badge = cva(badgeConfig)\nexport const cls = badge({ tone: 'a' })\n`
    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })

  test('a config resolved in this module still folds', async () => {
    const { createFoldFixture } = await import('./fixture')
    const { fold } = createFoldFixture()

    const result = fold(
      `import { cva } from 'styled-system/css'\nconst badgeConfig = { base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } }\nconst badge = cva(badgeConfig)\nexport const cls = badge({ tone: 'a' })\n`,
    )

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('--tone_a')
  })
})

describe('inline recipe lowering matches the generated runtime', () => {
  test.each(CONFIGS)('$label', ({ config }) => {
    const runtime = cva(config)

    for (const { source, props } of SELECTIONS) {
      const lowered = foldOf(config, source)

      expect(lowered.kind, `${source || '(no args)'} should fold`).toBe('class')
      if (lowered.kind !== 'class') continue

      expect(lowered.className, `selection ${source || '(no args)'}`).toBe(runtime(props))
    }
  })

  /**
   * The half that must *not* fold. An unresolvable property is dropped from the extractor's
   * data rather than flagged, so `badge({ tone })` and `badge({})` are indistinguishable there
   * — folding the first as the second emits a class string missing a variant.
   */
  test.each([
    [`{ tone: t }`, 'a runtime identifier'],
    [`{ tone }`, 'shorthand'],
    [`{ ...rest }`, 'a spread'],
    [`{ [key]: 'a' }`, 'a computed key'],
    [`{ tone: cond ? 'a' : 'b' }`, 'a ternary'],
    [`{ tone: 'a' }, extra`, 'a second argument'],
  ])('declines %s (%s)', (source) => {
    const lowered = foldOf(CONFIGS[0]!.config, source)

    expect(lowered.kind).toBe('decline')
  })

  test('declines when the binding is not a known recipe', () => {
    expect(foldOf(undefined as never, `{ tone: 'a' }`).kind).toBe('decline')
  })

  /**
   * The `Object.hasOwn` guard, which is the point of the whole design and which the cases
   * above never reach — they all decline at the literal check first.
   *
   * The extractor's data is lossy in one direction: a property it could not resolve is
   * *dropped*, so `badge({ tone: t })` and `badge({})` are identical in it. Property names
   * therefore always come from the source, and this data may only supply a *value* for a name
   * that is present in both. A regression making the data authoritative would emit a class
   * string missing a variant, and nothing else in this file would notice.
   */
  describe('a value the extractor resolved', () => {
    const config = CONFIGS[0]!.config

    test('is used when the source wrote that property', () => {
      const lowered = foldOf(config, `{ tone: t }`, { tone: 'a' })

      expect(lowered.kind).toBe('class')
      if (lowered.kind === 'class') expect(lowered.className).toBe(cva(config)({ tone: 'a' }))
    })

    test('does not rescue a property the extractor dropped', () => {
      // What `badge({ tone: t })` actually produces when `t` is a parameter: the key is gone.
      const lowered = foldOf(config, `{ tone: t }`, {})

      expect(lowered.kind).toBe('decline')
    })

    test('cannot introduce a property the source did not write', () => {
      const lowered = foldOf(config, `{}`, { tone: 'b' })

      expect(lowered.kind).toBe('class')
      // `{}` selects nothing, whatever the data carries.
      if (lowered.kind === 'class') expect(lowered.className).toBe(cva(config)({}))
    })

    test('declines a resolved value that is not a scalar', () => {
      expect(foldOf(config, `{ tone: t }`, { tone: { base: 'a' } }).kind).toBe('decline')
    })
  })
})
