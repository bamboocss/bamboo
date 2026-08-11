import { describe, expect, test } from 'vitest'
import { configDepPaths } from '../src/config-deps'
import { diffConfigs } from '../src/diff-config'
import { validateRemovedOptions } from '../src/validation/validate-removed'

/**
 * Which artifacts a config edit rebuilds, and whether the paths deciding that still exist.
 *
 * `ConfigPath` ends in `(string & {})`, so a path naming an option that has been renamed still
 * typechecks and simply stops matching anything. Nothing else notices: the diff reports the
 * change, no matcher claims it, and the affected set comes back empty — which is *not* "rebuild
 * everything". `getMatchingArtifacts` filters on `ids.includes(...)`, and an empty list includes
 * nothing, so a watch rebuild writes no artifact at all and keeps serving the previous one.
 *
 * Both stale entries here were left by the option renames: `eject`, which no longer exists, and
 * `themes`, which became `theme.variants`.
 */
const artifactsFor = (prev: object, next: object) => diffConfigs(next as never, prev as never).artifacts

const variant = (color: string) => ({
  theme: { variants: { primary: { tokens: { colors: { text: { value: color } } } } } },
})

describe('artifact invalidation', () => {
  test('editing a theme variant rebuilds the themes artifact', () => {
    expect([...artifactsFor(variant('blue'), variant('red'))]).toContain('themes')
  })

  test('adding a theme variant rebuilds it too', () => {
    const next = { theme: { variants: { primary: {}, secondary: {} } } }
    const prev = { theme: { variants: { primary: {} } } }

    expect([...artifactsFor(prev, next)]).toContain('themes')
  })

  /** The control: a base token edit already worked, and must keep the wider fan-out. */
  test('editing a base token still rebuilds the token artifacts', () => {
    const prev = { theme: { tokens: { colors: { a: { value: 'x' } } } } }
    const next = { theme: { tokens: { colors: { a: { value: 'y' } } } } }

    expect([...artifactsFor(prev, next)]).toEqual(
      expect.arrayContaining(['design-tokens', 'types', 'css-fn', 'themes', 'static-css']),
    )
  })

  test('an unchanged config rebuilds nothing', () => {
    expect([...artifactsFor(variant('blue'), variant('blue'))]).toEqual([])
  })
})

/**
 * The guard that would have caught both, and will catch the next one.
 *
 * Checked against the removed-option table rather than against a hand-written list, so it stays
 * true as options are removed: anything that lands in `validate-removed.ts` and is still watched
 * here fails immediately, at the same commit that removes it.
 */
describe('every watched config path still exists', () => {
  /** `theme.tokens` → `{ theme: { tokens: true } }`, stopping at the first glob segment. */
  const asConfig = (path: string) => {
    const segments = path.replace(/^!/, '').split('.')
    const upToGlob = segments.slice(0, segments.indexOf('*') === -1 ? segments.length : segments.indexOf('*'))

    return upToGlob.reduceRight<unknown>((value, key) => ({ [key]: value }), true) as object
  }

  test.each(configDepPaths)('%s', (path) => {
    const reported: string[] = []
    validateRemovedOptions(asConfig(path), (_scope, message) => reported.push(message))

    expect(reported).toEqual([])
  })
})
