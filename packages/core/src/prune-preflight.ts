import { isObject } from '@bamboocss/shared'
import type { Config } from '@bamboocss/types'
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
 *
 * `:host` does not belong here and used to sit in it. It is a pseudo-class, so `elementOf`
 * strips it and reports no element at all, and the branch for that keeps the selector before
 * this set is ever consulted — listing it only suggested it was doing something.
 */
const ALWAYS_KEPT = new Set(['html', 'body'])

/** The element a selector part targets, or undefined when it targets no particular one. */
function elementOf(part: string): string | undefined {
  const bare = part
    .replace(/:{1,2}[\w-]+(\([^()]*\))?/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
  return ELEMENT_ONLY.test(bare) ? bare.toLowerCase() : undefined
}

/**
 * A scoped reset carries its scope on every selector, and the shapes it emits mostly do not
 * survive `elementOf`: `preflight: { scope: '.app' }` writes `.app table`, and
 * `level: 'element'` writes `table.app`. Neither reports an element, so without stripping the
 * scope first every rule is kept and the whole pass silently does nothing. (An attribute
 * scope was the exception -- `table[data-app]` already worked, because `elementOf` strips
 * `[...]` anyway -- which is exactly the kind of partial coverage that hides a bug.)
 *
 * A scope may be a selector list, and the emitter distributes it, so each alternative is
 * tried in turn. Whitespace is trimmed off both: the config carries it verbatim, and `.app `
 * failing to match `.app table` would put the silent no-op straight back.
 *
 * Stripping cannot make it less safe. It only ever turns a part that reported no element
 * into one that names a real element, which is the question this pass exists to ask; a part
 * that does not carry the scope is returned untouched and falls through to being kept. Even
 * a coincidental match is sound -- `div .app` strips to `div`, and that selector does need a
 * `div` to match -- because `ELEMENT_ONLY` accepts a single compound, so whatever survives
 * the strip is either the subject of the selector or its leftmost compound, and both have to
 * be present for the rule to apply.
 */
function unscope(part: string, scopes: string[]): string {
  for (const scope of scopes) {
    if (part.startsWith(`${scope} `)) return part.slice(scope.length).trim()
    if (part.endsWith(scope)) return part.slice(0, -scope.length).trim()
  }
  return part
}

/**
 * Whether `preflight` asks for the reset to be pruned.
 *
 * One accessor rather than the check written out at each of the six call sites: `preflight`
 * is `boolean | PreflightOptions`, so every one of them would otherwise have to remember
 * that `true` means "on with the defaults" and therefore *not* pruned.
 */
export function prunesPreflight(preflight: Config['preflight']): boolean {
  return isObject(preflight) && preflight.prune === true
}

export interface PrunePreflightOptions {
  /** The layer holding the reset. Only rules here are considered. */
  target: Container
  /** Element names the source is known to render. */
  rendered: Set<string>
  /** `preflight.scope`, when the reset is scoped. Stripped before an element is read out.
   * A selector list is accepted, since the emitter distributes one across every rule. */
  scope?: string
}

/**
 * Drop the parts of the reset that style elements the project never renders.
 *
 * Two thirds of the reset is bound to specific elements — 41 of them, covering `table`,
 * `pre`, `kbd`, `optgroup` and the rest of the long tail. An app that renders none of those
 * still ships every rule, and because the reset is a fixed size it dominates a small
 * stylesheet: a third of one sandbox's css here and four fifths of another's.
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
  const { target, rendered, scope = '' } = options
  const scopes = scope
    .split(',')
    .map((one) => one.trim())
    .filter(Boolean)
  let removedRules = 0
  let removedParts = 0
  /**
   * The elements this dropped, for the caller to say out loud.
   *
   * The one objection to this pass is that being wrong is silent — an element rendered where
   * the scan cannot see it loses its reset, and the page just looks slightly off. Counts do
   * not help with that; names do, because the reader knows whether their app has a `<table>`
   * in it and the scan does not.
   *
   * Exactly what it says: an element named here had a rule or a selector part removed. It is
   * not a claim that nothing styles it any more — a reset that names `table` twice, once alone
   * and once as `.prose table`, loses only the first, and `table` is still reported because a
   * rule for it did go. Subtracting elements that survive elsewhere was tried and is worse: it
   * can only see a survivor whose selector is *nothing but* an element name, so `.prose table`
   * would not count and the subtraction would be silently partial. Nothing the generated reset
   * emits has that shape; a hand-written one, or one rewritten through `cssgen:done`, can.
   */
  const removedElements = new Set<string>()

  target.walkRules((rule: Rule) => {
    const parts = rule.selectors
    const kept = parts.filter((part) => {
      const element = elementOf(unscope(part, scopes))
      // No element in it at all, so nothing about the source can say it is unreachable.
      if (!element) return true
      if (ALWAYS_KEPT.has(element) || rendered.has(element)) return true
      removedElements.add(element)
      return false
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

  return { removedRules, removedParts, removedElements }
}
