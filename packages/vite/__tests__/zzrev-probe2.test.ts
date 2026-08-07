import { describe, test } from 'vitest'
import { createFoldFixture } from './fixture'

const last = (code: string) => code.split('\n').slice(-1)[0]

describe('inert: what survives', () => {
  const foldWith = (source: string) => {
    const { fold } = createFoldFixture()
    return fold(
      `import { checkbox } from '../styled-system/recipes'\ndeclare const dyn: any\ndeclare const tag: any\ndeclare const size: any\ndeclare const arr: any\n${source}`,
    )
  }

  const cases: Record<string, string> = {
    'tagged template': 'export const a = checkbox({ size: tag`x` }).control',
    'tagged template dynamic': 'export const a = checkbox({ size: tag`x${dyn}` }).control',
    'template substitution literal': 'export const a = checkbox({ size: `a${1}` }).control',
    'template substitution dynamic': 'export const a = checkbox({ size: `a${dyn}` }).control',
    'negative one': 'export const a = checkbox({ size: -1 }).control',
    'nested dyn object': 'export const a = checkbox({ size: { base: dyn } }).control',
    'array with dyn': "export const a = checkbox({ size: ['a', dyn] }).control",
    shorthand: 'export const a = checkbox({ size }).control',
    'string key dyn': "export const a = checkbox({ 'size': dyn }).control",
    'numeric key dyn': 'export const a = checkbox({ 1: dyn }).control',
    'nested call inside object': 'export const a = checkbox({ size: { base: tag() } }).control',
    'nested call inside array': 'export const a = checkbox({ size: [tag()] }).control',
    'call in second argument': 'export const a = checkbox({ size: dyn }, tag()).control',
    'method shorthand': 'export const a = checkbox({ size: dyn, extra() { return tag() } }).control',
  }

  for (const [label, source] of Object.entries(cases)) {
    test(label, () => {
      const r = foldWith(source)
      console.log(`SURVIVE[${label}] => ${JSON.stringify(last(r.code))}`)
    })
  }
})

describe('badge / unscoped slot recipe throw parity', () => {
  const foldWith = (source: string) => {
    const { fold } = createFoldFixture()
    return fold(`import { badge } from '../styled-system/recipes'\ndeclare const dyn: any\n${source}`)
  }

  test('conditional variant on a sibling-compound slot', () => {
    console.log('COND:', JSON.stringify(last(foldWith(`export const a = badge({ size: { base: 'sm' } }).body`).code)))
  })
  test('array variant on a sibling-compound slot', () => {
    console.log('ARR:', JSON.stringify(last(foldWith(`export const a = badge({ size: ['sm'] as any }).body`).code)))
  })
  test('raised conditional', () => {
    console.log(
      'RAISED:',
      JSON.stringify(last(foldWith(`export const a = badge({ raised: { base: true } as any }).body`).code)),
    )
  })
})

describe('range widening interactions', () => {
  test('nested css inside the props of a slot access', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nimport { css } from '../styled-system/css'\nexport const a = [checkbox({ size: 'sm' }).control, css({ color: 'red' })]`,
    )
    console.log('NESTED:', JSON.stringify(last(r.code)), r.skipped)
  })

  test('two slot accesses of the same recipe', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const a = checkbox({ size: 'sm' }).control\nexport const b = checkbox({ size: 'sm' }).label`,
    )
    console.log('TWO:', JSON.stringify(r.code.split('\n').slice(-2)), r.skipped)
  })

  test('same start different member — identical text different offsets', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const a = checkbox({ size: 'sm' }).control.length\n`,
    )
    console.log('CHAIN:', JSON.stringify(last(r.code)), r.skipped)
  })

  test('sourcemap generated for a widened range', () => {
    const { fold } = createFoldFixture()
    const r = fold(
      `import { checkbox } from '../styled-system/recipes'\nexport const a = checkbox({ size: 'sm' }).control\n`,
    )
    console.log('MAP:', r.map ? 'yes' : 'no', JSON.stringify(r.folded))
  })
})
