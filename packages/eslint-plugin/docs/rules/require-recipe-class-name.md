# Require a `className` on a recipe, so its class names do not depend on what the build could read (`@bamboocss/require-recipe-class-name`)

⚠️ This rule _warns_ in the following configs: 🌐 `all`, ✅ `recommended`.

<!-- end auto-generated rule header -->

A recipe with no `className` is named by hashing its config:

```jsx
const button = cva({ base: { padding: '4' } })
// → 'cva_a1b2c3'
```

That name is derived twice — once by the build while it emits the stylesheet, once by the browser. The build hashes the
config it could **read**; the browser hashes the one it **holds**. Anything the build cannot resolve makes those two
objects differ, so the two derive different names, the element carries classes no rule was emitted under, and it renders
with **no styles at all**.

```jsx
// ⚠️ the build cannot resolve the spread, so it hashes a different object
const button = cva({
  base: { ...getFocusRingStyles(), padding: '4' },
})
```

## How to fix it

Name the recipe. The identity short-circuits on `className` and never hashes the styles, so extraction fidelity stops
deciding what the classes are called — and a declaration the build could not read costs only itself, rather than
everything:

```jsx
const button = cva({
  className: 'button',
  base: { ...getFocusRingStyles(), padding: '4' },
})
// → 'button', whatever the build managed to resolve
```

You get readable class names with it: `button--size_sm` rather than `cva_a1b2c3--size_sm`.

## Options

### `mode`

- `'always'` (default) — every `cva`/`sva` needs a name.
- `'dynamic-only'` — only recipes whose config is not a plain static literal, which is where the divergence is possible.
  This is what `recommended` enables.

```json
{
  "rules": {
    "@bamboocss/require-recipe-class-name": ["warn", { "mode": "dynamic-only" }]
  }
}
```

## When not to use it

The build already reports a recipe config it could not fully read, with the path to what it lost. This rule is the
editor-time half of that, and it catches shapes the build check cannot: it needs no extraction, so it sees the problem
before a build runs. If you always build before reviewing, the warning alone may be enough.

A name has to be unique across the project. Two recipes sharing one emit rules under the same selectors, and the later
one wins for any variant they both declare.
