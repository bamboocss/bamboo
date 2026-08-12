import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

const classes = (result: ReturnType<ReturnType<typeof createFoldFixture>['fold']>) =>
  result.folded.filter((entry) => entry.kind === 'class' || entry.kind === 'slots')

describe('calls the compiler rejects', () => {
  test.each([
    {
      reason: 'raw-call',
      code: `import { css } from 'styled-system/css'\nexport const styles = css.raw({ color: 'red.300' })\n`,
    },
    {
      reason: 'dynamic',
      code: `import { css } from 'styled-system/css'\nexport const make = (tone) => css({ color: { base: tone } })\n`,
    },
    {
      reason: 'dynamic',
      code: `import { css } from 'styled-system/css'\nexport const make = (rest) => css({ color: 'red.300', ...rest })\n`,
    },
    {
      reason: 'dynamic',
      code: `import { flex } from 'styled-system/patterns'\nexport const make = (gap) => flex({ gap })\n`,
    },
  ])('leaves $reason source unchanged', ({ code, reason }) => {
    const result = createFoldFixture().fold(code)
    expect(result.code).toBe(code)
    expect(result.folded).toHaveLength(0)
    expect(result.skipped.map((entry) => entry.reason)).toContain(reason)
  })

  test('still compiles an independent static call in the same module', () => {
    const result = createFoldFixture().fold(`
      import { css } from 'styled-system/css'
      export const fixed = css({ color: 'red.300' })
      export const dynamic = (tone) => css({ color: { base: tone } })
    `)

    expect(classes(result)).toHaveLength(1)
    expect(result.code).toContain('export const fixed = "c_red.300"')
    expect(result.code).toContain('css({ color: { base: tone } })')
  })

  test('returns a module with no Bamboo calls untouched', () => {
    const code = `export const value = compute({ color: 'red.300' })\n`
    expect(createFoldFixture().fold(code)).toMatchObject({ code, map: null, folded: [] })
  })
})

describe('config recipe calls', () => {
  test('compiles a static selection to declaration atoms', () => {
    const fixture = createFoldFixture()
    const result = fixture.fold(`
      import { buttonStyle } from 'styled-system/recipes'
      export const cls = buttonStyle({ size: 'sm' })
    `)

    expect(classes(result)).toHaveLength(1)
    expect(classes(result)[0]!.className).toContain('d_inline-flex')
    expect(classes(result)[0]!.className).not.toContain('buttonStyle')
  })

  test('compiles a runtime selection to a finite decision table', () => {
    const code = `import { buttonStyle } from 'styled-system/recipes'\nexport const make = (size) => buttonStyle({ size })\n`
    const result = createFoldFixture().fold(code)
    expect(classes(result)).toHaveLength(1)
    expect(result.code).toContain('cvaMap([size]')
    expect(result.code).not.toContain('buttonStyle({ size })')
    expect(result.skipped).toHaveLength(0)
  })

  test('rejects raw() but compiles a whole slot object to preselected slot atoms', () => {
    const raw = createFoldFixture().fold(
      `import { buttonStyle } from 'styled-system/recipes'\nexport const x = buttonStyle.raw({ size: 'sm' })\n`,
    )
    expect(raw.skipped.map((entry) => entry.reason)).toContain('raw-call')

    const slots = createFoldFixture().fold(
      `import { checkbox } from 'styled-system/recipes'\nexport const x = checkbox({ size: 'sm' })\n`,
    )
    expect(slots.folded).toContainEqual(expect.objectContaining({ kind: 'slots' }))
    expect(slots.code).toContain('"root"')
    expect(slots.code).not.toContain('checkbox({ size:')
  })
})

describe('inline recipe declarations are compile-time only', () => {
  const inline = (body: string) => `
    import { cva } from 'styled-system/css'
    const badge = cva({
      base: { display: 'flex', color: 'red.300' },
      variants: { tone: { quiet: { color: 'gray.500' }, loud: { color: 'red.500' } } },
      defaultVariants: { tone: 'quiet' },
    })
    ${body}
  `

  test('erases the factory and compiles a static call to shared atoms', () => {
    const result = createFoldFixture().fold(inline(`export const cls = badge({ tone: 'loud' })`))
    expect(result.code).toContain('const badge = undefined')
    expect(result.code).not.toContain('cva({')
    expect(classes(result)[0]!.className).toContain('c_red.500')
    expect(classes(result)[0]!.className).not.toContain('cva_')
  })

  test('compiles a runtime axis to the finite decision helper', () => {
    const result = createFoldFixture().fold(inline(`export const cls = (tone) => badge({ tone })`))
    expect(result.code).toContain('cvaMap([tone]')
    expect(result.code).not.toContain('badge({ tone })')
    expect(result.code).not.toContain('cva({')
  })

  test('lowers splitVariantProps without preserving the recipe object', () => {
    const result = createFoldFixture().fold(
      inline(`
        export const Badge = (props) => {
          const [variants, rest] = badge.splitVariantProps(props)
          return badge(variants) + JSON.stringify(rest)
        }
      `),
    )
    expect(result.code).toContain('splitProps(props, ["tone"])')
    expect(result.code).not.toContain('badge.splitVariantProps')
    expect(result.code).not.toContain('cva({')
  })

  test('reports an unenumerable selection and reflective recipe reads', () => {
    const spread = createFoldFixture().foldStrict(inline(`export const cls = (rest) => badge({ ...rest })`))
    expect(spread.skipped.map((entry) => entry.reason)).toContain('recipe-call')

    const reflective = createFoldFixture().foldStrict(inline(`export const config = badge.config`))
    expect(reflective.skipped).toContainEqual(expect.objectContaining({ reason: 'runtime-binding', name: 'badge' }))
  })

  test('erases an exported declaration even when all calls live in consumer modules', () => {
    const result = createFoldFixture().fold(`
      import { cva } from 'styled-system/css'
      export const badge = cva({ base: { display: 'flex' } })
    `)
    expect(result.code).toContain('export const badge = undefined')
    expect(result.folded).toContainEqual(expect.objectContaining({ kind: 'definition', name: 'badge' }))
  })
})
