---
'@bamboocss/vite': minor
---

Fold static `token()` calls into their values during the source transform.

`token()` is what you reach for when a design token is needed somewhere Bamboo emits no CSS — an inline style, a canvas,
a chart config. It was previously declined outright as `not-foldable`, on the grounds that it resolves to no class. It
resolves to a literal, though, and that is enough to inline:

```tsx
// you write
const chart = { grid: token('colors.red.300') }

// the bundle gets
const chart = { grid: '#fca5a5' }
```

What it folds to is exactly what the runtime would have returned, which for a conditional or semantic token is the
variable reference rather than either branch:

```tsx
token('colors.primary') // → 'var(--colors-primary)', still themeable
```

That split is the one mistake here no class-name check would catch — inlining a base colour where the runtime emits a
variable produces source that looks right and stops responding to themes — so the resolver mirrors `generateTokenJs`
rather than reimplementing the choice.

When every `token()` call in a module folds, its import of the generated token map — every token in the project — is
left unused and the bundler drops it.

Aliased and namespaced imports fold. What declines, all of it to preserve behaviour rather than out of caution:

- A path that is not **one resolved string literal**, as `dynamic`. A conditional is not one even when every branch is a
  real token: `token(dark ? 'colors.a' : 'colors.b')` boxes both branches, so folding either would pick a value and
  delete the condition that chose it.
- A path resolving to no usable string, as the new `unresolved-token` — the path names no token, the value is empty, or
  the value is not a string (a numeric `fontWeights` token stays a number, and no string literal stands in for that).
  For the first two the runtime's `tokens[path]?.value || fallback` hands the result to the fallback, which is what
  declining preserves.
- A second argument that could _run_ something (`token('colors.red.300', compute())`), as `dynamic`. Both arguments
  evaluate before the call, so folding it away would delete the call too. An inert fallback — a string, number, boolean,
  `null`, `undefined` — is provably dead and gets dropped.

`token.var()` is left alone; it returns the variable reference where `token()` returns the resolved value.

`FoldedCall` gains a `kind` field (`'class' | 'value'`) and an optional `value`. A token fold reports no class, so a
consumer checking folded classes against the emitted stylesheet does not go looking for a rule behind a `var()`
reference.

The lookup table is built once per context and shared across the build, so a module that calls `token()` zero times pays
nothing for this — asserted by counting table construction rather than by timing it.

No CSS output changes.
