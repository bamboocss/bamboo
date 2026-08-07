import { describe, test } from 'vitest'
import { createFoldFixture } from './fixture'

describe('why did the tagged template fold', () => {
  const foldWith = (source: string) => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nimport { css } from '../styled-system/css'\ndeclare const tag: any\ndeclare const dyn: any\n${source}`,
    )
    return r
  }

  const cases: Record<string, string> = {
    // `.root` is an ANCHOR slot: it only folds through the static path, so a fold here
    // proves the extractor resolved the argument rather than the inertness gate passing.
    'anchor slot with tagged template': 'export const a = checkbox({ size: tag`x` }).root',
    'anchor slot with -1': 'export const a = checkbox({ size: -1 }).root',
    'anchor slot with template literal': 'export const a = checkbox({ size: `sm` }).root',
    'css with tagged template': 'export const a = css({ color: tag`x` })',
    'constant slot tagged template': 'export const a = checkbox({ size: tag`x` }).control',
    'constant slot new Date': 'export const a = checkbox({ size: new Date() }).control',
    'constant slot tagged template nested': 'export const a = checkbox({ size: { base: tag`x` } }).control',
    'constant slot tagged template in array': 'export const a = checkbox({ size: [tag`x`] }).control',
    'constant slot tagged template second arg': 'export const a = checkbox({ size: dyn }, tag`x`).control',
  }

  for (const [label, source] of Object.entries(cases)) {
    test(label, () => {
      const r = foldWith(source)
      console.log(`Q[${label}] code=${JSON.stringify(r.code.split('\n').at(-1))} folded=${JSON.stringify(r.folded)}`)
    })
  }
})

describe('chain', () => {
  test('control.length', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const a = checkbox({ size: 'sm' }).control.length`,
    )
    console.log('CHAIN:', JSON.stringify(r.code.split('\n').at(-1)))
  })
  test('optional chain code', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\ndeclare const dyn: any\nexport const a = checkbox({ size: dyn })?.control`,
    )
    console.log('OPT:', JSON.stringify(r.code.split('\n').at(-1)))
  })
})
