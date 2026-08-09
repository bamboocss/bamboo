---
'@bamboocss/vite': minor
'@bamboocss/core': minor
---

Fold calls of inline recipes into the class string they produce.

```ts
const badge = cva({ base: { rounded: 'full' }, variants: { tone: { info: { bg: 'blue.100' } } } })

// you write
const cls = badge({ tone: 'info' })

// the bundle gets
const cls = 'cva_1a2b3c cva_1a2b3c--tone_info'
```

**The prize is the config, not the runtime.** `cva({ base, variants })` ships the whole style object to the browser so
that `cva` can hash it into a name and pick classes off it — but those styles are already in the stylesheet. Once every
call of a binding folds, the binding is unreferenced and your bundler drops the config with it. Measured on an
application with 1,271 inline recipe bindings: **173 of them fold completely, dropping 9.6 kB gzipped of config**, while
the folded call sites are themselves slightly _smaller_ than the calls they replace. The `cva` runtime is 4.5 kB by
comparison.

**Correct by construction.** The class names come from `getRecipeIdentity` and `getRecipeClassNames` — the same
functions the generated `cva` runs, not a reimplementation — and prefixing and hashing from `classFormatter`, which is
what the encoder emitted the rules under. A parity suite compares the folded string against the real generated `cva`
across defaults, multi-axis selections, values containing spaces, a declared `className`, compound variants and a
default naming an undeclared value.

**What still declines,** reported as `recipe-call` exactly as before:

- Any selection with a property the build cannot resolve — `badge({ tone })` where `tone` is a prop or state. This is
  the common case in application code, and it is deliberately all-or-nothing: an unresolved variant does not merely omit
  a class, so a partially-known selection does not fold at all.
- A ternary, which yields several candidate selections and no single literal.
- **A selection that could _run_ something.** `badge({ tone: pick() })` has a knowable class and a call inside it;
  folding deletes the argument, so the call would never run. Same contract the `token()` fallback already keeps.
- **A config the build could not read** — `cva(makeConfig())`, or one imported from another module, both of which the
  extractor resolves to `{}`. That is not an empty config, and folding against it would substitute the identity of `{}`
  for the call that produces the real classes, leaving the element permanently unstyled.
- A slot recipe. `sva(...)` invocations return one class per slot rather than a string.
- `.raw()`, `.merge()`, and anything else reaching the recipe object rather than calling it.

**The value a call site was written with always comes from the source.** The extractor's resolved data is consulted only
to supply a value for a property that is present in both — because that data is lossy in the one direction that matters:
a property it could not resolve is _dropped_ rather than flagged, so `badge({ tone })` and `badge({})` are
indistinguishable in it. Folding the first as the second would emit a class string missing a variant and render the
element wrongly, with nothing to report it.

Variant keys are read from the property's name node rather than by stripping quotes from its text, so
`badge({ '\u0074one': 'info' })` selects `tone` as the runtime does instead of silently dropping the variant.

`classFormatter` is now exported from `@bamboocss/core`, so the fold and the naming-agreement check derive names the
same way.
