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
 * Obtain the length of the media request in pixels.
 * Copy from original source `function inspectLength (length)`
 */
function getQueryLength(query: string) {
  let length = /(-?\d*\.?\d+)(ch|em|ex|px|rem)/.exec(query)

  if (length === null && (isMinWidth(query) || isMinHeight(query))) {
    length = /(\d)/.exec(query)
  }

  //@ts-expect-error - will fix later
  if (length === '0') {
    return 0
  }

  if (length === null) {
    return maxValue
  }

  let number: string | number = length[1]
  const unit = length[2]

  switch (unit) {
    case 'ch':
      number = parseFloat(number) * 8.8984375
      break

    case 'em':
    case 'rem':
      number = parseFloat(number) * 16
      break

    case 'ex':
      number = parseFloat(number) * 8.296875
      break

    case 'px':
      number = parseFloat(number)
      break
  }

  return +number
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
