# @bamboocss/parser

## 1.20.3

### Patch Changes

- Updated dependencies [fa63a80]
  - @bamboocss/core@1.20.3
  - @bamboocss/config@1.20.3
  - @bamboocss/extractor@1.20.3
  - @bamboocss/logger@1.20.3
  - @bamboocss/shared@1.20.3
  - @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/config@1.20.2
- @bamboocss/core@1.20.2
- @bamboocss/extractor@1.20.2
- @bamboocss/logger@1.20.2
- @bamboocss/shared@1.20.2
- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/config@1.20.1
- @bamboocss/core@1.20.1
- @bamboocss/extractor@1.20.1
- @bamboocss/logger@1.20.1
- @bamboocss/shared@1.20.1
- @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

- Updated dependencies [15e2d53]
- Updated dependencies [045ab1e]
- Updated dependencies [6512d6b]
- Updated dependencies [5d2c91c]
- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0441724]
- Updated dependencies [0e2cb31]
  - @bamboocss/core@1.20.0
  - @bamboocss/types@1.20.0
  - @bamboocss/shared@1.20.0
  - @bamboocss/extractor@1.20.0
  - @bamboocss/config@1.20.0
  - @bamboocss/logger@1.20.0

## 1.19.0

### Patch Changes

- Updated dependencies [510cdd3]
  - @bamboocss/core@1.19.0
  - @bamboocss/config@1.19.0
  - @bamboocss/extractor@1.19.0
  - @bamboocss/logger@1.19.0
  - @bamboocss/shared@1.19.0
  - @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [21c6daa]
- Updated dependencies [070f9da]
  - @bamboocss/shared@1.18.0
  - @bamboocss/core@1.18.0
  - @bamboocss/config@1.18.0
  - @bamboocss/extractor@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [a1df32d]
  - @bamboocss/extractor@1.17.3
  - @bamboocss/types@1.17.3
  - @bamboocss/config@1.17.3
  - @bamboocss/core@1.17.3
  - @bamboocss/logger@1.17.3
  - @bamboocss/shared@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/config@1.17.2
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
  - @bamboocss/config@1.17.1
  - @bamboocss/extractor@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/logger@1.17.1

## 1.17.0

### Minor Changes

- 049a382: Report a `css()` call the build could not fully read under `cssMode: 'atomic'`, not only under `grouped`.

  ```jsx
  css({ ...getFocusRingStyles(), color: 'red' })
  // `.c_red` is emitted; the focus ring's declarations are not, and nothing said so
  ```

  The detection was gated on `grouped` because that is where a loss is _fatal_ — one class names the whole call, so
  missing part of it costs all of it. Under `atomic` the loss is partial: what the build saw still applies. But it is no
  less silent, and a component quietly missing its focus ring is exactly the shape that gets reported as a mystery
  rather than as a bug.

  Only the surprising half is reported. A spread the build could not read **looks** static and is not, so it interrupts.
  A value it could not evaluate — `css({ color: getColor() })` — is the documented dynamic-styling shape, answered by
  `staticCss` and already covered by the `no-dynamic-styling` lint rule; warning on every one of those would bury the
  first. Grouped mode keeps reporting both, because there either kind costs the whole call.

  The message is written for the mode it fires in rather than reusing grouped's, which ended "to group it".

- 7251bf8: Report a recipe config the build could not fully read, instead of emitting a stylesheet nothing will ask for.

  A `cva`/`sva` config with a spread the extractor cannot resolve loses those declarations — and since 1.16 that is not
  a partial loss. A recipe's classes are named from a hash of its config, so a dropped declaration changes the hash: the
  build emits rules under one name and the browser asks for another, and the element renders with **no styles at all**.

  ```jsx
  cva({ base: { ...getFocusRing(), color: 'red' } })
  // build emits  .cva_iPlRDu, .cva_iPlRDu--size_sm
  // browser asks cva_gLgUZR…      — nothing matches
  ```

  Before 1.16 atomic class names were content-addressed per declaration, so the spread's properties were missing but
  everything the build _did_ resolve still applied. Semantic recipe naming turned that benign limit into total loss.

  The detection already existed — `findUnresolvedStyles`, added for `cssMode: 'grouped'`, where one class names a whole
  `css()` call. That gate was right for what it was written for and was never extended when recipes gained the same
  property, in every mode. Recipes are now checked regardless of `cssMode`, and the message says what to do:

  ```
  🎋 warn [recipe] app/Button.tsx:4:18 — an object spread or computed key leaves the build unable to tell
  which properties this call sets. A recipe's classes are named from a hash of its config, so a declaration
  the build cannot see gives the build and the browser different names and the element renders with no
  styles at all. Set `className` on the recipe, so its name does not depend on what the build could resolve.
  ```

  `className` is the fix as well as the workaround: the identity short-circuits on it and never hashes the styles, so
  extraction fidelity stops deciding the name and the loss degrades to the missing declarations alone. A recipe that
  sets one is not reported.

  Reported per level with its path — `base`, `variants.size.sm`, `compoundVariants.0.css`, `base.root` for a slot. Three
  ways a level can lose something are covered:
  - a **spread or computed key** that contributed no keys beyond those written beside it;
  - a **value the build could not evaluate** (`{ color: getColor() }`), which leaves no trace in the box tree at all
    because the pair is never recorded — this one needs the written source compared against the resolved data;
  - the config **not being an object literal**, as in `cva(someConfig)`, which is the quietest total loss of the lot.

  Every level is unwrapped first, so `as const` and `satisfies` — idiomatic on a recipe config — do not hide the loss. A
  spread of a literal is not reported, since its keys are written right there and nothing can have gone missing.

  **Cost.** The check walks the config, so it roughly doubles the walking a recipe already costs: on a file of eight
  variant-heavy recipes, parse goes from 1.087 ms to 1.390 ms (+28%). It is skipped entirely for a recipe that sets
  `className` — so the state this warning asks for is also the one that does not pay for it. Folding the comparison into
  extraction, rather than walking a second time, is the way to remove the cost outright.

  This does not change what CSS is emitted. `css()` in atomic mode still drops an unresolvable spread silently; that is
  unchanged and pre-existing.

### Patch Changes

- Updated dependencies [57b2e66]
- Updated dependencies [3cdd0d1]
- Updated dependencies [29f9bbe]
- Updated dependencies [66cb96c]
- Updated dependencies [28463ce]
- Updated dependencies [6577023]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [355e573]
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
  - @bamboocss/config@1.16.1
  - @bamboocss/core@1.16.1
  - @bamboocss/logger@1.16.1
  - @bamboocss/shared@1.16.1

## 1.16.0

### Minor Changes

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

- bb6d999: Fix `css([a, b])` emitting the second object at the `sm` breakpoint.

  `css()` accepts an array of style objects, and `mergeCss` flattens it before merging. The build hashed the array
  itself, so `walkObject` read its indices as a responsive array: `css([{ color: 'red' }, { padding: '2' }])` emitted
  `padding` inside a `min-width` media query while the runtime asked for an unconditional class. Under
  `cssMode: 'atomic'` the padding silently went missing; under `grouped` the whole call did.

  The array is flattened before hashing now, in both modes, so the build encodes the operands the runtime merges.

- bb6d999: Stop `cssMode: 'grouped'` rendering elements with no styles at all, in the shapes that were left.

  A grouped class names a whole `css()` call, so the build has to have encoded that exact call to emit its rule. The
  runtime already falls back to atomic class names when it has not — but a fallback only helps if atomic rules for those
  names exist, and the build emitted them for a `css()` call it knew it had lost and nowhere else. Every other way of
  losing a call landed on nothing, and the element rendered unstyled with no warning:
  - A conditional value beside any other prop on a JSX element or in a pattern —
    `<styled.div color={on ? 'red' : 'blue'} padding="2" />`. Only `css()` reconstructs a ternary's branches; a JSX
    element or a pattern encoded each extracted object on its own, and the runtime asked for the merge of them.
  - A value the build could not evaluate beside another prop on either —
    `<styled.div color={props.tone} padding="2" />`.
  - A property lost to a spread — `css({ ...props.styles, color: 'red' })`.
  - Two arguments setting one property, which the build read as a pair of ternary branches rather than as a merge —
    `css({ color: { base: 'red' } }, { color: { _hover: 'blue' } })`.

  Those now emit their atomic rules alongside their group, so the element keeps every declaration the build resolved —
  the same styling `cssMode: 'atomic'` gives for the same source. The `css()` cases warn, with a file, a line, and what
  to change; a conditional style prop is ordinary code and does not.

  Two shapes group properly now instead of degrading:
  - A ternary inside a condition block, beside another property —
    `css({ _hover: { color: on ? 'red' : 'blue' }, padding: '2' })`. Reconstructing the branches combined them with
    `Object.assign`, so the empty `_hover` carried by the entry holding `padding` replaced the branch's condition
    instead of merging into it. They are merged the way `mergeCss` merges now.
  - An array argument — `css([{ color: 'red' }, { padding: '2' }])`.

  A call site that emits atomic rules alongside its group costs some CSS. It is bounded by how many call sites the build
  cannot fully see, and buys back the styles they were dropping.

- 645bb09: Stop `cssMode: 'grouped'` rendering an element with no styles when the build could not see the whole `css()`
  call.

  A grouped class names a whole call, so the build has to have seen that exact call to emit its rule. When it had not —
  an unresolvable value, a combination it declined to enumerate — the runtime returned a class with nothing behind it
  and the element rendered blank. Not a degraded version of the styles: none of them.

  Three pieces, and the feature needs all three:
  - The build writes the set of grouped classes it emitted to `styled-system/css/groups.mjs`, refreshed after every
    extraction — including `--watch`, which reaches CSS emission through a path of its own. `codegen` seeds an empty one
    when the file is missing, so the import resolves on a fresh project, and leaves a populated one alone rather than
    blanking it.
  - The generated `css()` consults it. A class in the set is returned alone, as before. A class that is not keeps the
    group class and **adds** atomic names for each declaration.
  - A call the build flagged as unresolvable now contributes atomic rules as well as its group, so those names have
    somewhere to land. Gated on the call actually being at risk, so the duplication is bounded by unresolvable call
    sites rather than by stylesheet size.

  Adding to the group class rather than replacing it is what makes a stale registry harmless: it lags the stylesheet as
  a matter of when files land, and replacing would turn every lag into an element stripped of styles it really had. A
  wrong miss now costs one class that matches nothing. Only a false _hit_ can hurt, which is why the registry is an
  exact set and not a probabilistic one.

  A value the build never saw still has no rule under any mode — the same limit `atomic` has. What changes is that the
  declarations it _did_ resolve now apply.

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

- d652ed9: Stop `cssMode: 'grouped'` silently dropping style props from a `styled(Component, cvaConfig)` element.

  `<Button size="sm" fontSize="30px" />` rendered with no font size at all. The component's runtime merges the cva's
  styles with the element's style props into a single `css()` call, but the build cannot see through the component to
  the cva — it sees only the props. So the group it encoded was a strict _subset_ of the one the runtime asked for and
  could never match it, and the fallback then named the props atomically with no atomic rule to land on.

  Style props on an element whose component the build cannot see through are now encoded atomically as well as grouped.
  The cva's own styles are already atomic, so both halves of the merged call now have rules behind them.

  `styled.div` is unaffected: it carries no cva, its runtime groups exactly what the build encoded, and the atomic
  copies would be dead weight.

  This does not make `styled(Component, cvaConfig)` _group_ — the element still carries the cva's atomic classes rather
  than one class. It makes it correct.

- 645bb09: Warn, with a file and line, when a `css()` call under `cssMode: 'grouped'` contains a value the build cannot
  resolve.

  Under `grouped` one class names the whole call, so a property the build cannot see does not merely go missing — it
  changes the class, and the element renders with **no** styles at all. Until now that happened silently: the build
  emitted a rule, the runtime returned a different class, and nothing said so.

  Two shapes are detected, because one of them leaves no trace in the extracted styles:
  - a value boxed as unresolvable, or a template literal with an interpolation
  - a property whose value could not be evaluated at all — `css({ color: getColor() })`. The extractor records no pair
    for it, so the key vanishes from the box entirely; it is recovered by reading the call's object literal back and
    comparing.

  Shapes that cannot be read confidently — a spread, a computed key, a multi-argument call — are declined rather than
  guessed at, so the warning does not fire on styles that are fine.

  A warning, not an error: the build is not wrong and the same call is perfectly valid under `cssMode: 'atomic'`, which
  loses one declaration and keeps the rest. Nothing is reported under `atomic` for that reason.

- Updated dependencies [f798d1c]
- Updated dependencies [bb6d999]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [41ea189]
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
  - @bamboocss/extractor@1.16.0
  - @bamboocss/core@1.16.0
  - @bamboocss/shared@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/config@1.16.0
  - @bamboocss/logger@1.16.0

## 1.15.0

### Minor Changes

- 3014989: Add `viewTransition()` to `styled-system/css`.

  It styles the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) and
  returns one class for the bag:

  ```js
  import { viewTransition } from '../styled-system/css'

  const slide = viewTransition({
    group: { animationDuration: '0.4s' },
    imagePair: { isolation: 'isolate' },
    old: { animationName: 'slide-out' },
    new: { animationName: 'slide-in' },
  })
  // → 'vt_bxRGKd'
  ```

  ```css
  .vt_bxRGKd {
    view-transition-class: vt_bxRGKd;
  }
  ::view-transition-group(.vt_bxRGKd) {
    animation-duration: 0.4s;
  }
  ::view-transition-image-pair(.vt_bxRGKd) {
    isolation: isolate;
  }
  ::view-transition-old(.vt_bxRGKd) {
    animation-name: slide-out;
  }
  ::view-transition-new(.vt_bxRGKd) {
    animation-name: slide-in;
  }
  ```

  The class carries `view-transition-class`, not `view-transition-name`. A name has to be unique per element, so it
  cannot be shared, extracted or deduplicated — you still set that yourself. A class is shared by design, which is what
  lets one transition be emitted once and used anywhere.

  The four slots — `group`, `imagePair`, `old`, `new` — are ordinary style objects, so tokens, breakpoints and at-rule
  conditions resolve inside them. Rules land in the `utilities` layer, so a keyframe or token reached only from a
  transition is still seen by `pruneUnusedKeyframes` and `pruneUnusedTokens`.

  The class is a hash of the options with object keys sorted, so slot order and property order do not affect it, and
  keys that are not slots are ignored. A nullish slot is the same as an absent one, matching what the extractor can see.
  The build and the generated runtime call the same function to derive the class, so a call the extractor never saw
  still returns the class its CSS was written against.

  Aliased (`import { viewTransition as vt }`) and namespaced (`import * as bamboo`) imports are extracted. A project's
  own local `viewTransition`, or a recipe or pattern of that name, is left alone. Not extracted or generated for
  `template-literal` syntax.

  Two limits worth knowing, both documented: one class covers all four slots, so a value that cannot be resolved at
  build time costs the whole bag its CSS rather than one declaration; and conditions that lower to a selector (`_hover`,
  `_dark`) cannot reach a `::view-transition-*` pseudo-element, so only at-rule conditions apply inside a slot.

  No existing CSS output changes — nothing is emitted unless `viewTransition()` is called.

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/shared@1.15.0
  - @bamboocss/types@1.15.0
  - @bamboocss/core@1.15.0
  - @bamboocss/config@1.15.0
  - @bamboocss/extractor@1.15.0
  - @bamboocss/logger@1.15.0

## 1.14.0

### Minor Changes

- 3264da1: Export a `fallback()` helper from `styled-system/css`.

  `fallback(...)` previously existed only as a string, which meant no import to discover, no autocomplete and no hover.
  The helper builds the same string, so the two forms are interchangeable:

  ```js
  import { css, fallback } from '../styled-system/css'

  css({ height: fallback('100dvh', '100vh') })
  css({ height: 'fallback(100dvh, 100vh)' }) // identical
  ```

  The extractor evaluates the call, including under an alias (`import { fallback as fb }`). A project's own local
  `fallback` function is left alone — only an identifier that resolves to a bamboo import is treated as this helper.

  One case where the forms differ: a candidate built by another call, such as `token()`, cannot be resolved from inside
  the helper. Use the string form there — `` `fallback(${token('sizes.4')}, 100vh)` `` — which interpolates before the
  extractor sees it. The helper is not emitted for `syntax: 'template-literal'`.

  The candidates are still not individually type-checked, the same trade the `[...]` escape hatch makes.

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
  - @bamboocss/types@1.13.2
  - @bamboocss/logger@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/core@1.13.1
- @bamboocss/extractor@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/types@1.13.1

## 1.13.0

### Minor Changes

- 5b881ee: Extract styles composed across files. A named import whose value is static now folds at the call site:

  ```ts
  // styles.ts
  export const button = css.raw({ display: 'inline-flex', paddingInline: '4' })

  // button.tsx
  import { button } from './styles'
  css(button, { background: 'blue.500' }) // now emits the button styles too
  ```

  Previously the imported half resolved to nothing and was silently dropped, so only the inline object produced CSS.

  Supported: named imports, aliased named imports, re-exports, file-local alias chains, plain exported objects,
  `css.raw()` values, and imported values spread into objects or nested selectors. Not supported, and skipped without
  error: default imports, namespace imports, and values that are only known at runtime.

  Aliased named imports (`import { button as btn }`) were additionally never resolved even when file traversal was
  enabled — the lookup used the local binding name rather than the exported one.

- 5b881ee: Re-parse importers when a shared style file changes in watch mode.

  Cross-file extraction folds an imported value into the importing file's output, so editing `styles.ts` had to re-parse
  everyone importing it — watch only re-parsed and rebundled the changed file, leaving consumers emitting the previous
  styles until the process restarted.

  The parser now records a reverse dependency graph while parsing, covering both imports and re-exports, and exposes
  `project.getDependents(filePath)` for the transitive set. Watch rebundles those alongside the changed file. Edges are
  rebuilt on each parse, so removing an import stops forcing a rebuild of the file it no longer depends on.

### Patch Changes

- 172fec0: Resolve imports without initializing the type checker when building the dependency graph.

  Tracking which files import which ran through the symbol table, which forces the TypeScript type checker to initialize
  on first use — hundreds of milliseconds on a cold build, for what is only a filesystem question. Resolution now goes
  straight to the module resolver, with a shared cache so a repeated specifier does not hit the disk again.

  Resolved files are looked up in the project rather than added to it, so resolving a package import cannot pull its
  type declarations in. The graph continues to track only the files being scanned.

- 5b881ee: Build the stylesheet once per edit, not once per affected file.

  The stylesheet is built from the whole parser result, so rebuilding it per file meant one edit to a shared style file
  ran the full optimize pipeline and wrote to disk once for every file importing it — 61 builds and 61 writes for a file
  with 60 importers. Affected files are now re-parsed first and the sheet is built and written a single time.

  A file appearing also reaches the files that were importing it before it existed. Those importers have no dependency
  edge to follow, since the specifier resolved to nothing when they were parsed, so they are tracked separately and
  rebuilt when a new file arrives.

- 5b881ee: Serve fresh values to importers after a shared style file is edited or deleted.

  Resolved values are memoized against the AST node that produced them, but a node's value can come from another file —
  `css(button)` folds whatever `./styles` exports. Editing that file replaces only its own nodes, so an importer's nodes
  stayed identical and kept serving the value read before the edit. Re-parsing the importer was not enough to clear it.

  The memo is now dropped whenever a file's contents are replaced or reloaded, which is the point at which another
  file's resolutions can have gone out of date. Deleting a shared file also rebuilds its importers, resolving them
  before the file leaves the project rather than after, when its path can no longer be matched.

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
- Updated dependencies [a24d37a]
- Updated dependencies [5b881ee]
  - @bamboocss/shared@1.13.0
  - @bamboocss/extractor@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/core@1.13.0
  - @bamboocss/config@1.13.0
  - @bamboocss/logger@1.13.0

## 1.12.3

### Patch Changes

- Updated dependencies
  - @bamboocss/core@1.12.3
  - @bamboocss/config@1.12.3
  - @bamboocss/extractor@1.12.3
  - @bamboocss/logger@1.12.3
  - @bamboocss/shared@1.12.3
  - @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/config@1.12.2
- @bamboocss/core@1.12.2
- @bamboocss/extractor@1.12.2
- @bamboocss/logger@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/config@1.12.1
- @bamboocss/core@1.12.1
- @bamboocss/extractor@1.12.1
- @bamboocss/logger@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/config@1.12.0
- @bamboocss/core@1.12.0
- @bamboocss/extractor@1.12.0
- @bamboocss/logger@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- Updated dependencies [f3591d8]
  - @bamboocss/config@1.11.5
  - @bamboocss/core@1.11.5
  - @bamboocss/extractor@1.11.5
  - @bamboocss/logger@1.11.5
  - @bamboocss/shared@1.11.5
  - @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/config@1.11.4
  - @bamboocss/core@1.11.4
  - @bamboocss/extractor@1.11.4
  - @bamboocss/logger@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/config@1.11.3
  - @bamboocss/core@1.11.3
  - @bamboocss/extractor@1.11.3
  - @bamboocss/logger@1.11.3
  - @bamboocss/shared@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/extractor@1.11.2
  - @bamboocss/config@1.11.2
  - @bamboocss/logger@1.11.2
  - @bamboocss/shared@1.11.2
  - @bamboocss/types@1.11.2
  - @bamboocss/core@1.11.2

## 1.11.1

### Patch Changes

- 2ea9205: Add `matchTagMode` to let parser hooks fully override JSX tag matching.

  ```ts
  hooks: {
    'parser:before': ({ configure }) => {
      configure({
        matchTagMode: 'override',
        matchTag(tag, isBambooComponent) {
          return isBambooComponent && tag !== 'Stack'
        },
      })
    },
  }
  ```

- Updated dependencies [2f29aa6]
- Updated dependencies [2ea9205]
  - @bamboocss/core@1.11.1
  - @bamboocss/types@1.11.1
  - @bamboocss/config@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/extractor@1.11.1
  - @bamboocss/shared@1.11.1

## 1.11.0

### Patch Changes

- b567ae6: Improve compiled JSX extraction so `css` props are recognized from framework runtime helper output, including
  React, Preact, Vue, Solid, and Qwik builds.
- 0608e92: Normalize tsconfig `compilerOptions` before passing them to ts-morph.

  TypeScript 6.0 (bundled inside `ts-morph@28` via `@ts-morph/common@0.29`) now refuses to accept raw JSON
  `compilerOptions` with string-form enum values like `target: "ESNext"`. They must be converted to numeric enum values
  via the TypeScript parser API.

  Previously, bamboo forwarded the parsed-as-JSON `compilerOptions` from `get-tsconfig` straight to ts-morph, which
  caused `bamboo` (codegen and any command that loads source files) to throw:

  ```
  target is a string value; tsconfig JSON must be parsed with parseJsonSourceFileConfigFileContent
  or getParsedCommandLineOfConfigFile before passing to createProgram
  ```

  We now run `compilerOptions` through `ts.convertCompilerOptionsFromJson` so string enums are normalized before
  ts-morph instantiates its TypeScript program.

- Updated dependencies [b567ae6]
- Updated dependencies [055e69c]
- Updated dependencies [78869ae]
  - @bamboocss/extractor@1.11.0
  - @bamboocss/core@1.11.0
  - @bamboocss/types@1.11.0
  - @bamboocss/config@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.
- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0
  - @bamboocss/core@1.10.0
  - @bamboocss/config@1.10.0
  - @bamboocss/extractor@1.10.0

## 1.9.1

### Patch Changes

- Updated dependencies [8fda1a5]
  - @bamboocss/core@1.9.1
  - @bamboocss/config@1.9.1
  - @bamboocss/extractor@1.9.1
  - @bamboocss/logger@1.9.1
  - @bamboocss/shared@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Minor Changes

- 3ca1f24: Add support for `*Css` prop convention in JSX components.

  Any JSX prop ending with `Css` (camelCase, e.g. `inputCss`, `wrapperCss`) is now treated as a style prop during static
  extraction, enabling compound component patterns like:

  ```tsx
  function Comp(props) {
    const { inputCss, wrapperCss, children } = props
    return (
      <styled.div css={wrapperCss}>
        <styled.input css={inputCss} />
        {children}
      </styled.div>
    )
  }

  // Usage - styles are statically extracted
  const usage = <Comp inputCss={{ color: 'red.200' }} wrapperCss={{ display: 'flex' }} />
  ```

  This works in both `all` and `minimal` JSX style prop modes, with no configuration needed.

### Patch Changes

- Updated dependencies [3ca1f24]
- Updated dependencies [7d66c0b]
  - @bamboocss/core@1.9.0
  - @bamboocss/config@1.9.0
  - @bamboocss/extractor@1.9.0
  - @bamboocss/logger@1.9.0
  - @bamboocss/shared@1.9.0
  - @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
- Updated dependencies [82d23ab]
  - @bamboocss/types@1.8.2
  - @bamboocss/core@1.8.2
  - @bamboocss/config@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/extractor@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/config@1.8.1
  - @bamboocss/core@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/extractor@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/config@1.8.0
- @bamboocss/core@1.8.0
- @bamboocss/extractor@1.8.0
- @bamboocss/logger@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/config@1.7.3
- @bamboocss/core@1.7.3
- @bamboocss/extractor@1.7.3
- @bamboocss/logger@1.7.3
- @bamboocss/shared@1.7.3
- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/config@1.7.2
- @bamboocss/core@1.7.2
- @bamboocss/extractor@1.7.2
- @bamboocss/logger@1.7.2
- @bamboocss/shared@1.7.2
- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- Updated dependencies [cc04ebf]
  - @bamboocss/config@1.7.1
  - @bamboocss/core@1.7.1
  - @bamboocss/extractor@1.7.1
  - @bamboocss/logger@1.7.1
  - @bamboocss/shared@1.7.1
  - @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
- Updated dependencies [f37fd8d]
  - @bamboocss/types@1.7.0
  - @bamboocss/core@1.7.0
  - @bamboocss/config@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/extractor@1.7.0
  - @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- 8f43369: Fix css.raw spreading within selectors and conditions

  Fixed several scenarios where spreading css.raw objects wouldn't be properly extracted:

  **Child selectors:**

  ```js
  const baseStyles = css.raw({ margin: 0, padding: 0 })
  const component = css({
    '& p': { ...baseStyles, fontSize: '1rem' }, // Now works
  })
  ```

  **Nested conditions:**

  ```js
  const interactive = css.raw({ cursor: 'pointer', transition: 'all 0.2s' })
  const card = css({
    _hover: {
      ...interactive, // Now works
      _dark: { ...interactive, color: 'white' },
    },
  })
  ```

  **CSS aliases:**

  ```js
  import { css as xcss } from 'styled-system/css'
  const styles = xcss.raw({ color: 'red' })
  // xcss.raw now properly recognized
  ```

- Updated dependencies [8f43369]
  - @bamboocss/core@1.6.1
  - @bamboocss/config@1.6.1
  - @bamboocss/extractor@1.6.1
  - @bamboocss/logger@1.6.1
  - @bamboocss/shared@1.6.1
  - @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/config@1.6.0
- @bamboocss/core@1.6.0
- @bamboocss/extractor@1.6.0
- @bamboocss/logger@1.6.0
- @bamboocss/shared@1.6.0
- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/config@1.5.1
- @bamboocss/core@1.5.1
- @bamboocss/extractor@1.5.1
- @bamboocss/logger@1.5.1
- @bamboocss/shared@1.5.1
- @bamboocss/types@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies [1b85b61]
- Updated dependencies [91c65ff]
  - @bamboocss/extractor@1.5.0
  - @bamboocss/types@1.5.0
  - @bamboocss/core@1.5.0
  - @bamboocss/config@1.5.0
  - @bamboocss/logger@1.5.0
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- Updated dependencies [bb32028]
- Updated dependencies [84a0de9]
  - @bamboocss/core@1.4.3
  - @bamboocss/config@1.4.3
  - @bamboocss/extractor@1.4.3
  - @bamboocss/logger@1.4.3
  - @bamboocss/shared@1.4.3
  - @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.
- 70420dd: Fix issue where using `token()` or `token.var()` function from `styled-system/tokens` doesn't get resolved by
  the compiler.

  ```tsx
  import { token } from 'styled-system/tokens'
  import { css } from 'styled-system/css'

  css({
    // This didn't work before, but now it does
    outline: `2px solid ${token('colors.gray.500')}`,

    // This has always worked
    outline: `2px solid token('colors.gray.500')`,
  })
  ```

  This also supports fallback values.

  ```tsx
  css({
    color: token('colors.brand.primary', '#3b82f6'),
  })
  ```

- Updated dependencies [0679f6f]
- Updated dependencies [1290a27]
- Updated dependencies [70420dd]
  - @bamboocss/config@1.4.2
  - @bamboocss/shared@1.4.2
  - @bamboocss/extractor@1.4.2
  - @bamboocss/core@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/logger@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [db237b6]
  - @bamboocss/core@1.4.1
  - @bamboocss/config@1.4.1
  - @bamboocss/extractor@1.4.1
  - @bamboocss/logger@1.4.1
  - @bamboocss/shared@1.4.1
  - @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [4c291ca]
  - @bamboocss/core@1.4.0
  - @bamboocss/config@1.4.0
  - @bamboocss/extractor@1.4.0
  - @bamboocss/logger@1.4.0
  - @bamboocss/shared@1.4.0
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- Updated dependencies [7fcd100]
  - @bamboocss/core@1.3.1
  - @bamboocss/config@1.3.1
  - @bamboocss/extractor@1.3.1
  - @bamboocss/logger@1.3.1
  - @bamboocss/shared@1.3.1
  - @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0
  - @bamboocss/config@1.3.0
  - @bamboocss/core@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/extractor@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- @bamboocss/config@1.2.0
- @bamboocss/core@1.2.0
- @bamboocss/extractor@1.2.0
- @bamboocss/logger@1.2.0
- @bamboocss/shared@1.2.0
- @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0
  - @bamboocss/config@1.1.0
  - @bamboocss/shared@1.1.0
  - @bamboocss/core@1.1.0
  - @bamboocss/logger@1.1.0
  - @bamboocss/extractor@1.1.0

## 1.0.1

### Patch Changes

- @bamboocss/config@1.0.1
- @bamboocss/core@1.0.1
- @bamboocss/extractor@1.0.1
- @bamboocss/logger@1.0.1
- @bamboocss/shared@1.0.1
- @bamboocss/types@1.0.1

## 1.0.0

### Major Changes

- a3bcbea: Stable release of BambooCSS

  ### Style Context

  Add `createStyleContext` function to framework artifacts for React, Preact, Solid, and Vue frameworks

  ```tsx
  import { sva } from 'styled-system/css'
  import { createStyleContext } from 'styled-system/jsx'

  const card = sva({
    slots: ['root', 'label'],
    base: {
      root: {
        color: 'red',
        bg: 'red.300',
      },
      label: {
        fontWeight: 'medium',
      },
    },
    variants: {
      size: {
        sm: {
          root: {
            padding: '10px',
          },
        },
        md: {
          root: {
            padding: '20px',
          },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })

  const { withProvider, withContext } = createStyleContext(card)

  const CardRoot = withProvider('div', 'root')
  const CardLabel = withContext('label', 'label')
  ```

  Then, use like this:

  ```tsx
  <CardRoot size="sm">
    <CardLabel>Hello</CardLabel>
  </CardRoot>
  ```

### Patch Changes

- Updated dependencies [a3bcbea]
- Updated dependencies [a20811c]
  - @bamboocss/config@1.0.0
  - @bamboocss/core@1.0.0
  - @bamboocss/extractor@1.0.0
  - @bamboocss/logger@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- Updated dependencies [efa060d]
- Updated dependencies [d2aede5]
  - @bamboocss/shared@0.54.0
  - @bamboocss/config@0.54.0
  - @bamboocss/core@0.54.0
  - @bamboocss/extractor@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/logger@0.54.0

## 0.53.7

### Patch Changes

- Updated dependencies [5e5af6b]
- Updated dependencies [9453c9b]
  - @bamboocss/core@0.53.7
  - @bamboocss/config@0.53.7
  - @bamboocss/extractor@0.53.7
  - @bamboocss/logger@0.53.7
  - @bamboocss/shared@0.53.7
  - @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/config@0.53.6
- @bamboocss/core@0.53.6
- @bamboocss/extractor@0.53.6
- @bamboocss/logger@0.53.6
- @bamboocss/shared@0.53.6
- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/config@0.53.5
- @bamboocss/core@0.53.5
- @bamboocss/extractor@0.53.5
- @bamboocss/logger@0.53.5
- @bamboocss/shared@0.53.5
- @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- Updated dependencies [57343c1]
  - @bamboocss/core@0.53.4
  - @bamboocss/config@0.53.4
  - @bamboocss/extractor@0.53.4
  - @bamboocss/logger@0.53.4
  - @bamboocss/shared@0.53.4
  - @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/config@0.53.3
- @bamboocss/core@0.53.3
- @bamboocss/extractor@0.53.3
- @bamboocss/logger@0.53.3
- @bamboocss/shared@0.53.3
- @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- Updated dependencies [cde9a0b]
  - @bamboocss/config@0.53.2
  - @bamboocss/core@0.53.2
  - @bamboocss/extractor@0.53.2
  - @bamboocss/logger@0.53.2
  - @bamboocss/shared@0.53.2
  - @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/config@0.53.1
- @bamboocss/core@0.53.1
- @bamboocss/extractor@0.53.1
- @bamboocss/logger@0.53.1
- @bamboocss/shared@0.53.1
- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/types@0.53.0
  - @bamboocss/core@0.53.0
  - @bamboocss/config@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/extractor@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/config@0.52.0
- @bamboocss/core@0.52.0
- @bamboocss/extractor@0.52.0
- @bamboocss/logger@0.52.0
- @bamboocss/shared@0.52.0
- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/config@0.51.1
- @bamboocss/core@0.51.1
- @bamboocss/extractor@0.51.1
- @bamboocss/logger@0.51.1
- @bamboocss/shared@0.51.1
- @bamboocss/types@0.51.1

## 0.51.0

### Minor Changes

- d68ad1f: **[BREAKING]**: Fix issue where Next.js build might fail intermittently due to version mismatch between
  internal `ts-morph` and userland `typescript`.

  > The current version of TS supported is `5.6.2`

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/extractor@0.51.0
  - @bamboocss/config@0.51.0
  - @bamboocss/types@0.51.0
  - @bamboocss/core@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/shared@0.51.0

## 0.50.0

### Patch Changes

- 7c85ac7: Improve inference of slots in slot recipes when spreading and concatenating slot names.

  This handles the following case gracefully:

  ```ts
  const styles = sva({
    className: 'foo',
    slots: [...componentAnatomy.keys(), 'additional', 'slots', 'here'],
  })
  ```

  Bamboo will now infer the slots from the anatomy and add them to the recipe.

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
- Updated dependencies [7c85ac7]
  - @bamboocss/types@0.50.0
  - @bamboocss/core@0.50.0
  - @bamboocss/config@0.50.0
  - @bamboocss/logger@0.50.0
  - @bamboocss/extractor@0.50.0
  - @bamboocss/shared@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/types@0.49.0
  - @bamboocss/core@0.49.0
  - @bamboocss/config@0.49.0
  - @bamboocss/logger@0.49.0
  - @bamboocss/extractor@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- @bamboocss/config@0.48.1
- @bamboocss/core@0.48.1
- @bamboocss/extractor@0.48.1
- @bamboocss/logger@0.48.1
- @bamboocss/shared@0.48.1
- @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/config@0.48.0
- @bamboocss/core@0.48.0
- @bamboocss/extractor@0.48.0
- @bamboocss/logger@0.48.0
- @bamboocss/shared@0.48.0
- @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- @bamboocss/core@0.47.1
- @bamboocss/config@0.47.1
- @bamboocss/extractor@0.47.1
- @bamboocss/logger@0.47.1
- @bamboocss/shared@0.47.1
- @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/types@0.47.0
  - @bamboocss/core@0.47.0
  - @bamboocss/config@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/extractor@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- Updated dependencies [9fbd2d8]
  - @bamboocss/core@0.46.1
  - @bamboocss/config@0.46.1
  - @bamboocss/extractor@0.46.1
  - @bamboocss/logger@0.46.1
  - @bamboocss/shared@0.46.1
  - @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [54426a2]
- Updated dependencies [54426a2]
  - @bamboocss/core@0.46.0
  - @bamboocss/shared@0.46.0
  - @bamboocss/config@0.46.0
  - @bamboocss/extractor@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/logger@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/config@0.45.2
- @bamboocss/core@0.45.2
- @bamboocss/extractor@0.45.2
- @bamboocss/logger@0.45.2
- @bamboocss/shared@0.45.2
- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- @bamboocss/core@0.45.1
- @bamboocss/config@0.45.1
- @bamboocss/extractor@0.45.1
- @bamboocss/logger@0.45.1
- @bamboocss/shared@0.45.1
- @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [dcc9053]
- Updated dependencies [1e4da63]
- Updated dependencies [552dd4b]
  - @bamboocss/types@0.45.0
  - @bamboocss/core@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/config@0.45.0
  - @bamboocss/logger@0.45.0
  - @bamboocss/extractor@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [d7f5cab]
- Updated dependencies [c99cb75]
  - @bamboocss/config@0.44.0
  - @bamboocss/types@0.44.0
  - @bamboocss/core@0.44.0
  - @bamboocss/logger@0.44.0
  - @bamboocss/extractor@0.44.0
  - @bamboocss/shared@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0
  - @bamboocss/core@0.43.0
  - @bamboocss/config@0.43.0
  - @bamboocss/logger@0.43.0
  - @bamboocss/extractor@0.43.0
  - @bamboocss/shared@0.43.0

## 0.42.0

### Minor Changes

- e157dd1: - Ensure classnames are unique across utilities to prevent potential clash
  - Add support for `4xl` border radius token

### Patch Changes

- ec64819: Change recipes `className` to be optional, both for `recipes` and `slotRecipes`, with a fallback to its name.

  ```ts
  import { defineConfig } from '@bamboocss/core'

  export default defineConfig({
    recipes: {
      button: {
        className: 'button', // 👈 was mandatory, is now optional
        variants: {
          size: {
            sm: { padding: '2', borderRadius: 'sm' },
            md: { padding: '4', borderRadius: 'md' },
          },
        },
      },
    },
  })
  ```

- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [ec64819]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0
  - @bamboocss/core@0.42.0
  - @bamboocss/extractor@0.42.0
  - @bamboocss/config@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/shared@0.42.0

## 0.41.0

### Patch Changes

- 2750261: Fix an issue where spreading an identifier in a sva `slots` array would prevent expected CSS from being
  generated

  ```ts
  import { sva } from 'styled-system/css'
  const parts = ['positioner', 'content']

  const card = sva({
    slots: [...parts], // <- spreading here was causing the below CSS not to be generated, it's now fixed ✅
    base: {
      root: {
        p: '6',
      },
    },
  })
  ```

- Updated dependencies [2750261]
  - @bamboocss/extractor@0.41.0
  - @bamboocss/core@0.41.0
  - @bamboocss/types@0.41.0
  - @bamboocss/config@0.41.0
  - @bamboocss/logger@0.41.0
  - @bamboocss/shared@0.41.0

## 0.40.1

### Patch Changes

- Updated dependencies [d2cc156]
  - @bamboocss/core@0.40.1
  - @bamboocss/config@0.40.1
  - @bamboocss/extractor@0.40.1
  - @bamboocss/logger@0.40.1
  - @bamboocss/shared@0.40.1
  - @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- Updated dependencies [5dcdae4]
  - @bamboocss/core@0.40.0
  - @bamboocss/config@0.40.0
  - @bamboocss/extractor@0.40.0
  - @bamboocss/logger@0.40.0
  - @bamboocss/shared@0.40.0
  - @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 8b07cdf: Allow nesting (string) token references in the fallback argument, fix an issue where using CSS var in the
  fallback argument would be mistakenly escaped
- Updated dependencies [2f63a4c]
- Updated dependencies [1f636eb]
- Updated dependencies [8b07cdf]
  - @bamboocss/config@0.39.2
  - @bamboocss/shared@0.39.2
  - @bamboocss/core@0.39.2
  - @bamboocss/extractor@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/logger@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/config@0.39.1
- @bamboocss/core@0.39.1
- @bamboocss/extractor@0.39.1
- @bamboocss/logger@0.39.1
- @bamboocss/shared@0.39.1
- @bamboocss/types@0.39.1

## 0.39.0

### Minor Changes

- df2546a: **BREAKING 💥**

  Remove `linkBox` pattern in favor of using adding `position: relative` when using the `linkOverlay` pattern.

  **Before**

  ```jsx
  import { linkBox, linkOverlay } from 'styled-system/patterns'

  const App = () => {
    return (
      <div className={linkBox()}>
        <img src="https://via.placeholder.com/150" alt="placeholder" />
        <a href="#" className={linkOverlay()}>
          Link
        </a>
      </div>
    )
  }
  ```

  **After**

  ```jsx
  import { css } from 'styled-system/css'
  import { linkOverlay } from 'styled-system/patterns'

  const App = () => {
    return (
      <div className={css({ pos: 'relative' })}>
        <img src="https://via.placeholder.com/150" alt="placeholder" />
        <a href="#" className={linkOverlay()}>
          Link
        </a>
      </div>
    )
  }
  ```

### Patch Changes

- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/types@0.39.0
  - @bamboocss/core@0.39.0
  - @bamboocss/shared@0.39.0
  - @bamboocss/config@0.39.0
  - @bamboocss/logger@0.39.0
  - @bamboocss/extractor@0.39.0

## 0.38.0

### Patch Changes

- 96b47b3: Add support for array values in the special `css` property for the JSX factory and JSX patterns

  This makes it even easier to merge styles from multiple sources.

  ```tsx
  import { Stack, styled } from '../styled-system/jsx'

  const HeroSection = (props) => {
    return (
      <Stack css={[{ color: 'blue.300', padding: '4' }, props.css]}>
        <styled.div css={[{ fontSize: '2xl' }, props.hero]}>Hero Section</styled.div>
      </Stack>
    )
  }

  const App = () => {
    return (
      <>
        <HeroSection css={{ backgroundColor: 'yellow.300' }} hero={css.raw({ fontSize: '4xl', color: 'red.300' })} />
      </>
    )
  }
  ```

  should render something like:

  ```html
  <div class="d_flex flex_column gap_10px text_blue.300 p_4 bg_yellow.300">
    <div class="fs_4xl text_red.300">Hero Section</div>
  </div>
  ```

- 7a96298: Fix Bamboo imports detection when using `tsconfig`.`baseUrl` with an outdir that starts with `./`.
- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
- Updated dependencies [7a96298]
- Updated dependencies [2c8b933]
  - @bamboocss/types@0.38.0
  - @bamboocss/core@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/config@0.38.0
  - @bamboocss/logger@0.38.0
  - @bamboocss/extractor@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2
  - @bamboocss/config@0.37.2
  - @bamboocss/core@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/extractor@0.37.2
  - @bamboocss/shared@0.37.2

## 0.37.1

### Patch Changes

- 99870bb: Fix issue where setting the pattern `jsx` option with dot notation didn't work.

  ```jsx
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    patterns: {
      extend: {
        grid: {
          jsx: ['Form.Group', 'Grid'],
        },
        stack: {
          jsx: ['Form.Action', 'Stack'],
        },
      },
    },
  })
  ```

- Updated dependencies [88049c5]
- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/config@0.37.1
  - @bamboocss/types@0.37.1
  - @bamboocss/shared@0.37.1
  - @bamboocss/core@0.37.1
  - @bamboocss/logger@0.37.1
  - @bamboocss/extractor@0.37.1

## 0.37.0

### Patch Changes

- 7daf159: Fix a bug where some styles would be grouped together in the same rule, even if they were not related to each
  other.

  ## Internal details

  This was caused by an object reference being re-used while setting a property deeply in the hashes decoding process,
  leading to the mutation of a previous style object with additional properties.

- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/shared@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/core@0.37.0
  - @bamboocss/config@0.37.0
  - @bamboocss/extractor@0.37.0
  - @bamboocss/logger@0.37.0

## 0.36.1

### Patch Changes

- 35bd134: Fix JSX matching with recipes after introducing namespace imports

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    theme: {
      extend: {
        slotRecipes: {
          tabs: {
            className: 'tabs',
            slots: ['root', 'list', 'trigger', 'content', 'indicator'],
            base: {
              root: {
                display: 'flex',
                // ...
              },
            },
          },
        },
      },
    },
  })
  ```

  ```tsx
  const App = () => {
    return (
      // ❌ this was not matched to the `tabs` slot recipe
      // ✅ fixed with this PR
      <Tabs.Root defaultValue="button">
        <Tabs.List>
          <Tabs.Trigger value="button">Button</Tabs.Trigger>
          <Tabs.Trigger value="radio">Radio Group</Tabs.Trigger>
          <Tabs.Trigger value="slider">Slider</Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
      </Tabs.Root>
    )
  }
  ```

  We introduced a bug in [v0.34.2](https://github.com/bamboocss/bamboo/blob/main/CHANGELOG.md#0342---2024-03-08) where
  the `Tabs.Trigger` component was not being matched to the `tabs` slot recipe, due to the
  [new namespace import feature](https://github.com/bamboocss/bamboo/pull/2371).

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1
  - @bamboocss/config@0.36.1
  - @bamboocss/core@0.36.1
  - @bamboocss/logger@0.36.1
  - @bamboocss/extractor@0.36.1
  - @bamboocss/shared@0.36.1

## 0.36.0

### Patch Changes

- Updated dependencies [445c7b6]
- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/config@0.36.0
  - @bamboocss/types@0.36.0
  - @bamboocss/core@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/extractor@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- 50db354: Add missing reducers to properly return the results of hooks for `config:resolved` and `parser:before`
- c459b43: Fix extraction of JSX `styled` factory when using namespace imports

  ```tsx
  import * as bambooJsx from '../styled-system/jsx'

  // ✅ this will work now
  bambooJsx.styled('div', { base: { color: 'red' } })
  const App = () => <bambooJsx.styled.span color="blue">Hello</bambooJsx.styled.span>
  ```

- Updated dependencies [50db354]
- Updated dependencies [c459b43]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/config@0.35.0
  - @bamboocss/types@0.35.0
  - @bamboocss/core@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/extractor@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/config@0.34.3
- @bamboocss/core@0.34.3
- @bamboocss/extractor@0.34.3
- @bamboocss/logger@0.34.3
- @bamboocss/shared@0.34.3
- @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- 0bf09f2: Allow using namespaced imports

  ```ts
  import * as p from 'styled-system/patterns'
  import * as recipes from 'styled-system/recipes'
  import * as bamboo from 'styled-system/css'

  // this will now be extracted
  p.stack({ mt: '40px' })

  recipes.cardStyle({ rounded: true })

  bamboo.css({ color: 'red' })
  bamboo.cva({ base: { color: 'blue' } })
  bamboo.sva({ base: { root: { color: 'green' } } })
  ```

- Updated dependencies [0bf09f2]
- Updated dependencies [58388de]
  - @bamboocss/extractor@0.34.2
  - @bamboocss/core@0.34.2
  - @bamboocss/config@0.34.2
  - @bamboocss/types@0.34.2
  - @bamboocss/logger@0.34.2
  - @bamboocss/shared@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/core@0.34.1
- @bamboocss/config@0.34.1
- @bamboocss/extractor@0.34.1
- @bamboocss/logger@0.34.1
- @bamboocss/shared@0.34.1
- @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [1c63216]
- Updated dependencies [64d5144]
- Updated dependencies [d1516c8]
- Updated dependencies [9f04427]
  - @bamboocss/config@0.34.0
  - @bamboocss/core@0.34.0
  - @bamboocss/types@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/extractor@0.34.0
  - @bamboocss/shared@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [34d94cf]
- Updated dependencies [4736057]
- Updated dependencies [8feeb95]
- Updated dependencies [5a205e7]
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/core@0.33.0
  - @bamboocss/config@0.33.0
  - @bamboocss/types@0.33.0
  - @bamboocss/logger@0.33.0
  - @bamboocss/extractor@0.33.0
  - @bamboocss/shared@0.33.0

## 0.32.1

### Patch Changes

- 31071ba: Fix an issue for token names starting with '0'

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    theme: {
      tokens: {
        spacing: {
          '025': {
            value: '0.125rem',
          },
        },
      },
    },
  })
  ```

  and then using it like

  ```ts
  css({ margin: '025' })
  ```

  This would not generate the expected CSS because the parser would try to parse `025` as a number (`25`) instead of
  keeping it as a string.

- 5184771: Using colorPalette with DEFAULT values will now also override the current token path

  Given this config:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    theme: {
      extend: {
        semanticTokens: {
          colors: {
            bg: {
              primary: {
                DEFAULT: {
                  value: '{colors.red.500}',
                },
                base: {
                  value: '{colors.green.500}',
                },
                hover: {
                  value: '{colors.yellow.300}',
                },
              },
            },
          },
        },
      },
    },
  })
  ```

  And this style usage:

  ```ts
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  })
  ```

  This is the difference in the generated css

  ```diff
  @layer utilities {
    .color-palette_bg\\.primary {
  +    --colors-color-palette: var(--colors-bg-primary);
      --colors-color-palette-base: var(--colors-bg-primary-base);
      --colors-color-palette-hover: var(--colors-bg-primary-hover);
    }
  }
  ```

  Which means you can now directly reference the current `colorPalette` like:

  ```diff
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  +  backgroundColor: 'colorPalette',
  })
  ```

- f419993: - Prevent extracting style props of `styled` when not explicitly imported
  - Allow using multiple aliases for the same identifier for the `/css` entrypoints just like `/patterns` and `/recipes`

  ```ts
  import { css } from '../styled-system/css'
  import { css as css2 } from '../styled-system/css'

  css({ display: 'flex' })
  css2({ flexDirection: 'column' }) // this wasn't working before, now it does
  ```

- Updated dependencies [a032375]
- Updated dependencies [31071ba]
- Updated dependencies [f419993]
- Updated dependencies [89ffb6b]
  - @bamboocss/config@0.32.1
  - @bamboocss/types@0.32.1
  - @bamboocss/core@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/extractor@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- b32d817: Switch from `em` to `rem` for breakpoints and container queries to prevent side effects.

### Patch Changes

- Updated dependencies [433a364]
- Updated dependencies [7e70b6b]
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
- Updated dependencies [b32d817]
  - @bamboocss/core@0.32.0
  - @bamboocss/extractor@0.32.0
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/config@0.32.0
  - @bamboocss/logger@0.32.0

## 0.31.0

### Minor Changes

- f0296249: - Sort the longhand/shorthand atomic rules in a deterministic order to prevent property conflicts
  - Automatically merge the `base` object in the `css` root styles in the runtime
  - This may be a breaking change depending on how your styles are created

  Ex:

  ```ts
  css({
    padding: '1px',
    paddingTop: '3px',
    paddingBottom: '4px',
  })
  ```

  Will now always generate the following css:

  ```css
  @layer utilities {
    .p_1px {
      padding: 1px;
    }

    .pt_3px {
      padding-top: 3px;
    }

    .pb_4px {
      padding-bottom: 4px;
    }
  }
  ```

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [e2ad0eed]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
- Updated dependencies [ddeda8ac]
  - @bamboocss/types@0.31.0
  - @bamboocss/config@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/core@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/extractor@0.31.0

## 0.30.2

### Patch Changes

- 6b829cab: Allow configuring the `matchTag` / `matchTagProp` functions to customize the way Bamboo extracts your JSX.
  This can be especially useful when working with libraries that have properties that look like CSS properties but are
  not and should be ignored.

  > **Note**: This feature mostly affects users who have `jsxStyleProps` set to `all`. This is currently the default.
  >
  > Setting it to `minimal` (which also allows passing the css prop) or `none` (which disables the extraction of CSS
  > properties) will make this feature less useful.

  Here's an example with Radix UI where the `Select.Content` component has a `position` property that should be ignored:

  ```tsx
  // Here, the `position` property will be extracted because `position` is a valid CSS property
  <Select.Content position="popper" sideOffset={5}>
  ```

  ```tsx
  export default defineConfig({
    // ...
    hooks: {
      'parser:before': ({ configure }) => {
        configure({
          // ignore the Select.Content entirely
          matchTag: (tag) => tag !== 'Select.Content',
          // ...or specifically ignore the `position` property
          matchTagProp: (tag, prop) => tag === 'Select.Content' && prop !== 'position',
        })
      },
    },
  })
  ```

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/core@0.30.2
  - @bamboocss/config@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/extractor@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- Updated dependencies [ffe177fd]
  - @bamboocss/config@0.30.1
  - @bamboocss/core@0.30.1
  - @bamboocss/extractor@0.30.1
  - @bamboocss/logger@0.30.1
  - @bamboocss/shared@0.30.1
  - @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- d5977c24: - Add a `--logfile` flag to the `bamboo`, `bamboo codegen`, `bamboo cssgen` and `bamboo debug` commands.
  - Add a `logfile` option to the postcss plugin

  Logs will be streamed to the file specified by the `--logfile` flag or the `logfile` option. This is useful for
  debugging issues that occur during the build process.

  ```sh
  bamboo --logfile ./logs/bamboo.log
  ```

  ```js
  module.exports = {
    plugins: {
      '@bamboocss/dev/postcss': {
        logfile: './logs/bamboo.log',
      },
    },
  }
  ```

- Updated dependencies [0dd45b6a]
- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
- Updated dependencies [d5977c24]
  - @bamboocss/config@0.30.0
  - @bamboocss/types@0.30.0
  - @bamboocss/shared@0.30.0
  - @bamboocss/core@0.30.0
  - @bamboocss/logger@0.30.0
  - @bamboocss/extractor@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/config@0.29.1
  - @bamboocss/extractor@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- 7c7340ec: Add support for token references with curly braces like `{path.to.token}` in media queries, just like the
  `token(path.to.token)` alternative already could.

  ```ts
  css({
    // ✅ this is fine now, will resolve to something like
    // `@container (min-width: 56em)`
    '@container (min-width: {sizes.4xl})': {
      color: 'green',
    },
  })
  ```

  Fix an issue where the curly token references would not be escaped if the token path was not found.

- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [ea3f5548]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/config@0.29.0
  - @bamboocss/extractor@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Minor Changes

- f58f6df2: Refactor `config.hooks` to be much more powerful, you can now:
  - Tweak the config after it has been resolved (after presets are loaded and merged), this could be used to dynamically
    load all `recipes` from a folder
  - Transform a source file's content before parsing it, this could be used to transform the file content to a
    `tsx`-friendly syntax so that Bamboo's parser can parse it.
  - Implement your own parser logic and add the extracted results to the classic Bamboo pipeline, this could be used to
    parse style usage from any template language
  - Tweak the CSS content for any `@layer` or even right before it's written to disk (if using the CLI) or injected
    through the postcss plugin, allowing all kinds of customizations like removing the unused CSS variables, etc.
  - React to any config change or after the codegen step (your outdir, the `styled-system` folder) have been generated

  See the list of available `config.hooks` here:

  ```ts
  export interface BambooHooks {
    /**
     * Called when the config is resolved, after all the presets are loaded and merged.
     * This is the first hook called, you can use it to tweak the config before the context is created.
     */
    'config:resolved': (args: { conf: LoadConfigResult }) => MaybeAsyncReturn
    /**
     * Called when the Bamboo context has been created and the API is ready to be used.
     */
    'context:created': (args: { ctx: ApiInterface; logger: LoggerInterface }) => void
    /**
     * Called when the config file or one of its dependencies (imports) has changed.
     */
    'config:change': (args: { config: UserConfig }) => MaybeAsyncReturn
    /**
     * Called after reading the file content but before parsing it.
     * You can use this hook to transform the file content to a tsx-friendly syntax so that Bamboo's parser can parse it.
     * You can also use this hook to parse the file's content on your side using a custom parser, in this case you don't have to return anything.
     */
    'parser:before': (args: { filePath: string; content: string }) => string | void
    /**
     * Called after the file styles are extracted and processed into the resulting ParserResult object.
     * You can also use this hook to add your own extraction results from your custom parser to the ParserResult object.
     */
    'parser:after': (args: { filePath: string; result: ParserResultInterface | undefined }) => void
    /**
     * Called after the codegen is completed
     */
    'codegen:done': () => MaybeAsyncReturn
    /**
     * Called right before adding the design-system CSS (global, static, preflight, tokens, keyframes) to the final CSS
     * Called right before writing/injecting the final CSS (styles.css) that contains the design-system CSS and the parser CSS
     * You can use it to tweak the CSS content before it's written to disk or injected through the postcss plugin.
     */
    'cssgen:done': (args: {
      artifact: 'global' | 'static' | 'reset' | 'tokens' | 'keyframes' | 'styles.css'
      content: string
    }) => string | void
  }
  ```

### Patch Changes

- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/config@0.28.0
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/extractor@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/config@0.27.3
  - @bamboocss/extractor@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/config@0.27.2
- @bamboocss/core@0.27.2
- @bamboocss/extractor@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/config@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/extractor@0.27.1
  - @bamboocss/logger@0.27.1
  - @bamboocss/shared@0.27.1

## 0.27.0

### Minor Changes

- 84304901: Improve performance, mostly for the CSS generation by removing a lot of `postcss` usage (and plugins).

  ## Public changes:
  - Introduce a new `config.lightningcss` option to use `lightningcss` (currently disabled by default) instead of
    `postcss`.
  - Add a new `config.browserslist` option to configure the browserslist used by `lightningcss`.
  - Add a `--lightningcss` flag to the `bamboo` and `bamboo cssgen` command to use `lightningcss` instead of `postcss`
    for this run.

  ## Internal changes:
  - `markImportant` fn from JS instead of walking through postcss AST nodes
  - use a fork of `stitches` `stringify` function instead of `postcss-css-in-js` to write the CSS string from a JS
    object
  - only compute once `TokenDictionary` properties
  - refactor `serializeStyle` to use the same code path as the rest of the pipeline with `StyleEncoder` / `StyleDecoder`
    and rename it to `transformStyles` to better convey what it does

### Patch Changes

- Updated dependencies [84304901]
- Updated dependencies [74ac0d9d]
- Updated dependencies [c9195a4e]
  - @bamboocss/extractor@0.27.0
  - @bamboocss/config@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/config@0.26.2
- @bamboocss/core@0.26.2
- @bamboocss/extractor@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/config@0.26.1
- @bamboocss/core@0.26.1
- @bamboocss/extractor@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- d420c676: Refactors the parser and import analysis logic. The goal is to ensure we can re-use the import logic in
  ESLint Plugin and Node.js.
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [1bd7fbb7]
- Updated dependencies [d420c676]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/config@0.26.0
  - @bamboocss/extractor@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- de282f60: Fix issue where `base` doesn't work within css function

  ```jsx
  css({
    // This didn't work, but now it does
    base: { color: 'blue' },
  })
  ```

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/config@0.25.0
  - @bamboocss/extractor@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/config@0.24.2
  - @bamboocss/extractor@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/config@0.24.1
- @bamboocss/extractor@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- f6881022: Add `patterns` to `config.staticCss`

  ***

  Fix the special `[*]` rule which used to generate the same rule for every breakpoints, which is not what most people
  need (it's still possible by explicitly using `responsive: true`).

  ```ts
  const card = defineRecipe({
    className: 'card',
    base: { color: 'white' },
    variants: {
      size: {
        small: { fontSize: '14px' },
        large: { fontSize: '18px' },
      },
      visual: {
        primary: { backgroundColor: 'blue' },
        secondary: { backgroundColor: 'gray' },
      },
    },
  })

  export default defineConfig({
    // ...
    staticCss: {
      recipes: {
        card: ['*'], // this

        // was equivalent to:
        card: [
          // notice how `responsive: true` was implicitly added
          { size: ['*'], responsive: true },
          { visual: ['*'], responsive: true },
        ],

        //   will now correctly be equivalent to:
        card: [{ size: ['*'] }, { visual: ['*'] }],
      },
    },
  })
  ```

  Here's the diff in the generated CSS:

  ```diff
  @layer recipes {
    .card--size_small {
      font-size: 14px;
    }

    .card--size_large {
      font-size: 18px;
    }

    .card--visual_primary {
      background-color: blue;
    }

    .card--visual_secondary {
      background-color: gray;
    }

    @layer _base {
      .card {
        color: var(--colors-white);
      }
    }

  -  @media screen and (min-width: 40em) {
  -    -.sm\:card--size_small {
  -      -font-size: 14px;
  -    -}
  -    -.sm\:card--size_large {
  -      -font-size: 18px;
  -    -}
  -    -.sm\:card--visual_primary {
  -      -background-color: blue;
  -    -}
  -    -.sm\:card--visual_secondary {
  -      -background-color: gray;
  -    -}
  -  }

  -  @media screen and (min-width: 48em) {
  -    -.md\:card--size_small {
  -      -font-size: 14px;
  -    -}
  -    -.md\:card--size_large {
  -      -font-size: 18px;
  -    -}
  -    -.md\:card--visual_primary {
  -      -background-color: blue;
  -    -}
  -    -.md\:card--visual_secondary {
  -      -background-color: gray;
  -    -}
  -  }

  -  @media screen and (min-width: 64em) {
  -    -.lg\:card--size_small {
  -      -font-size: 14px;
  -    -}
  -    -.lg\:card--size_large {
  -      -font-size: 18px;
  -    -}
  -    -.lg\:card--visual_primary {
  -      -background-color: blue;
  -    -}
  -    -.lg\:card--visual_secondary {
  -      -background-color: gray;
  -    -}
  -  }

  -  @media screen and (min-width: 80em) {
  -    -.xl\:card--size_small {
  -      -font-size: 14px;
  -    -}
  -    -.xl\:card--size_large {
  -      -font-size: 18px;
  -    -}
  -    -.xl\:card--visual_primary {
  -      -background-color: blue;
  -    -}
  -    -.xl\:card--visual_secondary {
  -      -background-color: gray;
  -    -}
  -  }

  -  @media screen and (min-width: 96em) {
  -    -.\32xl\:card--size_small {
  -      -font-size: 14px;
  -    -}
  -    -.\32xl\:card--size_large {
  -      -font-size: 18px;
  -    -}
  -    -.\32xl\:card--visual_primary {
  -      -background-color: blue;
  -    -}
  -    -.\32xl\:card--visual_secondary {
  -      -background-color: gray;
  -    -}
  -  }
  }
  ```

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/config@0.24.0
  - @bamboocss/extractor@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 80ada336: Automatically extract/generate CSS for `sva` even if `slots` are not statically extractable, since it will
  only produce atomic styles, we don't care much about slots for `sva` specifically

  Currently the CSS won't be generated if the `slots` are missing which can be problematic when getting them from
  another file, such as when using `Ark-UI` like `import { comboboxAnatomy } from '@ark-ui/anatomy'`

  ```ts
  import { sva } from '../styled-system/css'
  import { slots } from './slots'

  const card = sva({
    slots, // ❌ did NOT work -> ✅ will now work as expected
    base: {
      root: {
        p: '6',
        m: '4',
        w: 'md',
        boxShadow: 'md',
        borderRadius: 'md',
        _dark: { bg: '#262626', color: 'white' },
      },
      content: {
        textStyle: 'lg',
      },
      title: {
        textStyle: 'xl',
        fontWeight: 'semibold',
        pb: '2',
      },
    },
  })
  ```

- b01eb049: Fix a parser issue where we didn't handle import aliases when using a {xxx}.raw() function.

  ex:

  ```ts
  // button.stories.ts
  import { button as buttonRecipe } from '@ui/styled-system/recipes'

  export const Primary: Story = {
    // ❌ this wouldn't be parsed as a recipe because of the alias + .raw()
    //  -> ✅ it's now fixed
    args: buttonRecipe.raw({
      color: 'primary',
    }),
  }
  ```

- a3b6ed5f: Fix & perf improvement: skip JSX parsing when not using `config.jsxFramework` / skip tagged template literal
  parsing when not using `config.syntax` set to "template-literal"
- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/config@0.23.0
  - @bamboocss/extractor@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- 647f05c9: Fix a CSS generation issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with `!` or
  `!important`

  ```ts
  css({
    borderWidth: '[2px!]',
    width: '[2px !important]',
  })
  ```

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/config@0.22.1
  - @bamboocss/extractor@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/config@0.22.0
  - @bamboocss/extractor@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [1464460f]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/extractor@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/config@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/config@0.20.1
- @bamboocss/extractor@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/config@0.20.0
  - @bamboocss/types@0.20.0
  - @bamboocss/extractor@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/config@0.19.0
  - @bamboocss/extractor@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/config@0.18.3
- @bamboocss/extractor@0.18.3
- @bamboocss/is-valid-prop@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/shared@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/config@0.18.2
- @bamboocss/extractor@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- @bamboocss/config@0.18.1
- @bamboocss/extractor@0.18.1
- @bamboocss/is-valid-prop@0.18.1
- @bamboocss/logger@0.18.1
- @bamboocss/shared@0.18.1
- @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
- Updated dependencies [336fd0b0]
  - @bamboocss/shared@0.18.0
  - @bamboocss/extractor@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/config@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/config@0.17.5
- @bamboocss/extractor@0.17.5
- @bamboocss/is-valid-prop@0.17.5
- @bamboocss/logger@0.17.5
- @bamboocss/shared@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/config@0.17.4
  - @bamboocss/extractor@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/config@0.17.3
  - @bamboocss/extractor@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/config@0.17.2
- @bamboocss/extractor@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies [a76b279e]
- Updated dependencies [5ce359f6]
  - @bamboocss/extractor@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/config@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/config@0.17.0
  - @bamboocss/extractor@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- @bamboocss/config@0.16.0
- @bamboocss/extractor@0.16.0
- @bamboocss/is-valid-prop@0.16.0
- @bamboocss/logger@0.16.0
- @bamboocss/shared@0.16.0
- @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/config@0.15.5
- @bamboocss/extractor@0.15.5
- @bamboocss/is-valid-prop@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/shared@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- bf0e6a30: Fix issues with class merging in the `styled` factory fn for Qwik, Solid and Vue.
- 69699ba4: Improved styled factory by adding a 3rd (optional) argument:

  ```ts
  interface FactoryOptions<TProps extends Dict> {
    dataAttr?: boolean
    defaultProps?: TProps
    shouldForwardProp?(prop: string, variantKeys: string[]): boolean
  }
  ```

  - Setting `dataAttr` to true will add a `data-recipe="{recipeName}"` attribute to the element with the recipe name.
    This is useful for testing and debugging.

  ```jsx
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button, { dataAttr: true })

  const App = () => (
    <Button variant="secondary" mt="10px">
      Button
    </Button>
  )
  // Will render something like <button data-recipe="button" class="btn btn--variant_purple mt_10px">Button</button>
  ```

  - `defaultProps` allows you to skip writing wrapper components just to set a few props. It also allows you to locally
    override the default variants or base styles of a recipe.

  ```jsx
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button, {
    defaultProps: {
      variant: 'secondary',
      px: '10px',
    },
  })

  const App = () => <Button>Button</Button>
  // Will render something like <button class="btn btn--variant_secondary px_10px">Button</button>
  ```

  - `shouldForwardProp` allows you to customize which props are forwarded to the underlying element. By default, all
    props except recipe variants and style props are forwarded.

  ```jsx
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'
  import { isCssProperty } from '../styled-system/jsx'
  import { motion, isValidMotionProp } from 'framer-motion'

  const StyledMotion = styled(
    motion.div,
    {},
    {
      shouldForwardProp: (prop, variantKeys) =>
        isValidMotionProp(prop) || (!variantKeys.includes(prop) && !isCssProperty(prop)),
    },
  )
  ```

- 3a04a927: Fix static extraction of the
  [Array Syntax](https://bamboocss.com/docs/concepts/responsive-design#the-array-syntax) when used with runtime
  conditions

  Given a component like this:

  ```ts
  function App() {
    return <Box py={[2, verticallyCondensed ? 2 : 3, 4]} />;
  }
  ```

  the `py` value was incorrectly extracted like this:

  ```ts
   {
      "py": {
          "1": 2,
      },
  },
  {
      "py": {
          "1": 3,
      },
  },
  ```

  which would then generate invalid CSS like:

  ```css
  .paddingBlock\\\\:1_2 {
    1: 2px;
  }

  .paddingBlock\\\\:1_3 {
    1: 3px;
  }
  ```

  it's now correctly transformed back to an array:

  ```diff
  {
    "py": {
  -    "1": 2,
  +   [
  +       undefined,
  +       2,
  +   ]
    },
  },
  {
    "py": {
  -    "1": 3,
  +   [
  +       undefined,
  +       3,
  +   ]
    },
  },
  ```

  which will generate the correct CSS

  ```css
  @media screen and (min-width: 40em) {
    .sm\\\\:py_2 {
      padding-block: var(--spacing-2);
    }

    .sm\\\\:py_3 {
      padding-block: var(--spacing-3);
    }
  }
  ```

- Updated dependencies [abd7c47a]
- Updated dependencies [3a04a927]
  - @bamboocss/config@0.15.4
  - @bamboocss/extractor@0.15.4
  - @bamboocss/types@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4

## 0.15.3

### Patch Changes

- 1ac2011b: Add a new `config.importMap` option that allows you to specify a custom module specifier to import from
  instead of being tied to the `outdir`

  You can now do things like leverage the native package.json
  [`imports`](https://nodejs.org/api/packages.html#subpath-imports):

  ```ts
  export default defineConfig({
    outdir: './outdir',
    importMap: {
      css: '#bamboo/styled-system/css',
      recipes: '#bamboo/styled-system/recipes',
      patterns: '#bamboo/styled-system/patterns',
      jsx: '#bamboo/styled-system/jsx',
    },
  })
  ```

  Or you could also make your outdir an actual package from your monorepo:

  ```ts
  export default defineConfig({
    outdir: '../packages/styled-system',
    importMap: {
      css: '@monorepo/styled-system',
      recipes: '@monorepo/styled-system',
      patterns: '@monorepo/styled-system',
      jsx: '@monorepo/styled-system',
    },
  })
  ```

  Working with tsconfig paths aliases is easy:

  ```ts
  export default defineConfig({
    outdir: 'styled-system',
    importMap: {
      css: 'styled-system/css',
      recipes: 'styled-system/recipes',
      patterns: 'styled-system/patterns',
      jsx: 'styled-system/jsx',
    },
  })
  ```

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/config@0.15.3
  - @bamboocss/extractor@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
- Updated dependencies [2645c2da]
  - @bamboocss/types@0.15.2
  - @bamboocss/config@0.15.2
  - @bamboocss/extractor@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- c40ae1b9: feat(parser): extract {fn}.raw as an identity fn

  so this will now work:

  ```ts
  import { css } from 'styled-system/css'

  const paragraphSpacingStyle = css.raw({
    '&:not(:first-child)': { marginBlockEnd: '1em' },
  })

  export const proseCss = css.raw({
    maxWidth: '800px',
    '& p': {
      '&:not(:first-child)': { marginBlockStart: '1em' },
    },
    '& h1': paragraphSpacingStyle,
    '& h2': paragraphSpacingStyle,
  })
  ```

  & use ECMA preset for ts-evaluator: This means that no other globals than those that are defined in the ECMAScript
  spec such as Math, Promise, Object, etc, are available but it allows for some basic evaluation of expressions like
  this:

  ```ts
  import { cva } from '.bamboo/css'

  const variants = () => {
    const spacingTokens = Object.entries({
      s: 'token(spacing.1)',
      m: 'token(spacing.2)',
      l: 'token(spacing.3)',
    })

    const spacingProps = {
      px: 'paddingX',
      py: 'paddingY',
    }

    // Generate variants programmatically
    return Object.entries(spacingProps)
      .map(([name, styleProp]) => {
        const variants = spacingTokens
          .map(([variant, token]) => ({ [variant]: { [styleProp]: token } }))
          .reduce((_agg, kv) => ({ ..._agg, ...kv }))

        return { [name]: variants }
      })
      .reduce((_agg, kv) => ({ ..._agg, ...kv }))
  }

  const baseStyle = cva({
    variants: variants(),
  })
  ```

- Updated dependencies [c40ae1b9]
- Updated dependencies [26f6982c]
  - @bamboocss/extractor@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/config@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/bamboocss/bamboo/issues/1315

- Updated dependencies [be24d1a0]
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [7c1ab170]
- Updated dependencies [f27146d6]
  - @bamboocss/extractor@0.15.0
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/config@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/config@0.14.0
  - @bamboocss/extractor@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- 577dcb9d: Fix issue where Bamboo does not detect styles after nested template in vue
- Updated dependencies [d0fbc7cc]
  - @bamboocss/config@0.13.1
  - @bamboocss/extractor@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/config@0.13.0
- @bamboocss/extractor@0.13.0
- @bamboocss/is-valid-prop@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/shared@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/config@0.12.2
- @bamboocss/extractor@0.12.2
- @bamboocss/is-valid-prop@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/shared@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/config@0.12.1
- @bamboocss/extractor@0.12.1
- @bamboocss/is-valid-prop@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/shared@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/config@0.12.0
- @bamboocss/extractor@0.12.0
- @bamboocss/is-valid-prop@0.12.0
- @bamboocss/logger@0.12.0
- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/config@0.11.1
  - @bamboocss/extractor@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [dead08a2]
- Updated dependencies [5b95caf5]
  - @bamboocss/config@0.11.0
  - @bamboocss/types@0.11.0
  - @bamboocss/extractor@0.11.0
  - @bamboocss/is-valid-prop@0.11.0
  - @bamboocss/logger@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Minor Changes

- a669f4d5: Introduce new slot recipe features.

  Slot recipes are useful for styling composite or multi-part components easily.
  - `sva`: the slot recipe version of `cva`
  - `defineSlotRecipe`: the slot recipe version of `defineRecipe`

  **Definition**

  ```jsx
  import { sva } from 'styled-system/css'

  const button = sva({
    slots: ['label', 'icon'],
    base: {
      label: { color: 'red', textDecoration: 'underline' },
    },
    variants: {
      rounded: {
        true: {},
      },
      size: {
        sm: {
          label: { fontSize: 'sm' },
          icon: { fontSize: 'sm' },
        },
        lg: {
          label: { fontSize: 'lg' },
          icon: { fontSize: 'lg', color: 'pink' },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })
  ```

  **Usage**

  ```jsx
  export function App() {
    const btnClass = button({ size: 'lg', rounded: true })

    return (
      <button>
        <p class={btnClass.label}> Label</p>
        <p class={btnClass.icon}> Icon</p>
      </button>
    )
  }
  ```

### Patch Changes

- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/config@0.10.0
  - @bamboocss/extractor@0.10.0
  - @bamboocss/logger@0.10.0

## 0.9.0

### Minor Changes

- c08de87f: ### Breaking
  - Renamed the `name` property of a config recipe to `className`. This is to ensure API consistency and express the
    intent of the property more clearly.

  ```diff
  export const buttonRecipe = defineRecipe({
  -  name: 'button',
  +  className: 'button',
    // ...
  })
  ```

  - Renamed the `jsx` property of a pattern to `jsxName`.

  ```diff
  const hstack = definePattern({
  -  jsx: 'HStack',
  +  jsxName: 'HStack',
    // ...
  })
  ```

  ### Feature

  Update the `jsx` property to be used for advanced tracking of custom pattern components.

  ```jsx
  import { Circle } from 'styled-system/jsx'
  const CustomCircle = ({ children, ...props }) => {
    return <Circle {...props}>{children}</Circle>
  }
  ```

  To track the `CustomCircle` component, you can now use the `jsx` property.

  ```js
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    patterns: {
      extend: {
        circle: {
          jsx: ['CustomCircle'],
        },
      },
    },
  })
  ```

### Patch Changes

- Updated dependencies [c08de87f]
- Updated dependencies [3269b411]
  - @bamboocss/types@0.9.0
  - @bamboocss/extractor@0.9.0
  - @bamboocss/config@0.9.0
  - @bamboocss/is-valid-prop@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Minor Changes

- 9ddf258b: Introduce the new `{fn}.raw` method that allows for a super flexible usage and extraction :tada: :

  ```tsx
  <Button rootProps={css.raw({ bg: "red.400" })} />

  // recipe in storybook
  export const Funky: Story = {
  	args: button.raw({
  		visual: "funky",
  		shape: "circle",
  		size: "sm",
  	}),
  };

  // mixed with pattern
  const stackProps = {
    sm: stack.raw({ direction: "column" }),
    md: stack.raw({ direction: "row" })
  }

  stack(stackProps[props.size]))
  ```

### Patch Changes

- fb449016: Fix cases where Stitches `styled.withConfig` would be misinterpreted as a bamboo fn and lead to this error:

  ```ts
  TypeError: Cannot read properties of undefined (reading 'startsWith')
      at /bamboo/packages/shared/dist/index.js:433:16
      at get (/bamboo/packages/shared/dist/index.js:116:20)
      at Utility.setClassName (/bamboo/packages/core/dist/index.js:1682:66)
      at inner (/bamboo/packages/core/dist/index.js:1705:14)
      at Utility.getOrCreateClassName (/bamboo/packages/core/dist/index.js:1709:12)
      at AtomicRule.transform (/bamboo/packages/core/dist/index.js:1729:23)
      at /bamboo/packages/core/dist/index.js:323:32
      at inner (/bamboo/packages/shared/dist/index.js:219:12)
      at walkObject (/bamboo/packages/shared/dist/index.js:221:10)
      at AtomicRule.process (/bamboo/packages/core/dist/index.js:317:35)
  ```

- be0ad578: Fix parser issue with TS path mappings
- 78612d7f: Fix node evaluation in extractor process (can happen when using a BinaryExpression, simple CallExpression or
  conditions)
- Updated dependencies [fb449016]
- Updated dependencies [e1f6318a]
- Updated dependencies [be0ad578]
- Updated dependencies [78612d7f]
  - @bamboocss/extractor@0.8.0
  - @bamboocss/config@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- 16cd3764: Fix parser issue in `.vue` files, make the traversal check nested elements instead of only checking the 1st
  level
- 7bc69e4b: Fix issue where extraction does not work when the spread syntax is used or prop contains string that ends
  with ':'
- Updated dependencies [f2abf34d]
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
- Updated dependencies [7bc69e4b]
  - @bamboocss/extractor@0.7.0
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 5bd88c41: Fix JSX recipe extraction when multiple recipes were used on the same component, ex:

  ```tsx
  const ComponentWithMultipleRecipes = ({ variant }) => {
    return (
      <button className={cx(pinkRecipe({ variant }), greenRecipe({ variant }), blueRecipe({ variant }))}>Hello</button>
    )
  }
  ```

  Given a `bamboo.config.ts` with recipes each including a common `jsx` tag name, such as:

  ```ts
  recipes: {
      pinkRecipe: {
          className: 'pinkRecipe',
          jsx: ['ComponentWithMultipleRecipes'],
          base: { color: 'pink.100' },
          variants: {
              variant: {
              small: { fontSize: 'sm' },
              },
          },
      },
      greenRecipe: {
          className: 'greenRecipe',
          jsx: ['ComponentWithMultipleRecipes'],
          base: { color: 'green.100' },
          variants: {
              variant: {
              small: { fontSize: 'sm' },
              },
          },
      },
      blueRecipe: {
          className: 'blueRecipe',
          jsx: ['ComponentWithMultipleRecipes'],
          base: { color: 'blue.100' },
          variants: {
              variant: {
              small: { fontSize: 'sm' },
              },
          },
      },
  },
  ```

  Only the first matching recipe would be noticed and have its CSS generated, now this will properly generate the CSS
  for each of them

- b50675ca: Refactor parser to support extracting `css` prop in JSX elements correctly.
- Updated dependencies [21295f2e]
  - @bamboocss/extractor@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 09ebaf2e: Fix svelte parsing when using Typescript or `<script context=module>` or multiple `<script>`s
- 78ed6ed4: Fix issue where using a nested outdir like `src/styled-system` with a baseUrl like `./src` would result on
  parser NOT matching imports like `import { container } from "styled-system/patterns";` cause it would expect the full
  path `src/styled-system`
- a3d760ce: Do not allow all JSX properties to be extracted if none provided, rely on the `isStyleProp` fn instead

  This fixes cases when :
  - `eject: true` and only the `@bamboocss/preset-base` is used (or none)
  - some non-styling JSX prop is extracted leading to an incorrect CSS rule being generated, ex:

  ```sh
  🐼 info [cli] Writing /Users/astahmer/dev/reproductions/remix-bamboo/styled-system/debug/app__routes___index.css
  🐼 error [serializer:css] Failed to serialize CSS: CssSyntaxError: <css input>:28:19: Missed semicolon

    26 |     }
    27 |     .src_https\:\/\/akmweb\.viztatech\.com\/web\/svnres\/file\/50_e4bb32c9ea75c5de397f2dc17a3cf186\.jpg {
  > 28 |         src: https://akmweb.viztatech.com/web/svnres/file/50_e4bb32c9ea75c5de397f2dc17a3cf186.jpg
       |                   ^
    29 |     }
    30 | }
  ```

- Updated dependencies [6f03ead3]
- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
- Updated dependencies [e48b130a]
- Updated dependencies [d9bc63e7]
  - @bamboocss/extractor@0.5.1
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/is-valid-prop@0.5.1

## 0.5.0

### Minor Changes

- ead9eaa3: Add support for tagged template literal version.

  This features is pure css approach to writing styles, and can be a great way to migrate from styled-components and
  emotion.

  Set the `syntax` option to `template-literal` in the bamboo config to enable this feature.

  ```js
  // bamboo.config.ts
  export default defineConfig({
    //...
    syntax: 'template-literal',
  })
  ```

  > For existing projects, you might need to run the `bamboo codegen --clean`

  You can also use the `--syntax` option to specify the syntax type when using the CLI.

  ```sh
  bamboo init -p --syntax template-literal
  ```

  To get autocomplete for token variables, consider using the
  [CSS Var Autocomplete](https://marketplace.visualstudio.com/items?itemName=phoenisx.cssvar) extension.

### Patch Changes

- 30f41e01: Fix parsing of factory recipe with property access + object syntax, such as:

  ```ts
  const Input = styled.input({
    base: {
      color: 'blue.100',
      bg: 'blue.900',
    },
  })
  ```

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/extractor@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

## 0.4.0

### Patch Changes

- 8991b1e4: - Experimental support for `.vue` files and better `.svelte` support
  - Fix issue where the `bamboo ship` command does not write to the correct path
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/extractor@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/extractor@0.3.2
- @bamboocss/is-valid-prop@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/extractor@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/extractor@0.3.0
  - @bamboocss/is-valid-prop@0.3.0
  - @bamboocss/logger@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/extractor@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
