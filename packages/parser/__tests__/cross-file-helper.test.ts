import { createContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'

/**
 * A style helper in a neighbouring file used to come back unresolvable: the evaluator was
 * given no type checker, so it could not follow an import to a declaration and the call
 * resolved to nothing. Its declarations were then silently absent from the stylesheet.
 *
 * For `css()` that was a partial loss. For a recipe it is not: the classes are named from a
 * hash of the config, so a dropped declaration gives the build and the browser different
 * names and the element renders with no styles at all.
 *
 * The boundary is the project. A dependency's code is not ours to run at build time.
 */
const build = (extra: Record<string, string>, source: string) => {
  const ctx = createContext() as never as {
    project: { addSourceFile: (p: string, c: string) => void; parseSourceFile: (p: string, e?: unknown) => never }
    encoder: { clone: () => unknown }
  }
  ctx.project.addSourceFile(
    'app/src/helpers.ts',
    `const defaults = { color: 'gray.90', width: '2px' }
     export const focusRing = (options: any = {}) => {
       const { color, width } = { ...defaults, ...options }
       return { _focusVisible: { outlineColor: color, outlineWidth: width } }
     }`,
  )
  for (const [path, content] of Object.entries(extra)) ctx.project.addSourceFile(path, content)
  ctx.project.addSourceFile('app/src/use.tsx', source)

  const result = ctx.project.parseSourceFile('app/src/use.tsx', ctx.encoder.clone()) as never as {
    toArray: () => Array<{ data: unknown[] }>
  }
  return result.toArray().flatMap((item) => item.data)
}

describe('a style helper in another module', () => {
  test('its call resolves, with the argument applied over the defaults', () => {
    expect(
      build(
        {},
        `import { css } from 'styled-system/css'
         import { focusRing } from './helpers'
         export const a = css({ ...focusRing({ color: 'labs.blue.40' }), color: 'red' })`,
      ),
    ).toEqual([
      {
        _focusVisible: { outlineColor: 'labs.blue.40', outlineWidth: '2px' },
        color: 'red',
      },
    ])
  })

  test('a recipe gets the same treatment, which is what keeps its hash honest', () => {
    const [config] = build(
      {},
      `import { cva } from 'styled-system/css'
       import { focusRing } from './helpers'
       export const a = cva({ base: { ...focusRing(), padding: '4' } })`,
    ) as Array<{ base: Record<string, unknown> }>

    expect(Object.keys(config.base)).toEqual(['_focusVisible', 'padding'])
  })

  test('a call into a dependency is left alone', () => {
    // Resolving it would mean running that package's code during the build.
    expect(
      build(
        { 'node_modules/vendor/index.d.ts': `export declare const vendorStyles: (o?: any) => any` },
        `import { css } from 'styled-system/css'
         import { vendorStyles } from 'vendor'
         export const a = css({ ...vendorStyles({ x: 1 }), color: 'blue' })`,
      ),
    ).toEqual([{ color: 'blue' }])
  })
})
