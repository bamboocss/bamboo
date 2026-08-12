import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { StaticCompilationSession } from './static-session'

/** The generated declaration that identifies a Bamboo stylesheet after minification. */
const SENTINEL = '--made-with-bamboo'

/**
 * Remove source-graph atoms no transformed module can emit.
 *
 * `prunableClasses` contains only atoms extracted from the source graph. Explicit `staticCss`
 * additions are absent and survive as a safelist; graph atoms are governed by the transformed
 * module reachability set, regardless of whether they originated in `css()` or a recipe.
 */
export const pruneStaticCss = (
  css: string,
  session: StaticCompilationSession,
  { prune = true }: { prune?: boolean } = {},
): string => {
  if (!css.includes(SENTINEL)) return css

  const root = postcss.parse(css)
  const isUtilityRule = (rule: postcss.Rule) => {
    let parent = rule.parent as postcss.Node | undefined
    while (parent) {
      if (parent.type === 'atrule') {
        const atRule = parent as postcss.AtRule
        if (atRule.name === 'layer' && atRule.params === session.utilityLayer) return true
      }
      parent = parent.parent as postcss.Node | undefined
    }
    return false
  }
  if (prune) {
    root.walkRules((rule) => {
      if (!isUtilityRule(rule)) return
      const classes = new Set<string>()
      try {
        selectorParser((selectors) => {
          selectors.walkClasses((classNode) => {
            classes.add(classNode.toString().slice(1))
          })
        }).processSync(rule.selector)
      } catch {
        // An authored selector the parser cannot understand is not a compiler-owned atom.
        return
      }

      if (classes.size !== 1) return
      const [className] = classes
      if (!className || !session.prunableClasses.has(className) || session.usedClasses.has(className)) return
      rule.remove()
    })
  }

  // Removing the last rule from a condition or layer should remove its wrappers as well.
  let removed = true
  while (removed) {
    removed = false
    root.walkAtRules((rule) => {
      if (rule.nodes?.length !== 0) return
      rule.remove()
      removed = true
    })
  }

  if (session.denseClassNames) {
    root.walkRules((rule) => {
      if (!isUtilityRule(rule)) return
      const transitionClasses = new Set<string>()
      try {
        rule.selector = selectorParser((selectors) => {
          selectors.walkClasses((classNode) => {
            if (!session.prunableClasses.has(classNode.toString().slice(1))) return
            if (session.viewTransitionClasses.has(classNode.value)) transitionClasses.add(classNode.value)
            classNode.value = session.allocateClassString(classNode.value)
          })
        }).processSync(rule.selector)
      } catch {
        // Authored selectors that cannot be parsed are unrelated to compiler-owned atoms.
      }

      if (transitionClasses.size) {
        rule.walkDecls('view-transition-class', (declaration) => {
          if (!transitionClasses.has(declaration.value)) return
          declaration.value = session.allocateClassString(declaration.value)
        })
      }
    })
  }

  return root.toString()
}
