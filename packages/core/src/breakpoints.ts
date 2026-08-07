import { toRem } from '@bamboocss/shared'
import type { AtRuleCondition, ConditionDetails } from '@bamboocss/types'
import type { Root } from 'postcss'
import { expandRange, rangeQuery, sortScale } from './range-query'

export class Breakpoints {
  sorted: ReturnType<typeof sortBreakpoints>
  values: Record<string, BreakpointEntry>
  keys: string[]
  ranges: Record<string, string>
  conditions: Record<string, AtRuleCondition>

  constructor(private breakpoints: Record<string, string>) {
    this.sorted = sortBreakpoints(breakpoints)
    this.values = Object.fromEntries(this.sorted)
    this.keys = ['base', ...Object.keys(this.values)]
    this.ranges = this.getRanges()
    this.conditions = this.getConditions()
  }

  get = (name: string) => {
    return this.values[name]
  }

  build = ({ min, max }: { min?: string | null; max?: string | null }) => {
    return rangeQuery('width', min, max)
  }

  only = (name: string) => {
    const { min, max } = this.get(name)
    return this.build({ min, max })
  }

  private getRanges = () => {
    const values = expandRange(Object.keys(this.values))
      .map(({ key, min, max }): [string, string] => [
        key,
        this.build({ min: min && this.get(min).min, max: max && this.get(max).min }),
      ])
      .filter(([, value]) => value !== '')

    return Object.fromEntries(values)
  }

  private getConditions = () => {
    const values = Object.entries(this.ranges).map(([key, value]) => {
      return [key, toCondition(key, value)]
    })

    return Object.fromEntries(values)
  }

  getCondition = (key: string): ConditionDetails | undefined => {
    return this.conditions[key]
  }

  expandScreenAtRule = (root: Root) => {
    root.walkAtRules('breakpoint', (rule) => {
      const value = this.getCondition(rule.params)
      if (!value) {
        throw rule.error(`No \`${rule.params}\` screen found.`)
      }
      if (value.type !== 'at-rule') {
        throw rule.error(`\`${rule.params}\` is not a valid screen.`)
      }

      rule.name = 'media'
      rule.params = value.params
    })
  }
}

type BreakpointEntry = { name: string; min?: string | null; max?: string | null }
type Entries = [string, BreakpointEntry][]

/**
 * `max` is the neighbouring breakpoint as written, and is exclusive.
 *
 * It used to be that value stepped down by 0.04px, so that the inclusive `max-width` it fed
 * stopped just short of the next range. Nothing steps down any more — `(width < max)` excludes
 * the bound itself — so the two halves of a range meet exactly, and a breakpoint in a unit the
 * old arithmetic could not convert (`vw`, `ch`, a `calc()`) is no longer a special case.
 */
function sortBreakpoints(breakpoints: Record<string, string>): Entries {
  return sortScale(breakpoints).map(([name, min], index, entries) => {
    const max = entries[index + 1]?.[1]
    return [name, { name, min: toRem(min), max: max == null ? max : toRem(max) }]
  })
}

const toCondition = (key: string, value: string): AtRuleCondition => ({
  type: 'at-rule',
  name: 'breakpoint',
  value: key,
  raw: `@media ${value}`,
  params: value,
})
