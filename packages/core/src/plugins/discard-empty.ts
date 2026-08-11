import type { AnyNode, ChildNode, Container, Plugin } from 'postcss'

/**
 * `postcss-discard-empty`'s predicate, field for field.
 *
 * Two of these clauses are load-bearing here in ways that are easy to lose when reimplementing:
 *
 * - A custom property is kept even with an empty value. `--a: ;` is a valid declaration that
 *   registers the property, and dropping it changes what `var(--a)` resolves to.
 * - A *named* empty `@layer` is kept, because `@layer utilities{}` is what declares the layer
 *   and fixes its position in the cascade order. An anonymous empty one (`@layer{}`) has no
 *   name to declare and still goes, which is the difference between the third clause's
 *   exemption and the fourth clause's reach. Bamboo's `@layer reset, base, …;` statement has
 *   params and no body, so no clause touches it.
 */
function isEmpty(node: AnyNode): boolean {
  const nodes = (node as Container).nodes as ChildNode[] | undefined

  switch (node.type) {
    case 'decl':
      return !node.value && !node.prop.startsWith('--')
    case 'rule':
      return !node.selector || (!!nodes && nodes.length === 0)
    case 'atrule':
      // No params and nothing to hold: `@media{}`, `@media;`.
      if (!node.params && (!nodes || nodes.length === 0)) return true
      // An empty body otherwise, except for the named layer above.
      return !!nodes && nodes.length === 0 && node.name !== 'layer'
    default:
      return !!nodes && nodes.length === 0
  }
}

/**
 * What `postcss-discard-empty` produces, without its per-removal sibling scan.
 *
 * Upstream removes each empty node through `Node.remove()`, and postcss resolves that with
 * `Container.removeChild`, which calls `indexOf` over the parent's children and then splices.
 * That is linear per removal, so a pass costs removals x siblings. Hand-written CSS never
 * notices; a generated stylesheet does, because every condition's block sits under one cascade
 * layer as a sibling of every other, and `mergeRules` runs immediately before this and leaves
 * the shells behind. Specifically it leaves empty *at-rules*, not empty rules: every path that
 * empties a rule also removes it, and the one that does not is `mergeParents`, which lifts a
 * rule out of its enclosing at-rule and never revisits the parent. A 663 kB sheet measured
 * here arrives with 6,005 empty `@media` shells and zero empty rules. The sibling count and
 * the removal count therefore both grow with the config, and their product is what this costs.
 *
 * Measured over a sibling group half of which is empty, against a parse-only control. All
 * three variants run interleaved in one process, best of seven, because the machine this was
 * taken on could not be quieted and alternating them is what keeps the comparison honest:
 *
 *     siblings   control   upstream     this    upstream/control   this/control
 *        8,000     8.5ms     26.8ms   18.8ms                3.2x           2.2x
 *       16,000    11.8ms     54.0ms   29.0ms                4.6x           2.5x
 *       32,000    25.7ms    369.0ms   53.9ms               14.4x           2.1x
 *
 * The last two columns are the point rather than the speedup: this stays a fixed multiple of
 * the control across the range, the way a linear pass does, and upstream does not.
 *
 * Rebuilding each container's `nodes` array once is the whole difference -- same predicate,
 * same depth-first order, so the same nodes are dropped and the output is byte-identical.
 * `discard-empty.test.ts` pins that against upstream on the shapes the predicate distinguishes.
 *
 * One deliberate divergence: upstream pushes a `removal` message onto `result.messages` per
 * node. Nothing reads them here -- `ctx.messages` is bamboo's own catalogue, unrelated -- and
 * on the sheet above that is 6,005 objects allocated to be thrown away.
 */
export function discardEmpty(): Plugin {
  const prune = (container: Container) => {
    const nodes = container.nodes as ChildNode[] | undefined
    if (!nodes) return

    // `kept` stays null until something is actually dropped, so the common case -- a container
    // with nothing empty in it -- allocates nothing and leaves `nodes` untouched.
    let kept: ChildNode[] | null = null

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as ChildNode

      // Depth-first, like upstream: a node's emptiness is only settled once its own children
      // have been pruned, which is what lets a rule emptied by `mergeRules` take its enclosing
      // at-rule with it.
      if ((node as Container).nodes) prune(node as Container)

      if (isEmpty(node)) {
        kept ??= nodes.slice(0, i)
        // Detached the way `remove()` leaves it. Nothing downstream reads this -- `OnceExit`
        // listeners run in registration order, so `dedupeNodes` has already returned, and
        // postcss's own `parent` checks all sit in the visitor phase that precedes them -- but
        // a node still claiming a parent it is no longer in is a trap to leave lying around.
        node.parent = undefined
      } else {
        kept?.push(node)
      }
    }

    if (!kept) return

    /**
     * `Root` -- and only `Root` -- overrides `removeChild` to hand a dropped first child's
     * `raws.before` to the node that replaces it, so a sheet does not acquire the leading
     * blank lines that belonged to a rule that is now gone. Removing one at a time propagates
     * that forward across a run, landing it on the first survivor.
     *
     * Reproducing it is not cosmetic. `prettify` runs in the visitor phase, before any
     * `OnceExit`, so nothing downstream re-normalizes this on the non-minified path -- the
     * default one. It is reachable whenever a top-level node can be empty, which is any sheet
     * built with `config.polyfill` (the cascade-layer polyfill unwraps the `@layer` blocks that
     * otherwise keep every root child non-empty) and any caller of the exported `optimizeCss`.
     */
    if (container.type === 'root' && kept.length && nodes[0] !== kept[0]) {
      kept[0]!.raws.before = nodes[0]!.raws.before
    }

    container.nodes = kept
  }

  // The root itself is never tested, matching upstream's `css.each(discardEmpty)`.
  return { postcssPlugin: 'bamboo-discard-empty', OnceExit: (root) => prune(root) }
}
discardEmpty.postcss = true
