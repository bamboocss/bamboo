import { describe, expect, test } from 'vitest'
import { createFoldFixture, selectorsFor } from './fixture'

describe('static style-set folding', () => {
  test('an inline recipe and css share the same declaration atom across files', () => {
    const fixture = createFoldFixture()

    const recipe = fixture.foldStyleSets(
      `
      import { cva } from 'styled-system/css'
      const layout = cva({ base: { display: 'flex' } })
      export const className = layout()
    `,
      'app/src/recipe.ts',
    )

    const utility = fixture.foldStyleSets(
      `
      import { css } from 'styled-system/css'
      export const className = css({ display: 'flex' })
    `,
      'app/src/utility.ts',
    )

    expect(recipe.folded).toHaveLength(1)
    expect(utility.folded).toHaveLength(1)
    expect(recipe.folded[0]!.className).toBe(utility.folded[0]!.className)

    const css = fixture.getStyleSetCss()
    for (const selector of selectorsFor(recipe.folded[0]!.className)) {
      expect(css).toContain(selector)
      expect(css.split(selector)).toHaveLength(2)
    }
  })

  test('a static recipe selection is composed before its atoms are allocated', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { cva } from 'styled-system/css'
      const badge = cva({
        base: { display: 'flex', color: 'red.300' },
        variants: { tone: { quiet: { color: 'gray.500' } } },
        compoundVariants: [{ tone: 'quiet', css: { opacity: 0.8 } }],
      })
      export const className = badge({ tone: 'quiet' })
    `)

    expect(result.folded).toHaveLength(1)
    expect(result.folded[0]!.className).toBe(fixture.runtimeCss({ display: 'flex', color: 'gray.500', opacity: 0.8 }))
  })

  test('cx composes recipe and css declarations before either becomes a class string', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { css, cva, cx } from 'styled-system/css'
      const badge = cva({ base: { display: 'flex', color: 'red.300' } })
      export const className = cx(
        badge(),
        css({ display: 'flex', color: 'blue.500' }),
      )
    `)

    const expected = fixture.runtimeCss({ display: 'flex', color: 'blue.500' })
    expect(result.code).toContain(JSON.stringify(expected))
    expect(result.code).not.toContain('cx(')
    expect(result.code).not.toContain(fixture.runtimeCss({ color: 'red.300' }))
    expect(result.folded.some((entry) => entry.name === 'cx' && entry.className === expected)).toBe(true)
  })

  test('cx preserves static third-party classes while composing Bamboo styles', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { css, cx } from 'styled-system/css'
      export const className = cx('external', css({ color: 'red.300' }), 'selected')
    `)

    expect(result.code).toContain(JSON.stringify(`external ${fixture.runtimeCss({ color: 'red.300' })} selected`))
  })

  test('cx recursively composes statically analyzable arrays', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { css, cx } from 'styled-system/css'
      export const className = cx(['external', [css({ color: 'red.300' }), false]], css({ color: 'blue.500' }))
    `)

    expect(result.code).toContain(JSON.stringify(`external ${fixture.runtimeCss({ color: 'blue.500' })}`))
    expect(result.skipped).not.toContainEqual(expect.objectContaining({ name: 'cx', reason: 'dynamic' }))
  })

  test('a finite dynamic recipe becomes a reduced lookup of complete shared StyleSets', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { cva } from 'styled-system/css'
      const badge = cva({
        base: { display: 'flex', color: 'red.300' },
        variants: {
          tone: {
            quiet: { color: 'gray.500' },
            loud: { color: 'red.500' },
          },
        },
        defaultVariants: { tone: 'quiet' },
        compoundVariants: [{ tone: 'loud', css: { opacity: 0.8 } }],
      })
      export const className = (tone) => badge({ tone })
    `)

    expect(result.skipped).not.toContainEqual(expect.objectContaining({ reason: 'recipe-call' }))
    expect(result.code).toContain('cvaMap([tone]')
    expect(result.code).not.toMatch(/cva_[a-z0-9]+--tone/)

    const quiet = fixture.runtimeCss({ display: 'flex', color: 'gray.500' })
    const loud = fixture.runtimeCss({ display: 'flex', color: 'red.500', opacity: 0.8 })
    const miss = fixture.runtimeCss({ display: 'flex', color: 'red.300' })
    expect(result.code).toContain(JSON.stringify(quiet).slice(1, -1))
    expect(result.code).toContain(JSON.stringify(loud).slice(1, -1))
    expect(result.code).toContain(JSON.stringify(miss).slice(1, -1))
    expect(result.folded[0]!.classNames).toEqual(
      expect.arrayContaining([...quiet.split(' '), ...loud.split(' '), ...miss.split(' ')]),
    )
  })

  test('bounds an exact dynamic recipe table before enumerating its Cartesian product', () => {
    const fixture = createFoldFixture()
    const source = `
      import { cva } from 'styled-system/css'
      const badge = cva({
        variants: {
          tone: { quiet: { color: 'gray.500' }, loud: { color: 'red.500' } },
          size: { sm: { padding: '2' }, md: { padding: '4' } },
        },
      })
      export const className = (tone, size) => badge({ tone, size })
    `

    // Each axis has miss, undefined, and two declared values: 4 * 4 = 16 exact states.
    expect(() => fixture.foldStyleSets(source, 'app/src/state-limit.ts', 15)).toThrow('would inspect 16 selections')
    expect(() => fixture.foldStyleSets(source, 'app/src/state-limit.ts', 16)).not.toThrow()
  })

  test('composes static cx styles into every runtime StyleSet leaf', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { css, cva, cx } from 'styled-system/css'
      const badge = cva({ variants: { tone: { quiet: { color: 'gray.500' } } } })
      export const className = (tone) => cx(badge({ tone }), css({ color: 'blue.500' }))
    `)

    expect(result.skipped).not.toContainEqual(expect.objectContaining({ name: 'cx', reason: 'dynamic' }))
    const cx = result.folded.find((entry) => entry.name === 'cx')
    expect(cx?.classNames).toContain('c_blue.500')
    expect(cx?.classNames).not.toContain('c_gray.500')
    expect(result.code).toContain('cvaMap([tone]')
  })

  test('inline sva slot accesses share atoms with css, including finite runtime variants', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { css, sva } from 'styled-system/css'
      const field = sva({
        slots: ['root', 'label'],
        base: { root: { display: 'flex' }, label: { color: 'red.300' } },
        variants: {
          tone: {
            quiet: { root: { opacity: 0.8 }, label: { color: 'gray.500' } },
            loud: { root: { opacity: 1 }, label: { color: 'red.500' } },
          },
        },
      })
      export const root = field({ tone: 'quiet' }).root
      export const label = (tone) => field({ tone }).label
      export const utility = css({ display: 'flex' })
    `)

    expect(result.code).toContain(JSON.stringify(fixture.runtimeCss({ display: 'flex', opacity: 0.8 })))
    expect(result.code).toContain('cvaMap([tone]')
    expect(result.code).not.toMatch(/sva_[a-z0-9]+__/)
    expect(result.folded.some((entry) => entry.classNames.includes('d_flex'))).toBe(true)
  })

  test('a whole inline sva call becomes one slot object lookup', () => {
    const fixture = createFoldFixture()
    const result = fixture.foldStyleSets(`
      import { sva } from 'styled-system/css'
      const field = sva({
        slots: ['root', 'label'],
        base: { root: { display: 'flex' }, label: { color: 'red.300' } },
        variants: { tone: { quiet: { label: { color: 'gray.500' } } } },
      })
      export const staticSlots = field({ tone: 'quiet' })
      export const dynamicSlots = (tone) => field({ tone })
    `)

    expect(result.code).toContain(
      JSON.stringify({
        root: fixture.runtimeCss({ display: 'flex' }),
        label: fixture.runtimeCss({ color: 'gray.500' }),
      }),
    )
    expect(result.code).toContain('cvaMap([tone]')
    expect(result.folded.filter((entry) => entry.kind === 'slots')).toHaveLength(2)
  })
})
