import { describe, expect, test } from 'vitest'
import { mergeConfigs } from '../src/merge-config'

/**
 * `hash`, `prefix` and `preflight` take a scalar that is shorthand for setting every member
 * of their object form. Expanding the scalar before merging is what lets the object forms
 * compose across a preset and an app.
 *
 * Before it, the later object replaced the earlier one wholesale — and silently, because the
 * two usually name *different* members. `hash`'s members are optional, so writing the partial
 * form that triggers it is the natural thing to do.
 */
const merge = (preset: object, user: object) => mergeConfigs([{ ...preset, name: 'preset' } as never, user as never])

describe('scalar-shorthand options merge per member', () => {
  test('a preset and an app can each set one member of hash', () => {
    expect(merge({ hash: { cssVar: true } }, { hash: { className: true } }).hash).toEqual({
      cssVar: true,
      className: true,
    })
  })

  test('the same for prefix', () => {
    expect(merge({ prefix: { cssVar: 'p' } }, { prefix: { className: 'c' } }).prefix).toEqual({
      cssVar: 'p',
      className: 'c',
    })
  })

  test('a scalar expands to every member, and a partial overrides one of them', () => {
    expect(merge({ hash: true }, { hash: { className: false } }).hash).toEqual({ cssVar: true, className: false })
    expect(merge({ prefix: 'bb' }, { prefix: { className: 'x' } }).prefix).toEqual({ cssVar: 'bb', className: 'x' })
  })

  /** `false` is a statement about the whole option, not a member of it. */
  test('false from the winning config turns the option off', () => {
    expect(merge({ hash: { cssVar: true } }, { hash: false }).hash).toBe(false)
    expect(merge({ preflight: { scope: '.app' } }, { preflight: false }).preflight).toBe(false)
  })

  /**
   * `preflight: true` normalizes to `{}` — an object with nothing to contribute. Handed back
   * as the scalar, because an empty object is dropped on the way out and the option would be
   * lost rather than merged.
   */
  test('preflight: true survives on its own', () => {
    expect(merge({}, { preflight: true }).preflight).toBe(true)
  })

  test('preflight keeps a scope the preset set', () => {
    expect(merge({ preflight: { scope: '.app' } }, { preflight: true }).preflight).toEqual({ scope: '.app' })
  })

  test('an option nobody sets stays unset', () => {
    const result = merge({}, {})

    expect(result.hash).toBeUndefined()
    expect(result.prefix).toBeUndefined()
    expect(result.preflight).toBeUndefined()
  })
})
