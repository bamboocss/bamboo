// ----------------------------------------
// Private
// ----------------------------------------

const minMaxWidth = /(!?\(\s*min(-device-)?-width)(.|\n)+\(\s*max(-device)?-width/i
const minWidth = /\(\s*min(-device)?-width/i
const maxMinWidth = /(!?\(\s*max(-device)?-width)(.|\n)+\(\s*min(-device)?-width/i
const maxWidth = /\(\s*max(-device)?-width/i

const isMinWidth = _testQuery(minMaxWidth, maxMinWidth, minWidth)
const isMaxWidth = _testQuery(maxMinWidth, minMaxWidth, maxWidth)

const minMaxHeight = /(!?\(\s*min(-device)?-height)(.|\n)+\(\s*max(-device)?-height/i
const minHeight = /\(\s*min(-device)?-height/i
const maxMinHeight = /(!?\(\s*max(-device)?-height)(.|\n)+\(\s*min(-device)?-height/i
const maxHeight = /\(\s*max(-device)?-height/i

const isMinHeight = _testQuery(minMaxHeight, maxMinHeight, minHeight)
const isMaxHeight = _testQuery(maxMinHeight, minMaxHeight, maxHeight)

const isPrint = /print/i
const isPrintOnly = /^print$/i

const maxValue = Number.MAX_VALUE

/**
 * How many pixels one unit is worth.
 *
 * The absolute units are exact. The font-relative ones resolve against the 16px root this file
 * has always assumed; `ex` and `ch` keep the exact constants inherited from
 * `sort-css-media-queries`, because they are font metrics rather than derivations and changing
 * them would reorder stylesheets that sort correctly today. `cap`, `ic` and `lh` are
 * approximations of the same kind — they resolve against metrics no build step can read, and a
 * query using one still has to land somewhere deterministic.
 */
const pxPerUnit = new Map<string, number>([
  // Absolute
  ['px', 1],
  ['in', 96],
  ['pc', 16],
  ['pt', 96 / 72],
  ['cm', 96 / 2.54],
  ['mm', 96 / 25.4],
  ['q', 96 / 25.4 / 4],
  // Font-relative, against a 16px root
  ['em', 16],
  ['rem', 16],
  ['ex', 8.296875],
  ['rex', 8.296875],
  ['ch', 8.8984375],
  ['rch', 8.8984375],
  ['ic', 16],
  ['ric', 16],
  ['cap', 11.2],
  ['rcap', 11.2],
  ['lh', 19.2],
  ['rlh', 19.2],
])

/**
 * Units that are a percentage of something this code cannot know — the viewport for `vw` and
 * its siblings, the query container for `cq*`.
 *
 * There is no pixel value to compare one against a breakpoint written in `px`, so rather than
 * inventing a reference viewport, each family is ordered within itself and placed after
 * everything that does resolve to a length. `20vw` and `100vw` then sort the way their numbers
 * say, which is the whole requirement; where the family sits relative to a `px` breakpoint is
 * arbitrary under any scheme, and under this one it is at least stable.
 *
 * The bases sit far above any real breakpoint and far below `maxValue`, which stays reserved
 * for "no length in this query at all".
 */
const viewportUnit = /^[sld]?v(?:w|h|i|b|min|max)$/
const containerUnit = /^cq(?:w|h|i|b|min|max)$/
const viewportBase = 1e9
const containerBase = 2e9

/** A number and the unit stuck to it, scanned in order so the first real length wins. */
const lengthToken = /(-?\d*\.?\d+)([a-z]*)/gi

/**
 * Obtain the length of the media request in pixels.
 * Copy from original source `function inspectLength (length)`
 *
 * Units are looked up rather than matched by an alternation. The alternation this replaces
 * listed `ch|em|ex|px|rem` and fell back to `/(\d)/` — a single digit — for everything else, so
 * `(min-width: 100vw)` scored 1 and sorted ahead of `(min-width: 20vw)`, and `(min-width:
 * 100cqw)` ahead of `(min-width: 20cqw)`. For mobile-first `min-` queries that is the reverse
 * of the order the cascade needs, so the wider breakpoint lost to the narrower one at every
 * viewport where both applied. It covered every viewport and container unit — which is to say
 * every unit a container query is likely to be written in.
 */
function getQueryLength(query: string) {
  lengthToken.lastIndex = 0

  let token: RegExpExecArray | null
  while ((token = lengthToken.exec(query)) !== null) {
    const value = parseFloat(token[1])
    const unit = token[2].toLowerCase()

    // Zero is the one length CSS spells without a unit. Any other bare number belongs to a
    // feature that is not a length — `(-webkit-min-device-pixel-ratio: 2)`, `(min-monochrome: 8)`
    // — and reading one as a length is how the digit fallback used to score a query by its
    // device-pixel ratio.
    if (unit === '') {
      if (value === 0) return 0
      continue
    }

    const px = pxPerUnit.get(unit)
    if (px !== undefined) return value * px

    if (viewportUnit.test(unit)) return viewportBase + value
    if (containerUnit.test(unit)) return containerBase + value

    // A unit this does not know: `dpi`, `dppx`, `x`, or one CSS has not shipped yet. Keep
    // scanning, because a query that mixes one with a real length still has a length to sort on.
  }

  return maxValue
}

/**
 * Wrapper for creating test functions
 * @private
 * @param {RegExp} doubleTestTrue
 * @param {RegExp} doubleTestFalse
 * @param {RegExp} singleTest
 * @return {Function}
 */
function _testQuery(doubleTestTrue: RegExp, doubleTestFalse: RegExp, singleTest: RegExp) {
  /**
   * @param {string} query
   * @return {boolean}
   */
  return function (query: string) {
    if (doubleTestTrue.test(query)) {
      return true
    } else if (doubleTestFalse.test(query)) {
      return false
    }
    return singleTest.test(query)
  }
}

// ----------------------------------------
// Range syntax
// ----------------------------------------

/**
 * Media Queries Level 4 range syntax, rewritten to the `min-`/`max-` form everything above
 * reads.
 *
 * The classification is a pile of regexes asking which bound a query carries and which one
 * comes first, and every one of them looks for a literal `min-width` or `max-width`.
 * `(width >= 40rem)` carries a lower bound and matches none of them, so it would classify as
 * neither — and that split is precisely what orders a range against its neighbours: it is the
 * reason `mdDown` sorts after `md` instead of the two being ranked by length, and the reason
 * every `max` bound sorts descending. Emitting range syntax without teaching the sorter to
 * read it does not drop rules; it emits them in an order where an override lands before the
 * rule it overrides, which is the kind of thing that shows up as one wrong colour at one
 * viewport.
 *
 * Rewriting once, rather than duplicating six regexes in a second dialect, keeps a single
 * definition of "which bound comes first". The result is fed only to the tests and the length
 * parse — nothing emits it.
 *
 * `inline-size` and `block-size` fold into `width` and `height` so container queries keep
 * classifying the way they did when they were written as `(min-width: …)`.
 */
const rangeFeature = 'width|height|inline-size|block-size'
/** Anything but a paren or a comparison operator, plus `calc()`-style groups one level deep. */
const rangeValue = '(?:[^()<>=]|\\([^()]*\\))+?'

const doubleEndedRange = new RegExp(
  `\\(\\s*(${rangeValue})\\s*([<>]=?)\\s*(${rangeFeature})\\s*[<>]=?\\s*(${rangeValue})\\s*\\)`,
  'gi',
)
const featureFirstRange = new RegExp(`\\(\\s*(${rangeFeature})\\s*([<>]=?)\\s*(${rangeValue})\\s*\\)`, 'gi')
const valueFirstRange = new RegExp(`\\(\\s*(${rangeValue})\\s*([<>]=?)\\s*(${rangeFeature})\\s*\\)`, 'gi')

const legacyFeature = (feature: string) => {
  const name = feature.toLowerCase()
  if (name === 'inline-size') return 'width'
  if (name === 'block-size') return 'height'
  return name
}

const bound = (feature: string, side: 'min' | 'max', value: string) =>
  `(${side}-${legacyFeature(feature)}: ${value.trim()})`

function toLegacyRanges(query: string) {
  if (!query.includes('<') && !query.includes('>')) return query

  return query
    .replace(doubleEndedRange, (_match, first: string, op: string, feature: string, second: string) => {
      // A double-ended range is a min-bounded range whichever way it is written, so the lower
      // bound is emitted first either way — `(a <= width < b)` and `(b > width >= a)` are one range.
      const [lower, upper] = op.startsWith('<') ? [first, second] : [second, first]
      return `${bound(feature, 'min', lower)} and ${bound(feature, 'max', upper)}`
    })
    .replace(featureFirstRange, (_match, feature: string, op: string, value: string) =>
      bound(feature, op.startsWith('>') ? 'min' : 'max', value),
    )
    .replace(valueFirstRange, (_match, value: string, op: string, feature: string) =>
      bound(feature, op.startsWith('<') ? 'min' : 'max', value),
    )
}

interface QueryFacts {
  isPrint: boolean
  isPrintOnly: boolean
  min: boolean
  max: boolean
  length: number
}

/**
 * Everything the comparator needs to know about one query, derived once per distinct string.
 *
 * `sortCSSmq` is a comparator, so a sort of N rules calls it on the order of N log N times —
 * and each call ran six regexes and a length parse over each of its two operands. The strings
 * come from the config's conditions, so a build sorting thousands of rules asks the same
 * handful of questions about the same handful of queries tens of thousands of times.
 *
 * These are pure functions of the string, so caching them cannot change a comparison's result
 * and the sorted order is identical. The cache is keyed on the query text rather than on the
 * rule, because two rules carrying the same breakpoint should share the entry.
 *
 * Bounded because the PostCSS `sort-mq` plugin feeds it `params` from whatever stylesheet it
 * is given, rather than only the conditions this config declared. The ceiling is far above any
 * real project's distinct at-rule count, so it exists to stop a pathological input growing the
 * map without limit in a watch process, not as an eviction policy anything should reach.
 */
const factsCache = new Map<string, QueryFacts>()

const factsOf = (query: string): QueryFacts => {
  let facts = factsCache.get(query)
  if (facts === undefined) {
    const legacy = toLegacyRanges(query)
    facts = {
      isPrint: isPrint.test(legacy),
      isPrintOnly: isPrintOnly.test(legacy),
      min: isMinWidth(legacy) || isMinHeight(legacy),
      max: isMaxWidth(legacy) || isMaxHeight(legacy),
      length: getQueryLength(legacy),
    }
    if (factsCache.size > 4096) factsCache.clear()
    factsCache.set(query, facts)
  }
  return facts
}

/**
 * @private
 * @param {string} a
 * @param {string} b
 * @return {number|null}
 */
function _testIsPrint(a: string, b: string, aFacts: QueryFacts, bFacts: QueryFacts) {
  const isPrintA = aFacts.isPrint
  const isPrintOnlyA = aFacts.isPrintOnly

  const isPrintB = bFacts.isPrint
  const isPrintOnlyB = bFacts.isPrintOnly

  if (isPrintA && isPrintB) {
    if (!isPrintOnlyA && isPrintOnlyB) {
      return 1
    }
    if (isPrintOnlyA && !isPrintOnlyB) {
      return -1
    }
    return a.localeCompare(b)
  }
  if (isPrintA) {
    return 1
  }
  if (isPrintB) {
    return -1
  }

  return null
}

// ----------------------------------------
// Public
// ----------------------------------------

function createSort(config: { unitlessMqAlwaysFirst?: boolean } = {}) {
  const { unitlessMqAlwaysFirst } = config

  return function sortCSSmq(a: string, b: string) {
    const aFacts = factsOf(a)
    const bFacts = factsOf(b)

    const testIsPrint = _testIsPrint(a, b, aFacts, bFacts)
    if (testIsPrint !== null) {
      return testIsPrint
    }

    const minA = aFacts.min
    const maxA = aFacts.max

    const minB = bFacts.min
    const maxB = bFacts.max

    if (unitlessMqAlwaysFirst && ((!minA && !maxA) || (!minB && !maxB))) {
      if (!minA && !maxA && !minB && !maxB) {
        return a.localeCompare(b)
      }
      return !minB && !maxB ? 1 : -1
    } else {
      if (minA && maxB) {
        return -1
      }
      if (maxA && minB) {
        return 1
      }

      const lengthA = aFacts.length
      const lengthB = bFacts.length

      if (lengthA === maxValue && lengthB === maxValue) {
        return a.localeCompare(b)
      } else if (lengthA === maxValue) {
        return 1
      } else if (lengthB === maxValue) {
        return -1
      }

      if (lengthA > lengthB) {
        if (maxA) {
          return -1
        }
        return 1
      }

      if (lengthA < lengthB) {
        if (maxA) {
          return 1
        }
        return -1
      }

      return a.localeCompare(b)
    }
  }
}

export const sortAtRules = createSort()
