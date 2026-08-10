import { createGeneratorContext } from '@bamboocss/fixture'
import { describe, expect, test } from 'vitest'
import { generatePattern } from '../src/artifacts/js/pattern'

/**
 * `cssProps` replaces a `strict` boolean and an `@experimental` `blocklist`, which were two
 * answers to one question — which css properties the pattern accepts beside its own.
 *
 * The pair had a combination that silently did nothing: the blocklist is only applied to the
 * type that lists css properties, and `strict: true` did not emit that type, so setting both
 * dropped the blocklist. One option makes that unrepresentable, which is the point — so the
 * assertions are on the emitted declaration rather than on the config.
 */
const dtsFor = (cssProps?: unknown) => {
  const ctx = createGeneratorContext({
    patterns: {
      widget: {
        properties: { size: { type: 'property', value: 'width' } },
        ...(cssProps === undefined ? {} : { cssProps }),
        transform: (props: any) => props,
      },
    },
  } as never)

  return generatePattern(ctx)!.find((file) => file.name === 'widget')!.dts
}

describe('pattern cssProps', () => {
  test("'all' — the default — accepts any css property beside the declared ones", () => {
    const dts = dtsFor()

    expect(dts).toContain('WidgetProperties')
    expect(dts).toContain('DistributiveOmit<SystemStyleObject, keyof WidgetProperties')
  })

  test("'none' emits only the declared properties", () => {
    const dts = dtsFor('none')

    expect(dts).toContain('interface WidgetStyles extends WidgetProperties {}')
    // Not a bare `DistributiveOmit`: the import line names it whatever the setting.
    expect(dts).not.toContain('DistributiveOmit<SystemStyleObject')
  })

  test('{ except } keeps the css half and omits what it lists', () => {
    const dts = dtsFor({ except: ['overflow', 'aspectRatio'] })

    expect(dts).toContain('DistributiveOmit<SystemStyleObject, keyof WidgetProperties')
    expect(dts).toContain(`| 'overflow' | 'aspectRatio'`)
  })

  /** The combination that used to be silently vacuous cannot be written now. */
  test('an empty except list is the same as accepting everything', () => {
    expect(dtsFor({ except: [] })).toBe(dtsFor('all'))
  })

  test('the declared properties survive every setting', () => {
    for (const value of [undefined, 'all', 'none', { except: ['overflow'] }]) {
      expect(dtsFor(value)).toContain('size?:')
    }
  })
})
