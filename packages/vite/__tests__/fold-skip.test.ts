import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * Everything the fold declines to touch must come back byte-identical.
 *
 * This is the half that matters most. A missed fold costs a few nanoseconds; a wrong
 * fold silently changes what the page renders. Each case here is a shape where the
 * call does not evaluate to a class string, or does not evaluate to a *knowable* one.
 */
const skipCases: Array<{ name: string; code: string; reason?: string }> = [
  {
    name: 'css.raw returns a style object, not a class string',
    reason: 'raw-call',
    code: `
      import { css } from 'styled-system/css'
      export const styles = css.raw({ color: 'red.300' })
    `,
  },
  {
    name: 'aliased css.raw',
    reason: 'raw-call',
    code: `
      import { css as xcss } from 'styled-system/css'
      export const styles = xcss.raw({ color: 'red.300' })
    `,
  },
  {
    name: 'cva returns a function',
    reason: 'not-foldable',
    code: `
      import { cva } from 'styled-system/css'
      export const button = cva({ base: { color: 'red.300' } })
    `,
  },
  {
    name: 'sva returns a function',
    reason: 'not-foldable',
    code: `
      import { sva } from 'styled-system/css'
      export const parts = sva({ slots: ['root'], base: { root: { color: 'red.300' } } })
    `,
  },
  {
    // A bare `color: tone` lowers to the leaf helper now. A condition object does not: it
    // names one class per condition, which no single prefix describes.
    name: 'runtime variable in a condition object',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (tone, other) => css({ color: { base: tone, md: other } })
    `,
  },
  {
    name: 'spread of an unknown object',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (rest) => css({ color: 'red.300', ...rest })
    `,
  },
  {
    // A ternary between two resolvable values lowers to a ternary between two classes;
    // one unresolvable branch makes the choice infinite again. At the top level it would
    // still lower as a leaf, so this is nested, where neither mechanism applies.
    name: 'ternary with a dynamic branch inside a condition',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (on, tone) => css({ _hover: { color: on ? 'red.300' : tone } })
    `,
  },
  {
    name: 'partially dynamic multi-argument call',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (extra) => css({ color: 'red.300' }, extra)
    `,
  },
  {
    name: 'dynamic condition key',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (key) => css({ [key]: { color: 'red.300' } })
    `,
  },
  {
    name: 'value from a function call in a condition object',
    reason: 'dynamic',
    code: `
      import { css } from 'styled-system/css'
      export const make = (n) => css({ padding: { base: compute(n), md: '2' } })
    `,
  },
  {
    name: 'dynamic pattern props',
    reason: 'dynamic',
    code: `
      import { stack } from 'styled-system/patterns'
      export const make = (gap) => stack({ gap })
    `,
  },
]

describe('calls the fold declines', () => {
  test.each(skipCases)('$name — source is unchanged', ({ code }) => {
    const { fold } = createFoldFixture()
    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
    expect(result.map).toBeNull()
  })

  test.each(skipCases.filter((c) => c.reason))('$name — reports reason "$reason"', ({ code, reason }) => {
    const { fold } = createFoldFixture()
    const result = fold(code)

    expect(result.skipped.map((s) => s.reason)).toContain(reason)
  })
})

describe('mixed modules', () => {
  test('a static call folds while a dynamic one beside it is left alone', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export const fixed = css({ color: 'red.300' })
      export const dynamic = (tone, other) => css({ color: { base: tone, md: other } })
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const fixed = "c_red.300"')
    expect(result.code).toContain('export const dynamic = (tone, other) => css({ color: { base: tone, md: other } })')
  })

  test('css.raw beside a foldable css() does not confuse the fold', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      export const base = css.raw({ color: 'red.300' })
      export const cls = css({ display: 'flex' })
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain(`css.raw({ color: 'red.300' })`)
    expect(result.code).toContain('export const cls = "d_flex"')
  })

  test('a folded call composed from css.raw keeps the raw call intact', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      const base = css.raw({ color: 'red.300' })
      export const cls = css(base, { display: 'flex' })
    `

    const result = fold(code)

    // The raw definition must survive verbatim whether or not the consumer folded.
    expect(result.code).toContain(`const base = css.raw({ color: 'red.300' })`)
  })

  test('modules with no bamboo calls are returned untouched', () => {
    const { fold } = createFoldFixture()

    const code = `export const value = compute({ color: 'red.300' })\n`
    const result = fold(code)

    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
  })
})

describe('nested calls', () => {
  test('a call nested inside another folded call is not double-written', () => {
    const { fold } = createFoldFixture()

    const code = `
      import { css } from 'styled-system/css'
      import { stack } from 'styled-system/patterns'
      export const cls = stack({ gap: '4', css: css({ color: 'red.300' }) })
    `

    // Whatever the fold decides here, it must not corrupt the output.
    const result = fold(code)

    expect(() => result.code).not.toThrow()
    expect(result.code).toBeTruthy()
    // No overlapping rewrite may produce a truncated or duplicated fragment.
    expect(result.code.split('export const cls').length).toBe(2)
  })
})

describe('config recipe calls', () => {
  test('a static recipe call folds to its class string', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({ size: 'sm' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "')
    expect(result.folded[0]!.className).toContain('buttonStyle--size_sm')
  })

  test('default variants are applied', () => {
    const { fold } = createFoldFixture()
    const withNone = fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({})
    `)

    // The base class is always present, and the defaults resolve without being passed.
    expect(withNone.folded[0]!.className).toContain('buttonStyle')
  })

  test('a dynamic variant does not fold', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { buttonStyle } from 'styled-system/recipes'
      export const make = (s) => buttonStyle({ size: s })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a slot recipe is left to the runtime', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { checkbox } from 'styled-system/recipes'
      export const cls = checkbox({ size: 'sm' })
    `

    // A slot recipe resolves to one class per slot, not to a single string.
    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).skipped.map((s) => s.reason)).toContain('unsupported-kind')
  })

  test('a recipe.raw call is left alone', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { buttonStyle } from 'styled-system/recipes'
      export const styles = buttonStyle.raw({ size: 'sm' })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).skipped.map((s) => s.reason)).toContain('raw-call')
  })

  test('a recipe call does not block a css() fold in the same file', () => {
    const { fold } = createFoldFixture()

    const result = fold(`
      import { css } from 'styled-system/css'
      import { buttonStyle } from 'styled-system/recipes'
      export const a = buttonStyle({ size: 'sm' })
      export const b = css({ color: 'red.300' })
    `)

    expect(result.folded).toHaveLength(2)
    expect(result.code).toContain('export const b = "c_red.300"')
  })
})

/**
 * `const badge = cva(...)` then `badge({ tone })`.
 *
 * These calls were invisible before the parser tracked local bindings: matching happens on
 * the *imported* name, and a local binding has no import. So an invocation nothing could
 * fold looked exactly like an invocation nothing had parsed, and a build had no way to tell
 * them apart. They are reported here, not folded — resolving one means emitting a literal
 * for a static selection or a lookup for a dynamic one, which is its own change.
 */
describe('calls of an inline recipe', () => {
  const inline = (body: string) => `
      import { cva } from 'styled-system/css'
      const badge = cva({ base: { color: 'red.300' }, variants: { tone: { a: { color: 'blue.300' } } } })
      ${body}
    `

  test('a static call folds to the classes the recipe would have produced', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const cls = badge({ tone: 'a' })`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('export const cls = "')
    expect(result.folded[0]!.className).toContain('--tone_a')
    // Named from the config, not per property — the rules live in the recipes layer.
    expect(result.folded[0]!.className).not.toContain('c_blue')
  })

  test('a call with no arguments folds, applying the defaults', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { cva } from 'styled-system/css'
      const badge = cva({ base: { color: 'red.300' }, variants: { tone: { a: {}, b: {} } }, defaultVariants: { tone: 'b' } })
      export const cls = badge()
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('--tone_b')
  })

  /**
   * The wrapper shape: a component that forwards its own props to the recipe.
   *
   * `input(variantProps)` cannot be resolved — the variants are the component's public API —
   * but the classes are still knowable, because a recipe emits one per *declared* variant. The
   * `splitVariantProps` access is lowered alongside it, since it is what would otherwise keep
   * the binding alive and the config in the bundle.
   */
  describe('a component wrapping a recipe', () => {
    const wrapper = `
      import { cva, cx } from 'styled-system/css'
      const input = cva({
        base: { color: 'red.300' },
        variants: { size: { sm: {}, md: {} }, tone: { a: {}, b: {} } },
        defaultVariants: { size: 'md' },
      })
      export const Input = ({ className, ...props }) => {
        const [variantProps, rest] = input.splitVariantProps(props)
        return <span className={cx(input(variantProps), className)} {...rest} />
      }
    `

    test('the call lowers, keeping the component variant API', () => {
      const { fold } = createFoldFixture()
      const result = fold(wrapper)

      expect(result.folded).toHaveLength(1)
      expect(result.code).toContain('cvaPick(variantProps.size,')
      expect(result.code).toContain('cvaPick(variantProps.tone,')
    })

    test('splitVariantProps lowers to the helper it already called', () => {
      const { fold } = createFoldFixture()
      const result = fold(wrapper)

      expect(result.code).toContain('splitProps(props, ["size","tone"])')
      expect(result.code).not.toContain('input.splitVariantProps')
    })

    test('nothing reads the binding, so its config is marked droppable', () => {
      const { fold } = createFoldFixture()
      const result = fold(wrapper)

      expect(result.code).toContain('/*#__PURE__*/')
    })

    /**
     * `.raw` is a read of the recipe object, and nothing lowers it — so the binding stays
     * referenced and a bundler keeps the config, annotation or not. The annotation says the
     * *call* is side-effect free, which is true either way; it only licenses a drop that an
     * unread binding would have allowed anyway.
     */
    test('a surviving read of the recipe keeps the binding referenced', () => {
      const { fold } = createFoldFixture()
      const result = fold(`${wrapper}\nexport const raw = input.raw({ size: 'sm' })`)

      expect(result.code).toContain('input.raw(')
    })
  })

  /**
   * A slot recipe returns one class per slot — an object, not a string — so there is no literal
   * that stands for it. The parser records its calls as recipe calls like any other, so what
   * keeps it safe is that the fold's binding→config map is built from `cva` definitions only.
   */
  test('a slot recipe call never folds', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { sva } from 'styled-system/css'
      const parts = sva({ slots: ['root'], base: { root: { color: 'red.300' } }, variants: { tone: { a: { root: { color: 'green.300' } } } } })
      export const cls = parts({ tone: 'a' })
      export const root = parts({ tone: 'a' }).root
    `

    const result = fold(code)

    expect(result.folded).toHaveLength(0)
    expect(result.code).toBe(code)
  })

  /**
   * A selection the build cannot resolve is still a choice among classes it knows, so it
   * lowers to that choice rather than keeping the recipe. The runtime that survives is the
   * `cvaPick` join, not `cva` — and once every call of a binding lowers, its config is dead.
   */
  test('a dynamic call lowers to a choice between known classes', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const make = (tone) => badge({ tone })`))

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cvaPick(tone,')
    expect(result.code).toContain(`import { cva, cvaPick }`)
  })

  test('a selection the build cannot enumerate is still reported', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const make = (rest) => badge({ ...rest })`))

    expect(result.folded).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('recipe-call')
  })

  test('the definition is still reported, and marked pure once nothing reads it', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const cls = badge({ tone: 'a' })`))

    // `cva(...)` returns a function; only its invocations resolve to a class string.
    expect(result.skipped.map((s) => s.reason)).toContain('not-foldable')
    // Left in place, but annotated — a bundler cannot prove `cva` is side-effect free, so
    // without this the config stays and folding makes the module larger, not smaller.
    expect(result.code).toContain('const badge = /*#__PURE__*/cva(')
  })

  test('the definition is not marked pure while a call still reads it', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      export const cls = badge({ tone: 'a' })
      export const other = (rest) => badge({ ...rest })
    `),
    )

    expect(result.code).not.toContain('/*#__PURE__*/')
  })

  /**
   * A selection that could run something keeps running it.
   *
   * Folding to a literal would delete the call, so a property whose expression is not inert
   * takes the runtime path instead — where it survives verbatim as the helper's argument and
   * evaluates exactly once, in place. That is strictly better than declining: the call is
   * preserved *and* the recipe config still leaves the bundle.
   */
  test('a selection that could run something keeps the call, and still lowers', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      const trace = () => 'a'
      export const cls = badge({ tone: trace() })
    `),
    )

    expect(result.folded).toHaveLength(1)
    expect(result.code).toContain('cvaPick(trace(),')
  })

  /**
   * Terms are emitted in the config's variant order, so two properties that could each run
   * something would swap. One can never be reordered against itself; two must already agree.
   */
  /**
   * A property name that reaches `Object.prototype`.
   *
   * `config.variants[key]` answers truthily for `toString` or `__proto__`, so the property
   * looked like a real variant — while the emission loop iterates `Object.keys`, which does
   * not contain it. The expression was therefore accepted and then never emitted, taking
   * whatever it would have run with it. The value side of these same tables has guarded this
   * for a while; this is the key side.
   */
  test.each(['__proto__', 'toString', 'constructor', 'valueOf'])(
    'a property named %s does not fold, so its expression survives',
    (key) => {
      const { fold } = createFoldFixture()
      const code = inline(`
      const trace = () => 'a'
      export const cls = badge({ ${key}: trace() })
    `)

      expect(fold(code).folded).toHaveLength(0)
      expect(fold(code).code).toBe(code)
    },
  )

  /**
   * A key written twice. The *value* is last-wins, but the earlier expression still runs, so
   * emitting only the winner would delete it. A type error in TypeScript, reachable in the
   * `.js` and `.jsx` the fold also transforms.
   */
  test.each([
    [`{ tone: trace(), tone: 'a' }`, 'a literal overwriting an effectful one'],
    [`{ tone: trace(), tone: other() }`, 'two effectful writes'],
  ])('a duplicate key does not fold — %s', (selection) => {
    const { fold } = createFoldFixture()
    const code = inline(`
      const trace = () => 'a'
      const other = () => 'b'
      export const cls = badge(${selection})
    `)

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  /**
   * The fold's own copy of `getRecipeClassNames`'s skip condition has to make the same own-key
   * check, or it names a class for `'toString'` that the runtime never emits and no rule backs.
   */
  test('a variant value naming a prototype member emits no class', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const cls = badge({ tone: 'toString' })`))

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).not.toContain('toString')
  })

  test('two effectful properties that would swap do not fold', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { cva } from 'styled-system/css'
      const badge = cva({ base: {}, variants: { tone: { a: {}, b: {} }, size: { sm: {}, md: {} } } })
      const a = () => 'sm'
      const b = () => 'a'
      export const cls = badge({ size: a(), tone: b() })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('two effectful properties already in config order do fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { cva } from 'styled-system/css'
      const badge = cva({ base: {}, variants: { tone: { a: {}, b: {} }, size: { sm: {}, md: {} } } })
      const a = () => 'sm'
      const b = () => 'a'
      export const cls = badge({ tone: b(), size: a() })
    `)

    expect(result.folded).toHaveLength(1)
    // Both calls survive, in the order the source wrote them.
    expect(result.code.indexOf('b()')).toBeLessThan(result.code.indexOf('a()'))
  })

  /**
   * The key is read off the name node, not unquoted from its text. `'\u0074one'` names the
   * variant `tone`; stripping the quotes leaves the escape uninterpreted, the variant does
   * not match, and its class is silently dropped from the string.
   */
  test.each([
    [`{ 'tone': 'a' }`, 'a quoted key'],
    [`{ '\u0074one': 'a' }`, 'an escaped key'],
  ])('%s folds like a bare one (%s)', (selection) => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export const cls = badge(${selection})`))

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toContain('--tone_a')
  })

  /**
   * A config the extractor could not read is not an empty config. Folding against one emits
   * the identity of `{}` and deletes the call that would have produced real classes, leaving
   * the element permanently unstyled with nothing to report it.
   */
  test('a config the build could not resolve does not fold', () => {
    const { fold } = createFoldFixture()
    const code = `
      import { cva } from 'styled-system/css'
      const badge = cva(makeConfig())
      export const cls = badge({ tone: 'a' })
    `

    expect(fold(code).folded).toHaveLength(0)
    expect(fold(code).code).toBe(code)
  })

  test('a config chosen by a ternary does not fold', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { cva } from 'styled-system/css'
      const badge = cva(dark ? { base: { color: 'red.300' } } : { base: { color: 'blue.300' } })
      export const cls = badge({})
    `)

    expect(result.folded).toHaveLength(0)
  })

  /**
   * Shapes where the name at the call site is not the recipe at all. The parser registers an
   * inline recipe for the whole file, so without these guards the fold would be rewriting
   * somebody else's function into a class string.
   */
  test('a nearer binding of the same name is not reported', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      export function other() {
        const badge = (x) => x
        return badge({ tone: 'a' })
      }
    `),
    )

    expect(result.skipped.map((s) => s.reason)).not.toContain('recipe-call')
  })

  test('a reassignable binding is not registered at all', () => {
    const { fold } = createFoldFixture()
    const result = fold(`
      import { cva } from 'styled-system/css'
      let badge = cva({ base: { color: 'red.300' } })
      badge = (x) => x
      export const y = badge({ tone: 'a' })
    `)

    expect(result.skipped.map((s) => s.reason)).not.toContain('recipe-call')
  })

  test('a call nested in a function still folds, when nothing shadows it', () => {
    const { fold } = createFoldFixture()
    const result = fold(inline(`export function ok() { return badge({ tone: 'a' }) }`))

    expect(result.folded).toHaveLength(1)
  })

  test('an inline recipe call does not block a css() fold beside it', () => {
    const { fold } = createFoldFixture()
    const result = fold(
      inline(`
      export const cls = badge({ tone: 'a' })
      export const b = css({ color: 'red.300' })
    `).replace(`import { cva }`, `import { css, cva }`),
    )

    expect(result.code).toContain('export const b = "c_red.300"')
    // Both fold now: the css() call by property, the recipe call by its config.
    expect(result.folded).toHaveLength(2)
  })
})
