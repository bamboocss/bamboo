---
'@bamboocss/eslint-plugin': minor
---

Add `no-unlayered-override`, and correct what the docs claimed about which styles land in which layer.

Now that `cx` joins rather than merges, a component that styles itself with `css()` and joins a `className` it was
handed has both classes in the `utilities` layer — so which one applies is decided by stylesheet order, not by the
caller. The new rule reports that shape and names the two fixes.

The docs said the fix was to write the component with `cva`/`sva`. That is wrong, and measurement is what turned it up:

```
css()                → utilities   (atomic)
inline cva() / sva() → utilities   (atomic)   ← not `recipes`
config recipe        → recipes     (semantic)
```

Only a **config recipe** — declared in `theme.recipes` or `theme.slotRecipes` — lands in a lower layer. An inline
`cva()` emits atomic classes, exactly like `css()`, and sits alongside the consumer. Every page that said otherwise has
been corrected, and the rule knows the difference: it reports a call to a locally declared `cva`, and stays quiet for a
recipe imported from `styled-system/recipes`.

The docs now also give the mechanism with no caveats at all — accept a style object rather than a class name, and merge
it with `css(base, props.css)`. That resolves per property before any class name exists, so it behaves identically in
every build and needs no layer.
