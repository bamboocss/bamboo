---
'@bamboocss/vite': minor
---

Fold `recipe(props).slot` for slot recipes, including when the variant props are dynamic.

A slot recipe call returns one class per slot rather than a string, so the fold declined it outright. What resolves to a
string is the property access, and that is now what gets replaced:

```tsx
// you write
<div className={checkbox({ size: 'sm' }).root} />

// the bundle gets
<div className="checkbox__root checkbox__root--size_sm" />
```

The case worth the machinery is a **scoped recipe's non-anchor slot**. Its variant styles arrive through an `@scope`
rule anchored on an enclosing slot, so its own class is a constant — the same string whatever the props are — and it
folds even when the variant is fully dynamic:

```tsx
checkbox({ size: runtimeValue }).control // → "checkbox__control"
```

That is new. Before variant scoping every slot carried a variant class, so nothing about a slot recipe was resolvable
without static props. It matters most where it fires: the parts of a compound component, which are the hot render paths.

Three cases are deliberately left alone, because their classes are not constant:

- an anchor slot with a dynamic variant — its class _is_ the variant
- any slot of an unscoped recipe (`scopeRoots: []`, or sibling slots with no anchor), where every slot takes variants
- the whole `recipe(props)` call, which resolves to an object rather than a string

The folded class is built through the same `createCss` the runtime uses rather than by concatenating the slot name, so
`hash.className` and `prefix` reach it — reconstructing that string is exactly how the runtime and the stylesheet
drifted apart once already.

Measured on `fold.bench.ts`: every case within the control's own drift, so no measurable cost to the fold itself.
