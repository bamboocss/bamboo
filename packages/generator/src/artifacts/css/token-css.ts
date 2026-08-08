import type { Conditions, Context } from '@bamboocss/core'
import { Stylesheet, expandNestedCss, extractParentSelectors, stringify } from '@bamboocss/core'
import { logger } from '@bamboocss/logger'
import type { ConditionQuery } from '@bamboocss/types'
import postcss, { Container, CssSyntaxError } from 'postcss'

const BASE = 'base'
const OS_DARK = '_osDark'
const OS_LIGHT = '_osLight'
const OS_DARK_QUERY = '@media (prefers-color-scheme: dark)'

/** Compare a condition against a known query without tripping over spacing. */
const normalize = (condition: ConditionQuery | undefined) =>
  typeof condition === 'string' ? condition.replace(/\s+/g, ' ').trim() : undefined

/**
 * Collapse a token's `base`/`_osDark` pair into a single `light-dark()` declaration.
 *
 * Two declarations and a whole `@media (prefers-color-scheme: dark)` block become one line,
 * which for a design system carrying a few hundred `_osDark` semantic tokens is the largest
 * reduction available in this layer.
 *
 * It also makes an explicit theme toggle tractable. `_osDark` is a media query and a
 * `[data-theme=dark]` selector is not, so the two are independent mechanisms that resolve
 * against each other by source order. `light-dark()` reads `color-scheme`, which is an
 * ordinary inherited property — so a toggle is `color-scheme: dark` on a subtree rather than
 * a second copy of every token.
 *
 * A var carrying `_osLight` as well is left alone. Folding it would put the light arm of
 * `light-dark()` and an `@media (prefers-color-scheme: light)` block in play for the same
 * var, where the block wins on order and the arm is simply dead. Three-way tokens keep the
 * mechanism they already had.
 *
 * `view.vars` is shared with the JS theme artifacts, so this copies rather than mutates.
 */
function foldLightDark(vars: Map<string, Map<string, string>>, conditions: Conditions) {
  const base = vars.get(BASE)
  const osDark = vars.get(OS_DARK)
  if (!base || !osDark) return { vars, folded: false }

  // `_osDark` is a configurable condition, not a keyword. Someone can point it at a selector
  // -- `[data-os=dark] &` -- and `light-dark()` cannot express that, so it is only safe to
  // fold once the condition is confirmed to be the media query it is named after. Under
  // `eject` it resolves to nothing at all.
  if (normalize(conditions.get(OS_DARK)) !== OS_DARK_QUERY) return { vars, folded: false }

  const osLight = vars.get(OS_LIGHT)
  const nextBase = new Map(base)
  const nextDark = new Map(osDark)

  for (const [name, darkValue] of osDark) {
    const lightValue = base.get(name)
    if (lightValue === undefined || osLight?.has(name)) continue
    nextBase.set(name, `light-dark(${lightValue}, ${darkValue})`)
    nextDark.delete(name)
  }

  if (nextDark.size === osDark.size) return { vars, folded: false }

  const next = new Map(vars)
  next.set(BASE, nextBase)
  if (nextDark.size) next.set(OS_DARK, nextDark)
  else next.delete(OS_DARK)

  return { vars: next, folded: true }
}

export function generateTokenCss(ctx: Context, sheet: Stylesheet) {
  const { config, conditions, tokens } = ctx
  const { cssVarRoot, staticCss } = config

  const root = cssVarRoot!

  const results: string[] = []

  const { vars: tokenVars, folded } = foldLightDark(tokens.view.vars, conditions)

  /**
   * `light-dark()` returns the light value unless `color-scheme` names both, and a stylesheet
   * that never sets it looks exactly like one where dark mode is broken. This rides with the
   * tokens rather than the reset because it is a prerequisite of the declarations above it,
   * and the reset can be turned off with `preflight: false`. `:where()` keeps it at zero
   * specificity, so `color-scheme: dark` on any subtree still wins.
   */
  if (folded) {
    results.push(stringify({ [root]: { colorScheme: 'light dark' } }))
  }

  const allowed = staticCss?.themes
  let themeVariants: string[] = []

  // Skip theme tokens if they're not explicitly listed in the `staticCss.themes` array
  if (allowed) {
    const keys = Object.keys(config.themes ?? {})
    themeVariants = allowed.includes('*') ? keys : keys.filter((key) => allowed.includes(key))
  }

  const themeConds = themeVariants.map((key) => conditions.getThemeName(key))
  const themePrefix = ctx.conditions.getThemeName('')

  for (const [key, values] of tokenVars.entries()) {
    const isThemeSkipped =
      key.startsWith(themePrefix) && !themeConds.some((condName) => key === condName || key.startsWith(condName + ':'))
    if (isThemeSkipped) {
      continue
    }

    const css = stringifyVars({ values, conditionKey: key, root: root, conditions })
    if (css) {
      results.push(css)
    }
  }

  let css = results.join('\n\n')
  css = '\n\n' + cleanupSelectors(css, root)

  if (ctx.hooks['cssgen:done']) {
    css = ctx.hooks['cssgen:done']({ artifact: 'tokens', content: css }) ?? css
  }

  sheet.layers.tokens.append(css)
}

export function stringifyVars(options: {
  conditionKey: string
  values: Map<string, string>
  root: string
  conditions: Conditions
}) {
  const { conditionKey, values, root, conditions } = options

  const varsObj = Object.fromEntries(values)
  if (Object.keys(varsObj).length === 0) return

  if (conditionKey === 'base') {
    return stringify({ [root]: varsObj })
  }

  // nested conditionals in semantic tokens are joined by ":", so let's split it
  const keys = conditionKey.split(':')

  // if any part of the condition is missing, skip
  if (keys.some((key) => !conditions.get(key))) return

  const css = stringify(varsObj)

  // Each chained condition contributes one or more selector paths.
  // String/array conditions yield a single path; multi-block (object)
  // conditions yield one path per `@slot` leaf. The final rules are the
  // cartesian product of paths across the chain.
  const altsPerKey = keys.map((key) => getSelectorPaths(conditions.get(key)))
  if (altsPerKey.some((alts) => alts.length === 0)) return

  let combos: string[][] = [[]]
  for (const alts of altsPerKey) {
    const next: string[][] = []
    for (const partial of combos) {
      for (const alt of alts) {
        next.push([...partial, ...alt])
      }
    }
    combos = next
  }

  const rules = combos
    .map((segments) => {
      const transformed = segments.map(transformSegment).filter(Boolean) as string[]
      const rule = getDeepestRule(root, transformed)
      if (!rule) return
      getDeepestNode(rule)?.append(css)
      return expandNestedCss(rule.toString())
    })
    .filter(Boolean) as string[]

  return rules.length ? rules.join('\n\n') : undefined
}

/**
 * Convert a condition value into one or more selector paths.
 * - string: one path with one segment
 * - array (mixed): one path with the last segment (preserves prior behavior)
 * - object (multi-block): one path per `@slot` leaf, with the full segment chain
 */
function getSelectorPaths(condition: ConditionQuery | undefined): string[][] {
  if (condition == null) return []
  if (typeof condition === 'string') return [[condition]]
  if (Array.isArray(condition)) {
    const last = condition.at(-1)
    return last ? [[last]] : []
  }
  const paths: string[][] = []
  const walk = (node: Record<string, any>, path: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (value === '@slot') {
        paths.push([...path, key])
      } else if (typeof value === 'object' && value !== null) {
        walk(value, [...path, key])
      }
    }
  }
  walk(condition as Record<string, any>, [])
  return paths
}

/**
 * Apply the existing parent-selector transform to selector segments.
 * At-rules pass through untouched so `getDeepestRule` can wrap them.
 * ASSUMPTION: the nature of parent selectors with tokens is that they're merged
 * (e.g. `[data-color-mode=dark][data-theme=pastel]`). Removing the `&` keeps
 * sibling selectors flat instead of nested.
 */
function transformSegment(seg: string): string {
  if (seg.startsWith('@')) return seg
  const parent = extractParentSelectors(seg)
  return parent ? `&${parent}` : seg
}

/**
 * Build the nesting chain for one condition path.
 *
 * The outermost node is a `Root`, so the first segment has no enclosing rule and
 * its `&` refers to nothing — it is resolved away here rather than by
 * postcss-nested. Deeper segments keep their `&` and nest against the real
 * parent selector as before.
 *
 * This used to be seeded with an empty-selector rule and leaned on
 * postcss-nested to erase `&` against it. postcss 8.5.25 ("Fixed 8.5.17 visitor
 * regression") changed that edge case to collapse the whole selector, so every
 * conditional token was emitted as a selectorless — and therefore discarded —
 * rule, leaving only the `base` value in the tokens layer.
 */
function getDeepestRule(root: string, selectors: string[]) {
  const container = postcss.root()

  for (const selector of selectors) {
    const node = getDeepestNode(container)
    const isTopLevel = node === container
    if (selector.startsWith('@')) {
      // ASSUMPTION: the nature of parent selectors with tokens is that they're merged
      // [data-color-mode=dark][data-theme=pastel]
      // If we really want it nested, we remove the `&`
      const inner = isTopLevel ? root : `${root}&`
      const atRule = postcss.rule({ selector, nodes: [postcss.rule({ selector: inner })] })
      node.append(atRule)
    } else {
      node.append(postcss.rule({ selector: isTopLevel ? withoutParentSelector(selector) : selector }))
    }
  }

  return container
}

function withoutParentSelector(selector: string) {
  return selector.replaceAll('&', '').trim()
}

function getDeepestNode<T extends Container>(node: T): Container {
  if (node.nodes && node.nodes.length) {
    return getDeepestNode(node.nodes[node.nodes.length - 1] as Container)
  }
  return node
}

const parse = (str: string) => {
  try {
    return postcss.parse(str)
  } catch (error) {
    if (error instanceof CssSyntaxError) {
      logger.error('tokens:process', error.showSourceCode(true))
    } else {
      logger.caughtError('tokens:process', 'Failed to parse token CSS', error)
    }
  }
}

export function cleanupSelectors(css: string, varSelector: string) {
  // Ignore if invalid CSS
  const root = parse(css) ?? postcss.root()

  root.walkRules((rule) => {
    // [':root', ' :host,', '  ::backdrop ']
    const selectors = [] as string[]
    rule.selectors.forEach((selector) => {
      selectors.push(selector.trim())
    })

    // ':root, :host, ::backdrop'
    const ruleSelector = selectors.join(', ')
    if (ruleSelector === varSelector) {
      return
    }

    // ':root,:host,::backdrop'
    const trimmedSelector = selectors.join(',')
    if (trimmedSelector === varSelector) {
      return
    }

    const selectorsWithoutVarRoot = selectors
      .map((selector) => {
        const res = selector.split(varSelector).filter(Boolean)
        return res.join('')
      })
      .filter(Boolean)
    if (selectorsWithoutVarRoot.length === 0) return
    rule.selector = selectorsWithoutVarRoot.join(', ')
  })

  return root.toString()
}
