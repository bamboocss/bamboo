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
  const { scan, target, keyframeNames, keep } = options
  if (!keyframeNames.size) return { removed: 0, kept: 0 }

  const referenced = new Set<string>(keep)

  // A name found in an ordinary declaration reaches its keyframe directly. A name found
  // in a custom property's value only reaches it if that property is itself reachable,
  // so those are held back for the closure below. Counting them up front is what makes
  // the pass useless in practice: a preset declares `--animations-spin: spin 1s linear
  // infinite` whether or not anything uses that token, and reading it as a reference
  // keeps every keyframe the preset ships.
  const byCustomProperty = new Map<string, Set<string>>()
  /** Custom property -> the custom properties its value reads through `var()`. */
  const varEdges = new Map<string, Set<string>>()
  const reachableVars = new Set<string>()
  const varQueue: string[] = []

  const visitVar = (name: string) => {
    if (reachableVars.has(name)) return
    reachableVars.add(name)
    varQueue.push(name)
  }

  for (const container of scan) {
    container.walkDecls((decl) => {
      const isCustomProperty = decl.prop.startsWith('--')

      if (!isCustomProperty) {
        for (const name of cssVarRefs(decl.value)) visitVar(name)
        if (!isAnimationProperty(decl.prop)) return

        for (const token of decl.value.split(NAME_SEPARATOR)) {
          if (keyframeNames.has(token)) referenced.add(token)
        }
        return
      }

      for (const token of decl.value.split(NAME_SEPARATOR)) {
        if (!keyframeNames.has(token)) continue
        let names = byCustomProperty.get(decl.prop)
        if (!names) byCustomProperty.set(decl.prop, (names = new Set()))
        names.add(token)
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

  for (const property of reachableVars) {
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
