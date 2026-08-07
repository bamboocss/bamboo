import { capitalize, toPx } from '@bamboocss/shared'

/**
 * A bound in CSS Media Queries Level 4 range syntax.
 *
 * The pair this replaces was `(min-width: X) and (max-width: Y')`, where `Y'` was the next
 * breakpoint stepped down by 0.04px. That step existed only because `max-width` is inclusive
 * and the legacy syntax has no inclusive/exclusive pair, and it cost two things:
 *
 * - **A dead zone.** Viewports between `Y'` and `Y` matched neither range. 0.04px is small
 *   enough to hide on the devices anyone tests on and large enough to exist.
 * - **A unit requirement.** Stepping down means arithmetic, and arithmetic needs a value that
 *   converts to pixels. A breakpoint written in `vw`, `ch`, or as a `calc()` had to be passed
 *   through unstepped, overlapping its neighbour by a whole unit — or, before that was caught,
 *   reinterpreted as pixels and shrunk by a factor of sixteen.
 *
 * `>=` with an exclusive `<` says the same thing exactly, in any unit, with no arithmetic at
 * all. The upper bound is now the neighbouring value as written.
 *
 * Range syntax needs Chrome 104+, Safari 16.4+, or Firefox 102+. Older targets need the
 * LightningCSS path, which lowers `(width < Y)` to `(not (min-width: Y))` — preserving the
 * exclusivity rather than reintroducing the step.
 */
export const rangeQuery = (feature: string, min?: string | null, max?: string | null) => {
  // Truthiness, not a null check: an empty breakpoint value survives `toRem` as `''`, and a
  // bound built from it reads `(width >= )` — which is not a media query, so the browser drops
  // the whole block. Omitting the bound leaves the range open on that side instead, and a
  // range with neither bound is dropped by the caller.
  return [min && `(${feature} >= ${min})`, max && `(${feature} < ${max})`].filter(Boolean).join(' and ')
}

export interface RangeBound {
  key: string
  /** Name in the scale this bound starts at, inclusive. */
  min?: string
  /** Name in the scale this bound stops before, exclusive. */
  max?: string
}

/**
 * The `md` / `mdOnly` / `mdDown` / `mdToXl` set over an ordered scale, as names rather than
 * values, so the caller resolves them against whatever it stores per entry.
 *
 * Shared by breakpoints and container sizes because they are one construction over two
 * features — `width` for the viewport, `inline-size` for a container. Keeping them separate is
 * how the two drifted in the first place: containers only ever got the `min` half.
 *
 * The order here is load-bearing. Every simple bound comes before every span, matching the
 * order these keys have always been generated in, because it reaches `Object.keys` on the
 * conditions map and from there the order conditions are emitted in.
 */
export const expandRange = (names: string[]): RangeBound[] => {
  const bounds = names.flatMap((name, index): RangeBound[] => [
    { key: name, min: name },
    { key: `${name}Only`, min: name, max: names[index + 1] },
    { key: `${name}Down`, max: name },
  ])

  const spans = names.flatMap((name, index): RangeBound[] =>
    names.slice(index + 1).map((other) => ({ key: `${name}To${capitalize(other)}`, min: name, max: other })),
  )

  return [...bounds, ...spans]
}

/**
 * Where a scale entry sits relative to its neighbours, in pixels where that can be known.
 *
 * This used to be `parseInt`, which reads the leading digits and ignores the unit — so `30rem`
 * sorted below `400px` on `30 < 400`, when it is half again as large. Ordering only mattered
 * for the `min` bound before, which is monotonic either way, so nothing showed. It matters now:
 * `Only` and `To` take their upper bound from the *next* entry, and a scale in the wrong order
 * produces a range whose bounds are inverted — `(width >= 30rem) and (width < 25rem)` — which
 * is valid CSS that matches no viewport at all.
 *
 * Breakpoints are protected from this by `validateBreakpoints`, which rejects a mixed-unit
 * scale. Container sizes have no such check, and this is the layer both go through.
 *
 * A unit that does not convert to pixels keeps its leading magnitude, because `50vw` cannot be
 * ordered against `40rem` without a viewport to resolve it against. Anything with no magnitude
 * at all sorts last rather than poisoning the comparison with `NaN`.
 */
const magnitude = (value: string) => {
  const pixels = Number.parseFloat(toPx(value) ?? '')
  if (Number.isFinite(pixels)) return pixels

  const leading = Number.parseFloat(value)
  return Number.isFinite(leading) ? leading : Number.POSITIVE_INFINITY
}

export const sortScale = (scale: Record<string, string>): Array<[string, string]> =>
  Object.entries(scale).sort(([nameA, a], [nameB, b]) => magnitude(a) - magnitude(b) || nameA.localeCompare(nameB))
