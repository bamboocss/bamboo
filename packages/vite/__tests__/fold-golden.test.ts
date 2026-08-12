import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

/**
 * Whole-module output, so a change in what the fold emits shows up as a readable diff
 * rather than as a class-name assertion somewhere. Each module mixes foldable and
 * non-foldable calls, since the interesting failures are at the boundary.
 */
const modules: Array<{ name: string; code: string }> = [
  {
    name: 'basic',
    code: `import { css } from 'styled-system/css'

export const title = css({ fontSize: 'lg', fontWeight: 'bold' })
export const body = css({ color: 'red.300', _hover: { color: 'blue.500' } })
`,
  },
  {
    name: 'mixed-static-and-dynamic',
    code: `import { css } from 'styled-system/css'

export const fixed = css({ display: 'flex' })

export function tinted(tone: string) {
  return css({ color: tone, padding: '2' })
}

export function merged(extra: Record<string, unknown>) {
  return css({ display: 'block' }, extra)
}
`,
  },
  {
    name: 'raw-composition',
    code: `import { css } from 'styled-system/css'

export const base = css.raw({ padding: '4', rounded: 'md' })
export const solid = css({ bg: 'blue.500', color: 'white' })
`,
  },
  {
    name: 'recipe-definitions-erased',
    code: `import { css, cva, sva } from 'styled-system/css'

export const button = cva({
  base: { display: 'inline-flex' },
  variants: { size: { sm: { padding: '2' }, md: { padding: '4' } } },
})

export const parts = sva({
  slots: ['root', 'label'],
  base: { root: { display: 'flex' }, label: { color: 'red.300' } },
})

export const plain = css({ margin: '0 auto' })
`,
  },
  {
    name: 'patterns',
    code: `import { flex, center } from 'styled-system/patterns'

export const column = flex({ gap: '4', align: 'center' })
export const row = center({ gap: '2' })

export function spaced(gap: string) {
  return flex({ gap })
}
`,
  },
  {
    // `css()` inside a JSX expression is still a call site, so it folds. What stays
    // untouched is JSX *style props*, which are a separate surface.
    name: 'jsx-expressions',
    code: `import { css } from 'styled-system/css'

export const Button = () => (
  <button className={css({ px: '4', py: '2' })}>
    <span className={css({ fontWeight: 'bold' })}>Hello</span>
  </button>
)
`,
  },
  {
    name: 'escaping',
    code: `import { css } from 'styled-system/css'

export const quoted = css({ color: '[var(--x, "red")]' })
export const spaced = css({ margin: '0 auto ' })
export const important = css({ padding: '0 !important' })
`,
  },
]

describe('golden module output', () => {
  test.each(modules)('$name', async ({ name, code }) => {
    const { fold } = createFoldFixture()
    const result = fold(code, `app/src/${name}.tsx`)

    await expect(result.code).toMatchFileSnapshot(`./__golden__/${name}.tsx`)
  })

  test.each(modules)('$name — folding is idempotent', ({ name, code }) => {
    const { fold } = createFoldFixture()

    const once = fold(code, `app/src/${name}.tsx`)
    const twice = fold(once.code, `app/src/${name}-again.tsx`)

    // A folded literal is no longer a call, so a second pass has nothing left to do.
    expect(twice.code).toBe(once.code)
  })
})
