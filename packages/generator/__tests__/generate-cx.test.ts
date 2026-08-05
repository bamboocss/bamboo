import { createGeneratorContext } from '@bamboocss/fixture'
import type { Config } from '@bamboocss/types'
import { describe, expect, test } from 'vitest'
import { generateCx } from '../src/artifacts/js/cx'

type Cx = (...args: unknown[]) => string

/**
 * Evaluate the emitted artifact rather than a copy of it. `cx` ships to the browser as this
 * exact string, and a test that reimplemented the matcher would be free to drift from it.
 */
const compile = (config?: Config): Cx => {
  const { js } = generateCx(createGeneratorContext(config) as any)
  return new Function(`${js.replace(/export\s*\{\s*cx\s*\}/, 'return cx')}`)() as Cx
}

describe('generated cx', () => {
  const cx = compile()

  test('the last class setting a property wins', () => {
    expect(cx('px_4', 'px_2')).toBe('px_2')
    expect(cx('mt_4 c_red', 'c_blue.500')).toBe('mt_4 c_blue.500')
  })

  test('the winner keeps the position of the class it replaces', () => {
    expect(cx('btn px_4', 'btn px_2')).toBe('btn px_2 btn')
  })

  test('a condition is part of the declaration, so it does not merge with the base', () => {
    expect(cx('hover:px_4', 'hover:px_2')).toBe('hover:px_2')
    expect(cx('px_4', 'hover:px_2')).toBe('px_4 hover:px_2')
    expect(cx('md:hover:px_4', 'hover:px_2')).toBe('md:hover:px_4 hover:px_2')
  })

  test('classes bamboo did not generate are left alone, duplicates included', () => {
    expect(cx('custom', 'custom')).toBe('custom custom')
    expect(cx('a', 'b')).toBe('a b')
  })

  test('skips falsy parts and flattens arrays', () => {
    expect(cx('a', false, null, undefined, 'b', ['c', '', 'd'])).toBe('a b c d')
    expect(cx(false, null, undefined, [])).toBe('')
    expect(cx(['d_flex px_4', ['h_8', false]], 'px_2')).toBe('d_flex px_2 h_8')
  })

  test('returns a lone class string untouched', () => {
    expect(cx('d_flex px_4')).toBe('d_flex px_4')
    expect(cx('d_flex px_4', undefined)).toBe('d_flex px_4')
    expect(cx([false, 'd_flex px_4'])).toBe('d_flex px_4')
  })

  test('an important class is the same declaration as its plain form', () => {
    // The cascade would always pick the important one; argument order decides here, which
    // is the whole point of merging.
    expect(cx('c_red!', 'c_blue')).toBe('c_blue')
    expect(cx('c_blue', 'c_red!')).toBe('c_red!')
  })

  test('a colon inside an arbitrary selector does not start a condition', () => {
    expect(cx('[&[data-x="a:b"]]:px_4', '[&[data-x="a:b"]]:px_2')).toBe('[&[data-x="a:b"]]:px_2')
    expect(cx('[&[data-x="a:b"]]:px_4', 'px_2')).toBe('[&[data-x="a:b"]]:px_4 px_2')
  })

  test('a value containing the separator still resolves to its property', () => {
    expect(cx('p_10px_15px', 'p_2')).toBe('p_2')
    expect(cx('w_[calc(1px_+_2px)]', 'w_2')).toBe('w_2')
  })

  test('leaves recipe and hand-written classes alone', () => {
    // `button--size-sm` is not a utility. Keying it on the text before the first separator
    // would collapse it with `button--visual-outline` and drop one of them.
    expect(cx('button button--visual-outline', 'button--size-md custom-btn')).toBe(
      'button button--visual-outline button--size-md custom-btn',
    )
    expect(cx('custom_a', 'custom_b')).toBe('custom_a custom_b')
  })

  test('leaves a bare word alone rather than treating it as a property', () => {
    expect(cx('px_', '_4')).toBe('px_ _4')
  })
})

describe('generated cx with a className prefix', () => {
  test('merges on the property, not the prefix', () => {
    const cx = compile({ prefix: 'bam' })
    expect(cx('bam-px_4', 'bam-px_2')).toBe('bam-px_2')
    expect(cx('hover:bam-px_4', 'hover:bam-px_2')).toBe('hover:bam-px_2')
    expect(cx('bam-px_4', 'bam-c_red')).toBe('bam-px_4 bam-c_red')
  })

  test('a `-` separator does not make the prefix look like the property', () => {
    // `formatClassName` joins the prefix with `-` whatever the separator is. Without
    // skipping it, `bam-px-4` and `bam-c-red` would both key on `bam` and collapse into one.
    const cx = compile({ prefix: 'bam', separator: '-' })
    expect(cx('bam-px-4', 'bam-c-red')).toBe('bam-px-4 bam-c-red')
    expect(cx('bam-px-4', 'bam-px-2')).toBe('bam-px-2')
    expect(cx('hover:bam-px-4', 'hover:bam-px-2')).toBe('hover:bam-px-2')
  })
})

describe('generated cx with a non-default separator', () => {
  test('merges on the configured separator', () => {
    const cx = compile({ separator: '=' })
    expect(cx('px=4', 'px=2')).toBe('px=2')
    expect(cx('px=4', 'c=red')).toBe('px=4 c=red')
  })

  test('recipe classes survive a `-` separator', () => {
    const cx = compile({ separator: '-' })
    expect(cx('button button--visual-outline', 'button--size-md custom-btn')).toBe(
      'button button--visual-outline button--size-md custom-btn',
    )
    expect(cx('mx-2', 'mx-4')).toBe('mx-4')
  })
})

describe('generated cx with hashed class names', () => {
  test('falls back to concatenation, because a hash carries no property', () => {
    const cx = compile({ hash: true })
    expect(cx('oFJfu', 'bcDef')).toBe('oFJfu bcDef')
    // No merging is possible, so nothing is dropped either.
    expect(cx('abc', 'abc')).toBe('abc abc')
  })

  test('emits the smaller function', () => {
    const hashed = generateCx(createGeneratorContext({ hash: true }) as any).js
    const plain = generateCx(createGeneratorContext() as any).js
    expect(hashed).not.toContain('mergeKey')
    expect(hashed.length).toBeLessThan(plain.length)
  })
})

describe('generated cx — regression guards', () => {
  test('multi-segment utilities do not collapse onto their first segment', () => {
    // Under `separator: '-'` a utility name contains the separator itself, and its leading
    // segment is often a utility too. Keying on the first separator merged `bd-w` and `bd-c`.
    const cx = compile({ separator: '-' })
    expect(cx('bd-w-4px', 'bd-c-red')).toBe('bd-w-4px bd-c-red')
    expect(cx('ov-x-auto', 'ov-y-hidden')).toBe('ov-x-auto ov-y-hidden')
    expect(cx('translate-x-4', 'translate-y-2')).toBe('translate-x-4 translate-y-2')
    expect(cx('bd-t-w-1px', 'bd-b-c-blue')).toBe('bd-t-w-1px bd-b-c-blue')
    // Still merges what it should.
    expect(cx('bd-w-4px', 'bd-w-2px')).toBe('bd-w-2px')
  })

  test('a recipe owns its class even when it looks like a utility', () => {
    // `my_btn` starts with `my` (marginY). Without protecting recipe names the component
    // would lose every one of its recipe styles the moment a `my` prop was passed.
    const cx = compile({
      theme: {
        extend: {
          recipes: {
            myBtn: { className: 'my_btn', base: { color: 'red' }, variants: { size: { sm: { padding: '2' } } } },
          },
        },
      },
    } as Config)
    expect(cx('my_btn', 'my_8')).toBe('my_btn my_8')
    expect(cx('my_btn--size_sm', 'my_8')).toBe('my_btn--size_sm my_8')
  })

  test('splits on every whitespace the class attribute does', () => {
    const cx = compile()
    expect(cx('px_4\npy_2', 'px_8')).toBe('px_8 py_2')
    expect(cx('px_4\tc_red', 'px_2')).toBe('px_2 c_red')
  })

  test('a configured prefix is required, not merely skipped', () => {
    // Bamboo only ever emits `bam-px_4`, so a bare `px_2` is by definition someone else's.
    const cx = compile({ prefix: 'bam' })
    expect(cx('bam-px_4', 'px_2')).toBe('bam-px_4 px_2')
  })

  test('merges utilities that declare no explicit className', () => {
    // `colorPalette` falls back to the hyphenated property, so it is absent from the
    // `entries()` list the set used to be built from.
    expect(compile()('color-palette_red', 'color-palette_blue')).toBe('color-palette_blue')
  })

  test('the concatenating fallback honours the array type it advertises', () => {
    const cx = compile({ hash: true })
    expect(cx(['a', 'b'])).toBe('a b')
    expect(cx('a', ['b', ['c']])).toBe('a b c')
  })
})
