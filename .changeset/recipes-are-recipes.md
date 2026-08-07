---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/core': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
'@bamboocss/eslint-plugin': minor
---

**Breaking:** an inline `cva()`/`sva()` now emits the same kind of CSS as a recipe declared in `theme.recipes` — one
class per variant, in the `recipes` cascade layer — instead of atomic classes in `utilities`.

An inline recipe and a config recipe were the same declaration, evaluated by the same code, that produced different
naming, a different layer and different override behaviour. Nothing about the two justified that: a config recipe is an
inline one that happens to be declared somewhere with a name.

```js
cva({ base: { padding: '4' }, variants: { size: { sm: { fontSize: 'sm' } } } })
// before: 'p_4'                    in @layer utilities
// now:    'cva_a1b2c3'             in @layer recipes
//         'cva_a1b2c3--size_sm'    when size="sm"
```

Three things follow.

**A component written with `cva` is now reliably overridable.** Its classes are in `recipes`, so a consumer's `css()` in
`utilities` wins by cascade layer in every build, without the consumer knowing how the component was declared. That was
previously true only if you hoisted the styles into `theme.recipes`.

**`cssMode: 'grouped'` no longer has an exception.** Recipes were extracted atomically whatever `cssMode` said, because
a group class names a whole call and which variant combination a caller selects is not knowable at build time. That
forced a second `css` instance — the internal `__atomicCss` — purely so their runtime could name classes the way the
stylesheet did. Naming from the config is knowable in every mode, so `__atomicCss` is gone and `cva` no longer sprays
atomic classes into grouped markup.

**Compound variants are a compound selector.** `.btn--size_sm.btn--tone_a` rather than atomic classes joined at runtime,
which puts them in the same layer as the rest of the recipe and leaves the runtime nothing to compute — the rule matches
because both variant classes are already on the element.

### Naming

The class prefix is derived from the config: `className` when you set one, otherwise a hash of the recipe's styles.

```js
cva({ className: 'button', base: { padding: '4' } }) // .button, .button--size_sm
cva({ base: { padding: '4' } }) //                      .cva_a1b2c3, .cva_a1b2c3--size_sm
```

It has to come from the config because the build and the browser each derive it independently and never meet. Deriving
it from the binding — `const button = cva(...)` — would need the build to rewrite the call, and a pipeline without that
transform would then name classes differently from one with it.

### Faster at runtime

Naming from the config means the runtime no longer resolves a style object to produce a class string. `cva()` used to
run `mergeCss` per active variant and then name a class per property; it now walks the variant keys and concatenates.

Measured with both shapes in one process, so the comparison cannot drift (`packages/generator/__tests__/cva.bench.ts`):

```
cva() all-miss x10000   173.72 hz ±2.23%   (semantic)
                         33.38 hz ±0.91%   (the atomic shape this replaced)   → 5.2x
cva() warm x10000      1,678    hz ±0.60%  (semantic)
                       1,720    hz ±0.51%  (atomic)                           → within noise
```

All-miss is every call selecting a distinct variant combination, so nothing is reusable. Warm, both return from the memo
without doing the work that distinguishes them, which is why they match. `raw()` is unchanged — it still resolves
styles, because that is what it returns.

### The trade

CSS grows. Two recipes that both set `padding: 4` no longer share one atomic rule, and a variant that repeats a
declaration repeats it in each rule. In exchange the markup shrinks — a component carrying a recipe goes from a class
per property to its base class plus one per active variant, which in this repo's own fixtures is 23 classes down to 2.

### Also fixed

Two naming bugs that predate this change and affected config recipes too, both found by extending `checkNamingAgreement`
to cover recipes:

- A variant value containing a space named `--size-x\ large` in the stylesheet and `--size-x_large` in the browser. The
  build now applies `withoutSpace`, as the runtime always has.
- Under `hash: true` the build reported a recipe's **base** class unhashed while emitting the rule under the hashed
  name, so `@bamboocss/vite` could fold a class literal no rule existed for.

### Upgrading

Class names change for every `cva`/`sva` call site, so DOM snapshots and any CSS that targeted the generated atomic
classes will need updating. Styles themselves are unchanged. If you were relying on a `cva` losing to a `css()` by
stylesheet order, it now wins or loses by layer instead — which is the point, but it is a change in behaviour.
