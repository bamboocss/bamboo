# @bamboocss/eslint-plugin

## 1.17.2

### Patch Changes

- @bamboocss/config@1.17.2
- @bamboocss/generator@1.17.2
- @bamboocss/shared@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [fc381ca]
  - @bamboocss/shared@1.17.1
  - @bamboocss/generator@1.17.1
  - @bamboocss/config@1.17.1

## 1.17.0

### Minor Changes

- b1f94f7: Add `require-recipe-class-name`, warning on a recipe whose class names depend on what the build could read.

  A `cva`/`sva` with no `className` is named by hashing its config, and that name is derived twice — the build hashes
  the config it could **read**, the browser hashes the one it **holds**. Anything the build cannot resolve makes those
  two objects differ, so the element carries classes no rule was emitted under and renders with no styles at all.

  ```jsx
  // ⚠️ the build cannot resolve the spread, so it hashes a different object
  const button = cva({ base: { ...getFocusRingStyles(), padding: '4' } })

  // ✅ the identity short-circuits on the name and never hashes the styles
  const button = cva({
    className: 'button',
    base: { ...getFocusRingStyles(), padding: '4' },
  })
  ```

  Naming the recipe removes the failure rather than banning the pattern: a declaration the build could not read then
  costs only itself, which is what it cost before recipes were named semantically. Readable class names come with it.

  `mode: 'dynamic-only'` — what `recommended` enables — narrows it to configs that are not plain static literals, which
  is where the divergence is possible. `mode: 'always'` requires a name everywhere.

  This is the editor-time half of the build warning for an unreadable recipe config. It needs no extraction, so it fires
  before a build runs and catches shapes the build check cannot see.

### Patch Changes

- Updated dependencies [3cdd0d1]
- Updated dependencies [29f9bbe]
- Updated dependencies [28463ce]
- Updated dependencies [6577023]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
  - @bamboocss/generator@1.17.0
  - @bamboocss/shared@1.17.0
  - @bamboocss/config@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/config@1.16.1
- @bamboocss/generator@1.16.1
- @bamboocss/shared@1.16.1

## 1.16.0

### Minor Changes

- 091f2e1: **Breaking:** an inline `cva()`/`sva()` now emits the same kind of CSS as a recipe declared in
  `theme.recipes` — one class per variant, in the `recipes` cascade layer — instead of atomic classes in `utilities`.

  An inline recipe and a config recipe were the same declaration, evaluated by the same code, that produced different
  naming, a different layer and different override behaviour. Nothing about the two justified that: a config recipe is
  an inline one that happens to be declared somewhere with a name.

  ```js
  cva({
    base: { padding: '4' },
    variants: { size: { sm: { fontSize: 'sm' } } },
  })
  // before: 'p_4'                    in @layer utilities
  // now:    'cva_a1b2c3'             in @layer recipes
  //         'cva_a1b2c3--size_sm'    when size="sm"
  ```

  Three things follow.

  **A component written with `cva` is now reliably overridable.** Its classes are in `recipes`, so a consumer's `css()`
  in `utilities` wins by cascade layer in every build, without the consumer knowing how the component was declared. That
  was previously true only if you hoisted the styles into `theme.recipes`.

  **`cssMode: 'grouped'` no longer has an exception.** Recipes were extracted atomically whatever `cssMode` said,
  because a group class names a whole call and which variant combination a caller selects is not knowable at build time.
  That forced a second `css` instance — the internal `__atomicCss` — purely so their runtime could name classes the way
  the stylesheet did. Naming from the config is knowable in every mode, so `__atomicCss` is gone and `cva` no longer
  sprays atomic classes into grouped markup.

  **Compound variants are a compound selector.** `.btn--size_sm.btn--tone_a` rather than atomic classes joined at
  runtime, which puts them in the same layer as the rest of the recipe and leaves the runtime nothing to compute — the
  rule matches because both variant classes are already on the element.

  ### Naming

  The class prefix is derived from the config: `className` when you set one, otherwise a hash of the recipe's styles.

  ```js
  cva({ className: 'button', base: { padding: '4' } }) // .button, .button--size_sm
  cva({ base: { padding: '4' } }) //                      .cva_a1b2c3, .cva_a1b2c3--size_sm
  ```

  It has to come from the config because the build and the browser each derive it independently and never meet. Deriving
  it from the binding — `const button = cva(...)` — would need the build to rewrite the call, and a pipeline without
  that transform would then name classes differently from one with it.

  ### Faster at runtime

  Naming from the config means the runtime no longer resolves a style object to produce a class string. `cva()` used to
  run `mergeCss` per active variant and then name a class per property; it now walks the variant keys and concatenates.

  Measured with both shapes in one process, so the comparison cannot drift
  (`packages/generator/__tests__/cva.bench.ts`):

  ```
  cva() all-miss x10000   173.72 hz ±2.23%   (semantic)
                           33.38 hz ±0.91%   (the atomic shape this replaced)   → 5.2x
  cva() warm x10000      1,678    hz ±0.60%  (semantic)
                         1,720    hz ±0.51%  (atomic)                           → within noise
  ```

  All-miss is every call selecting a distinct variant combination, so nothing is reusable. Warm, both return from the
  memo without doing the work that distinguishes them, which is why they match. `raw()` is unchanged — it still resolves
  styles, because that is what it returns.

  ### The trade

  CSS grows. Two recipes that both set `padding: 4` no longer share one atomic rule, and a variant that repeats a
  declaration repeats it in each rule. In exchange the markup shrinks — a component carrying a recipe goes from a class
  per property to its base class plus one per active variant, which in this repo's own fixtures is 23 classes down to 2.

  ### Also fixed

  Two naming bugs that predate this change and affected config recipes too, both found by extending
  `checkNamingAgreement` to cover recipes:
  - A variant value containing a space named `--size-x\ large` in the stylesheet and `--size-x_large` in the browser.
    The build now applies `withoutSpace`, as the runtime always has.
  - Under `hash: true` the build reported a recipe's **base** class unhashed while emitting the rule under the hashed
    name, so `@bamboocss/vite` could fold a class literal no rule existed for.

  ### Upgrading

  Class names change for every `cva`/`sva` call site, so DOM snapshots and any CSS that targeted the generated atomic
  classes will need updating. Styles themselves are unchanged. If you were relying on a `cva` losing to a `css()` by
  stylesheet order, it now wins or loses by layer instead — which is the point, but it is a change in behaviour.

- f2d5df2: **Breaking:** remove the JSX factory. Bamboo no longer generates components, and is now framework-agnostic.

  `styled-system/jsx` is not emitted at all. `styled` / `bamboo`, style props, the `css` prop, `as`, `unstyled`,
  `createStyleContext`, `splitCssProps` and `isCssProperty` are gone, along with `jsxFramework`, `jsxFactory` and
  `jsxStyleProps`. There is no React, Vue, Solid, Preact or Qwik codegen left anywhere.

  ```tsx
  // before
  <styled.div color="red.300" padding="4">hi</styled.div>
  const Button = styled('button', buttonRecipe)

  // after
  <div className={css({ color: 'red.300', padding: '4' })}>hi</div>
  const Button = (props: ButtonProps) => {
    const [variantProps, rest] = buttonRecipe.splitVariantProps(props)
    return <button {...rest} className={cx(buttonRecipe(variantProps), props.className)} />
  }
  ```

  For an override to be deterministic the component's styles have to sit in a lower cascade layer, which means declaring
  them as a config recipe — an inline `cva()` is atomic and lands in `utilities` alongside the consumer. A component
  that instead accepts a style object and merges it with `css(base, props.css)` needs no layer at all.

  **Recipe JSX tracking is kept**, and no longer depends on `jsxFramework`. A recipe's `jsx: ['Button']` hint is how the
  build reads `<Button variant="danger">` on a component you wrote and emits `--variant_danger`; without it those
  variants would silently stop being generated. It costs no codegen — it is extraction only.

  **`createStyleContext` has no replacement in the box.** Compound components that need one slot to see the variant
  chosen at the root now write their own context; `docs/concepts/slot-recipes` documents the ~20-line version.

  What this removes beyond the API: the whole per-framework generator tree, `is-valid-prop` (a large module that shipped
  to the browser only to decide whether a prop was a style prop), `normalize-html`, the vite fold's JSX element path —
  which has nothing left to fold — and the per-framework test matrix.

  `@bamboocss/plugin-vue` and `@bamboocss/plugin-svelte` are unaffected: they transform source so the extractor can read
  it, which has nothing to do with the factory.

- 1dbeb84: **Breaking:** remove JSX pattern components.

  `styled-system/jsx` no longer emits a component per pattern — `<Stack>`, `<Box>`, `<HStack>` and the rest are gone,
  and `styled-system/jsx` now exports only the factory, `isCssProperty` and `createStyleContext`.

  Pattern **functions** are unchanged. Every pattern still ships from `styled-system/patterns`, and a pattern function
  passes arbitrary style props through, so the rewrite is mechanical and behaviour-preserving:

  ```tsx
  // before
  <Stack gap="4" mt="8">{children}</Stack>
  <Box p="4">{children}</Box>

  // after
  <div className={stack({ gap: '4', mt: '8' })}>{children}</div>
  <div className={css({ p: '4' })}>{children}</div>
  ```

  The `jsx`, `jsxName` and `jsxElement` fields on a pattern config are removed along with them — they only ever
  described a component bamboo generated. `jsx` on a **recipe** is untouched.

  Everything that existed to serve the component layer goes with it: the five per-framework pattern generators, the
  `jsx-patterns` artifact, the parser's `jsx-pattern` result type and `JsxEngine`'s pattern matcher, and the vite fold's
  pattern-element path. `Patterns.find`/`Patterns.filter` (both keyed by JSX name) are gone, and
  `StyleEncoder.processPattern` takes `(name, props, grouped)`.

  Two consequences worth knowing:
  - A component of your own named `Box` or `Stack` is no longer misread as bamboo's pattern. It extracts as an ordinary
    component, which is what it always was.
  - The `jsx-patterns-index` artifact is now `jsx-index`, since it no longer indexes patterns.

- 233ac01: Add `no-unlayered-override`, and correct what the docs claimed about which styles land in which layer.

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

  The docs now also give the mechanism with no caveats at all — accept a style object rather than a class name, and
  merge it with `css(base, props.css)`. That resolves per property before any class name exists, so it behaves
  identically in every build and needs no layer.

### Patch Changes

- Updated dependencies [1be9171]
- Updated dependencies [ca558fb]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [41ea189]
- Updated dependencies [645bb09]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [99ab42f]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
  - @bamboocss/generator@1.16.0
  - @bamboocss/shared@1.16.0
  - @bamboocss/config@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/generator@1.15.0
  - @bamboocss/shared@1.15.0
  - @bamboocss/config@1.15.0

## 1.14.0

### Patch Changes

- d0b7016: `no-escape-hatch` now looks inside `fallback(...)` candidates.

  The rule tests whether the value as a whole is an escape hatch, and a fallback wraps its candidates — so
  `fallback([stretch], 100%)` slipped past it even though `[stretch]` is exactly what the rule exists to catch. Each
  candidate is now checked on its own.

  No autofix is offered in that case: the existing suggestion rewrites the whole value to its unwrapped form, which for
  a fallback would be a no-op. The report still points at the value.

- Updated dependencies [7cc6235]
- Updated dependencies [b567114]
- Updated dependencies [3264da1]
- Updated dependencies [d1d05fc]
  - @bamboocss/generator@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/config@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [ba60cf5]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/generator@1.13.2
  - @bamboocss/config@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/generator@1.13.1
- @bamboocss/shared@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [8a6c23e]
- Updated dependencies [17de3d0]
- Updated dependencies [cd76ba7]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [fd03a10]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
- Updated dependencies [5b16a67]
  - @bamboocss/generator@1.13.0
  - @bamboocss/shared@1.13.0
  - @bamboocss/config@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/generator@1.12.3
- @bamboocss/config@1.12.3
- @bamboocss/shared@1.12.3

## 1.12.2

### Patch Changes

- Fix rule prefix in exported configs from `@bamboocss/` to `bamboo/` to match the plugin name used by consumers in
  ESLint flat config and oxlint jsPlugins.
  - @bamboocss/config@1.12.2
  - @bamboocss/generator@1.12.2
  - @bamboocss/shared@1.12.2

## 1.12.1

### Patch Changes

- Fix runtime error caused by test fixtures being bundled into the production dist, which created a dependency on
  @bamboocss/types at runtime.
  - @bamboocss/config@1.12.1
  - @bamboocss/generator@1.12.1
  - @bamboocss/shared@1.12.1

## 1.12.0

### Minor Changes

- Add ESLint plugin for Bamboo CSS with 19 rules covering design token enforcement, property validation, and best
  practices.

### Patch Changes

- @bamboocss/config@1.12.0
- @bamboocss/generator@1.12.0
- @bamboocss/shared@1.12.0
