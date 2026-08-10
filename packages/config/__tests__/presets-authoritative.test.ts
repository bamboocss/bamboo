import { logger } from '@bamboocss/logger'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { resolveConfig } from '../src/resolve-config'

/**
 * `presets` is the complete list. The old behaviour was neither additive nor replacing:
 * listing any preset kept `@bamboocss/preset-base` and silently dropped
 * `@bamboocss/preset-bamboo`, and `presets: []` meant "base only" rather than "none".
 *
 * The warning matters more than usual here. `presets` still exists and still takes a list, so
 * nothing in `validate-removed` can see that its meaning changed — and `preset-base` carries
 * the utility table, so dropping it changes every generated class name (`c_red_300` becomes
 * `color_red_300`) rather than raising an error.
 */
const resolve = async (config: object) => {
  const result = await resolveConfig(
    { config: { ...config }, path: '/mock/bamboo.config.ts', dependencies: [] } as never,
    '/mock',
  )

  return (result.config.presets ?? []).map((preset: any) => preset?.name)
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  return () => warn.mockRestore()
})

const warnedAboutBase = () => warn.mock.calls.some((args: unknown[]) => String(args[1]).includes('preset-base'))

describe('presets is authoritative', () => {
  test('an unset presets loads the defaults', async () => {
    expect(await resolve({})).toEqual(['@bamboocss/preset-base', '@bamboocss/preset-bamboo'])
    expect(warnedAboutBase()).toBe(false)
  })

  test('a listed preset is the whole list — no default underneath it', async () => {
    expect(await resolve({ presets: [{ name: 'mine' }] })).toEqual(['mine'])
  })

  test('and that is warned about, because it silently changes every class name', async () => {
    await resolve({ presets: [{ name: 'mine' }] })

    expect(warnedAboutBase()).toBe(true)
  })

  /** The replacement for `eject: true`, and a deliberate choice rather than an oversight. */
  test('an empty list loads nothing, silently', async () => {
    expect(await resolve({ presets: [] })).toEqual([])
    expect(warnedAboutBase()).toBe(false)
  })

  test('listing preset-base explicitly silences the warning', async () => {
    const names = await resolve({ presets: ['@bamboocss/preset-base', { name: 'mine' }] })

    expect(names).toEqual(['@bamboocss/preset-base', 'mine'])
    expect(warnedAboutBase()).toBe(false)
  })

  test('a bundled preset is resolved from its name', async () => {
    expect(await resolve({ presets: ['@bamboocss/preset-bamboo'] })).toEqual(['@bamboocss/preset-bamboo'])
  })

  test('the same preset listed twice is loaded once', async () => {
    const mine = { name: 'mine' }

    expect(await resolve({ presets: ['@bamboocss/preset-base', mine, mine] })).toEqual([
      '@bamboocss/preset-base',
      'mine',
    ])
  })
})
