import { bench, describe } from 'vitest'
import { memo } from '../src/memo'
import { splitProps } from '../src/split-props'

/**
 * `splitProps` runs once per factory element per render, so it is on the hottest path the
 * runtime has — and nothing else here covers it.
 *
 * Two shapes, and which is which matters:
 *
 * - **One array group** is what ships. Every call site in the project is a recipe handing
 *   over its `variantKeys` — `cva`, `sva`, `recipe` and `Recipes.splitProps`, no others —
 *   so this is the shape that runs per component per render.
 * - **Several groups, some predicates** is reachable only by a user calling the exported
 *   helper directly. It is still public API, so it is still measured, but nothing in the
 *   project takes it.
 *
 * The docblock here used to describe the four-group shape as "the key groups the JSX
 * factory passes". No such caller exists — it went with a factory removed long ago — and
 * for a while that left the shape that actually ships with no bench at all while the one
 * that does not had five.
 */
const isCssProperty = (key: string) => ['color', 'padding', 'margin', 'fontSize', 'bg'].includes(key)
const HTML_KEYS = ['htmlSize', 'htmlWidth', 'htmlHeight', 'htmlTranslate']
const VARIANT_KEYS = ['size', 'tone']

// A variant and an html prop are present deliberately: without them two of the four
// groups claim nothing, and the named-group copy path — the one `splitVariantProps` runs
// — is never measured at all.
const PROPS = {
  color: 'red.300',
  padding: '4',
  fontSize: 'lg',
  size: 'sm',
  htmlWidth: 40,
  id: 'cta',
  onClick: () => {},
  'data-testid': 'cta',
  'aria-label': 'go',
  role: 'button',
}

/** A key the source hid, which has to stay hidden — so it takes the descriptor path. */
const HIDDEN = Object.defineProperty({ ...PROPS }, 'internal', { value: 1, enumerable: false })

/**
 * Props as Solid compiles them: accessors, `configurable: true` as its own proxy reports
 * them. `Object.freeze` is deliberately not used here — it leaves every key enumerable
 * and adds no accessor, so a frozen object takes the same value path as a plain one and
 * measures nothing new.
 */
const LAZY = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(PROPS).map((key) => [
      key,
      { get: () => PROPS[key as keyof typeof PROPS], enumerable: true, configurable: true },
    ]),
  ),
) as Record<string, unknown>

/**
 * What Solid's `mergeProps` hands over: a proxy that traps every question and synthesizes
 * an *accessor* descriptor for each key. A bare `new Proxy(obj, {})` is not this — it has
 * no trap to pay for and forwards plain data descriptors, so it measures the value path
 * and cannot show a regression in the one place this shape is sensitive.
 */
const PROXIED = new Proxy(
  { ...PROPS },
  {
    getOwnPropertyDescriptor: (target, key) => ({
      get: () => Reflect.get(target, key),
      enumerable: true,
      configurable: true,
    }),
    ownKeys: (target) => Reflect.ownKeys(target),
  },
) as Record<string, unknown>

const opts = { warmupIterations: 5, time: 2000 }
const split = (props: Record<string, unknown>) => splitProps(props, HTML_KEYS, () => false, VARIANT_KEYS, isCssProperty)

/**
 * What actually ships: the generated `isCssProperty` is `memo`-wrapped, and a memo reads its
 * whole argument list. Every case above passes a plain predicate, which cannot see that —
 * handing the predicate straight to `filter` measured within noise here while costing ~10x
 * on this one, because the memo was hashing and keying on `(key, index, allKeys)`.
 *
 * Two prop sets alternate so a per-prop-set cache cannot look like a working one.
 */
const memoizedIsCssProperty = memo(isCssProperty)
const OTHER_PROPS = { ...PROPS, margin: '2', bg: 'red.100' }
const splitMemoized = (props: Record<string, unknown>) =>
  splitProps(props, HTML_KEYS, () => false, VARIANT_KEYS, memoizedIsCssProperty)

/** What `splitVariantProps` runs: one array group, and the only shape the project calls. */
const splitOne = (props: Record<string, unknown>) => splitProps(props, VARIANT_KEYS)

/**
 * A recipe naming more variants than the element sets. Absent keys are answered from the
 * `ownKeys` set rather than by asking the object, so this should track the two-key case
 * rather than the key count — on a proxy the difference would be six extra traps.
 */
const MANY_VARIANT_KEYS = ['size', 'tone', 'variant', 'shape', 'density', 'align', 'fit', 'elevation']
const splitMany = (props: Record<string, unknown>) => splitProps(props, MANY_VARIANT_KEYS)

describe('splitProps (one array group — what ships)', () => {
  bench('variant split (2 keys, 10 props)', () => void splitOne(PROPS), opts)
  bench('variant split (8 keys, 10 props)', () => void splitMany(PROPS), opts)

  // The shapes that take the descriptor path rather than the value path. The win is
  // smallest here: trap cost dominates, and none of it is what this path skips.
  bench('a hidden key', () => void splitOne(HIDDEN), opts)
  bench('accessor props', () => void splitOne(LAZY), opts)
  bench('proxied props', () => void splitOne(PROXIED), opts)
})

describe('splitProps (several groups — public API, no caller in project)', () => {
  bench('4 groups, 10 props', () => void split(PROPS), opts)

  bench(
    '4 groups, memoized predicate',
    () => {
      splitMemoized(PROPS)
      splitMemoized(OTHER_PROPS)
    },
    opts,
  )

  bench('4 groups, proxied props', () => void split(PROXIED), opts)
})
