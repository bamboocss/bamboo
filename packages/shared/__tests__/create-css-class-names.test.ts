import { describe, expect, test } from 'vitest'
import { createCss } from '../src/classname'

const makeContext = (over: { prefix?: string; hash?: boolean } = {}) => ({
  hash: over.hash ?? false,
  utility: {
    prefix: over.prefix ?? '',
    hasShorthand: false,
    resolveShorthand: (p: string) => p,
    transform: (prop: string, value: any) => ({ className: `${prop}_${value}` }),
    toHash: (path: string[], h: (s: string) => string) => h(path.join(':')),
  },
  conditions: {
    breakpoints: { keys: ['base', 'md'] },
    // What the generated `sortConditions` does: move the conditions behind the property, and
    // sort in place, which is why each leaf needs its own path array.
    shift: (paths: string[]) =>
      paths.sort((a, b) => {
        const aa = isCondition(a)
        const bb = isCondition(b)
        if (aa && !bb) return 1
        if (!aa && bb) return -1
        return 0
      }),
    finalize: (v: string[]) => v.map((c) => c.replace(/^_/, '')),
  },
})

const isCondition = (value: string) => value.startsWith('_') || value === 'base' || value === 'md'

/**
 * The class name is assembled from a prefix, the conditions and the utility class, and each
 * piece is optional. Most configs set no prefix and most leaves carry no condition, so those
 * are the paths that skip the assembly — and therefore the ones that have to agree with it.
 */
describe('createCss class name assembly', () => {
  test('no prefix and no condition is the bare utility class', () => {
    expect(createCss(makeContext())({ color: 'red' })).toBe('color_red')
  })

  test('a prefix is joined with a dash', () => {
    expect(createCss(makeContext({ prefix: 'bam' }))({ color: 'red' })).toBe('bam-color_red')
  })

  test('conditions are joined with colons, ahead of the prefixed class', () => {
    expect(createCss(makeContext())({ _hover: { color: 'red' } })).toBe('hover:color_red')
    expect(createCss(makeContext({ prefix: 'bam' }))({ _hover: { color: 'red' } })).toBe('hover:bam-color_red')
  })

  test('several conditions keep their order', () => {
    expect(createCss(makeContext())({ _hover: { _focus: { color: 'red' } } })).toBe('hover:focus:color_red')
  })

  test('a base condition is dropped before assembly', () => {
    expect(createCss(makeContext())({ color: { base: 'red' } })).toBe('color_red')
  })

  test('hashing folds the conditions into the hash, and the prefix stays outside', () => {
    const plain = createCss(makeContext({ hash: true }))({ _hover: { color: 'red' } })
    const prefixed = createCss(makeContext({ hash: true, prefix: 'bam' }))({ _hover: { color: 'red' } })

    expect(plain).not.toContain(':')
    expect(prefixed).toBe(`bam-${plain}`)
  })

  test('an important value keeps its marker after assembly', () => {
    expect(createCss(makeContext({ prefix: 'bam' }))({ color: 'red !important' })).toBe('bam-color_red!')
    expect(createCss(makeContext())({ _hover: { color: 'red !important' } })).toBe('hover:color_red!')
  })

  test('an empty utility class collapses to the prefix alone', () => {
    const context = makeContext({ prefix: 'bam' })
    context.utility.transform = () => ({ className: '' })

    expect(createCss(context)({ color: 'red' })).toBe('bam')
  })

  test('an empty utility class with no prefix is empty', () => {
    const context = makeContext()
    context.utility.transform = () => ({ className: '' })

    expect(createCss(context)({ color: 'red' })).toBe('')
  })
})
