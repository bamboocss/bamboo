---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/config': minor
---

**Breaking:** `scopeRoot: 'x'` becomes `scopeRoots: ['x']`, and a slot recipe can now name more than one anchor.

A portal is a real break in the DOM tree, and no CSS mechanism crosses one — not inheritance, not `@container style()`,
not `:has()`. A `<Select>` occupies two disjoint subtrees: the trigger side under `root`, the listbox side under a
portaled `positioner`. A variant writes styles into both. One anchor can only ever reach one of them.

That was not a limitation you could work around by choosing the right anchor — it only picked which half worked:

```ts
scopeRoot: 'root' // 7 slots scoped, the 8 portaled ones get rules that never match
scopeRoot: 'positioner' // 8 slots scoped, the 7 in-tree ones get rules that never match
```

And the failure was quiet. Base slot styles are emitted outside the scope, so they still applied and the component
rendered _nearly_ right — a partial failure, harder to notice than a total one.

```ts
defineSlotRecipe({
  className: 'select',
  slots: ['root', 'trigger', 'positioner', 'content', 'item'],
  scopeRoots: ['root', 'positioner'],
  variants: { size: { lg: { trigger: { h: '11' }, item: { px: '3' } } } },
})
```

Each named slot takes variant props; every other slot stays a constant. The author threads the variant to 2 elements
instead of 8, and that count does not grow with the recipe.

### No structural declaration

You never describe the DOM. Each non-anchor slot's variant rules are emitted under **every** anchor, and only the anchor
that is genuinely an ancestor matches at runtime. Nested anchors resolve by `@scope` proximity — the nearer one wins.

Read `scopeRoots` as a cost control rather than a description of the tree: emitting every slot under every slot would be
correct with nothing declared at all, it is just quadratic in slot count. Naming the enclosing slots prunes it to one
copy per anchor.

### Cost, measured

A 15-slot recipe shaped like Park UI's `select`, two variants over five values:

```
1 anchor    raw 2,315 B   gzip 310 B    5 @scope blocks
2 anchors   raw 4,248 B   gzip 383 B   10 @scope blocks
```

+84% raw, **+24% gzipped**. The alternative — per-slot variant classes for the portaled half — gzips to 502 B, _larger_
than two anchors, and still needs a runtime channel to deliver those classes.

Getting there needed a fix in the stylesheet: scoped rules are keyed by their `@scope` prelude, and identical at-rules
only collapse when adjacent. Interleaving two anchors broke that, giving 130 blocks where 10 would do. Scoped results
are now merged per layer before processing, so the prelude deduplicates as an object key. Unscoped output is untouched —
merging those would also collapse a variant's declarations into one rule and reorder the layer.

### Other changes

- `scopeRoots: []` explicitly turns scoping off, giving every slot its own variant class. Previously reachable only by
  _not_ having a slot named `root`.
- A slot recipe's generated type now declares every anchor as callable, not just one.
- Fixed: `slotScopes` was only ever written, never cleared, so a recipe that _stopped_ being scoped in a watch rebuild
  kept emitting rules under an anchor nothing rendered any more.

### What this does not fix

A slot under _no_ anchor is still unreachable, and nothing at build time can detect it — reachability is a fact about
the DOM, and there is no component layer left to check it at runtime. `scopeRoots` makes the correct thing expressible;
it does not make it verifiable. `recipe.slotsAffectedBy` remains the tool for whatever still needs threading by hand.
