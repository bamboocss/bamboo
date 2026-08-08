---
'@bamboocss/vite': minor
---

Add `strict` to `@bamboocss/vite`: fail the build when a `css()` call is left for the runtime.

```ts
plugins: [bamboocss({ strict: true })]
```

The fold's payoff was never the per-call CPU it saves. It is that a bundle where _every_ `css()` call folded stops
importing `styled-system/css`, and the engine behind it drops out — on the `vite-ts` example that is 1.3 kB gzipped of
`css.mjs`, plus whatever of `helpers` goes with it. One survivor keeps all of it, so 99% folded and 0% folded cost the
same, and a coverage percentage cannot tell you which you have. This can.

The error names every survivor with its file, line and reason:

```
bamboocss: 2 call(s) could not be folded, and `strict` is on.

  /app/src/Card.tsx
    14: css() — dynamic
    31: cssLeaf — lowered-leaf
```

**`cssLeaf` counts, and it is the one that matters.** `css({ color: tone })` _folds_ — to `cssLeaf("c_", "color", tone)`
— so it reports no skip at all. But `cssLeaf` falls back to `css({ [prop]: value })` for a value that is not a scalar,
which the build cannot rule out, so the module still imports the engine. Without counting it, `strict` would pass on the
most common dynamic shape while the thing it exists to guarantee quietly failed.

**`cva`/`sva` do not count.** A `cva(...)` definition returns a function and can never collapse to a class string, so
failing on it would make the option unusable for anyone writing recipes. Recipes keep their own runtime, which is a
different and much smaller module than the css engine.

Worth knowing before turning it on: a component that takes a style-bearing prop will trip it, because that is exactly
the shape `cssLeaf` exists for. Reaching zero is realistic for an app whose variation lives in `cva` variants, and hard
for a library whose components accept arbitrary values.
