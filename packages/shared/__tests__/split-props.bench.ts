import { bench, describe } from 'vitest'
import { splitProps } from '../src/split-props'

/**
 * `splitProps` runs once per factory element per render, so it is on the hottest path the
 * runtime has — and nothing else here covers it.
 *
 * The shape is what a real element carries rather than a synthetic worst case: a few
 * style props, a few DOM props, and the four key groups the JSX factory passes.
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

describe('splitProps', () => {
  bench('factory split (4 groups, 10 props)', () => void split(PROPS), opts)

  // The shapes that take the descriptor path rather than the value path.
  bench('a hidden key', () => void split(HIDDEN), opts)
  bench('accessor props', () => void split(LAZY), opts)
  bench('proxied props', () => void split(PROXIED), opts)
})
