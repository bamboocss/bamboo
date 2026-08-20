import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const CSS_IMPORT = `import { css } from '../../styled-system/css'`

/**
 * Selective cache invalidation must be observationally identical to the full clear it
 * replaced: after any sequence of edits, a warm project — whose caches survived every event
 * they were allowed to — must extract exactly what a cold project built from the final tree
 * extracts. The recorded per-entry read-sets are what license survival, so these sequences
 * are chosen to stress the shapes where a missing record would let a stale value through:
 * values crossing one module boundary, values crossing a re-export barrel, repeated
 * same-path overwrites with different content (the bundler transform shape), and edits to a
 * file a cached value never read (whose caches are exactly what should survive).
 */
const files = (): Record<string, string> => ({
  'app/src/tokens.ts': `export const accent = 'red.500'`,
  'app/src/styles.ts':
    `${CSS_IMPORT}\n` +
    `import { accent } from './tokens'\n` +
    `export const button = css.raw({ color: accent, padding: '4' })`,
  'app/src/barrel.ts': `export { button } from './styles'`,
  'app/src/app.tsx':
    `${CSS_IMPORT}\n` +
    `import { button } from './barrel'\n` +
    `export const App = () => <div className={css(button, { margin: '2' })} />`,
  'app/src/other.tsx': `${CSS_IMPORT}\n` + `export const Other = () => <div className={css({ display: 'flex' })} />`,
})

const buildProject = (tree: Record<string, string>) => {
  const ctx = createContext({})
  for (const [path, code] of Object.entries(tree)) ctx.project.addSourceFile(path, code)
  for (const path of Object.keys(tree)) ctx.project.parseSourceFile(path)
  return ctx
}

const stylesOf = (ctx: ReturnType<typeof createContext>, path: string) =>
  [...(ctx.project.parseSourceFile(path)?.css ?? [])].flatMap((c) => (c as { data: unknown[] }).data)

const snapshot = (ctx: ReturnType<typeof createContext>, tree: Record<string, string>) =>
  Object.fromEntries(Object.keys(tree).map((path) => [path, stylesOf(ctx, path)]))

describe('selective invalidation equality', () => {
  test('a warm project answers every edit sequence exactly as a cold one', () => {
    const tree = files()
    const warm = buildProject(tree)

    const apply = (path: string, content: string) => {
      tree[path] = content
      warm.project.addSourceFile(path, content)
      for (const dependent of warm.project.getDependents(path)) warm.project.parseSourceFile(dependent)
    }

    const expectParity = () => {
      const cold = buildProject({ ...tree })
      expect(snapshot(warm, tree)).toEqual(snapshot(cold, tree))
    }

    // A transitive value edit: tokens.ts feeds styles.ts feeds app.tsx through a barrel.
    apply('app/src/tokens.ts', `export const accent = 'blue.700'`)
    expectParity()

    // An edit to a file no cached cross-file value ever read — the caches that must survive.
    apply('app/src/other.tsx', `${CSS_IMPORT}\nexport const Other = () => <div className={css({ display: 'grid' })} />`)
    expectParity()

    // The shared file itself, changing both a read value and its own emission.
    apply(
      'app/src/styles.ts',
      `${CSS_IMPORT}\n` +
        `import { accent } from './tokens'\n` +
        `export const button = css.raw({ color: accent, padding: '8', outline: 'none' })`,
    )
    expectParity()

    // The barrel re-routes to a new declaration file — a resolution change with new file. Tree
    // changes clear outright, so parity here guards the full-clear half as well.
    tree['app/src/styles2.ts'] = `${CSS_IMPORT}\nexport const button = css.raw({ color: 'green.300' })`
    warm.project.addSourceFile('app/src/styles2.ts', tree['app/src/styles2.ts'])
    apply('app/src/barrel.ts', `export { button } from './styles2'`)
    expectParity()

    // Same-path overwrites with alternating content — the bundler transform shape.
    const full = tree['app/src/app.tsx']!
    const clipped = `${CSS_IMPORT}\nexport const meta = () => [{ title: 'clipped' }]`
    warm.project.addSourceFile('app/src/app.tsx', clipped)
    warm.project.parseSourceFile('app/src/app.tsx')
    apply('app/src/app.tsx', full)
    expectParity()
  })
})
