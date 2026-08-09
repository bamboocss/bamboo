# @bamboocss/preset-base

## 1.25.0

### Patch Changes

- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
  - @bamboocss/types@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0

## 1.21.0

### Patch Changes

- @bamboocss/types@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/types@1.20.1

## 1.20.0

### Minor Changes

- 045ab1e: Emit breakpoints and container queries in CSS Media Queries Level 4 range syntax.

  ```diff
  - @media screen and (min-width: 48rem) { … }                              /* md */
  + @media (width >= 48rem) { … }
  - @media screen and (min-width: 48rem) and (max-width: 63.9975rem) { … }  /* mdOnly */
  + @media (width >= 48rem) and (width < 64rem) { … }
  - @media screen and (max-width: 47.9975rem) { … }                         /* mdDown */
  + @media (width < 48rem) { … }
  ```

  The `63.9975rem` was the next breakpoint stepped down by 0.04px, because `max-width` is inclusive and the old syntax
  has no inclusive/exclusive pair. That step cost two things. Viewports inside the 0.04px gap matched neither range —
  small enough to never show up on a device anyone tests on, and real. And stepping down needs arithmetic, so a
  breakpoint in a unit that does not convert to pixels (`vw`, `ch`, a `calc()`) had to be emitted unstepped and
  overlapped its neighbour by a whole unit. An exclusive `<` says the same thing exactly, in any unit, with no
  arithmetic — so both are gone, and the overlap noted in the preceding changeset no longer applies.

  Container queries move to the same construction:

  ```diff
  - @container card (min-width: 40rem) { … }
  + @container card (inline-size >= 40rem) { … }
  ```

  `inline-size` is what a container query is actually asking about — it and `width` diverge the moment a container is in
  a vertical writing mode.

  **What changes for you**
  - **Emitted CSS changes** for every responsive and container style. Class names and hashes are unchanged.
  - **Responsive styles now apply when printing.** `@media screen and (min-width: 48rem)` never matched print;
    `@media (width >= 48rem)` matches it against the page width. Every breakpoint-conditioned declaration now
    participates in print output. If you relied on breakpoints being screen-only, scope those rules with an explicit
    `@media screen` or a `_print` condition.
  - **Browser baseline rises to Chrome 104+, Safari 16.4+, Firefox 102+.** Enabling
    [`lightningcss`](https://bamboocss.com/docs/references/config#lightningcss) lowers these queries against your
    browserslist targets, but only partly recovers the old baseline: the `min` half round-trips to `(min-width: X)`,
    while an exclusive upper bound has no MQ3 spelling and lowers to `not (min-width: Y)` — itself MQ4. So `smDown`,
    `mdOnly`, `mdToXl` and `hideBelow` need roughly Chrome 88 / Safari 14 / Firefox 64 even with lowering on.
  - **`hideBelow` with an arbitrary value is now exclusive.** `hideBelow="800px"` emitted `(max-width: 800px)` and now
    emits `(width < 800px)`, which is what the token form (`hideBelow="md"`) always meant. The two disagreed at exactly
    the bound.
  - **Container rules now sort ahead of every `Down` breakpoint rule, at any width.** Container queries carried no
    readable bound before — their sort key was a bare size like ` 40rem` — so they ranked below anything the sorter
    could classify. They now carry `inline-size >= …` and join the `min` group, which sorts ahead of every `max`-bounded
    rule. Where a container rule and a `Down` breakpoint rule set the same property on the same element, the `Down` rule
    now wins where the container rule used to.
  - **Rules whose media queries tie on computed width may reorder.** Two queries that resolve to the same pixel width
    but are spelled differently — `48rem` against `48em`, or the `md` breakpoint against the `3xl` container size, both
    768px — have no bound to separate them, so the sorter compares the strings. The strings changed, so those ties
    resolve differently.

  **New**

  Container sizes gain the range set breakpoints already had: `@/mdOnly`, `@/mdDown` and `@/mdToXl` alongside `@/md`.
  With the 12 sizes in `preset-bamboo` and one named container this takes the generated container conditions from 24 to
  204, since the `To` spans are quadratic in the size count. That count reaches shipped output: every condition key is
  joined into `css/conditions.mjs` and becomes a member of the generated `Conditions` interface, which
  `ConditionalValue` and `Nested` map over. Trim `theme.containerSizes` if the type surface matters more to you than the
  range keys.

  **Fixed**

  Scale entries are ordered by their converted pixel value rather than their leading digits, so `30rem` no longer sorts
  below `400px`. Ordering only affected the `min` bound before, which is monotonic either way; it decides the upper
  bound of every `Only` and `To` range now, and getting it wrong inverts the range so it matches nothing.
  `validateBreakpoints` rejects a mixed-unit theme, but `theme.containerSizes` has no equivalent check and reaches the
  same code.

### Patch Changes

- Updated dependencies [5d2c91c]
  - @bamboocss/types@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/types@1.19.0

## 1.18.0

### Minor Changes

- 112cb85: Stop a composed custom property inheriting into a descendant that declares its own.

  Registering the transform variables with `@property … { inherits: false }` fixed this for filters and transforms, but
  ten of the variables the preset composes with were left unregistered, so they still inherited. Two of them rendered
  wrong:

  ```tsx
  <div
    className={css({
      bgGradient: 'to-r',
      gradientFrom: 'red.500',
      gradientTo: 'blue.500',
    })}
  >
    <div className={css({ bgGradient: 'to-r' })} />
  </div>
  ```

  The child declares no colours, so it should render nothing. It rendered the parent's gradient, because
  `--gradient-from`/`--gradient-to` reached it by inheritance. The same shape applied to `transition`: a descendant
  using the shorthand inside an element that had set `transitionProperty` or `transitionDuration` silently took that
  element's timing rather than its own defaults.

  Now registered, and a child that declares its own composes only from what it declares:
  - `--gradient-from`, `--gradient-to`, `--gradient-via`, `--gradient-via-stops`
  - `--transition-prop`, `--transition-duration`, `--transition-easing`

  Three more are registered for the same reason but change nothing observable, because every utility that reads them
  also writes them in the same rule: `--gradient-stops`, `--gradient-position`, `--focus-ring-color`.

  None takes an `initialValue`. The gradient colours are read bare rather than with a fallback, on purpose — an unset
  one has to stay guaranteed-invalid so an incomplete gradient drops instead of rendering half of one, which is exactly
  what registration without an initial value gives.

  **Deliberately still inheriting:** `--focus-ring-color-prop`, `--focus-ring-width`, `--focus-ring-style` and
  `--focus-ring-offset`. The utilities that set those emit only a variable and no declaration of their own, so theming a
  subtree's focus rings from an ancestor is the only effect they have; registering them would turn that into dead CSS.
  `--thickness`, `--bleed-x` and `--bleed-y` belong to patterns rather than utilities, and each is written by the same
  transform that reads it, so neither can leak.

  Costs 10 `@property` rules — about 40 bytes gzipped, emitted once.

  Worth checking after upgrading: a nested element that set `bgGradient` or `transition` and happened to render with an
  ancestor's colours or timings now falls back to its own defaults. That was the bug, not a feature — the variables were
  never documented as inheritable and the preset already registered its other composed ones — but it is a visible
  change.

### Patch Changes

- @bamboocss/types@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3

## 1.17.2

### Patch Changes

- 7c81ec9: Emit `dropShadow` as a filter function, so it stops invalidating the whole `filter`.

  `dropShadow` passed its value straight through, unlike every other filter utility — `blur` writes `blur(…)`, `sepia`
  writes `sepia(…)`, and so on. So `dropShadow: '0 1px 2px black'` set `--drop-shadow: 0 1px 2px black`, and `filter`,
  which composes nine variables into one declaration, resolved to:

  ```css
  filter: blur(4px) 0 1px 2px black;
  ```

  A filter list is invalid **as a whole** if any function in it is, so this did not merely fail to draw a shadow — it
  dropped every filter on the element, including ones set by a different utility. An element with `blur` and
  `dropShadow` lost its blur too.

  The value is now wrapped: `--drop-shadow: drop-shadow(0 1px 2px black)`. A value that was already written as
  `drop-shadow(…)` — the only form that happened to work before — should now be given without the wrapper.

  Also removed `values: 'dropShadows'` from the utility. `dropShadows` is not a token category: it appears in neither
  `TokenDataTypes` nor the category map in `@bamboocss/token-dictionary`, so nothing ever resolved through it and the
  raw value was emitted. Every filter utility without a token category declares none, which is now true of this one as
  well. The utilities table in the docs listed `dropShadows` as its category and has been corrected.

  Nothing caught either of these because nothing ran the code: `effects.ts` sat at 10% statement coverage, with every
  `transform` body in the untested part, and no test in the repo used `dropShadow`. `filter-utilities.test.ts` now
  asserts that each of the nine filter and nine backdrop-filter utilities contributes something shaped like a filter
  function — with `backdropOpacity`, which takes a bare number, stated as the exception rather than folded in.

- bf2d9c5: Fix `outline: 'none'`, which referenced a token instead of resetting the outline.

  The utility special-cases `none`:

  ```ts
  transform(value) {
    if (value === 'none') return { outline: '2px solid transparent', outlineOffset: '2px' }
    return { outline: value }
  }
  ```

  That branch never ran. `outline` declares `values: 'borders'`, and a utility whose `values` is a token category has
  its value resolved **before** the transform is called — so `value` arrived as `var(--borders-none)` and the comparison
  against `'none'` could not match. No preset defines a `borders.none` token, so the emitted declaration referenced a
  variable that does not exist, which is invalid at computed-value time and dropped. `outline: 'none'` therefore left
  the outline exactly as it was: the opposite of what was asked for, silently.

  The check now reads `raw`, the value as written, and `outline: 'none'` emits `2px solid transparent` with a `2px`
  offset — transparent rather than `none` so the ring survives forced-colors mode, where there is nothing to repaint
  otherwise.

  Three snapshots had recorded the broken output as expected, which is the reason the new tests assert the shape a
  transform is responsible for rather than snapshotting a whole rule.

  The same mistake is not present elsewhere: `float` and `scrollbar` compare against their values too, but their
  `values` is a plain array — an enum of keywords rather than a token category — so nothing is resolved before they see
  it, and `lineClamp` declares no `values` at all. Tests now cover all three alongside the fix.
  - @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- @bamboocss/types@1.17.1

## 1.17.0

### Minor Changes

- 355e573: Register composed custom properties with `@property` instead of resetting them on every element.

  Utilities that build one declaration out of several variables — `filter` out of nine, `translate` out of its axes —
  needed the variables nobody set to resolve to something harmless, and needed them not to inherit, since a parent's
  `--blur` reaching its children is a leak rather than a default. Before `@property` the only way to say that was to
  assign all of them a value on `*, ::before, ::after, ::backdrop`, which put 33 custom property declarations on every
  element in the document.

  `inherits: false` says it directly, and the initial value lives in the registration rather than in a declaration per
  element.

  ## `customProperties` on a utility

  A utility now declares the properties it composes, so the guarantee that a variable exists sits with the code that
  reads it:

  ```ts
  filter: {
    className: 'filter',
    values: { auto: 'var(--blur, ) var(--brightness, )' },
    customProperties: {
      '--blur': { syntax: '*', inherits: false },
      '--brightness': { syntax: '*', inherits: false },
    },
  }
  ```

  Registrations are merged across every configured utility, so a reader and a writer may both name the same variable;
  the first declaration wins, so one utility cannot retype a variable another already registered. Third-party presets
  get the behaviour by declaring it next to the utility, with no second list to keep in step.

  Every registration is `syntax: '*'`. A type would let these transition, and would also make a value outside it fail
  silently to the initial value rather than loudly — `translateX: '50%'` under `<length>` renders as `0`. Typing is
  worth doing per variable, where the value space is known, not in bulk.

  Omitting `initialValue` gives a property the guaranteed-invalid value, which is what a `var(--x, )` read expects: the
  reference takes its own empty fallback and composes to nothing. That is what the old `/*-*/ /*-*/` sentinel bought,
  without a declaration per element to buy it.

  ## What changed in the emitted CSS

  The universal rule is gone, replaced by 32 `@property` rules. Against the 33 it declared:
  - **`--rotate`, `--skew-x` and `--skew-y` are no longer declared.** No utility reads or writes them; they were left
    behind by utilities that no longer exist. Stylesheets referencing them directly should set their own.
  - **`--rotate-z` and `--translate-z` are now declared.** `rotate: 'auto-3d'` and `translate: 'auto-3d'` compose them,
    but the reset never covered them — so they inherited, and a parent's value moved or rotated its descendants.

  The three gradient stop positions are now read as `var(--gradient-from-position, )` rather than bare. A stop's
  position is optional, and with no initial value a bare read would take the whole `--gradient-stops` declaration
  invalid at computed-value time and drop the gradient.

  ## Fixes

  `@property` emission no longer falls back to `initial-value: initial` when a definition declares no initial value.
  That keyword is not "no initial value" — under the universal syntax it is a token, so it became the property's value
  and was substituted into whatever composed it, turning `filter: var(--blur, ) …` into `filter: initial …`, which is
  invalid and drops the whole filter. The descriptor is now omitted, which is what the spec asks for.

  Generated types are unchanged: these registrations never reach `globalVars`, so `CssVars` and `CssVarKeys` keep the
  shapes they had. Routing them through `globalVars` would have closed the `CssVars` union to those names and broken
  `var(--anything)` on the ~100 properties whose type union has no string fallback.

### Patch Changes

- Updated dependencies [355e573]
  - @bamboocss/types@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1

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

### Patch Changes

- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
  - @bamboocss/types@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/types@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
  - @bamboocss/types@1.14.0

## 1.13.2

### Patch Changes

- @bamboocss/types@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/types@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
  - @bamboocss/types@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/types@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [2ea9205]
  - @bamboocss/types@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0

## 1.9.1

### Patch Changes

- 028e755: Fix `Spacer` pattern not resolving spacing tokens for the `size` prop.

  Previously, `<Spacer size="5" />` would generate invalid CSS (`flex: 0 0 5`) instead of resolving the spacing token.
  Now it correctly outputs `flex: 0 0 var(--spacing-5, 5)`.

  **Before (broken):** `flex: 0 0 5` — raw value, not a valid CSS length **After (fixed):**
  `flex: 0 0 var(--spacing-5, 5)` — resolved spacing token

  Closes #3490
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- ac2fb5c: **Gradient Utilities**: Fixed `token()` and brace syntax not working in `bgGradient`, `bgLinear`, and
  `textGradient` utilities.

  Before this fix, using token references in gradient values would not expand correctly:

  ```jsx
  // ❌ Before: token references were ignored
  css({ bgGradient: 'linear-gradient({colors.red.200}, {colors.blue.300})' })
  // Output: background-image: linear-gradient(var(--gradient-stops))

  // ✅ After: token references are properly expanded
  css({ bgGradient: 'linear-gradient({colors.red.200}, {colors.blue.300})' })
  // Output: background-image: linear-gradient(var(--colors-red-200), var(--colors-blue-300))
  ```

  Both `token()` function syntax and brace syntax `{...}` now work correctly in gradient utilities.
  - @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- b6e9646: Ensure the `WebkitTextFillColor` utility can accept color token values, like other color utilities.
  - @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
  - @bamboocss/types@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/types@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies [91c65ff]
  - @bamboocss/types@1.5.0

## 1.4.3

### Patch Changes

- @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- @bamboocss/types@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/types@1.4.1

## 1.4.0

### Minor Changes

- 29cf719: - **Preset Base**: Change default spacing from `10px` and `8px`
  - **Preset Bamboo**: Add `5.5` to spacing scale to cover more minor scales

### Patch Changes

- 1bca361: Fix regression in `_marker` condition due to the use of `:is()` which doesn't work for pseudo elements.
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/types@1.3.1

## 1.3.0

### Minor Changes

- 1c36121: Added new transition values and enhanced transition property utilities
  - `size` → `width, height, min-width, max-width, min-height, max-height`
  - `position` → `left, right, top, bottom, inset, inset-inline, inset-block`
  - `background` → `background, background-color, background-image, background-position`

  ```tsx
  import { css } from 'styled-system/css'

  // Transition shorthand values
  css({ transition: 'size' })

  // Property groups
  css({ transitionProperty: 'size', transitionDuration: '300ms' })
  ```

### Patch Changes

- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0

## 1.2.0

### Minor Changes

- 9964772: Add new utilities for managing focus rings with `focusRing` and `focusVisibleRing` properties
  - `focusRing`: Style focus states using `&:is(:focus, [data-focus])` selector with `outside`, `inside`, `mixed`, or
    `none` values
  - `focusVisibleRing`: Style keyboard-only focus using `&:is(:focus-visible, [data-focus-visible])` selector
  - `focusRingColor`, `focusRingWidth`, `focusRingStyle`, and `focusRingOffset` for fine-tuned control
  - Configure the global focus ring color with `--global-color-focus-ring` in global CSS

  ```tsx
  <div
    className={css({
      focusRing: 'outside',
      focusVisibleRing: 'inside',
      focusRingColor: 'blue.300',
    })}
  >
    Click me
  </div>
  ```

### Patch Changes

- @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0

## 1.0.1

### Patch Changes

- 0019184: Fix issue where `bgGradient` did not respect the gradient token.
  - @bamboocss/types@1.0.1

## 1.0.0

### Major Changes

- a20811c: - Fix issue where `rtl` and `ltr` variants does not work with `[dir=auto]`
  - Add `::-webkit-details-marker` to `marker` condition
  - Add new `inset-2xs`, `inset-xs` and `inset-sm` shadows
  - Add new `noscript` and `inverted-colors` conditions
  - Add `:popover-open` to `open` condition
  - Removed `inner` shadow in favor of `inset-sm`
  - Remap blur tokens:
    - `blurs.sm` -> `blurs.xs`
    - `blurs.base` -> `blurs.sm`
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

### Minor Changes

- 860cc7d: Add support for `bgLinear`, `bgRadial` and `bgConic` properties.

  ### `bgLinear`

  ```tsx
  <div
    className={css({
      bgLinear: 'to-r',
      gradientFrom: 'cyan.500',
      gradientTo: 'blue.500',
    })}
  />
  ```

  ### `bgRadial`

  ```tsx
  <div
    className={css({
      bgRadial: 'in srgb',
      gradientFrom: 'pink.400',
      gradientFromPosition: '40%',
      gradientTo: 'fuchsia.700',
    })}
  />
  ```

  ### `bgConic`

  ```tsx
  <div
    className={css({
      bgConic: 'in srgb',
      gradientFrom: 'blue.600',
      gradientTo: 'sky.400',
      gradientToPosition: '50%',
    })}
  />
  ```

  Add support for `boxSize` property that maps to `width` and `height` properties.

  ```tsx
  <div className={css({ boxSize: '24' })} />
  ```

### Patch Changes

- Updated dependencies [a3bcbea]
  - @bamboocss/types@1.0.0

## 0.54.0

### Minor Changes

- 654ed5c: Adds more `aria` attributes to conditions for better accessibility and styling hooks.
  - `[aria-disabled=true]` was added to `disabled`, `peerDisabled`, and `groupDisabled` conditions.
  - `[aria-readonly=true]` was added to the `readOnly` condition.
  - `[aria-invalid=true]` was added to `invalid` and `groupInvalid` conditions.

### Patch Changes

- @bamboocss/types@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- 6fb83a8: Add tokens for logical border widths
  - @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- 00aa868: Add cursor utility config
  - @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- 01d72ad: - Update `groupInvalid` condition according to other group selector implementations
  - @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/types@0.53.0

## 0.52.0

### Minor Changes

- bb37d2b: Add support for new conditions
  - `current` -> `&:is([aria-current=true], [data-current])`
  - `today` -> `&[data-today]`
  - `unavailable` -> `&[data-unavailable]`
  - `rangeStart` -> `&[data-range-start]`
  - `rangeEnd` -> `&[data-range-end]`
  - `now` -> `&[data-now]`
  - `topmost` -> `&[data-topmost]`
  - `icon` -> `& :where(svg)`
  - `complete` -> `&[data-complete]`
  - `incomplete` -> `&[data-incomplete]`
  - `dragging` -> `&[data-dragging]`
  - `grabbed` -> `&[data-grabbed]`
  - `underValue` -> `&[data-state=under-value]`
  - `overValue` -> `&[data-state=over-value]`
  - `atValue` -> `&[data-state=at-value]`
  - `hidden` -> `&:is([hidden], [data-hidden])`

### Patch Changes

- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/types@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
  - @bamboocss/types@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/types@0.49.0

## 0.48.1

### Patch Changes

- af9715a: Fix issue where `scrollbarGutter` property incorrectly referenced spacing tokens. The only valid values are
  `auto`, `stable`, and `both-edges`.
  - @bamboocss/types@0.48.1

## 0.48.0

### Minor Changes

- cff19aa: [Breaking] Remove default utility values for `gridTemplateColumns`, `gridTemplateRows`, `gridColumn` and
  `gridRow` to prevent interference with native css values.

  For example `1` or `2` is a valid native value for `gridColumn` or `gridRow`, and should not be overridden by the
  utility.

  Find the previous default values below, you can add them back to your config if you need them.

  ```ts
  const utilities = {
    gridTemplateColumns: {
      className: 'grid-tc',
      group: 'Grid Layout',
      values: {
        '1': 'repeat(1, minmax(0, 1fr))',
        '2': 'repeat(2, minmax(0, 1fr))',
        '3': 'repeat(3, minmax(0, 1fr))',
        '4': 'repeat(4, minmax(0, 1fr))',
        '5': 'repeat(5, minmax(0, 1fr))',
        '6': 'repeat(6, minmax(0, 1fr))',
        '7': 'repeat(7, minmax(0, 1fr))',
        '8': 'repeat(8, minmax(0, 1fr))',
        '9': 'repeat(9, minmax(0, 1fr))',
        '10': 'repeat(10, minmax(0, 1fr))',
        '11': 'repeat(11, minmax(0, 1fr))',
        '12': 'repeat(12, minmax(0, 1fr))',
      },
    },
    gridTemplateRows: {
      className: 'grid-tr',
      group: 'Grid Layout',
      values: {
        '1': 'repeat(1, minmax(0, 1fr))',
        '2': 'repeat(2, minmax(0, 1fr))',
        '3': 'repeat(3, minmax(0, 1fr))',
        '4': 'repeat(4, minmax(0, 1fr))',
        '5': 'repeat(5, minmax(0, 1fr))',
        '6': 'repeat(6, minmax(0, 1fr))',
        '7': 'repeat(7, minmax(0, 1fr))',
        '8': 'repeat(8, minmax(0, 1fr))',
        '9': 'repeat(9, minmax(0, 1fr))',
        '10': 'repeat(10, minmax(0, 1fr))',
        '11': 'repeat(11, minmax(0, 1fr))',
        '12': 'repeat(12, minmax(0, 1fr))',
      },
    },
    gridColumn: {
      className: 'grid-c',
      group: 'Grid Layout',
      values: {
        full: '1 / -1',
        '1': 'span 1 / span 1',
        '2': 'span 2 / span 2',
        '3': 'span 3 / span 3',
        '4': 'span 4 / span 4',
        '5': 'span 5 / span 5',
        '6': 'span 6 / span 6',
        '7': 'span 7 / span 7',
        '8': 'span 8 / span 8',
        '9': 'span 9 / span 9',
        '10': 'span 10 / span 10',
        '11': 'span 11 / span 11',
        '12': 'span 12 / span 12',
      },
    },
    gridRow: {
      className: 'grid-r',
      group: 'Grid Layout',
      values: {
        full: '1 / -1',
        '1': 'span 1 / span 1',
        '2': 'span 2 / span 2',
        '3': 'span 3 / span 3',
        '4': 'span 4 / span 4',
        '5': 'span 5 / span 5',
        '6': 'span 6 / span 6',
        '7': 'span 7 / span 7',
        '8': 'span 8 / span 8',
        '9': 'span 9 / span 9',
        '10': 'span 10 / span 10',
        '11': 'span 11 / span 11',
        '12': 'span 12 / span 12',
      },
    },
  }
  ```

### Patch Changes

- @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/types@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- b7ed157: fix: use sizing tokens for flexBasis instead of spacing tokens
  - @bamboocss/types@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [dcc9053]
  - @bamboocss/types@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0

## 0.42.0

### Minor Changes

- e157dd1: - Ensure classnames are unique across utilities to prevent potential clash
  - Add support for `4xl` border radius token

### Patch Changes

- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0

## 0.41.0

### Patch Changes

- @bamboocss/types@0.41.0

## 0.40.1

### Patch Changes

- @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- @bamboocss/types@0.39.2

## 0.39.1

### Patch Changes

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

- 2116abe: Fix issue where `float` property did not allow inherited values (auto, initial, none, etc.)
- c3e797e: Fix issue where `animationName` property was not connected to `theme.keyframes`, as a result, no
  autocompletion was available.
- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
  - @bamboocss/types@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
  - @bamboocss/types@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2

## 0.37.1

### Patch Changes

- Updated dependencies [885963c]
  - @bamboocss/types@0.37.1

## 0.37.0

### Minor Changes

- bcfb5c5: ### Fixed
  - Fix className collisions between utilities by using unique class names per property in the default preset.

  ### Changed
  - **Color Mode Selectors**: Changed the default selectors for `_light` and `_dark` to target parent elements. This
    ensures consistent behavior with using these conditions to style pseudo elements (like `::before` and `::after`).

  ```diff
  const conditions = {
  -  _dark: '&.dark, .dark &',
  +  _dark: '.dark &',
  -  _light: '&.light, .light &',
  +  _light: '.light &',
  }
  ```

  - Changed `divideX` and `divideY` now maps to the `borderWidths` token group.

  ### Added
  - **Spacing Utilities**: Add new `spaceX` and `spaceY` utilities for applying margin between elements. Especially
    useful when applying negative margin to child elements.

  ```tsx
  <div className={flex({ spaceX: '-1' })}>
    <div className={circle({ size: '5', bg: 'red' })} />
    <div className={circle({ size: '5', bg: 'pink' })} />
  </div>
  ```

  - Added new `_starting` condition to support the new `@starting-style` at-rule.
    [Learn more here](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)
  - **Gradient Position**: Add new `gradientFromPosition` and `gradientToPosition` utilities for controlling the
    position of the gradient color stops.

  ```tsx
  <div
    className={css({
      bgGradient: 'to-r',
      // from
      gradientFrom: 'red',
      gradientFromPosition: 'top left',
      // to
      gradientTo: 'blue',
      gradientToPosition: 'bottom right',
    })}
  />
  ```

### Patch Changes

- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/types@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1

## 0.36.0

### Patch Changes

- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/types@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [50db354]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/types@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- @bamboocss/types@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [d1516c8]
  - @bamboocss/types@0.34.0

## 0.33.0

### Patch Changes

- cca50d5: Add a `group` to every utility in the `@bamboocss/preset-base`, this helps Bamboo tooling organize utilities.
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/types@0.33.0

## 0.32.1

### Patch Changes

- Updated dependencies [a032375]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
  - @bamboocss/types@0.32.0

## 0.31.0

### Minor Changes

- 40cb30b9: Add `textShadowColor` utility

  ```ts
  css({
    textShadow: '1px 1px 1px var(--text-shadow-color)',
    textShadowColor: 'black',
  })
  ```

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [d5977c24]
  - @bamboocss/types@0.30.0

## 0.29.1

### Patch Changes

- @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- 5fcdeb75: Update every utilities connected to the `colors` tokens in the `@bamboocss/preset-base` (included by
  default) to use the [`color-mix`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) CSS
  function.

  This function allows you to mix two colors together, and we use it to change the opacity of a color using the
  `{color}/{opacity}` syntax.

  You can use it like this:

  ```ts
  css({
    bg: 'red.300/40',
    color: 'white',
  })
  ```

  This will generate:

  ```css
  @layer utilities {
    .bg_red\.300\/40 {
      --mix-background: color-mix(in srgb, var(--colors-red-300) 40%, transparent);
      background: var(--mix-background, var(--colors-red-300));
    }

    .text_white {
      color: var(--colors-white);
    }
  }
  ```

  - If you're not using any opacity, the utility will not use `color-mix`
  - The utility will automatically fallback to the original color if the `color-mix` function is not supported by the
    browser.
  - You can use any of the color tokens, and any of the opacity tokens.

  ***

  The `utilities` transform function also receives a new `utils` object that contains the `colorMix` function, so you
  can also use it on your own utilities:

  ```ts
  export default defineConfig({
    utilities: {
      background: {
        shorthand: 'bg',
        className: 'bg',
        values: 'colors',
        transform(value, args) {
          const mix = args.utils.colorMix(value)
          // This can happen if the value format is invalid (e.g. `bg: red.300/invalid` or `bg: red.300//10`)
          if (mix.invalid) return { background: value }

          return {
            background: mix.value,
          }
        },
      },
    },
  })
  ```

  ***

  Here's a cool snippet (that we use internally !) that makes it easier to create a utility transform for a given
  property:

  ```ts
  import type { PropertyTransform } from '@bamboocss/types'

  export const createColorMixTransform =
    (prop: string): PropertyTransform =>
    (value, args) => {
      const mix = args.utils.colorMix(value)
      if (mix.invalid) return { [prop]: value }

      const cssVar = '--mix-' + prop

      return {
        [cssVar]: mix.value,
        [prop]: `var(${cssVar}, ${mix.color})`,
      }
    }
  ```

  then the same utility transform as above can be written like this:

  ```ts
  export default defineConfig({
    utilities: {
      background: {
        shorthand: "bg",
        className: "bg",
        values: "colors",
        transform: createColorMixTransform("background"),
    },
  });
  ```

- 250b4d11: ### Container Query Theme

  Improve support for CSS container queries by adding a new `containerNames` and `containerSizes` theme options.

  You can new define container names and sizes in your theme configuration and use them in your styles.

  ```ts
  export default defineConfig({
    // ...
    theme: {
      extend: {
        containerNames: ['sidebar', 'content'],
        containerSizes: {
          xs: '40em',
          sm: '60em',
          md: '80em',
        },
      },
    },
  })
  ```

  The default container sizes in the `@bamboocss/preset-bamboo` preset are shown below:

  ```ts
  export const containerSizes = {
    xs: '320px',
    sm: '384px',
    md: '448px',
    lg: '512px',
    xl: '576px',
    '2xl': '672px',
    '3xl': '768px',
    '4xl': '896px',
    '5xl': '1024px',
    '6xl': '1152px',
    '7xl': '1280px',
    '8xl': '1440px',
  }
  ```

  Then use them in your styles by referencing using `@<container-name>/<container-size>` syntax:

  > The default container syntax is `@/<container-size>`.

  ```ts
  import { css } from "/styled-system/css";

  function Demo() {
    return (
      <nav className={css({ containerType: "inline-size" })}>
        <div
          className={css({
            fontSize: { "@/sm": "md" },
          })}
        />
      </nav>
    );
  }
  ```

  This will generate the following CSS:

  ```css
  .cq-type_inline-size {
    container-type: inline-size;
  }

  @container (min-width: 60em) {
    .\@\/sm:fs_md {
      container-type: inline-size;
    }
  }
  ```

  ### Container Query Pattern

  To make it easier to use container queries, we've added a new `cq` pattern to `@bamboocss/preset-base`.

  ```ts
  import { cq } from "styled-system/patterns";

  function Demo() {
    return (
      <nav className={cq()}>
        <div
          className={css({
            fontSize: { base: "lg", "@/sm": "md" },
          })}
        />
      </nav>
    );
  }
  ```

  You can also named container queries:

  ```ts
  import { cq } from "styled-system/patterns";

  function Demo() {
    return (
      <nav className={cq({ name: "sidebar" })}>
        <div
          className={css({
            fontSize: { base: "lg", "@sidebar/sm": "md" },
          })}
        />
      </nav>
    );
  }
  ```

- f778d3e5: Updated the default preset in Bamboo to use the new `defaultValues` feature.

  To override the default values, consider using the `extend` pattern.

  ```js
  defineConfig({
    patterns: {
      extend: {
        stack: {
          defaultValues: { gap: '20px' },
        },
      },
    },
  })
  ```

### Patch Changes

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [f58f6df2]
  - @bamboocss/types@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1

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

- bee3ec85: Add support for aspect ratio tokens in the bamboo config or preset. Aspect ratio tokens are used to define
  the aspect ratio of an element.

  ```js
  export default defineConfig({
    // ...
    theme: {
      extend: {
        // add aspect ratio tokens
        tokens: {
          aspectRatios: {
            '1:1': '1',
            '16:9': '16/9',
          },
        },
      },
    },
  })
  ```

  Here's what the default aspect ratio tokens in the base preset looks like:

  ```json
  {
    "square": { "value": "1 / 1" },
    "landscape": { "value": "4 / 3" },
    "portrait": { "value": "3 / 4" },
    "wide": { "value": "16 / 9" },
    "ultrawide": { "value": "18 / 5" },
    "golden": { "value": "1.618 / 1" }
  }
  ```

  **Breaking Change**

  The built-in token values has been removed from the `aspectRatio` utility to the `@bamboocss/preset-base` as a token.

  For most users, this change should be a drop-in replacement. However, if you used a custom preset in the config, you
  might need to update it to include the new aspect ratio tokens.

### Patch Changes

- Updated dependencies [84304901]
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- f823a8c5: Fix `placeholder` condition in `preset-base`
  - @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 3f6b3662: Add `data-placeholder` and `data-placeholder-shown` conditions
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/types@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
  - @bamboocss/types@0.22.1

## 0.22.0

### Patch Changes

- 1cc8fcff: Fixes a missing bracket in \_indeterminate condition
- Updated dependencies [526c6e34]
  - @bamboocss/types@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/types@0.21.0

## 0.20.1

### Patch Changes

- 428e5401: - Added `strokeWidth` to svg utilities.
  - Connected `outlineWidth` utility to `borderWidths` token.
  - Add `borderWidth`, `borderTopWidth`, `borderLeftWidth`, `borderRightWidth`, `borderBottomWidth` to border utilities.
  - @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- 3e1ea626: Fix regression in grid pattern where `columns` doesn't not work as expected.
  - @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- ce34ea45: Make `_required` target `[data-required]` and `[aria-required=true]` attributes
- aac7b379: Fix an issue with the `grid` pattern from @bamboocss/preset-base (included by default), setting a
  minChildWidth wasn't interpreted as a token value

  Before:

  ```tsx
  <div className={grid({ minChildWidth: '80px', gap: 8 })} />
  // ✅ grid-template-columns: repeat(auto-fit, minmax(80px, 1fr))

  <div className={grid({ minChildWidth: '20', gap: 8 })} />
  // ❌ grid-template-columns: repeat(auto-fit, minmax(20, 1fr))
  //                                                  ^^^
  ```

  After:

  ```tsx
  <div className={grid({ minChildWidth: '80px', gap: 8 })} />
  // ✅ grid-template-columns: repeat(auto-fit, minmax(80px, 1fr))

  <div className={grid({ minChildWidth: '20', gap: 8 })} />
  // ✅ grid-template-columns: repeat(auto-fit, minmax(var(--sizes-20, 20), 1fr))
  //                                                  ^^^^^^^^^^^^^^^^^^^
  ```

  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- @bamboocss/types@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- @bamboocss/types@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [fc4688e6]
  - @bamboocss/types@0.17.0

## 0.16.0

### Patch Changes

- 0f3bede5: Add closed condition `&:is([closed], [data-closed], [data-state="closed"])`
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/types@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2

## 0.15.1

### Patch Changes

- @bamboocss/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [39298609]
  - @bamboocss/types@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- bf2ff391: Add `animationName` utility
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [23b516f4]
  - @bamboocss/types@0.11.1

## 0.11.0

### Minor Changes

- 811f4fb1: Add new visually hidden and bleed patterns.

  ### Bleed

  Bleed is a layout pattern is used to negate the padding applied to a parent container. You can apply an `inline` or
  `block` bleed to a child element, setting its value to match the parent's padding.

  ```tsx
  import { css } from '../styled-system/css'
  import { bleed } from '../styled-system/patterns'

  export function Page() {
    return (
      <div class={css({ px: '6' })}>
        <div class={bleed({ inline: '6' })}>Welcome</div>
      </div>
    )
  }
  ```

  ### Visually Hidden

  Visually hidden is a layout pattern used to hide content visually, but still make it available to screen readers.

  ```tsx
  import { css } from '../styled-system/css'
  import { visuallyHidden } from '../styled-system/patterns'

  export function Checkbox() {
    return (
      <label>
        <input type="checkbox" class={visuallyHidden()}>
          I'm hidde
        </input>
        <span>Checkbox</span>
      </label>
    )
  }
  ```

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0

## 0.10.0

### Patch Changes

- 00d11a8b: Update conditions
- 1972b4fa: Add opacity utility to base preset
- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/types@0.10.0

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
  - @bamboocss/types@0.9.0

## 0.8.0

### Patch Changes

- be0ad578: Fix parser issue with TS path mappings
- Updated dependencies [be0ad578]
  - @bamboocss/types@0.8.0

## 0.7.0

### Minor Changes

- 60a77841: Refactor `transition` utility to improve DX of adding transition. Transitions will now add a default
  transition property, timing function and duration. This allows you to add transitions with a single property.

  ```jsx
  <div className={css({ transition: 'background' })}>Content</div>
  ```

  This will generate the following css:

  ```css
  .transition_background {
    transition-property: background, background-color;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
  ```

### Patch Changes

- d9eeba60: Fix issue where `zIndex` tokens are not connected to zIndex utility
- Updated dependencies [a9c189b7]
  - @bamboocss/types@0.7.0

## 0.6.0

### Minor Changes

- 97fbe63f: Add negative fraction values to `translateX` and `translateY` utilities

### Patch Changes

- 08d33e0f: - Fix issue where `gridRows` has the wrong `className`
  - Fix issue where `gridItem` pattern did not use the `colStart` and `rowStart` values

- f7aff8eb: Fix issue where `_even` and `_odd` map to incorrect selectors
  - @bamboocss/types@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [8c670d60]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [ead9eaa3]
  - @bamboocss/types@0.5.0

## 0.4.0

### Patch Changes

- e8024347: Fix issue here divider pattern generated incorrect css in horizontal orientation
- d00eb17c: Add `auto` value where neccessary to base utilities.
- 9156c1c6: Fix placeholder condition to map to `&::placeholder`
- 54a8913c: Fix issue where patterns that include css selectors doesn't work in JSX
- 0f36ebad: Add polyfill for common properties to reduce the need for autoprefixer
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- bd5c049b: Initial release
- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
