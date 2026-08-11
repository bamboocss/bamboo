import { cssVarRefs } from '@bamboocss/shared'
import type { AtRule, Container } from 'postcss'

interface PruneKeyframesOptions {
  /**
   * Everything that can reference an animation: the utility, recipe, reset, base and
   * composition layers, and the token layer, which is where `@keyframes` itself lands.
   */
  scan: Container[]
  /** The container holding the `@keyframes` rules, the only place they are removed from. */
  target: Container
  /**
   * Every keyframe the theme declares. Nothing outside this set is ever removed, so a
   * `@keyframes` emitted by `globalCss` is left alone.
   */
  keyframeNames: Set<string>
  /**
   * Names to keep regardless of what the css references, covering what this pass cannot
   * see: an animation assembled at runtime, or one applied through an inline `style`
   * rather than through bamboo.
   */
  keep?: Set<string>
  /**
   * The custom properties that survive into the shipped stylesheet — `pruneTokenVars`'
   * own answer, handed over rather than recomputed.
   *
   * A custom property is reachable for two reasons this pass cannot see from the css. It
   * may be rooted *outside* the sheet — a `token()` call, a `prune.keepTokens` pattern, a
   * theme artifact injected at runtime, a `globalCss` declaration exported for something
   * else to read — or it may simply not be the token system's to remove. Either way the
   * declaration ships, so the keyframe it names has to ship with it.
   *
   * Reading only the `var()` references in the css gives the weaker answer, and the gap
   * between the two is a live bug rather than a missed optimisation: the token pass keeps
   * `--animations-drawer-in-right: slide-in-right 400ms`, this pass finds nothing pointing
   * at that property, and `@keyframes slide-in-right` is deleted out from under a
   * declaration that is still there. Nothing reports it — the stylesheet is valid and the
   * animation simply never plays.
   *
   * `'all'` is what "no token pass ran" means, rather than a missing answer: nothing was
   * removed, so every declaration in the sheet ships, so every keyframe one of them names
   * ships with it. Undefined trusts the css alone, which is only ever right for a caller
   * that knows no custom property outlives what references it.
   */
  reachableVars?: Set<string> | 'all'
}

/**
 * Properties whose value can name a keyframe.
 *
 * Custom properties are included because they are the indirection carrier: `--enter:
 * fade-in 1s` followed by `animation: var(--enter)` puts the name somewhere no
 * animation property can be seen holding it. There are few enough of them that scanning
 * all of them is cheaper than reasoning about which ones matter.
 */
const isAnimationProperty = (prop: string) => prop.startsWith('--') || prop.toLowerCase().includes('animation')

const NAME_SEPARATOR = /[\s,()]+/

/**
 * `animation-name` accepts `<custom-ident> | <string>`, so `animation-name: "fade-in"`
 * names the same keyframe as the bare form and has to match it.
 */
const unquote = (token: string) => token.replace(/^['"]|['"]$/g, '')

const namesIn = (value: string, keyframeNames: Set<string>) => {
  const found: string[] = []
  for (const token of value.split(NAME_SEPARATOR)) {
    const name = unquote(token)
    if (keyframeNames.has(name)) found.push(name)
  }
  return found
}

/**
 * Remove `@keyframes` rules nothing can reach.
 *
 * Names are recovered by tokenizing the value and testing each token against the set of
 * declared keyframes, rather than by parsing the `animation` shorthand. The shorthand
 * interleaves durations, easings, directions and the name in any order, and a partial
 * grammar that mis-reads one of them would drop an animation that is genuinely used. The
 * cost of the loose approach is a keyframe named after a keyword — `none`, `ease`,
 * `running` — always looking referenced, which errs toward keeping.
 *
 * Only ever run this over a complete stylesheet, for the same reason as `pruneTokenVars`:
 * a partial one carries no utilities to reference anything, so every keyframe would look
 * unused.
 */
export function pruneKeyframes(options: PruneKeyframesOptions) {
  const { scan, target, keyframeNames, keep, reachableVars } = options
  if (!keyframeNames.size) return { removed: 0, kept: 0 }

  const referenced = new Set<string>(keep)

  // A name found in an ordinary declaration reaches its keyframe directly. A name found
  // in a custom property's value only reaches it if that property is itself reachable,
  // so those are held back for the closure below. Counting them up front is what makes
  // the pass useless in practice: a preset declares `--animations-spin: spin 1s linear
  // infinite` whether or not anything uses that token, and reading it as a reference
  // keeps every keyframe the preset ships.
  //
  // Which is why `reachableVars` is a set of *survivors* and not a second scan. It says
  // which of those declarations are still standing after the token pass, so an animation
  // token nothing uses still takes its keyframe with it, and one kept alive by a reader
  // outside the sheet keeps its keyframe too.
  const byCustomProperty = new Map<string, Set<string>>()
  /** Custom property -> the custom properties its value reads through `var()`. */
  const varEdges = new Map<string, Set<string>>()
  const varQueue: string[] = []

  /** Custom properties this walk has rooted, whether from `reachableVars` or from the css. */
  const visited = new Set<string>()

  const visitVar = (name: string) => {
    if (visited.has(name)) return
    visited.add(name)
    varQueue.push(name)
  }

  // Seeded before the walk, so a surviving property's own `var()` edges are followed too:
  // `--enter: var(--drawer-in)` and `--drawer-in: slide-in-right 400ms` is one chain, and
  // rooting only the head of it strands the tail exactly as before.
  if (reachableVars && reachableVars !== 'all') reachableVars.forEach(visitVar)

  for (const container of scan) {
    container.walkDecls((decl) => {
      const isCustomProperty = decl.prop.startsWith('--')

      if (!isCustomProperty) {
        for (const name of cssVarRefs(decl.value)) visitVar(name)
        if (!isAnimationProperty(decl.prop)) return

        for (const name of namesIn(decl.value, keyframeNames)) referenced.add(name)
        return
      }

      if (reachableVars === 'all') visitVar(decl.prop)

      for (const name of namesIn(decl.value, keyframeNames)) {
        let names = byCustomProperty.get(decl.prop)
        if (!names) byCustomProperty.set(decl.prop, (names = new Set()))
        names.add(name)
      }

      for (const name of cssVarRefs(decl.value)) {
        let edges = varEdges.get(decl.prop)
        if (!edges) varEdges.set(decl.prop, (edges = new Set()))
        edges.add(name)
      }
    })
  }

  while (varQueue.length) {
    varEdges.get(varQueue.pop()!)?.forEach(visitVar)
  }

  for (const property of visited) {
    byCustomProperty.get(property)?.forEach((name) => referenced.add(name))
  }

  let removed = 0

  target.walkAtRules((rule) => {
    if (!isKeyframesRule(rule)) return

    const name = rule.params.trim()
    if (!keyframeNames.has(name) || referenced.has(name)) return

    rule.remove()
    removed++
  })

  return { removed, kept: keyframeNames.size - removed }
}

/**
 * Matches the prefixed spellings too, since a preset may emit `@-webkit-keyframes`
 * alongside the standard rule and leaving half the pair behind is worse than leaving
 * both.
 */
const isKeyframesRule = (rule: AtRule) => rule.name.toLowerCase().endsWith('keyframes')
