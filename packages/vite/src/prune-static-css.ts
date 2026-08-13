import { truncateList } from '@bamboocss/shared'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { StaticCompilationSession } from './static-session'

/** The generated declaration that identifies a Bamboo stylesheet after minification. */
const SENTINEL = '--made-with-bamboo'

/**
 * A class name with its CSS escapes removed, which is the only spelling both sides agree on.
 *
 * The same class reaches the stylesheet either escaped or not — `--bottom-mask-size_16px` is a
 * valid selector as written, since a CSS ident may begin with `--`, while `esc` produces the
 * escaped `\--…` form that reachability keys are stored in. Comparing raw spellings therefore
 * missed a rule written the other way, and pruning removed an atom whose rule was in the sheet
 * all along. It could only ever affect names needing an escape, which is why it presented as
 * every custom property and vendor-prefixed declaration losing its rule at once.
 *
 * Stripping backslashes is unambiguous here: a semantic atom name never contains a literal one.
 */
export const bare = (className: string) => className.replaceAll('\\', '')

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
  // Canonicalised once. Both sets are built elsewhere in selector form; the sheet may spell a
  // class either way, so every comparison below is on the escape-free name.
  const prunable = new Set([...session.prunableClasses].map(bare))
  const used = new Set([...session.usedClasses].map(bare))
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

      // Decided per selector, not per rule.
      //
      // The optimizer merges rules sharing a body into one selector list, so an atom nothing
      // can reach routinely ends up beside one that is reachable — `content: ""` is written by
      // every `_before` and `_after` in a project, and they collapse into a single rule. Judging
      // the rule as a whole kept every one of those, which is dead CSS that pruning is supposed
      // to be removing and which grows with exactly the declarations that repeat most.
      //
      // A selector naming more than one class is left alone: a compound variant selects on the
      // classes an element already carries, so no single atom owns the rule and dropping it
      // would take a style the element still needs.
      let removedAny = false
      let selector: string
      try {
        selector = selectorParser((selectors) => {
          selectors.each((candidate) => {
            const classes = new Set<string>()
            candidate.walkClasses((classNode) => {
              // Both spellings, because a class can reach the sheet either way and they denote
              // the same class. `--bottom-mask-size_16px` needs no escape to be valid CSS — an
              // ident may begin with `--` — while `esc` produces the escaped `\--…` form, so a
              // set keyed on one spelling misses a rule written in the other.
              classes.add(bare(classNode.toString().slice(1)))
            })

            if (classes.size !== 1) return
            const [className] = classes
            if (!className || !prunable.has(className) || used.has(className)) return

            candidate.remove()
            removedAny = true
            // Recorded so a *later* build environment can tell that a class it has just
            // compiled was already pruned out of a stylesheet that has been finalized. See
            // the guard in `plugin.ts`; this pass cannot know about environments at all.
            session.prunedClasses.add(className)
          })
        }).processSync(rule.selector)
      } catch {
        // An authored selector the parser cannot understand is not a compiler-owned atom.
        return
      }

      if (!removedAny) return
      // Every selector went, so the rule has nothing left to style.
      if (!selector.trim()) {
        rule.remove()
        return
      }
      rule.selector = selector
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

  // Every atom the compiler emitted must still have a rule.
  //
  // Checked here rather than after the whole pass because this is the one point where both
  // sides are spelled the same way: `usedClasses` holds escaped semantic names, and dense
  // renaming below rewrites the sheet out of that space.
  //
  // Scoped to `prunableClasses`, so only atoms this pass could have removed are asserted —
  // a `staticCss` safelist entry is not graph-owned and is not its business.
  //
  // The failure this exists for is silent: class names reach the JS and the markup, the sheet
  // is present and carries the marker, the build exits 0, and the app renders unstyled. It
  // was found by grepping a shipped bundle. `markClassUsed` not splitting a space-joined
  // class string took every `::before` and `::after` rule out of one application's CSS.
  if (prune) {
    const present = new Set<string>()
    root.walkRules((rule) => {
      if (!isUtilityRule(rule)) return
      try {
        selectorParser((selectors) => {
          selectors.walkClasses((classNode) => {
            present.add(bare(classNode.toString().slice(1)))
          })
        }).processSync(rule.selector)
      } catch {
        // Unparseable authored selectors carry no compiler-owned atom to account for.
      }
    })

    const orphaned: string[] = []
    for (const className of session.usedClasses) {
      // A class name cannot contain whitespace, so an entry that does is a malformed key
      // rather than a class — and every atom it was meant to stand for is unmarked and about
      // to be pruned. Checked before the `prunableClasses` filter precisely because such an
      // entry matches nothing there, which is how the original bug slipped past this guard
      // when it was first written.
      if (/\s/.test(className)) {
        orphaned.push(className)
        continue
      }
      if (!prunable.has(bare(className))) continue
      if (present.has(bare(className))) continue
      orphaned.push(className)
    }

    if (orphaned.length) {
      // Reported with enough context to diagnose without a second build.
      //
      // The class name alone is not enough, and that cost a round trip: a report of twelve
      // orphans — every one a CSS custom property or a vendor-prefixed name, so every one a
      // class needing a leading-dash escape — could not be reproduced from the names, because
      // the names looked identical on both sides. What distinguishes the two possible causes
      // is *where* the entry is missing: absent from the extracted atom set means it was never
      // emitted, while present there but not in the sheet means the rule was written and then
      // pruned or not matched.
      //
      // The near misses matter as much. A class that differs only in escaping has a rule under
      // a spelling this did not recognise, which points at the encoding rather than at
      // emission — and is invisible if only the missing name is printed.
      const describe = (className: string) => {
        if (/\s/.test(className)) return `  ${className}\n      (malformed key: a class name cannot contain whitespace)`

        const extracted = session.prunableClasses.has(className) ? 'in the extracted atoms' : 'NOT extracted'
        const bare = className.replaceAll('\\', '')
        const near = [...present].filter(
          (candidate) => candidate !== className && candidate.replaceAll('\\', '') === bare,
        )

        return (
          `  ${className}\n      (${extracted}; no rule in the sheet` +
          (near.length ? `; a rule exists under ${near.map((n) => JSON.stringify(n)).join(', ')}` : '') +
          `)`
        )
      }

      throw new Error(
        `bamboocss: ${orphaned.length} compiled class(es) have no rule in the emitted stylesheet. ` +
          `Elements carrying them would render unstyled.\n\n` +
          `${truncateList(orphaned.map(describe), { unit: 'class', separator: '\n' })}\n\n` +
          `This is a compiler bug rather than anything to fix in your source. Please report it with ` +
          `the block above — the parenthesised part is what distinguishes an atom that was never ` +
          `emitted from one whose rule is present under a different spelling.`,
      )
    }
  }

  return root.toString()
}
