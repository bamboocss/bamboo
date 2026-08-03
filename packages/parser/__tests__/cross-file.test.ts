import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

const CSS_IMPORT = `import { css } from '../../styled-system/css'`

/** Parses `entry` after seeding every file, returning the folded style args per css() call. */
function extract(files: Record<string, string>, entry: string) {
  const ctx = createContext({})
  for (const [path, code] of Object.entries(files)) ctx.project.addSourceFile(path, code)
  const data = ctx.project.parseSourceFile(entry)
  return [...(data?.css ?? [])].map((c: any) => c.data)
}

describe('cross-file static composition', () => {
  test('folds a named import of css.raw', () => {
    expect(
      extract(
        {
          'app/src/styles.ts': `${CSS_IMPORT}
           export const button = css.raw({ display: 'inline-flex', paddingInline: '4' })`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { button } from './styles'
           export const App = () => <div className={css(button, { background: 'blue.500' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ display: 'inline-flex', paddingInline: '4' }, { background: 'blue.500' }]])
  })

  test('folds a plain exported object', () => {
    expect(
      extract(
        {
          'app/src/tokens.ts': `export const surface = { background: 'gray.100', color: 'black' }`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { surface } from './tokens'
           export const App = () => <div className={css(surface)} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ background: 'gray.100', color: 'black' }]])
  })

  test('folds an aliased named import', () => {
    expect(
      extract(
        {
          'app/src/styles.ts': `${CSS_IMPORT}
           export const button = css.raw({ color: 'red.500' })`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { button as btn } from './styles'
           export const App = () => <div className={css(btn)} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ color: 'red.500' }]])
  })

  test('folds through a re-export', () => {
    expect(
      extract(
        {
          'app/src/base.ts': `export const base = { paddingBlock: '2' }`,
          'app/src/index.ts': `export { base } from './base'`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { base } from './index'
           export const App = () => <div className={css(base)} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ paddingBlock: '2' }]])
  })

  test('folds through a file-local alias chain', () => {
    expect(
      extract(
        {
          'app/src/styles.ts': `const base = { margin: '2' }
           export const primary = base`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { primary } from './styles'
           export const App = () => <div className={css(primary)} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ margin: '2' }]])
  })

  test('folds an imported value spread into a local object', () => {
    expect(
      extract(
        {
          'app/src/styles.ts': `export const base = { display: 'flex' }`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { base } from './styles'
           export const App = () => <div className={css({ ...base, gap: '2' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ display: 'flex', gap: '2' }]])
  })

  test('folds an imported value inside a nested selector', () => {
    expect(
      extract(
        {
          'app/src/styles.ts': `export const icon = { width: '4', height: '4' }`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { icon } from './styles'
           export const App = () => <div className={css({ '& svg': { ...icon, color: 'currentColor' } })} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ '& svg': { width: '4', height: '4', color: 'currentColor' } }]])
  })
})

describe('cross-file: unsupported forms degrade silently', () => {
  // Each of these must extract *something* (the local half) and must not throw.
  test('default import is skipped without throwing', () => {
    expect(() =>
      expect(
        extract(
          {
            'app/src/styles.ts': `export default { color: 'red.500' }`,
            'app/src/app.tsx': `${CSS_IMPORT}
             import styles from './styles'
             export const App = () => <div className={css(styles, { margin: '2' })} />`,
          },
          'app/src/app.tsx',
        ),
      ).toEqual([[{}, { margin: '2' }]]),
    ).not.toThrow()
  })

  test('namespace import is skipped without throwing', () => {
    expect(() =>
      expect(
        extract(
          {
            'app/src/styles.ts': `export const button = { color: 'red.500' }`,
            'app/src/app.tsx': `${CSS_IMPORT}
             import * as styles from './styles'
             export const App = () => <div className={css(styles.button, { margin: '2' })} />`,
          },
          'app/src/app.tsx',
        ),
      ).toEqual([[{}, { margin: '2' }]]),
    ).not.toThrow()
  })

  test('a runtime value is skipped without throwing', () => {
    expect(() =>
      expect(
        extract(
          {
            'app/src/styles.ts': `export const dynamic = { width: Math.random() + 'px' }`,
            'app/src/app.tsx': `${CSS_IMPORT}
             import { dynamic } from './styles'
             export const App = () => <div className={css(dynamic, { margin: '2' })} />`,
          },
          'app/src/app.tsx',
        ),
      ).toEqual([[{}, { margin: '2' }]]),
    ).not.toThrow()
  })

  test('a missing module is skipped without throwing', () => {
    expect(() =>
      extract(
        {
          'app/src/app.tsx': `${CSS_IMPORT}
           import { nope } from './does-not-exist'
           export const App = () => <div className={css(nope, { margin: '2' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).not.toThrow()
  })

  test('a bare package specifier is skipped without throwing', () => {
    expect(() =>
      extract(
        {
          'app/src/app.tsx': `${CSS_IMPORT}
           import { theme } from 'some-design-system'
           export const App = () => <div className={css(theme, { margin: '2' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).not.toThrow()
  })

  test('an import of a file outside the project is skipped without throwing', () => {
    // Styles kept outside the configured include globs never enter the project, so
    // the module specifier resolves to nothing. That must degrade, not fail.
    expect(() =>
      expect(
        extract(
          {
            'app/src/app.tsx': `${CSS_IMPORT}
             import { base } from '../../outside/theme'
             export const App = () => <div className={css(base, { margin: '2' })} />`,
          },
          'app/src/app.tsx',
        ),
      ).toEqual([[{}, { margin: '2' }]]),
    ).not.toThrow()
  })

  // NOTE: this topology short-circuits before it ever recurses, so it is not cycle
  // coverage. Export lookup matches on the source name, so searching a.ts for `a`
  // compares it against `b` — the only export declaration — misses, and returns.
  // The tests below are the ones that actually walk a cycle.
  test('a circular re-export does not recurse forever', () => {
    expect(() =>
      extract(
        {
          'app/src/a.ts': `export { b as a } from './b'`,
          'app/src/b.ts': `export { a as b } from './a'`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { a } from './a'
           export const App = () => <div className={css(a, { margin: '2' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).not.toThrow()
  })
})

describe('cross-file: unresolvable names inside re-export cycles', () => {
  // Importing a name that never resolves inside a cycle — a typo, a stale import,
  // a type-only export — used to walk the cycle until the stack blew, taking the
  // whole build with it. Each must degrade to the inline half of the style.
  const app = `${CSS_IMPORT}
    import { gone } from './a'
    export const App = () => <div className={css(gone, { margin: '2' })} />`

  test('a star re-export cycle across three files terminates', () => {
    expect(
      extract(
        {
          'app/src/a.ts': `export * from './b'`,
          'app/src/b.ts': `export * from './c'`,
          'app/src/c.ts': `export * from './a'`,
          'app/src/app.tsx': app,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{}, { margin: '2' }]])
  })

  test('a same-name re-export cycle across two files terminates', () => {
    expect(
      extract(
        {
          'app/src/a.ts': `export { gone } from './b'`,
          'app/src/b.ts': `export { gone } from './a'`,
          'app/src/app.tsx': app,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{}, { margin: '2' }]])
  })

  test('a barrel that re-exports itself terminates', () => {
    expect(
      extract(
        {
          'app/src/a.ts': `export * from './a'`,
          'app/src/app.tsx': app,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{}, { margin: '2' }]])
  })

  test('a resolvable name is still found through a star re-export cycle', () => {
    // The guard must stop the walk, not truncate a lookup that would succeed.
    expect(
      extract(
        {
          'app/src/a.ts': `export * from './b'`,
          'app/src/b.ts': `export * from './a'
           export const found = { color: 'red.500' }`,
          'app/src/app.tsx': `${CSS_IMPORT}
           import { found } from './a'
           export const App = () => <div className={css(found, { margin: '2' })} />`,
        },
        'app/src/app.tsx',
      ),
    ).toEqual([[{ color: 'red.500' }, { margin: '2' }]])
  })
})

describe('cross-file: tsconfig path aliases', () => {
  test('folds a value imported through a tsconfig path alias', () => {
    // The upstream bug tracker flagged aliased imports specifically, so cover them
    // as well as relative ones. `baseUrl` is resolved against the project root.
    const ctx = createContext({
      tsconfig: { compilerOptions: { baseUrl: '/', paths: { '~/*': ['./app/src/*'] } } },
    } as any)
    ctx.project.addSourceFile(
      'app/src/styles.ts',
      `${CSS_IMPORT}
       export const button = css.raw({ borderWidth: '2px' })`,
    )
    ctx.project.addSourceFile(
      'app/src/app.tsx',
      `${CSS_IMPORT}
       import { button } from '~/styles'
       export const App = () => <div className={css(button, { margin: '2' })} />`,
    )

    const data = ctx.project.parseSourceFile('app/src/app.tsx')!
    expect([...data.css].map((c: any) => c.data)).toEqual([[{ borderWidth: '2px' }, { margin: '2' }]])
  })
})
