import type { AnyNode, ChildNode, Container, Plugin } from 'postcss'

const trim = (v: string | undefined) => (v ? v.trim() : v)

/**
 * A key capturing what `postcss-discard-duplicates`' `equals` compares, so two nodes share a
 * key if and only if that function calls them equal. Mirrored field by field rather than
 * serialised, because `toString()` carries untrimmed `raws.before` and would treat nodes that
 * `equals` considers identical as distinct.
 *
 * The `\u0001`-`\u0003` separators are what make the key injective, and they are not
 * decoration: without them `{prop:'--a',value:'bc'}` and `{prop:'--ab',value:'c'}` build the
 * same string, so `.a{--a:bc;--ab:c}` would lose its first declaration to a collision. They
 * are written as escapes rather than pasted in as raw control bytes so that a reader, a diff,
 * or an editor stripping unprintables cannot quietly delete them. `dedupe-nodes.test.ts`
 * covers that collision directly, since no random stylesheet is going to stumble onto one.
 *
 * One asymmetry with `equals`, in the direction that keeps more: it compares children only
 * when *both* nodes have them, so it calls a bodyless at-rule equal to a bodied one sharing
 * its name and params — `@media print;` against `@media print{…}`. Here the child section is
 * appended only when there are children, so the two get different keys and both survive.
 * See the note on `dedupeNodes`.
 */
function signature(node: AnyNode): string {
  const n = node as any
  let key = n.type + '\u0001' + (n.important ? '1' : '0') + '\u0001' + (n.raws ? '1' : '0')
  switch (n.type) {
    case 'rule':
      key += '\u0001' + n.selector
      break
    case 'atrule':
      key += '\u0001' + n.name + '\u0001' + n.params
      if (n.raws) key += '\u0001' + trim(n.raws.before) + '\u0001' + trim(n.raws.afterName)
      break
    case 'decl':
      key += '\u0001' + n.prop + '\u0001' + n.value
      if (n.raws) key += '\u0001' + trim(n.raws.before)
      break
  }
  if (n.nodes) {
    key += '\u0002' + n.nodes.length
    for (const child of n.nodes) key += '\u0003' + signature(child)
  }
  return key
}

/**
 * What `postcss-discard-duplicates` converges to, without its per-sibling scan.
 *
 * That plugin compares every at-rule and declaration against all of its preceding siblings,
 * which is quadratic in the sibling count. A generated stylesheet puts every condition's
 * `@media` block side by side under one layer -- 5,000 of them in the case measured -- so the
 * pass spends about 12.5M comparisons to find, in normal operation, nothing at all.
 *
 * "Converges to" rather than "the same as": upstream interleaves its recursion with its
 * sibling walk, so a later sibling is compared against earlier ones before those have had
 * their own inner duplicates removed, and two blocks equal only after that removal both
 * survive a single pass. Recursing over the whole subtree first, as below, settles them
 * immediately -- one pass here equals upstream applied until it stops changing anything.
 * The extra removals are exact duplicates, and dropping the earlier of two exact duplicates
 * cannot change the cascade. `dedupe-nodes.test.ts` pins the difference.
 *
 * The equivalence is not total, and the exception runs the other way: `equals` compares
 * children only when both nodes have them, so it calls a bodyless at-rule equal to a bodied
 * one sharing its name and params. Upstream keeps the last of a duplicate run, so it is a
 * bodyless at-rule *following* a real block that does damage -- `@media print{.a{c:1}}` then
 * `@media print;` leaves only the empty one. `signature` distinguishes the two and keeps
 * both. Nothing bamboo emits is bodyless, so this cannot arise here; it is recorded because
 * the fixpoint claim above is otherwise easy to read as unconditional, and both orderings
 * are pinned in `dedupe-nodes.test.ts`.
 */
export function dedupeNodes(): Plugin {
  const walk = (container: Container) => {
    const kids = [...((container.nodes ?? []) as ChildNode[])]
    for (const child of kids) if ((child as any).nodes) walk(child as Container)

    const bySelector = new Map<string, any[]>()
    const byKey = new Map<string, ChildNode[]>()
    for (const child of kids) {
      if (!child.parent) continue
      if (child.type === 'rule') {
        const g = bySelector.get((child as any).selector) ?? []
        g.push(child)
        bySelector.set((child as any).selector, g)
      } else if ((child.type === 'atrule' && (child as any).name !== 'layer') || child.type === 'decl') {
        const k = signature(child)
        const g = byKey.get(k) ?? []
        g.push(child)
        byKey.set(k, g)
      }
    }

    // Upstream keeps the last of each identical run and drops the earlier ones.
    for (const group of byKey.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length - 1; i++) group[i]!.remove()
    }

    /**
     * Same-selector rules, exactly as upstream walks them: from the end, every member in
     * turn strips its own declarations out of all earlier members, and an emptied rule goes.
     *
     * Doing this once against the final member only is not the same thing and is wrong --
     * `.a{d:2}.a{d:2}.a{c:1}` loses nothing that way, where upstream drops the middle rule
     * when the second `.a` takes its turn. Left quadratic deliberately: a same-selector group
     * is a handful of rules, unlike the sibling scan this replaces.
     */
    for (const group of bySelector.values()) {
      if (group.length < 2) continue
      for (let g = group.length - 1; g >= 0; g--) {
        const current = group[g]
        if (!current.parent) continue
        const keys = new Set<string>()
        current.each((c: any) => {
          if (c.type === 'decl') keys.add(signature(c))
        })
        for (let i = 0; i < g; i++) {
          const earlier = group[i]
          if (!earlier.parent) continue
          earlier.each((c: any) => {
            if (c.type === 'decl' && keys.has(signature(c))) c.remove()
          })
          if (!earlier.nodes.some((c: any) => c.type !== 'comment')) earlier.remove()
        }
      }
    }
  }

  return { postcssPlugin: 'bamboo-dedupe-nodes', OnceExit: (root) => walk(root) }
}
dedupeNodes.postcss = true
