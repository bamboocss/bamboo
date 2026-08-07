import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { createFoldFixture } from './fixture'

const probe = (source: string, config?: Config) => {
  const { fold } = createFoldFixture(config)
  const r = fold(`import { checkbox, badge, buttonStyle } from '../styled-system/recipes'\n${source}`)
  return r
}

describe('member access gating', () => {
  test('optional chaining', () => {
    const r = probe(`declare const dyn: 'sm'|'md'\nexport const a = checkbox({ size: dyn })?.control`)
    console.log('OPTIONAL:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('non-null assertion', () => {
    const r = probe(`declare const dyn: 'sm'|'md'\nexport const a = checkbox({ size: dyn })!.control`)
    console.log('NONNULL:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('non-null assertion static', () => {
    const r = probe(`export const a = checkbox({ size: 'sm' })!.control`)
    console.log('NONNULL-STATIC:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('element access', () => {
    const r = probe(`export const a = checkbox({ size: 'sm' })['control']`)
    console.log('ELEMACCESS:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('whole call of a slot recipe with static props', () => {
    const r = probe(`export const a = checkbox({ size: 'sm' })`)
    console.log('WHOLE:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })
})

describe('inert expression', () => {
  const cases: Record<string, string> = {
    'as const': `checkbox({ size: dyn as 'sm' }).control`,
    'non-null in prop': `checkbox({ size: dyn! }).control`,
    satisfies: `checkbox({ size: dyn satisfies string }).control`,
    parenthesised: `checkbox({ size: (dyn) }).control`,
    negative: `checkbox({ size: -1 }).control`,
    'void 0': `checkbox({ size: void 0 }).control`,
    'template with substitution': 'checkbox({ size: `a${1}` }).control',
    'template no substitution': 'checkbox({ size: `a` }).control',
    regex: `checkbox({ size: /x/ }).control`,
    bigint: `checkbox({ size: 1n }).control`,
    'arrow value': `checkbox({ size: () => 1 }).control`,
    'logical or': `checkbox({ size: dyn || 'sm' }).control`,
    nullish: `checkbox({ size: dyn ?? 'sm' }).control`,
    'nested object': `checkbox({ size: { base: dyn } }).control`,
    'array literal': `checkbox({ size: ['a', dyn] }).control`,
    'inline getter': `checkbox({ get size() { return dyn } }).control`,
    method: `checkbox({ size() { return 1 } }).control`,
    'computed key': `checkbox({ ['si' + 'ze']: dyn }).control`,
    'spread in array': `checkbox({ size: [...arr] }).control`,
    'string key': `checkbox({ 'size': dyn }).control`,
    'numeric key': `checkbox({ 1: dyn }).control`,
    shorthand: `checkbox({ size }).control`,
    'tagged template': 'checkbox({ size: tag`x` }).control',
    'class expression': `checkbox({ size: class {} }).control`,
    'new expression': `checkbox({ size: new Date() }).control`,
    'await-ish yield': `checkbox({ size: dyn as any as 'sm' }).control`,
    'array hole': `checkbox({ size: [,1] }).control`,
  }

  for (const [label, expression] of Object.entries(cases)) {
    test(label, () => {
      const r = probe(
        `declare const dyn: any\ndeclare const arr: any\ndeclare const size: any\ndeclare const tag: any\nexport const a = ${expression}`,
      )
      const folded = r.code.includes('"checkbox__control"')
      console.log(`INERT[${label}] folded=${folded}`)
    })
  }
})

describe('TDZ', () => {
  test('constant slot folds past a TDZ read', () => {
    const r = probe(`export const a = checkbox({ size: later }).control\nconst later = 'sm'`)
    console.log('TDZ:', r.code.includes('"checkbox__control"'), JSON.stringify(r.code))
  })
})

describe('anchor throw guard', () => {
  test('unscoped slot recipe with a compound on a sibling slot', () => {
    const r = probe(`export const a = badge({ size: { base: 'sm' } }).body`)
    console.log('BADGE-BODY:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('unscoped slot recipe, target slot has the compound', () => {
    const r = probe(`export const a = badge({ size: { base: 'sm' } }).title`)
    console.log('BADGE-TITLE:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  const scopedWithCompound: Config = {
    theme: {
      extend: {
        slotRecipes: {
          panel: {
            className: 'panel',
            slots: ['root', 'body'],
            base: { root: { display: 'flex' }, body: { color: 'blue' } },
            variants: {
              tone: {
                a: { root: { color: 'red' }, body: { color: 'red' } },
                b: { root: { color: 'green' }, body: { color: 'green' } },
              },
            },
            compoundVariants: [{ tone: 'a', css: { root: { padding: '4' } } }],
          },
        },
      },
    },
  } as unknown as Config

  test('scoped slot recipe, null variant value', () => {
    const { fold } = createFoldFixture(scopedWithCompound)
    const r = fold(
      `import { panel } from '../styled-system/recipes'\nexport const a = panel({ tone: null as any }).body`,
    )
    console.log('PANEL-NULL:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('scoped slot recipe, conditional variant value on constant slot', () => {
    const { fold } = createFoldFixture(scopedWithCompound)
    const r = fold(
      `import { panel } from '../styled-system/recipes'\nexport const a = panel({ tone: { base: 'a' } as any }).body`,
    )
    console.log('PANEL-COND:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })

  test('scoped slot recipe, array variant value', () => {
    const { fold } = createFoldFixture(scopedWithCompound)
    const r = fold(
      `import { panel } from '../styled-system/recipes'\nexport const a = panel({ tone: ['a'] as any }).body`,
    )
    console.log('PANEL-ARRAY:', JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
  })
})

describe('slot names that collide with object members', () => {
  const weird: Config = {
    theme: {
      extend: {
        slotRecipes: {
          odd: {
            className: 'odd',
            slots: ['root', 'constructor', 'toString', '__proto__', 'raw'],
            base: {
              root: { display: 'flex' },
              constructor: { color: 'red' },
              toString: { color: 'blue' },
              __proto__: { color: 'green' },
              raw: { color: 'purple' },
            },
            variants: { tone: { a: { root: { color: 'red' } } } },
          },
        },
      },
    },
  } as unknown as Config

  for (const slot of ['constructor', 'toString', '__proto__', 'raw']) {
    test(`slot ${slot}`, () => {
      const { fold } = createFoldFixture(weird)
      const r = fold(`import { odd } from '../styled-system/recipes'\nexport const a = odd({ tone: 'a' }).${slot}`)
      console.log(`ODD[${slot}]:`, JSON.stringify(r.code.split('\n').slice(-1)[0]), r.skipped)
    })
  }
})

test('placeholder', () => {
  expect(true).toBe(true)
})
