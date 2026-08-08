---
'@bamboocss/core': patch
---

Replace `postcss-discard-duplicates` with a linear pass, making CSS generation 7x faster on a large stylesheet.

Emitted CSS is unchanged — byte-identical on every sandbox in this repo, and the new pass is asserted against the plugin
it replaces rather than against a snapshot.

On one shape it removes something the old pass left behind. Upstream interleaves its recursion with its sibling walk, so
a later sibling is compared against earlier ones before those have had their own inner duplicates removed; two blocks
equal only after that removal both survive a pass, and one goes on the next. This pass recurses over the whole subtree
first, so it settles them at once — one pass here is upstream run until it stops changing anything. What it drops is an
exact duplicate, and dropping the earlier of two exact duplicates cannot change the cascade, so this is the same
transformation applied where upstream's traversal order happened to miss it.

On one other shape it keeps something the old pass removed, and that direction is worth stating too. Upstream's `equals`
compares children only when both nodes have them, so it calls a bodyless at-rule equal to a bodied one sharing its name
and params: `@media print;@media print{.a{c:1}}` loses the real block because an empty declaration preceded it. This
keys the child count as part of the signature, so the two differ and both survive. Nothing bamboo emits is bodyless, so
neither shape arises in generated CSS — both are pinned in `dedupe-nodes.test.ts` so the equivalence claim above is not
read as unconditional.

`postcss-discard-duplicates` moves to a dev dependency, since only the test that asserts agreement with it still imports
it. Consumers stop installing it.

**Where the time went**

Profiling a build that emits 493 kB of CSS put 925ms of its 1,066ms in `getCss`, and 767ms of that inside
`postcss-discard-duplicates`:

```
383 ms  dedupe
218 ms  dedupeNode
127 ms  equals
```

That plugin compares every at-rule and declaration against **all** of its preceding siblings. Rules are fine — they are
grouped by selector first — but at-rules are not, and a generated stylesheet is the worst possible shape for it: one
`@media` block per condition, all siblings under one layer. The measured config had 5,000 of them side by side, which is
~12.5M `equals()` calls. In normal operation it finds nothing, because the encoder does not emit duplicates; removing
the pass entirely produced byte-identical output.

`dedupeNodes` keys each node instead, so the same work is one pass over the tree:

|                 |   before |  after |
| --------------- | -------: | -----: |
| encode + decode |   141 ms | 136 ms |
| `getCss`        |   925 ms | 127 ms |
| **total**       | 1,066 ms | 263 ms |

Small stylesheets are unaffected either way — the pass was never the cost there.

**Why it is asserted against the plugin rather than snapshotted**

A snapshot would only record what the new one does. `dedupe-nodes.test.ts` runs both over the same input instead:
fourteen hand-written cases plus 400 randomised stylesheets drawn from a deliberately tiny alphabet, so duplicates arise
constantly rather than by luck.

That fuzzing earned its place. The first version deduped each same-selector group against its final member only, which
is not what upstream does — it walks from the end, so every member in turn strips its declarations out of all earlier
ones. `.a{d:2}.a{d:2}.a{c:1}` loses its middle rule upstream and lost nothing here. 65 of 400 random stylesheets caught
it; none of the hand-written cases did.

What that fuzzer cannot catch is the divergence above, because it builds every node independently and two siblings equal
only after their own contents are deduped essentially never arise — 2,000 cases produced none. So the divergence has its
own generator, which emits a block holding duplicated content beside the same block already clean, and asserts the
difference from a single upstream pass rather than papering over it.

Same-selector handling stays quadratic on purpose. A selector group is a handful of rules, unlike the sibling scan this
replaces.
