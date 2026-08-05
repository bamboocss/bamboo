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
    facts = {
      isPrint: isPrint.test(query),
      isPrintOnly: isPrintOnly.test(query),
      min: isMinWidth(query) || isMinHeight(query),
      max: isMaxWidth(query) || isMaxHeight(query),
      length: getQueryLength(query),
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
