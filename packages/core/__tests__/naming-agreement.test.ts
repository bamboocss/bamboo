import { createContext } from '@bamboocss/fixture'
import { getRecipeIdentity } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { checkNamingAgreement } from '../src/naming-agreement'

/**
 * The stylesheet and the runtime each derive a class name, and they only meet in the DOM.
 * `checkNamingAgreement` is what stops a disagreement reaching a browser, so it has to be
 * wrong in neither direction: a false positive fails every build, and a false negative is
 * the silent blank page it exists to prevent.
 */
const check = (config: Config) => checkNamingAgreement(createContext(config) as never)

describe('checkNamingAgreement', () => {
  // Every combination of the options that feed a class name. The pairs are what matter —
  // the defect this guards against was a combination nothing enumerated.
  const configs: Array<[string, Config]> = [
    ['default', {}],
    ['hash', { hash: true }],
    ['prefix', { prefix: 'bam' }],
    ['hash + prefix', { hash: true, prefix: 'bam' }],
    ['separator', { separator: '-' }],
    ['hash + separator', { hash: true, separator: '-' }],
    ['prefix + separator', { prefix: 'bam', separator: '-' }],
    ['hash + prefix + separator', { hash: true, prefix: 'bam', separator: '-' }],
  ]

  test.each(configs)('agrees: %s', (_name, config) => {
    expect(check(config)).toBeUndefined()
  })

  // A disagreement is only ever two sides configured differently, so that is what is
  // simulated: an encoder and decoder built without a prefix, asked about a utility that
  // has one. Reverting the real defect is not expressible from a test, but this exercises
  // the same shape — the stylesheet naming one class and the runtime asking for another.
  test('catches a build and runtime that were configured differently', () => {
    const plain = createContext({})
    const prefixed = createContext({ prefix: 'bam' })

    // Spelled out rather than spread: `Context` exposes `config` through a getter, and a
    // spread would drop it.
    const result = checkNamingAgreement({
      config: plain.config,
      conditions: plain.conditions,
      hash: plain.hash,
      encoder: plain.encoder,
      decoder: plain.decoder,
      // The one difference — the runtime resolves through a prefixed utility while the
      // stylesheet was encoded without one.
      utility: prefixed.utility,
    } as never)

    expect(result).toBeDefined()
    // A conditional class carries its condition first (`hover:bam-c_blue`), so the prefix is
    // looked for anywhere in the name rather than at the start of it.
    expect(result!.runtime.every((name) => name.includes('bam-'))).toBe(true)
    expect(result!.build.some((name) => name.includes('bam-'))).toBe(false)
  })

  /**
   * A compound variant's rule selects on the classes the element already carries —
   * `.btn--size_sm.btn--tone_a` — and contributes none of its own. That is why it slipped
   * past the check above for so long: `filterClassNames` reads class names, a compound has
   * none, and the build side is then narrowed to the runtime's set, so no trace of one
   * survived on either side.
   *
   * The invariant is stated here without recomputing a class name: every class a compound
   * selects on must be one the build emitted a rule for. A selector assembled from raw names
   * — which is how `hash.className` and `prefix` came to be skipped once already — names
   * classes that appear nowhere else, and the runtime never asks for them.
   */
  const COMPOUND_RECIPE = {
    base: { color: 'red' },
    compoundVariants: [{ css: { fontWeight: 'bold' }, size: 'sm', tone: 'a' }],
    variants: {
      size: { 'x large': { paddingTop: '2' }, sm: { paddingTop: '1' } },
      tone: { a: { paddingBottom: '1' } },
    },
  }

  test.each(configs)('a compound selects on classes the build emitted: %s', (_name, config) => {
    const ctx = createContext(config)
    const name = getRecipeIdentity(COMPOUND_RECIPE as never)
    ctx.recipes.registerInline(name, COMPOUND_RECIPE as never)
    ctx.encoder.withScope(() => ctx.encoder.processAtomicRecipe(COMPOUND_RECIPE as never))
    ctx.decoder.collect(ctx.encoder)

    const unescape = (value: string) => value.replaceAll('\\', '')
    const rules = Array.from(ctx.decoder.recipes.values()).flatMap((set) => Array.from(set))
    const emitted = new Set(rules.map((rule) => unescape(rule.className)))

    // `getAtomic` folds a compound's selector into its style object's key, so a compound is
    // the rule whose key is something other than its own class.
    const compounds = rules
      .map((rule) => unescape(Object.keys(rule.result)[0] ?? ''))
      .filter((selector, index) => selector && selector !== `.${unescape(rules[index]!.className)}`)

    // Without this the assertion below passes on an empty list, which is exactly the way the
    // build-time canary went quiet.
    expect(compounds).toHaveLength(1)

    for (const selector of compounds) {
      for (const className of selector.split('.').filter(Boolean)) {
        expect(emitted, `${selector} selects on ${className}, which no rule emits`).toContain(className)
      }
    }
  })

  /**
   * The tests above pin that the check is silent when the two sides agree, and that its `css`
   * arm speaks when they do not. Nothing pinned the other two arms, and silence is this
   * function's success value — so an arm refactored into always returning `undefined` would
   * leave every test here green while the net caught nothing. These fail on that.
   *
   * Each breaks one side only. Every config axis trips the `css` arm first and returns early,
   * which is why neither of these reaches for a config.
   */
  test('the recipe arm still reports when its build side emits nothing', () => {
    const ctx = createContext({})

    // The check runs on `ctx.encoder.clone()`, so the clone has to be wrapped too. A proxy
    // that does not survive cloning is bypassed in silence, and the probe then agrees with
    // itself and proves nothing.
    const withoutRecipeRules = (encoder: any): any =>
      new Proxy(encoder, {
        get: (target: any, key) => {
          if (key === 'processAtomicRecipe') return () => undefined
          if (key === 'clone') return () => withoutRecipeRules(target.clone())
          return typeof target[key] === 'function' ? target[key].bind(target) : target[key]
        },
      })

    const result = checkNamingAgreement({
      config: ctx.config,
      conditions: ctx.conditions,
      hash: ctx.hash,
      decoder: ctx.decoder,
      recipes: ctx.recipes,
      utility: ctx.utility,
      encoder: withoutRecipeRules(ctx.encoder),
    } as never)

    expect(result).toBeDefined()
    expect(result!.kind).toBe('recipe')
    // The runtime still asks for the base and the selected variant; the stylesheet has neither.
    expect(result!.build).toHaveLength(0)
    expect(result!.runtime.length).toBeGreaterThan(0)
  })

  test('the slot-recipe arm still reports when the two sides separate slots differently', () => {
    const ctx = createContext({})

    // Only the runtime side is given the odd separator: the decoder reads `slotSeparator` off
    // the real context, so proxying the copy the check holds is what makes the two disagree.
    // Assigning the field instead would move both sides together and report nothing.
    const result = checkNamingAgreement({
      config: ctx.config,
      conditions: ctx.conditions,
      hash: ctx.hash,
      encoder: ctx.encoder,
      decoder: ctx.decoder,
      utility: ctx.utility,
      recipes: new Proxy(ctx.recipes, {
        get: (target: any, key) => (key === 'slotSeparator' ? '@@' : target[key]),
      }),
    } as never)

    expect(result).toBeDefined()
    expect(result!.kind).toBe('slot-recipe')
    expect(result!.runtime.every((name) => name.includes('@@'))).toBe(true)
    expect(result!.build).toHaveLength(0)
  })

  test('the canary never reaches the caller stylesheet', () => {
    const ctx = createContext({})
    checkNamingAgreement(ctx as never)

    // `check` runs on clones, so the context's own encoder is still untouched.
    expect(ctx.encoder.isEmpty()).toBe(true)
    expect(ctx.decoder.isEmpty()).toBe(true)
  })
})
