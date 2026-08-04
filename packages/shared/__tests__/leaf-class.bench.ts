import { bench, describe } from 'vitest'
import { createCss, createMergeCss } from '../src/classname'
import { withoutSpace } from '../src/important'
import { leafClass } from '../src/leaf-class'
import { memo } from '../src/memo'

/**
 * What the source transform buys by rewriting `css({ color: tone })` into a leaf call.
 *
 * The comparison is against a `css` assembled the way the generated one is — memoized,
 * over `mergeCss` — because the memo is most of what the fold removes, and measuring
 * against a bare `createCss` would overstate the win on the warm path and understate it
 * on the cold one.
 */
const context = {
  utility: {
    prefix: '',
    hasShorthand: false,
    resolveShorthand: (prop: string) => prop,
    transform: (prop: string, value: unknown) => ({ className: `${prop}_${withoutSpace(value as string)}` }),
    toHash: (path: string[]) => path.join(':'),
  },
  conditions: { breakpoints: { keys: ['base', 'sm', 'md'] }, shift: (v: string[]) => v, finalize: (v: string[]) => v },
}

const cssFn = createCss(context)
const { mergeCss } = createMergeCss(context)
const css = memo((...styles: Record<string, unknown>[]) => cssFn(mergeCss(...styles)))

const opts = { warmupIterations: 5, time: 2000 }

/**
 * A value that cycles well past the memo's 1000-entry ceiling, so every call misses. This
 * is the SSR shape and the one the fold helps most — a warm hit is a hash and a map read,
 * a miss rebuilds the whole object.
 */
let tick = 0

/**
 * A handful of distinct values rather than one constant. With a literal argument and a
 * pure callee the whole call is loop-invariant and V8 removes it, which reports as zero
 * samples. Four values stay far inside the memo's ceiling, so `css()` still hits.
 */
const POOL = ['red.300', 'red.400', 'red.500', 'red.600']
const SPACE = ['', ' ', '  ', '   ']
const repeated = () => POOL[tick++ & 3]!

/** Cycles well past the 1000-entry ceiling, so every `css()` call misses. */
const cycling = () => `red.${tick++ % 5000}`

/**
 * Results are accumulated rather than discarded. `leafClass` is pure, so with a constant
 * argument and an unused result V8 eliminates the call outright — which reads as an
 * infinitely fast benchmark rather than as a broken one.
 */
let sink = 0
const keep = (value: string | undefined) => {
  sink += value === undefined ? 0 : value.length
}

describe('single dynamic leaf', () => {
  bench('css() — memo hit', () => keep(css({ color: repeated() })), opts)
  bench('leafClass — repeated value', () => keep(leafClass('color_', repeated())), opts)

  bench('css() — memo miss', () => keep(css({ color: cycling() })), opts)
  bench('leafClass — cycling value', () => keep(leafClass('color_', cycling())), opts)

  // The shapes that take the regex path rather than the character-scan fast path.
  bench('leafClass — value with a space', () => keep(leafClass('margin_', `0 auto${SPACE[tick++ & 3]}`)), opts)
  bench('leafClass — value with !important', () => keep(leafClass('color_', `${POOL[tick++ & 3]} !important`)), opts)
})

// Read once so the accumulator cannot itself be eliminated.
if (Number.isNaN(sink)) throw new Error('unreachable')
