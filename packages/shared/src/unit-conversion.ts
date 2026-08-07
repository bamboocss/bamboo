const BASE_FONT_SIZE = 16

const UNIT_PX = 'px'
const UNIT_EM = 'em'
const UNIT_REM = 'rem'

/**
 * A value that is *entirely* a number followed by a unit these functions can convert.
 *
 * Both halves of that matter, and each was wrong:
 *
 * - **Anchored.** The pattern used to match anywhere in the string, so `calc(2rem + 3px)`
 *   reported `rem` from inside the expression and the conversion then ran `parseFloat` over
 *   the whole thing — `NaN`. A breakpoint written that way reached the stylesheet as
 *   `min-width: NaNrem`, which is not a media query.
 * - **Case-insensitive.** CSS units are, and `40EM` is as valid as `40em`. Reporting no unit
 *   for it meant the value was passed through and then read as a *pixel* count, so a
 *   breakpoint of `50EM` produced `max-width: 3.1225rem` instead of `49.9975rem` — a factor
 *   of sixteen, and a range that matches nothing rather than one that looks wrong.
 *
 * The number accepts what CSS accepts: a leading sign, a bare fraction (`.5rem`), and an
 * exponent (`1e3px`).
 */
const VALUE_REGEX = /^\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(px|em|rem)\s*$/i

/** The unit, lower-cased, or nothing when the value is not a plain number and unit. */
export function getUnit(value: string | number = ''): string | undefined {
  return String(value).match(VALUE_REGEX)?.[2]?.toLowerCase()
}

/**
 * The numeric half, or nothing when there is not one.
 *
 * Read from the match rather than by running `parseFloat` over the raw value, which returns
 * a number for plenty of strings that are not one — `parseFloat('50vw')` is `50`, and
 * treating that as pixels is how a `vw` breakpoint became a sixteenth of itself.
 */
const amountOf = (value: string | number) => {
  const match = String(value).match(VALUE_REGEX)
  return match ? Number.parseFloat(match[1]!) : undefined
}

export function toPx(value: string | number = ''): string | undefined {
  if (typeof value === 'number') {
    return `${value}px`
  }

  const unit = getUnit(value)

  if (!unit) return value

  if (unit === UNIT_PX) {
    return value
  }

  const amount = amountOf(value)
  if (amount === undefined) return value

  return `${amount * BASE_FONT_SIZE}${UNIT_PX}`
}

export function toEm(value: string | number = '', fontSize = BASE_FONT_SIZE): string | undefined {
  const unit = getUnit(value)

  if (!unit) return String(value)

  if (unit === UNIT_EM) {
    return String(value)
  }

  const amount = amountOf(value)
  if (amount === undefined) return String(value)

  if (unit === UNIT_PX) {
    return `${amount / fontSize}${UNIT_EM}`
  }

  return `${(amount * BASE_FONT_SIZE) / fontSize}${UNIT_EM}`
}

export function toRem(value: string | number = ''): string | undefined {
  const unit = getUnit(value)

  if (!unit) return String(value)

  if (unit === UNIT_REM) {
    return String(value)
  }

  const amount = amountOf(value)
  if (amount === undefined) return String(value)

  if (unit === UNIT_EM) {
    return `${amount}${UNIT_REM}`
  }

  return `${amount / BASE_FONT_SIZE}${UNIT_REM}`
}
