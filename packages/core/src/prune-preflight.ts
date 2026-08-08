import type { Container, Rule } from 'postcss'

/**
 * A selector part that is nothing but an element name, once its pseudos and attribute tests
 * are stripped. `table` and `input:where([type=text])` both qualify; `::backdrop`, `*` and
 * `[hidden]` do not, because nothing about them names an element.
 */
const ELEMENT_ONLY = /^[a-zA-Z][\w-]*$/

/**
 * The document elements, kept whatever the scan says. They are never written in a component,
 * and a stylesheet that stops resetting them is wrong in a way nothing else here can be.
 */
const ALWAYS_KEPT = new Set(['html', 'body', ':host'])

/** The element a selector part targets, or undefined when it targets no particular one. */
function elementOf(part: string): string | undefined {
  const bare = part
    .replace(/:{1,2}[\w-]+(\([^()]*\))?/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
  return ELEMENT_ONLY.test(bare) ? bare.toLowerCase() : undefined
}

export interface PrunePreflightOptions {
  /** The layer holding the reset. Only rules here are considered. */
  target: Container
  /** Element names the source is known to render. */
  rendered: Set<string>
}

/**
 * Drop the parts of the reset that style elements the project never renders.
 *
 * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
 * `pre`, `kbd`, `optgroup` and the rest of the long tail. An app that renders none of those
 * still ships every rule, and because the reset is a fixed size it dominates a small
 * stylesheet: a third of one sandbox's css and nearly half of another's.
 *
 * A selector list loses only the parts naming unrendered elements, so a rule shared between
 * `button` and `::file-selector-button` keeps the half that still applies. A rule is removed
 * only when every part goes.
 *
 * This cannot be proven the way token pruning can. An element rendered by a dependency, by
 * `dangerouslySetInnerHTML`, or by markdown is invisible to any scan of your own source, so
 * it is opt-in and the failure is visual rather than loud.
 */
export function prunePreflight(options: PrunePreflightOptions) {
  const { target, rendered } = options
  let removedRules = 0
  let removedParts = 0

  target.walkRules((rule: Rule) => {
    const parts = rule.selectors
    const kept = parts.filter((part) => {
      const element = elementOf(part)
      // No element in it at all, so nothing about the source can say it is unreachable.
      if (!element) return true
      return ALWAYS_KEPT.has(element) || rendered.has(element)
    })

    if (kept.length === parts.length) return

    removedParts += parts.length - kept.length
    if (!kept.length) {
      removedRules++
      rule.remove()
      return
    }
    rule.selectors = kept
  })

  return { removedRules, removedParts }
}
