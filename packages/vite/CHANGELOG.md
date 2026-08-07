# @bamboocss/vite

## 1.17.3

### Patch Changes

- Updated dependencies [a1df32d]
  - @bamboocss/extractor@1.17.3
  - @bamboocss/types@1.17.3
  - @bamboocss/node@1.17.3
  - @bamboocss/config@1.17.3
  - @bamboocss/core@1.17.3
  - @bamboocss/logger@1.17.3
  - @bamboocss/shared@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/config@1.17.2
- @bamboocss/node@1.17.2
- @bamboocss/core@1.17.2
- @bamboocss/extractor@1.17.2
- @bamboocss/logger@1.17.2
- @bamboocss/shared@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [a1c3990]
- Updated dependencies [fc381ca]
  - @bamboocss/core@1.17.1
  - @bamboocss/shared@1.17.1
  - @bamboocss/node@1.17.1
  - @bamboocss/config@1.17.1
  - @bamboocss/extractor@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/logger@1.17.1

## 1.17.0

### Minor Changes

- a30a279: Fold `recipe(props).slot` for slot recipes, including when the variant props are dynamic.

  A slot recipe call returns one class per slot rather than a string, so the fold declined it outright. What resolves to
  a string is the property access, and that is now what gets replaced:

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
  without static props. It matters most where it fires: the parts of a compound component, which are the hot render
  paths.

  Three cases are deliberately left alone, because their classes are not constant:
  - an anchor slot with a dynamic variant — its class _is_ the variant
  - any slot of an unscoped recipe (`scopeRoots: []`, or sibling slots with no anchor), where every slot takes variants
  - the whole `recipe(props)` call, which resolves to an object rather than a string

  The folded class is built through the same `createCss` the runtime uses rather than by concatenating the slot name, so
  `hash.className` and `prefix` reach it — reconstructing that string is exactly how the runtime and the stylesheet
  drifted apart once already.

  Measured on `fold.bench.ts`: every case within the control's own drift, so no measurable cost to the fold itself.

### Patch Changes

- 28463ce: Five fixes from an adversarial review of the previous batch. Four are in code that batch introduced.

  **The fold declined where the runtime throws — but only for scoped recipes.** A slot recipe call runs a `recipeFn` per
  slot, each calling `assertCompoundVariant`. Which slots get one depends on scoping: with anchors only they do, without
  them every slot does. The guard read the anchors alone, and `[].some()` is false — so an _unscoped_ recipe with
  compound variants folded a class where the call throws.

  **`cva().merge()` was not associative.** `a.merge(b).merge(c)` dropped `b` entirely, because the merged object
  re-exposed the left parent's `merge` closure and recomposed `a` with `c`. It now composes the _result_, so `merge` is
  associative and `variantKeys` keeps every parent's.

  **A merged recipe applied each parent's own defaults** while publishing merged ones, so `m()` and
  `m(m.getVariantProps())` disagreed. The selection is now resolved once and handed to both parents.

  **The fold rejected ordinary TypeScript.** `dyn as Size`, `dyn!`, `(dyn)` and `dyn ?? 'sm'` are erased before anything
  runs, so they cannot add an effect — but the new inertness check rejected them, losing folds that landed before it
  existed. It now sees through the erased wrappers, while still declining template substitutions and arithmetic, which
  coerce and can reach a getter.

  **A scoped compound variant lost its precedence, and a stale one could survive a rebuild.** Moving a compound into an
  `@scope` rule made its inner selector one class — the same specificity and the same scoping root as every
  single-variant scope — so the winner fell to stylesheet order, which for compounds is decided by whichever call site
  the build walked first. The compound's inner selector is now `:scope .slot`, restoring `(0,2,0)` against a variant's
  `(0,1,0)` without changing what it matches.

  Separately, `slotScopes` was cleared for variants but not for compounds, both being module-global. A recipe that
  stopped being scoped kept emitting the previous build's rule — naming an anchor nothing renders — and lost its own
  compound entirely. Both maps are now cleared before either is written.

- d5347ab: Four fixes found by auditing the recipe work for edge cases. Three are silent failures of the same shape: a
  class name derived one way for the stylesheet and another way for the browser.

  **The fold emitted broken JavaScript for a property access on `css()` or a pattern.** Folding a slot access widened
  the replaced range to cover the member expression — but the widening applied to every foldable call, so the property
  read was deleted:

  ```js
  css({ color: 'red' }).trim() // → "c_red"()          TypeError
  flex({ direction: 'row' }).split(' ') // → "d_flex flex-d_row"(' ')
  ```

  It now fires only for a recipe whose accessed property names a slot the recipe declares.

  **Every compound variant was dead under `hash: true` or `prefix`.** A compound's selector is assembled from class
  names, and it was assembled from raw ones while the element carried prefixed or hashed ones — so
  `.btn--size_sm.btn--tone_a` selected nothing while the element carried `bam-btn--size_sm bam-btn--tone_a`. The
  selector is now built through the same `formatSelector` as every other class.

  **A compound variant on a scoped slot recipe matched nothing at all.** A scoped slot carries only its constant class,
  so a compound selecting on that slot's variant classes can never apply. It is now scoped by the anchor, like the
  variants it refines:

  ```css
  @scope (.cmp__root--size_lg.cmp__root--tone_a) to (.cmp__root) { .cmp__item { … } }
  ```

  **Two slot recipes differing only in `slots` or `scopeRoots` collided.** `getRecipeIdentity` hashed only the style
  fields, so "same styles, different DOM topology" — exactly what `scopeRoots` exists for — produced one name. An inline
  recipe is registered once, so whichever was extracted first decided the emission for both and the other rendered
  unstyled. Both fields now count toward the identity, which changes the generated name of every anonymous `sva`.

  **An `sva` that omits `slots` rendered unstyled.** The build infers slots and the runtime does not, so once `slots`
  counted toward the identity the two sides derived different names. The identity is now hashed from the config as
  written — what both sides actually see — and `checkNamingAgreement` gained a canary that leaves `slots` out, so it
  cannot recur.

  **`auditSlotScopes` was a no-op under `hash` or `prefix`.** It builds its selectors from `classNameMap`, and an inline
  `sva` populated that map with raw names while returning formatted ones — so the diagnostic went silent in precisely
  the configs where a naming bug is likeliest. Config slot recipes were already correct; the two now agree.

- Updated dependencies [049a382]
- Updated dependencies [57b2e66]
- Updated dependencies [3cdd0d1]
- Updated dependencies [29f9bbe]
- Updated dependencies [66cb96c]
- Updated dependencies [28463ce]
- Updated dependencies [6577023]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [7251bf8]
- Updated dependencies [355e573]
  - @bamboocss/node@1.17.0
  - @bamboocss/extractor@1.17.0
  - @bamboocss/shared@1.17.0
  - @bamboocss/core@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/config@1.17.0
  - @bamboocss/logger@1.17.0

## 1.16.1

### Patch Changes

- Updated dependencies [c9b6bc7]
  - @bamboocss/extractor@1.16.1
  - @bamboocss/types@1.16.1
  - @bamboocss/node@1.16.1
  - @bamboocss/config@1.16.1
  - @bamboocss/core@1.16.1
  - @bamboocss/logger@1.16.1
  - @bamboocss/shared@1.16.1

## 1.16.0

### Minor Changes

- f798d1c: Fold a spread the extractor could account for, instead of declining every spread.

  The rule was "an inline object literal, or nothing". Not caution for its own sake — the extractor records what a
  spread _contributed_, so one it flattened and one it silently skipped were indistinguishable in the result. Both
  simply add keys, or fail to. Folding the second would have dropped styles with no error.

  `BoxNodeMap` now carries `resolvedSpreads`: the spreads the extractor walked structurally, recorded as their own
  expression nodes. That makes the two cases separable, so only the second declines:

  ```tsx
  const known = { padding: '4' }
  css({ color: 'red.300', ...known }) // → "c_red.300 p_4"

  // styles.ts
  export const shared = { padding: '4' }
  // use.tsx
  css({ color: 'red.300', ...shared }) // → "c_red.300 p_4", with styles.ts registered as a watch dependency
  ```

  Source order is preserved, so a spread still overrides what it lands on.

  Three decisions worth stating, because each is the difference between this being safe and not:

  **The list is of successes, not failures.** A consumer asks "may I trust this spread", and a list of what went wrong
  answers that only while it is exhaustive — an omission there is a wrong fold. A list of what went right is safe to be
  incomplete, because an omission costs a fold that does not happen.

  **Being walked is not being complete.** The extractor builds a map whenever it walked the object literal, however many
  of that object's properties it dropped along the way, and once they are flattened the loss is unrecoverable. So the
  record carries the map itself and the spread object gets the same audit the call does. Without that, these fold while
  silently losing styles:

  ```tsx
  const partial = { padding: '4', ...rest } // rest is unknown
  css({ color: 'red.300', ...partial }) // would have folded to "c_red.300 p_4"

  const computed = { padding: '4', [key]: '2' } // key is unknown
  const branching = {
    padding: '4',
    get mm() {
      return x ? '1' : '2'
    },
  }
  ```

  All of them now decline.

  **An _evaluated_ spread is not recorded, only a _walked_ one.** When the extractor runs an expression and gets a plain
  value back, the keys are re-boxed against the spread site and the file they came from is no longer recoverable from
  the tree. Folding that would produce a literal depending on a module the build cannot name — and so cannot watch. That
  is why an imported `css.raw()` value spread inside a nested selector still declines, while an imported plain object
  folds and reports its module.

  `resolvedSpreads` is kept off the map's `value` and is therefore invisible to `unbox`, so nothing that generates CSS
  sees it. No CSS output changes.

- 8fa12a2: Fold static `token()` calls into their values during the source transform.

  `token()` is what you reach for when a design token is needed somewhere Bamboo emits no CSS — an inline style, a
  canvas, a chart config. It was previously declined outright as `not-foldable`, on the grounds that it resolves to no
  class. It resolves to a literal, though, and that is enough to inline:

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
  - A path that is not **one resolved string literal**, as `dynamic`. A conditional is not one even when every branch is
    a real token: `token(dark ? 'colors.a' : 'colors.b')` boxes both branches, so folding either would pick a value and
    delete the condition that chose it.
  - A path resolving to no usable string, as the new `unresolved-token` — the path names no token, the value is empty,
    or the value is not a string (a numeric `fontWeights` token stays a number, and no string literal stands in for
    that). For the first two the runtime's `tokens[path]?.value || fallback` hands the result to the fallback, which is
    what declining preserves.
  - A second argument that could _run_ something (`token('colors.red.300', compute())`), as `dynamic`. Both arguments
    evaluate before the call, so folding it away would delete the call too. An inert fallback — a string, number,
    boolean, `null`, `undefined` — is provably dead and gets dropped.

  `token.var()` is left alone; it returns the variable reference where `token()` returns the resolved value.

  `FoldedCall` gains a `kind` field (`'class' | 'value'`) and an optional `value`. A token fold reports no class, so a
  consumer checking folded classes against the emitted stylesheet does not go looking for a rule behind a `var()`
  reference.

  The lookup table is built once per context and shared across the build, so a module that calls `token()` zero times
  pays nothing for this — asserted by counting table construction rather than by timing it.

  No CSS output changes.

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

- d7226f0: **Breaking:** remove template literal syntax.

  The `syntax` config option is gone, along with the `--syntax` CLI flag and the syntax question `bamboo init -i` asked.
  Styles are written as objects.

  A project that set `syntax: 'template-literal'` now gets a TypeScript error on the option, and its tagged templates
  are no longer read by the extractor — `` css`color: red;` `` and `` styled.div`color: red;` `` produce no CSS. Convert
  them to object literals:

  ```tsx
  // before
  const One = styled.div`
    display: flex;
    width: 300px;
  `

  // after
  const One = styled('div', {
    base: {
      display: 'flex',
      width: '300px',
    },
  })
  ```

  Everything the option gated goes with it: the string-literal `css`/`conditions` runtimes and the string-literal JSX
  factories and types for all five frameworks, the parser's tagged-template branch, the extractor's `taggedTemplates`
  matcher, the vite fold's tagged-template path, and `astish` from `@bamboocss/shared`. Under the object syntax `cva`,
  `sva`, patterns, `is-valid-prop`, style props and `viewTransition()` were already the only paths taken, so their
  generated output is unchanged — the codegen artifacts are byte-identical.

### Patch Changes

- c31e5f7: Fix a stale folded class after a cross-file edit under `vite build --watch`.

  The fold reports the modules it resolved through and the plugin registers them as watch files, so editing one
  re-transforms its consumers. That was only half the mechanism. A consumer is transformed _before_ the module it
  imports — that is how a bundler discovers imports — so the re-transform ran while the parser still held the previous
  contents, and folded the same stale class again:

  ```tsx
  // styles.ts — edited from red.300 to blue.500
  export const shared = { color: 'blue.500' }

  // consumer.tsx — rebuilt, and still folded to the old value
  export const cls = 'c_red.300'
  ```

  The class was correct for source the user no longer had, and nothing in the build said so. `addWatchFile` was doing
  its job; the rebuild was simply reading a cache nothing had invalidated.

  Two things made it worse than a single stale rebuild. The staleness was **permanent for the life of the watch
  session** — touching the consumer did not clear it, so the only recovery was restarting the build. And _deleting_ a
  folded dependency left the build **succeeding**: the fold had removed the last use of the import, so the bundler never
  saw an unresolved module and never reported one.

  The plugin now implements `watchChange`, which the bundler calls before the rebuild — the only point early enough. An
  edited module is re-read from disk and a deleted one is dropped, both of which also clear the resolutions memoized
  against the old contents. A deleted dependency now fails the build the way it should, and a recreated one recovers.

  A created file takes the same path as an edit. That matters for an editor's atomic save, which arrives as a delete
  followed by a create while the parser still holds the file.

  The hook is inert when `transform` is off, so a project using the plugin for nothing else does not pay for it. It is
  also purely additive — the bundler only registers it when a watcher exists, so a plain `vite build` never calls it,
  and nothing on the fold's own path changed.

  This does not reach `vite dev`: the plugin is `apply: 'build'`, so the fold never runs there and there is nothing to
  keep fresh. Editing `bamboo.config.ts` during a watch session is still not picked up, which is a separate gap.

- 645bb09: Stop the fold splitting one `css()` call, or one styled element, across several class names under
  `cssMode: 'grouped'`.

  A grouped class names a whole call, so a split hashes a fragment on each side, and the build emitted no rule for the
  fragment — leaving the element with **no** styles at all:
  - `css({ margin: '2', color: c ? 'red.300' : 'green.300' })` folded to three class names with a rule behind none.
  - Two ternaries in one call folded to four, while the build emits the four _combinations_ — a different set entirely.
  - `<styled.div margin="2" _hover={{ color: 'red.300', background: tone }} />` hoisted a `margin`-only literal, where
    the build hashes `margin` together with the resolved part of `_hover`.

  The fold now declines a split under `grouped` unless a single piece carries the whole object. A fully static call or
  element still folds, and so does a lone ternary, whose two arms the build emits as two complete groups. Everything
  else keeps its runtime call.

  `cssMode: 'atomic'`, the default, is unaffected.

- 41ea189: Fix four of the ways `cssMode: 'grouped'` returned class names the build emitted no rule for.

  A grouped class names a whole `css()` call, so the build and the runtime have to agree on which object that call
  resolves to. Where they disagreed the failure was silent and total — the element rendered with no styles at all, not
  merely the wrong ones. Now fixed:
  - **Patterns** (`stack({ gap: '4' })`) and their JSX form were extracted one class per property while the runtime
    hashed the transformed object as a group. They now group, matching `css(stackStyleFn(styles))`.
  - **The `css` prop on a `styled` element** was hashed apart from the style props beside it, though the factory merges
    both into a single `css(propStyles, cssStyles)` call. It now merges the way `mergeCss` does — normalizing each
    operand and then deep-merging, so a shorthand and its longhand collide as they will at runtime and a shared key
    holding a condition object keeps every branch. A `*Css` prop belongs to another slot and still gets its own call.
  - **`cva()` and `sva()` called directly**, and **config recipe compound variants**, asked for a group while the build
    hashed each variant's styles on its own — the only thing possible while their classes were named by property.
    Recipes are now named from their config instead, in the `recipes` layer, which `cssMode` does not reach at all.

  `@bamboocss/vite` folds the recipe half the same way, so a folded call agrees with both.

  What is still broken under `grouped` is now documented in the `cssMode` reference: JSX factories that merge several
  extracted objects into one grouped call, conditional values outside `css()`, and style objects the build cannot fully
  resolve.

  `cssMode: 'atomic'`, the default, is unchanged.

- Updated dependencies [f798d1c]
- Updated dependencies [bb6d999]
- Updated dependencies [4877a67]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [41ea189]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [6fb235d]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [99ab42f]
- Updated dependencies [2ab7f19]
- Updated dependencies [6fb235d]
- Updated dependencies [ca558fb]
- Updated dependencies [645bb09]
  - @bamboocss/extractor@1.16.0
  - @bamboocss/core@1.16.0
  - @bamboocss/node@1.16.0
  - @bamboocss/shared@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/config@1.16.0
  - @bamboocss/logger@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/shared@1.15.0
  - @bamboocss/types@1.15.0
  - @bamboocss/core@1.15.0
  - @bamboocss/node@1.15.0
  - @bamboocss/config@1.15.0
  - @bamboocss/extractor@1.15.0
  - @bamboocss/logger@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
- Updated dependencies [3264da1]
- Updated dependencies [d1d05fc]
- Updated dependencies [42fab68]
- Updated dependencies [7f87699]
- Updated dependencies [1f5d4fb]
- Updated dependencies [4a7d40c]
- Updated dependencies [f2d7565]
- Updated dependencies [faffa8e]
- Updated dependencies [745727b]
  - @bamboocss/types@1.14.0
  - @bamboocss/core@1.14.0
  - @bamboocss/node@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/config@1.14.0
  - @bamboocss/logger@1.14.0
  - @bamboocss/extractor@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/config@1.13.2
  - @bamboocss/core@1.13.2
  - @bamboocss/extractor@1.13.2
  - @bamboocss/node@1.13.2
  - @bamboocss/types@1.13.2
  - @bamboocss/logger@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/core@1.13.1
- @bamboocss/extractor@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/node@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/types@1.13.1

## 1.13.0

### Minor Changes

- 7bf6798: Lower a single dynamic style value to a class the runtime builds by concatenation, instead of leaving a
  `css()` call behind.

  `css({ margin: '2', color: tone })` folded to `cx("m_2", css({ color: tone }))`. It now folds to
  `cx("m_2", cssLeaf("c_", "color", tone))`, where `c_` is resolved at build time and the runtime only appends the
  value. Measured against the `css()` call it replaces: 2.2x when the memo would have hit, 43x when it would have missed
  — which is every SSR render, and any value that cycles past the memo's 1000-entry ceiling.

  This is sound because `css()` already builds the class from the value alone. `utility.transform` is string
  construction over a table fixed at build time and nothing consults which rules were emitted, so `css({ color: tone })`
  already returns `c_<tone>` for a value the extractor never saw, with no CSS behind it. The lowered form produces the
  same string in the same cases.

  Three shapes do not reduce to one class and fall back to `css()` at runtime, so nothing is lost: a responsive array, a
  condition object, and any non-scalar. `null` and `undefined` produce no class, as before. A value carrying whitespace
  or `!important` still resolves correctly but takes a regex path that is slower than a memo hit, so a call whose value
  always has one is better left alone.

  It applies to a top-level property of a single-argument `css()` call, with `hash` and `cssMode: 'grouped'` declining
  automatically — neither produces a class the value is merely appended to. Condition keys are declined too, since their
  value is an object in every real use. Turn it off with `partial: false`, alongside the rest of the splitting.

  Two notes for upgrades. `cssLeaf` is emitted by the generator, so a project whose `styled-system/` was generated
  before this release must be regenerated — the transform emits an import of it, and a stale runtime has no such export.
  And `sanitize` is now exported from `@bamboocss/shared`, so the class-name pipeline has one implementation rather than
  a copy in `leafClass`.

- 6fccbd9: Lower a ternary style value to a ternary between two class literals, instead of leaving the property to the
  runtime.
  - `css({ margin: '2', color: isError ? 'red.500' : 'green.500' })` now folds to
    `cx('m_2', isError ? 'c_red.500' : 'c_green.500')`, removing the `css()` call entirely when nothing else is dynamic.
  - Independent conditionals stay linear: two of them emit two ternaries, not four combinations.
  - Declined when a branch does not resolve, when two ternaries would emit a class for the same property, when the
    conditional was written somewhere other than the call site, and when hoisting the condition would reorder it against
    a dynamic value beside it. A declined lowering sends its property back to the runtime call rather than giving up the
    split, so the static half is still hoisted.
  - `FoldedCall` gains `classNames`, listing every class literal the rewrite emits including both arms of each ternary.
    `className` continues to hold only the part resolved outright, which is empty when a call lowered entirely.

- 2dda723: Fold a `styled.*` element that carries a runtime `className`.

  `<styled.div color="red.300" className={cn} />` kept its factory because a dynamic class could not be concatenated
  into a literal. The split already emits a `cx` call, so it becomes `<div className={cx("c_red.300", cn)} />` — with
  `cn` last, which is where the factory's own `cx(styles, props.className)` put it, so a class it carries still wins the
  way it did before.

  This is the most common reason a reusable component declined, since forwarding `className` is how one is usually made
  composable. Rendering fifty trees of such elements: 4.45x.

  It has to be emitted last for the cascade and first for evaluation order, so a `className` declines when something
  written after it survives the fold and could observe the swap. The test is two-sided, because `A;B` becoming `B;A`
  shows as soon as `A` writes what `B` reads: a constant commutes with anything, while an expression that only reads
  commutes only while the `className` cannot write. So `className={cn} onClick={h}` folds, `className={cn} id="x"`
  folds, and `className={assigns()} bg={tone}` does not. A static style prop is exempt either way, being resolved rather
  than emitted. A `className` written twice declines unless both are static, where the later simply overwrites as it
  does at runtime.

  An element with no style props at all now folds to `cx(cn)` rather than keeping a factory that had nothing to do.

  Build time is unchanged on modules where nothing folds. Two per-file scans the helper resolution runs — the module
  specifiers and the module-scope names — are now memoized against the file's text rather than repeated per element,
  which removes a superlinear term predating this change: folding 600 elements went from 317ms to 39ms. A residual term
  remains, since the declarations themselves are still walked per element.

- e7aeced: Lower a runtime-valued style prop on a `styled.*` element, instead of sending it to a `css()` call.

  `<styled.div color="red.300" backgroundColor={tone} />` folded to `cx("c_red.300", css({ backgroundColor: tone }))`.
  It now folds to `cx("c_red.300", cssLeaf("bg-c_", "backgroundColor", tone))`, the same lowering the call-site split
  already did.

  An element whose props are _all_ runtime-valued now folds too, where it previously kept its factory for want of a
  static half to hoist. That is the case where the factory was pure overhead, since no static class amortised it.

  Rendering fifty trees of runtime-valued props goes from 1.58x to 2.86x against the unfolded source, and the fixture's
  `styled.*` elements drop from 6 to 1 with its `css()` calls from 1 to 0. A mixed tree is unchanged at 3.2x, since
  little of it reaches this path.

  Two rules narrow it, both about a `css()` object being last-wins where separate classes are not. Two props claiming
  one property — `mx` and `marginInline` — are never lowered apart. And lowered props may sit before or after what stays
  behind, but not interleave with it, since splitting the residue into two calls would turn one merge into two.

- e98339a: Fold a `styled.*` or pattern element that carries `ref`, `key` or an explicit `children` prop, under React.

  All three were declined alongside `unstyled` and `css`, but unlike those two they change nothing about how the element
  is styled — so the fold was refusing them for the company they kept.

  `<styled.div ref={r} color="red.300" />` becomes `<div ref={r} className={"c_red.300"} />`. React's factory forwards
  the ref to the element it renders, so moving it onto that element changes nothing — verified against a real DOM for
  object refs, callback refs, React 19 cleanup functions, detach on unmount, and `as` naming a component that does and
  does not forward.

  React only, and measured rather than reasoned about. Preact was included at first because its factory wraps in
  `forwardRef` too, and that inference was wrong: an unfolded `ref` there binds the component instance while a folded
  one binds the DOM node. Vue diverges for the plain reason — a ref on a component is the instance, on an element it is
  the node. Every other framework keeps the behaviour it had.

  `key` never reaches the component, React consuming it for reconciliation. An explicit `children` prop declines when
  the target is not an intrinsic tag: the factory's `children ?? combinedProps.children` collapses `null` to
  `undefined`, so a destructuring default fires where the folded `children={null}` would not.

  Each travels as a passthrough, so the ordering rules already in place apply — `className={writes()} ref={r}` declines,
  because the ref read would move behind the write.

  Two things this also closes on the pattern path. A `jsxElement` that is not an intrinsic tag now declines rather than
  folding: the runtime hands it to `createElement` as a string, so `jsxElement: 'Section'` folded to `<Section />`,
  which is a variable reference and threw at render. And `foo.bar` folded to a member expression naming something in
  scope.

  `unstyled` and a `css` prop still decline. Those two do change the styling: one skips the recipe, the other merges
  above the style props.

  No build-time cost either way. The per-element check is the same set lookup; elements that previously bailed at it now
  run the rest of the loop and fold, which is the point.

- a24d37a: Add `@bamboocss/vite`, with opt-in build-time source transformation.

  During a production build the plugin rewrites statically-resolvable `css()` and pattern calls into the class string
  they would have returned, so those calls cost nothing at runtime:

  ```tsx
  // you write
  export const title = css({ fontSize: 'lg', fontWeight: 'bold' })

  // the bundle gets
  export const title = 'fs_lg fw_bold'
  ```

  CSS output is unchanged — only the JavaScript changes. It is **off by default** and build-only:

  ```ts
  // vite.config.ts
  import bamboocss from '@bamboocss/vite'

  export default defineConfig({
    plugins: [bamboocss({ transform: true })],
  })
  ```

  The plugin does not emit CSS. Keep your existing PostCSS setup for that.

  `styled.*` elements collapse to the intrinsic tag they render, which is where most style resolution happens at runtime
  — the factory runs `splitProps`, `css()` and `cx` per element per render inside a `forwardRef`:

  ```tsx
  <styled.div color="red.300" onClick={fn}>hi</styled.div>
  <div onClick={fn} className={"c_red.300"}>hi</div>
  ```

  Props follow the factory's own rule: with no recipe attached, css properties are consumed and everything else reaches
  the DOM unchanged. Elements carrying `as`, `unstyled`, `css`, `ref`, a spread, a dynamic prop or an `html*` prop are
  left alone. Pass `jsx: false` for call-site folding only.

  A `styled.*` element with a static `as` folds to that tag, pattern elements (`<Stack>`) collapse the pattern and the
  factory together, and a call or element that is only _partly_ static splits — the resolvable half becomes a literal
  and the rest keeps its runtime call, joined with `cx`. Splitting is refused wherever the two halves could produce a
  class for the same property. Pass `partial: false` to disable it.

  Values composed across files fold too, since the extractor already resolves them — an imported `css.raw()` value, a
  plain exported object, an aliased import, or a pure local helper including an IIFE. When a fold reads from another
  module the plugin registers it as a watch dependency, so editing that module re-transforms its consumers instead of
  leaving a stale literal behind.

  Only fully static call sites fold. Anything else is left byte-identical: runtime values, ternaries, computed keys,
  spreads of anything but an inline object literal, and calls where any one argument is dynamic. `css.raw()` and the
  other `.raw()` variants never fold because they must keep returning a style object; `cva()`, `sva()`, and `token()`
  never fold because they do not evaluate to a class string. Set `reportSkipped: true` to have every declined call
  reported with a reason.

  Folded strings are computed through the same runtime `css` the app would have called, rebuilt in-process from the
  resolved config, so the substitution is behaviour-preserving by construction. Every folded class is separately
  asserted to be backed by a rule in the emitted CSS.

  Where this pays off: a cache miss costs ~3.1µs against ~66ns warm, and nested styles never reach the fast memoization
  path — a component with a condition and a responsive value costs ~437ns per call even fully cached. Folding removes
  that work rather than caching it. The runtime itself still ships, since dropping it would require every call site in
  the module graph to fold.

  Build only. Folding re-parses each module with `ts-morph` — measured at ~0.3ms for a small component and ~3ms for a
  147-line file with 24 call sites on `sandbox/vite-ts`, with the parse dominating and the fold adding ~10% on top. That
  amortizes across a build; on every hot update it would not, and a dev bundle gains nothing from pre-resolved style
  calls.

  Also scopes `RuleProcessor`'s `css`/`grouped`/`cva`/`sva`/`recipe` results to the call that produced them. They
  previously reported every class name the decoder had accumulated, which is correct for a processor used once and wrong
  for one shared across call sites. No change to CSS output or to any single-call result.

### Patch Changes

- d6e55ed: Decide whether the fold can add its `cx` import without binding the whole program.

  The check went through `sourceFile.getLocals()`, which reaches the compiler's symbol table and binds every `.d.ts` the
  module's imports touch. A syntactic walk of the module's statements answers the same question. Fold-only cost for a
  module that splits, A/B on an idle machine:

  | project size | before  | after  |
  | ------------ | ------- | ------ |
  | ~500 files   | 5.28ms  | 0.06ms |
  | ~2500 files  | 11.57ms | 0.07ms |

  85x at 500 files and 178x at 2500, and flat in project size where it previously grew linearly.

  The walk follows statements but not function or class bodies, since those open a new variable scope — so a hoisted
  `var` in any top-level block still blocks the insert, while one inside a function does not.

- 7a9413f: Stop folding a choice the extractor could not decide.

  The extractor answers "what styles could this produce", so when one arm of `a ? b : c`, `a || b` or `a && b` does not
  evaluate it returns the other rather than refusing. That is right for generating CSS and wrong for rewriting source,
  where the arm it kept becomes the only one that runs.
  - `css({ color: e ? 'red.300' : fn() })` folded to `c_red.300`, silently choosing a branch. Same for
    `fn() || 'blue.500'`, `fn() && 'blue.500'`, `on && fn()` with a truthy `on`, and `empty || 'blue.500'` with a falsy
    `empty`.
  - A choice with two resolvable arms still folds, including through named values and comparison conditions.
  - A nested object reached by name — `css({ _hover: base })` or the `css({ _hover })` shorthand — is now checked where
    it was written, so a spread or computed key inside the declaration is no longer invisible. An object passed as the
    whole argument, `css(base)`, is not yet: the extractor rebuilds that map against the call itself, leaving no
    declaration to follow.
  - A chain of short-circuits is judged all the way down, within the expression written at the call site.
    `fn() || 'red.300' || 'blue.500'` parses as `(fn() || 'red.300') || 'blue.500'`, so the outer operator was handed an
    arm the extractor had invented and read it as an ordinary literal. A choice reached through a _binding_ is still not
    judged — `const c = fn() || 'red.300'` followed by `css({ color: c })` folds to `c_red.300`.
  - A comparison is no longer folded to one of its operands. `css({ color: fn() === 'red.300' })` gave `c_red.300` and
    `css({ truncate: false === false })` gave `trunc_false`, where the value is `true`. The extractor collapses `===`,
    `in`, `instanceof` and the ordering operators the same way it collapses a choice, and never computes the comparison,
    so no answer it can give is the result.
  - A short-circuit folds only when its left operand is written at the call site. A box reached through a name records
    the declaration the extractor resolved through — `let m = '1'; m = undefined` still boxes as `'1'`, and a parameter
    default still boxes as its default for a caller that passed something else — and truthiness is exactly what that
    changes. So `const c = 'red.300'; css({ color: c || 'blue.500' })` no longer folds, while writing the value inline
    still does.

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [5b881ee]
- Updated dependencies [7bf6798]
- Updated dependencies [328a926]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [d7825f6]
- Updated dependencies [a966bae]
- Updated dependencies [5b16a67]
- Updated dependencies [a24d37a]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
  - @bamboocss/shared@1.13.0
  - @bamboocss/extractor@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/core@1.13.0
  - @bamboocss/node@1.13.0
  - @bamboocss/config@1.13.0
  - @bamboocss/logger@1.13.0
