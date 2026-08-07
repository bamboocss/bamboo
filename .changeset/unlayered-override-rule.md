---
'@bamboocss/eslint-plugin': minor
---

Add `no-unlayered-override`, and correct what the docs claimed about which styles land in which layer.

Now that `cx` joins rather than merges, a component that styles itself with `css()` and joins a `className` it was
handed has both classes in the `utilities` layer — so which one applies is decided by stylesheet order, not by the
caller. The new rule reports that shape and names the two fixes.

The fix is to write the component with `cva`/`sva`:

```
css()                → utilities   (atomic)
inline cva() / sva() → recipes     (semantic)
config recipe        → recipes     (semantic)
```

Both kinds of recipe land in a lower layer, so a consumer's `css()` wins by cascade in every build. The rule reports
`css()` joined with a class it cannot see, and stays quiet for either.

The docs now also give the mechanism with no caveats at all — accept a style object rather than a class name, and merge
it with `css(base, props.css)`. That resolves per property before any class name exists, so it behaves identically in
every build and needs no layer.
