import type { Theme } from '@bamboocss/types'
import type { AddError } from '../types'

/**
 * The unit a breakpoint is written in, whatever unit that is.
 *
 * This used to ask `getUnit`, which only reports the three units bamboo converts between and
 * answers `undefined` for everything else — so the check fell back to `px` and read `40EM`,
 * `50vw` and `30ch` as pixels alike. A theme mixing `em` and `vw` passed, and one written
 * entirely in `EM` passed by being classified as something it is not.
 *
 * Read generically instead: the trailing letters, lower-cased. A unitless value keeps the
 * `px` default, since `0` and `640` are pixels by convention here.
 */
const unitOf = (value: string) =>
  String(value)
    .trim()
    .match(/[a-z%]+$/i)?.[0]
    ?.toLowerCase() ?? 'px'

export const validateBreakpoints = (breakpoints: Theme['breakpoints'], addError: AddError) => {
  if (!breakpoints) return

  const units = new Set<string>()

  const values = Object.values(breakpoints)

  for (const value of values) {
    units.add(unitOf(value))
  }

  if (units.size > 1) {
    addError('breakpoints', `All breakpoints must use the same unit: \`${values.join(', ')}\``)
  }
}
