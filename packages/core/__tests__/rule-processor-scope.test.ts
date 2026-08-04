import { describe, expect, test } from 'vitest'
import { createRuleProcessor } from './fixture'

/**
 * `getClassNames()` reports the class names for *one* call.
 *
 * The encoder and decoder accumulate across calls so that a whole stylesheet can be
 * built from many sources. Reading the decoder's `classNames` directly therefore
 * returns everything encoded so far, which is correct for CSS emission and wrong for
 * any caller asking "what does this call resolve to" — notably the build-time fold,
 * which would otherwise splice a neighbouring call's atoms into an unrelated call
 * site.
 *
 * Every test here shares one processor across calls, since that is the only
 * configuration where scoped and unscoped answers differ. Existing suites construct
 * a fresh processor per call, where the two coincide.
 */
describe('rule processor scoping', () => {
  test('css() does not leak atoms from an earlier call', () => {
    const processor = createRuleProcessor()

    const first = processor.css({ color: 'red.300' })
    const second = processor.css({ display: 'flex' })

    expect(first.getClassNames()).toMatchInlineSnapshot(`
      [
        "c_red\\.300",
      ]
    `)
    expect(second.getClassNames()).toMatchInlineSnapshot(`
      [
        "d_flex",
      ]
    `)
  })

  test('a repeated call reports its class names again, not an empty set', () => {
    const processor = createRuleProcessor()

    const first = processor.css({ color: 'red.300' })
    const repeat = processor.css({ color: 'red.300' })

    expect(repeat.getClassNames()).toEqual(first.getClassNames())
    expect(repeat.getClassNames()).not.toHaveLength(0)
  })

  test('scoped output matches a dedicated processor for the same styles', () => {
    const shared = createRuleProcessor()

    shared.css({ color: 'blue.500', margin: '4' })
    const scoped = shared.css({ padding: '2', _hover: { color: 'red.300' } })

    const isolated = createRuleProcessor().css({ padding: '2', _hover: { color: 'red.300' } })

    expect(scoped.getClassNames()).toEqual(isolated.getClassNames())
  })

  test('css() ordering is stable regardless of what was encoded before it', () => {
    const styles = { display: 'flex', color: 'red.300', padding: '2' }

    const isolated = createRuleProcessor().css(styles).getClassNames()

    const shared = createRuleProcessor()
    shared.css({ margin: '10' })
    shared.css({ color: 'blue.500' })
    const scoped = shared.css(styles).getClassNames()

    expect(scoped).toEqual(isolated)
  })

  test('conditions and important values stay scoped', () => {
    const processor = createRuleProcessor()

    processor.css({ color: 'blue.500' })
    const scoped = processor.css({ padding: '0 !important', _hover: { color: 'red.300' } })

    expect(scoped.getClassNames()).toEqual(
      createRuleProcessor()
        .css({ padding: '0 !important', _hover: { color: 'red.300' } })
        .getClassNames(),
    )
  })

  test('grouped() does not leak between calls', () => {
    const processor = createRuleProcessor()

    const first = processor.grouped({ color: 'red.300' })
    const second = processor.grouped({ display: 'flex' })

    expect(first.getClassNames()).toHaveLength(1)
    expect(second.getClassNames()).toHaveLength(1)
    expect(first.getClassNames()).not.toEqual(second.getClassNames())
  })

  test('cva() does not leak between calls', () => {
    const processor = createRuleProcessor()

    const first = processor.cva({ base: { color: 'red.300' } })
    const second = processor.cva({ base: { display: 'flex' } })

    expect(first.getClassNames()).toEqual(
      createRuleProcessor()
        .cva({ base: { color: 'red.300' } })
        .getClassNames(),
    )
    expect(second.getClassNames()).toEqual(
      createRuleProcessor()
        .cva({ base: { display: 'flex' } })
        .getClassNames(),
    )
  })

  test('config recipe variants stay scoped to their own selection', () => {
    const processor = createRuleProcessor()

    const sm = processor.recipe('buttonStyle', { size: 'sm' })!
    const md = processor.recipe('buttonStyle', { size: 'md' })!

    expect(sm.getClassNames()).toEqual(createRuleProcessor().recipe('buttonStyle', { size: 'sm' })!.getClassNames())
    expect(md.getClassNames()).toEqual(createRuleProcessor().recipe('buttonStyle', { size: 'md' })!.getClassNames())
    expect(sm.getClassNames()).not.toEqual(md.getClassNames())
  })

  test('slot recipe variants stay scoped, including the base slots', () => {
    const processor = createRuleProcessor()

    const sm = processor.recipe('checkbox', { size: 'sm' })!
    const md = processor.recipe('checkbox', { size: 'md' })!

    expect(sm.getClassNames()).toEqual(createRuleProcessor().recipe('checkbox', { size: 'sm' })!.getClassNames())
    expect(md.getClassNames()).toEqual(createRuleProcessor().recipe('checkbox', { size: 'md' })!.getClassNames())
    expect(sm.getClassNames()).not.toEqual(md.getClassNames())
  })

  test('sva() does not leak between calls', () => {
    const processor = createRuleProcessor()

    const config = { slots: ['root'], base: { root: { color: 'red.300' } } }
    processor.sva({ slots: ['root'], base: { root: { display: 'flex' } } })
    const scoped = processor.sva(config)

    expect(scoped.getClassNames()).toEqual(createRuleProcessor().sva(config).getClassNames())
  })

  test('recipe base is reported even when an earlier call encoded it', () => {
    const processor = createRuleProcessor()

    const first = processor.recipe('buttonStyle', { size: 'sm' })!
    const second = processor.recipe('buttonStyle', { size: 'sm' })!

    // The second call adds nothing to the encoder, but its result is the same.
    expect(second.getClassNames()).toEqual(first.getClassNames())
  })

  test('CSS emission still sees every call on the shared processor', () => {
    const processor = createRuleProcessor()

    processor.css({ color: 'red.300' })
    processor.css({ display: 'flex' })

    const css = processor.toCss()

    // Scoping changes what each call reports, never what the sheet contains.
    expect(css).toContain('--colors-red-300')
    expect(css).toContain('display: flex')
  })
})
