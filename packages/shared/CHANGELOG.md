# @bamboocss/shared

## 1.17.2

## 1.17.1

### Patch Changes

- fc381ca: Terminate hex escapes in class selectors, so a digit-led class name still matches its element.

  A CSS escape consumes up to **six** hex digits, then one optional whitespace that ends it. `esc` emitted the escape
  without that terminator, so whenever the character after it was itself a hex digit it was read as part of the escape:

  | class name | selector emitted | the browser reads |
  | ---------- | ---------------- | ----------------- |
  | `640:p_4`  | `\3640\:p_4`     | `㙀:p_4`          |
  | `3d:p_4`   | `\33d\:p_4`      | `̽:p_4`            |
  | `12:p_4`   | `\312\:p_4`      | `̒:p_4`            |
  | `0a`       | `\30a`           | `̊`                |

  The element's `class` attribute still said `640:p_4`, so the selector matched nothing and it rendered unstyled — with
  no error, and invisible to any check that escapes both sides through this same function.

  Stock breakpoints escape their leading digit too and were unaffected only by luck: `2xl:bg_red` becomes `\32xl…`, and
  `x` is not a hex digit, so the escape ended where it should. Reaching the bug takes a breakpoint or condition named
  numerically (`640`, `12`) or as a digit followed by `a`–`f` (`3d`), or any digit-led class name whose next character
  is a hex digit.

  The terminator is now emitted, matching `CSS.escape` and the `jQuery.escapeSelector` this came from. A parser consumes
  the space as part of the escape, so it never reads as a descendant combinator, and escapes that already worked keep
  their meaning — `\30\.5` becomes `\30 \.5`, and both are `0.5`.

  `esc.test.ts` compared against recorded strings, which cannot tell a correct escape from one that names a different
  character, and had pinned `\30a` as expected output. It now also decodes each result the way a parser does and asserts
  the round trip.

## 1.17.0

### Patch Changes

- 3cdd0d1: Stop `css()` paying for a second cache keyed on the arguments it just hashed.

  The generated runtime was `css = memo((...styles) => cssFn(mergeCss(...styles)))`, and `mergeCss` is itself memoized
  on its argument list. So a `css()` call consulted two caches keyed on the same thing — and the second one could never
  answer. Reaching the merge at all means the outer cache missed, and a miss means those exact arguments have not been
  seen, so the inner lookup is _guaranteed_ to miss too. The redundancy is structural, not a matter of hit rate.

  Measured over 25,000 `css()` calls across four distinct styles, the inner memo served **zero** hits while paying a
  hash, a bucket scan, a snapshot and an insert on each of the four misses. Driven directly with no memo above it, the
  same function hit 24,996 times — which is why it stays memoized for the callers that reach it that way.

  `createMergeCss` now also returns `mergeCssUncached`, the same merge without the cache, and the generated `css` calls
  that instead. `css.raw`, `cva` and the Vite fold's runtime keep the memoized one: none of them sits behind a memo
  keyed on the same arguments, so for them the cache is doing real work.

  The win is on the miss path, which is where dynamic styles and SSR live. Cached calls are unchanged:

  | bench                            | before  | after   |              |
  | -------------------------------- | ------- | ------- | ------------ |
  | high-cardinality `css()`         | 26.48ms | 19.73ms | −25.5%       |
  | high-cardinality grouped `css()` | 28.23ms | 21.53ms | −23.7%       |
  | inline `css()` (cached)          | 0.724ms | 0.689ms | −4.8%, noise |
  | multi-arg `css(a, b)` (cached)   | 0.758ms | 0.767ms | +1.2%, noise |
  | `stack()` pattern (cached)       | 4.223ms | 4.246ms | +0.5%, noise |

  Per 10k iterations, interleaved new/old/new, controls read in every run.

  Locked down by counting rather than timing, per the note in `CLAUDE.md`: an enumerable getter on the style object is
  read once per pass over the arguments, so `packages/shared/__tests__/memo.test.ts` now asserts a miss costs four reads
  (hash, snapshot, and the merge itself) rather than six. Reintroducing the inner memo fails that test with
  `expected 6 to be 4`.

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

- c6154dc: Give `splitProps` a path for the shape it is actually called with.

  Every call site in the project passes one array group — a recipe's `variantKeys` — and it runs per component per
  render, inside `splitVariantProps`. The general implementation is built for several groups that may be predicates, and
  paid for that shape on every call: a closure per group, a `map` and a `concat` to assemble the result, and a branch
  per group to tell an array from a predicate. None of it is reachable with one array group.

  How much this wins depends on what the framework hands over, so both ends are worth naming:

  | props                      | before    | after |                     |
  | -------------------------- | --------- | ----- | ------------------- |
  | plain data, 2 variant keys | 650ns     | 395ns | −39%                |
  | plain data, 8 variant keys | 709ns     | 440ns | −38%                |
  | a non-enumerable key       | 915ns     | 662ns | −28%                |
  | accessors or a proxy       | 2.3–4.9µs |       | ~0–9%, within noise |

  Plain objects are what React and Vue pass. Solid passes a `mergeProps` proxy, where a trap per key dominates
  everything around it — the saving is real there but small, because trap cost is not what this path skips. The general
  path is unchanged to within its control (+0.0%).

  Worth saying what it does _not_ skip, because both look skippable and neither is:
  - The `own` set stays. Membership has to be answered from `ownKeys` rather than by asking the object: on a proxy —
    which is what Solid's `mergeProps` hands over — every question is a trap, and a recipe naming eight variants would
    otherwise fire eight traps to learn what one `ownKeys` already said.
  - The two passes stay separate. The group bucket is in _group_ order and the rest bucket in _props_ order, and that
    ordering reaches the emitted CSS.

  Skipping either is where the bigger numbers come from, and both change behaviour. Reading `props[key]` instead of its
  descriptor is faster still and is the change that broke Solid once already.

  The per-key descriptor rules are now one function shared by both paths, rather than two copies to keep in step, and a
  differential test pins the two paths against each other over the shapes that distinguish them.

## 1.16.1

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

- 645bb09: Fix `cssMode: 'grouped'` combined with `hash: true` rendering every element unstyled.

  A grouped class names a whole `css()` call, so the build and the runtime each derive it from the same group id. They
  derived it independently, and only the build routed the result through `formatSelector` — which hashes again when
  `hash.className` is set. The build emitted `.cYeKWS` while the runtime asked for `bKFMNe`, so every rule in the
  stylesheet missed and no element carrying a grouped class had any styles at all.

  A group id already digests every declaration in the call, so it is now hashed exactly once. `hash.className` shortens
  _utility_ class names, which a grouped class is not.

  The derivation moved into a single `groupClassName` helper in `@bamboocss/shared` that both sides call, so the two
  cannot name the class differently again — the next naming-relevant option cannot reintroduce this on one side only.

  Only `grouped` + `hash` changes. Grouped without hashing, with or without a `prefix`, emits byte-identical CSS:
  `formatSelector` reduced to `formatClassName` for an empty condition list, which is exactly what the helper does.

- 645bb09: Add `knownGroups` to `createCss`, so a grouped call the build never saw can fall back to atomic class names
  instead of returning a class with no rule behind it.

  Grouping names a class after a whole `css()` call, which means the build has to have seen that exact call to emit its
  rule. When it has not — a value it could not resolve, a combination it declined to enumerate — the element renders
  with **no** styles rather than losing a single declaration.

  Given the set of group classes the build actually emitted, the runtime now notices the miss and names each declaration
  atomically instead. That is not a complete recovery: an atomic class only helps where a rule for it exists. But it
  degrades to the partial styling `cssMode: 'atomic'` would have produced, rather than to nothing.

  The fallback shares its naming with the atomic branch, so a group that misses is named exactly as `cssMode: 'atomic'`
  would have named the same object — two spellings could drift, and the fallback would then reach for rules the
  stylesheet does not carry. Declarations are collected during the existing walk but not transformed until a miss
  actually happens, so a hit costs a set lookup rather than the naming work it avoids.

  Omitting `knownGroups` leaves the runtime exactly as it was, at no cost. Membership must be exact: a probabilistic
  structure trades a false positive for size, and a false positive here returns a class with no rule — the failure this
  exists to remove.

- 645bb09: Fail the build when the stylesheet and the runtime would disagree on class names.

  A class name is derived twice — once by `StyleDecoder` on the way into the stylesheet, and once by `css()` in the
  browser — and the two only ever meet in the DOM. When they disagree there is no error and no warning: the rule is
  emitted, the class is returned, and every element carrying it renders with no styles at all. That is how
  `cssMode: 'grouped'` combined with `hash: true` shipped broken.

  `checkNamingAgreement` now runs once per build, against the config actually being built. It sends a canary style
  object through both paths and compares the class names, raising `ERR_BAMBOO_NAMING_DISAGREEMENT` with both sets when
  they differ.

  Running it against the real config matters because the naming inputs are open-ended: the `utility:created` hook can
  replace `toHash` outright, and `separator`, `prefix` and custom utilities all feed the same derivation. A test can
  only pin the combinations it enumerates.

  The check runs on cloned encoder and decoder, so the canary never reaches the stylesheet being emitted.

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

## 1.14.0

### Minor Changes

- b567114: Drop `@bamboocss/studio` and `@bamboocss/astro-plugin-studio`.

  Studio was the visual token browser inherited from Panda — an Astro site that read your config and rendered your
  colors, typography and spacing. It is no longer maintained, and both packages are removed from the repository. The
  versions already on npm stay there and keep working; they will not receive further releases.

  **`bamboo studio` is gone.** Its own flags — `--build`, `--preview`, `--port`, `--host`, `--outdir` and `--base` —
  have no replacement. If you have it in a `package.json` script, remove the script.

  **`config.studio` is gone**, along with the `StudioOptions` type. Leaving `studio: { logo, outdir, inject }` in a
  config is now a TypeScript error rather than a silent no-op, so delete it — a plain-JS config will keep ignoring it.
  `Context.studio` is removed from `@bamboocss/core`, and the `MISSING_STUDIO` error code from `@bamboocss/shared`'s
  `BambooErrorCode` union.

  The studio output directory is no longer written to `.gitignore` by `bamboo init`. Existing `.gitignore` files keep
  their `styled-system-studio` line until you remove it, which is harmless — nothing writes there anymore.

  For documenting a design system, [spec files](/docs/theming/spec) generate a machine-readable description of your
  tokens, recipes and patterns that you can render however you like, and the [MCP server](/docs/ai/mcp-server) exposes
  the same information to AI tooling.

- d1d05fc: Add `fallback(...)` for progressive-enhancement values.

  CSS expresses a value fallback by declaring the same property more than once — the browser keeps the last declaration
  it can parse. A style object cannot hold the same key twice, so there was no way to write one. `fallback(...)` closes
  that gap:

  ```js
  css({ height: 'fallback(calc(100dvh - 100px), calc(100vh - 100px))' })
  ```

  ```css
  .h_fallback\(calc\(100dvh_-_100px\)\,_calc\(100vh_-_100px\)\) {
    height: calc(100vh - 100px);
    height: calc(100dvh - 100px);
  }
  ```

  Candidates are written most-preferred first and emitted in reverse. Each one resolves like an ordinary value, so
  tokens, the `[...]` escape hatch and shorthand properties all work inside a fallback, as do conditions, breakpoints,
  `globalCss`, recipes, patterns and JSX style props. `!important` marks every candidate. Under `strictTokens`,
  `fallback(...)` is accepted alongside the other escape hatches, though the candidates inside it are not individually
  checked — the same trade-off the `[...]` escape hatch already makes.

  Only a value that is _entirely_ one `fallback(...)` call is treated as a candidate list —
  `1px solid fallback(red, blue)` is left alone.

  Every candidate has to resolve to exactly one declaration, because that is all the cascade arbitrates between. A
  candidate that expands further — `transitionProperty` emits a `--transition-prop` variable beside the property,
  `lineClamp` emits four declarations for a number and one for `none`, `divideX` emits a nested rule — would leave those
  extras applying unconditionally whichever candidate the browser took. Those warn and apply the preferred candidate
  alone.

  Malformed calls warn and drop the declaration rather than emitting text that is not CSS: an unbalanced `(` or `[`, and
  a `fallback(...)` nested inside another. A misspelled name or one embedded in a larger value (`calc(fallback(a, b))`)
  is an ordinary string that Bamboo cannot recognise, and reaches the stylesheet verbatim.

  Reach for it when the fallback is a different design decision rather than a polyfill. If you use LightningCSS, it
  already generates vendor-prefix and color-space fallbacks from your browser targets, and it prunes the ones your
  targets don't need — including candidates you write yourself.

## 1.13.2

### Patch Changes

- 79c9872: Assemble class names without the throwaway arrays.

  Every style leaf of every `css()` cache miss built an array for the prefix, filtered it and joined it — and most
  configs set no prefix, so that array only ever held the class it started with. Conditions were spread into a second
  array and joined even when there were none.
  - A flat `css()` cache miss end to end: **1710 → 1443 ns** (-15.6%)
  - One with conditions and a responsive value: **2675 → 2589 ns** (-3.2%)
  - Measured on the assembly alone, with the memo forced to miss: **+25%** flat, **+10%** with a condition, **+14%**
    with a condition and a prefix
  - Class names are unchanged across a 27,000-object corpus, and across 43,008 combinations of prefix, class, condition
    and hashing

  The prefix is now read once when the `css` function is built rather than per leaf. It is set in the `Utility`
  constructor and the `utility:created` hook can only replace `toHash`, so there is nothing to re-read.

- 61fe88c: Answer "is this style object empty" without building the compacted object.

  `mergeCss` discards style objects that hold nothing once undefined values are dropped, and it decided that by
  compacting the object, taking a key array for the result, and throwing both away. It only ever needed to know whether
  one defined value existed.
  - The predicate itself: **19x** on a three-key style object, **43x** on a twenty-key one
  - A flat `css()` cache miss end to end: **2030 → 1857 ns** (-8.5%); the nested case moves within noise
  - Class names are unchanged across a 27,000-object corpus

  The predicate is the same one: `Object.keys` enumerates exactly what `compact`'s `Object.entries` did, so own,
  enumerable and string-keyed still decide it, and `null` still counts as present where `undefined` does not.

- be3764d: Skip the per-leaf string rewrites that have nothing to rewrite.

  `sanitize`, `isImportant`, `withoutImportant` and `withoutSpace` run on every style leaf of every `css()` cache miss,
  and each one starts with a regex rewrite. For the values that dominate real style objects — `red`, `4px`, `lg` — all
  four are no-ops. Each now begins with the cheapest search that can prove there is nothing to do.
  - A flat `css()` cache miss: **2474 → 2027 ns** (-18%)
  - One with conditions and a responsive value: **3040 → 2808 ns** (-7.6%)
  - Class names are unchanged across a 27,000-object corpus covering conditions, responsive arrays, `!important`, and
    values carrying whitespace

  The guards are exact rather than approximate, which is the only thing making them safe: `/\s/` is precisely the class
  the collapse matched, `trim()` strips precisely that set again, and `/\s*!(important)?/` cannot match a string with no
  `!`.

  `withoutImportant` and `withoutSpace` now declare `string | T` instead of inferring it. They return a rewritten
  string, so inferring `T` would have promised callers back the literal they passed in.

- 7a63215: Stop rebuilding style objects that are already normal.

  Normalizing renames a shorthand to its longhand, expands a responsive array into a breakpoint object, and drops
  nullish leaves. A flat object of plain values written in longhand needs none of the three — which is most of what
  `css()` is handed — but it was still walked and rebuilt, with a path array allocated per key.
  - Normalizing a flat object, measured through `mergeCss`: **-22% to -26%**, and **-28%** for one carrying twenty
    properties
  - A flat `css()` cache miss end to end: **1825 → 1685 ns** (-7.7%)
  - Class names are unchanged across a 27,000-object corpus

  An object that does need normalizing pays for the check that found out, which measures between +2% and +7% depending
  on how late the first dirty key appears. The nested case is around -4% overall, since the same objects tend to have
  flat blocks inside them.

  The result may now be the argument itself rather than a fresh object, so callers have to treat it as read-only. Every
  one already does: merging accumulates into its own object, and `css.raw()` and `cva.raw()` clone at the boundary.

- 2130606: Call `splitProps` predicates with the key alone.

  The predicate was handed straight to `Array.prototype.filter`, which calls it with `(key, index, allKeys)`. A
  one-parameter predicate cannot see the extra arguments, but a memoized one reads its whole argument list — and the
  predicate the JSX factory passes is `isCssProperty`, which is memoized. So the memo hashed the entire key array once
  per prop, and keyed its cache on it: two elements with different prop sets shared no entry even for the same prop
  name.

  Every styled element pays this, once per prop, on every render.
  - `splitProps` with a memoized predicate: **6.0x** faster
  - A React SSR render of styled elements: **4.18 → 1.15 µs** per element (3.6x)
  - The same for elements with a `cva` config: **11.2 → 2.17 µs** per element (5.2x)
  - Markup and `splitProps` output are unchanged

  Predicates have always been typed `(key: string) => boolean`, so no typed caller could have read the extra arguments.

## 1.13.1

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

- a5cb5a8: Add `pruneUnusedTokens`, dropping token css variables nothing can reach.

  The token layer declares every token in the theme. An app uses a fraction of them, so most of what it declares is dead
  weight in the one stylesheet that blocks first paint. On the `vite-ts` sandbox, with the default preset, this takes
  `styles.css` from 24,433 to 12,293 bytes — 6,398 to 3,504 gzipped. It scales with the size of the design system rather
  than the app: `preset-bamboo` declares 432 variables, `preset-atlaskit` 837, `preset-open-props` 898.

  It is **off by default** and changes nothing until switched on.

  A variable is kept when the generated css references it, when a kept variable's own value references it, or when it is
  named by `token()` or `token.var()` or a literal `var(--x)` anywhere under `include`. Tokens that javascript receives
  as a reference rather than a literal are always kept, because `token('colors.text')` hands the caller a `var()`
  whether or not the css mentions it. That covers virtual tokens, any token carrying a condition, and negative tokens —
  `spacing.-4` resolves to `calc(var(--spacing-4) * -1)`, so what has to survive is the _positive_ token's declaration,
  not its own. So is anything a theme refers to: a theme is a separate artifact injected at runtime, so nothing in the
  sheet points at what it needs.

  The negative-token rule is the one with a visible price, and there is no opt-out. A spacing scale generates one
  negative per entry, so the whole scale is pinned whether or not the app uses it: on the default preset an app
  referencing a single colour keeps 37 spacing variables, about a third of everything that survives. Presets with large
  spacing scales therefore see less than the numbers above.

  The walk follows any custom property, not only the removable ones. A colour palette is what forces that:
  `colorPalette: 'red'` emits `--colors-color-palette-300: var(--colors-red-300)`, and those palette properties are
  virtual, so stopping at them would leave the rule pointing at colours that had been removed.

  Two limits are deliberate:
  - Only custom properties the token system declares are eligible. `globalCss` output is never touched. `preset-base`
    declares the filter and gradient composition properties on the universal selector precisely so a parent's value
    cannot inherit into a descendant; they look unreferenced, and removing them would change rendering. The `styles.css`
    post-processing this option replaces does remove them.
  - Reachability cannot be proven for every reference. A token named by a path the source does not spell out as a string
    literal — `token.var(key)` — one used only from a stylesheet outside `include`, or one consumed by a separate
    package treating the output as design tokens, is invisible. Keep those with `staticCss`.

  Pruning runs wherever a complete stylesheet is assembled — `bamboo`, `bamboo cssgen`, watch mode and the PostCSS
  plugin — and never on a partial one such as `cssgen tokens`, where nothing would be left to reference the tokens.
  Collecting the references reads every source file, so that work stays behind the flag.

### Patch Changes

- 9ffb84f: Cache `css()` and pattern class names in the generated runtime, and stop `css.raw()` sharing a mutable
  object.

  `memo` now keys flat arguments on a structural hash confirmed by an exact comparison, falling back to `JSON.stringify`
  only for nested styles. Repeated `css()` calls get roughly 4-5x faster, multi-argument calls about 4x, and pattern
  helpers — which were not memoized at all — about 1.3x. Class name output is unchanged.

  Two behaviour changes worth knowing about:
  - The cache is now **bounded**. It previously grew for the lifetime of the process, which leaked in long-lived SSR
    workers (~16MB retained after 50k distinct styles, versus ~3MB now). The trade is that a workload whose set of
    distinct styles exceeds the bound no longer benefits from caching, and is slower than it was; a workload that reuses
    styles — the reason the cache exists — is substantially faster.
  - `css.raw()` returns a fresh object. It previously handed every caller the same cached instance, so a caller mutating
    what it received corrupted the cache and the class names produced afterwards. The copy is shallow, so mutating a
    nested condition object inside a `raw()` result still reaches shared state.

- e482ab3: Stop charging every merge for a copy only `raw()` needs.

  Merged style objects are cached, so `css.raw()` and `cva.raw()` have to hand out something independent — a caller
  mutating what it received would otherwise change what every later caller reads. That guarantee was previously supplied
  by making `mergeProps` copy nested objects, which put the cost on every merge instead of the two places that need it.

  Merging runs on every `css()` cache miss, and on every render of a pattern component under `jsxStyleProps: 'minimal'`.
  Copying there cost roughly twice as much as merging alone for a realistic style object — five base properties and four
  condition blocks — and the overhead scales with nesting, so it fell on exactly the styles people write.

  `mergeProps` is a merge again, and a new `cloneStyles` helper supplies the copy at the two boundaries where the value
  reaches user code. The independence guarantee is unchanged; the call site now says what it is doing.

  The template-literal `css.raw()` also routes through `cloneStyles`, so both syntaxes offer the same guarantee. It
  previously relied on the merge copying for it.

- 11c9409: Stop the generated runtime's memo treating differently-shaped arguments as equal.

  Cached arguments were compared as a flat bag of key/value pairs enumerated with `for...in`, which diverges from what
  the memoized functions actually read in two ways:
  - An array and an object with the same numeric keys enumerate identically, so `['x']` and `{ 0: 'x' }` shared a cache
    entry.
  - `for...in` walks the prototype chain, so an object with inherited enumerable properties was compared as though it
    owned them, while `Object.keys` and `JSON.stringify` see nothing.

  In both cases the second caller received a result computed from the first caller's arguments. No user-reachable
  miscompilation was found — style objects reaching that path are plain, and arrays of styles or responsive values are
  nested and take a different route — but the guarantee the memo documents was not one it kept, and the failure would
  surface as an inexplicable class name.

  Arrays are now distinguished from objects, and any value carrying a custom prototype is keyed by serialization
  instead, which sees exactly what the wrapped function does.

- 9ffb84f: Key scalar arguments by value in the generated runtime's memo.

  Every non-object argument hashed to the same constant, so distinct strings shared one bucket and competed for its
  fixed number of slots. Past that count the hit rate fell to zero and each call also paid a scan of the bucket and a
  fresh snapshot of its arguments.

  This hit `isCssProperty`, which is called for every prop on every render when `jsx.styleProps` is `'all'` (the
  default) and sees hundreds of distinct property names — so the hottest path in the runtime was missing its cache
  entirely.

  Scalars now hash by value, and a call with a single scalar argument is keyed directly, which is the shape of the
  callers that run most often.

- 9ffb84f: Stop `cva.raw()`, `sva.raw()` and `css.raw()` handing out shared, mutable style objects.

  Merged results are cached, so returning one directly means a caller that mutates what it received changes what every
  later caller reads:

  ```js
  const styles = button.raw({ size: 'sm' })
  styles.color = 'red' // used to poison the cached entry
  button.raw({ size: 'sm' }) // every later caller saw color: 'red'
  ```

  `css.raw()` already copied, but only at the top level, and the merge underneath kept references to the caller's nested
  objects — so a condition object such as `_hover` was shared even through that copy. Merging now copies nested objects
  and arrays instead of pointing at the source, and all three `raw()` helpers return a fully independent object.

  Class name output is unchanged.

- a966bae: Make `splitProps` faster by reading each key's descriptor instead of building one for the whole object, and
  by answering key membership from the own-keys list rather than by asking the object per key.

  Roughly 2.4–2.9x on plain and frozen props, 1.2x on accessor props, and about even on the proxy Solid's `mergeProps`
  hands over — the shapes that carry something to preserve keep the descriptor path and most of its cost.

  It called `Object.getOwnPropertyDescriptors` up front and `Object.defineProperty` for every key it moved. That is paid
  once per element per render, and the descriptor path is only needed for keys that have something to preserve.

  An accessor still stays an accessor — Solid compiles props to accessors, and reading one during a split would build a
  component's children before their provider exists — a non-enumerable key stays non-enumerable, and `__proto__` is
  defined rather than assigned so it stays an own property.

  One thing does change: a key taken from frozen props — React freezes them in development — arrives writable, because
  `writable`/`configurable` are carried over only on the descriptor path. Assigning to a split bucket used to throw in
  strict mode and now succeeds. Nothing in the framework mutates one.

  Two long-standing bugs go with it: a group naming `toString`, `constructor` or another `Object.prototype` member used
  to be handed one and put `undefined` in its bucket, and that spurious key also reached the rest bucket.

## 1.12.3

## 1.12.2

## 1.12.1

## 1.12.0

## 1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown

## 1.11.1

## 1.11.0

## 1.10.0

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.

## 1.9.1

## 1.9.0

## 1.8.2

## 1.8.1

## 1.8.0

## 1.7.3

## 1.7.2

## 1.7.1

## 1.7.0

## 1.6.1

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.3

## 1.4.2

### Patch Changes

- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.

## 1.4.1

## 1.4.0

## 1.3.1

## 1.3.0

## 1.2.0

## 1.1.0

### Minor Changes

- e8ec0aa: Add support for `preset:resolved` hook to pick/omit specific preset properties.

## 1.0.1

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

## 0.54.0

### Patch Changes

- efa060d: Improve algorithm for deterministic property order.
  - Longhand (`padding`, `margin`, `inset`)
  - Shorthand of longhands (`padding-inline`, `margin-inline`)
  - Shorthand of shorthands (`padding-inline-start`, `margin-inline-start`)

  ```tsx
  css({
    p: '4',
    pr: '2',
    px: '10',
  })
  ```

  Will result in the following css regardless of the order of the properties:

  ```css
  .p-4 {
    padding: 4px;
  }

  .px-10 {
    padding-left: 10px;
    padding-right: 10px;
  }

  .pr-2 {
    padding-right: 2px;
  }
  ```

- d2aede5: Reduce the size of the generated `Token` type by referencing category tokens.

  **Before:**

  ```ts
  export type Token = 'colors.green.400' | 'colors.red.400'

  export type ColorToken = 'green.400' | 'red.400'
  ```

  **After:**

  ```ts
  export type Token = `colors.${ColorToken}`

  export type ColorToken = 'green.400' | 'red.400'
  ```

## 0.53.7

## 0.53.6

## 0.53.5

## 0.53.4

## 0.53.3

## 0.53.2

## 0.53.1

## 0.53.0

## 0.52.0

## 0.51.1

## 0.51.0

## 0.50.0

## 0.49.0

## 0.48.1

## 0.48.0

## 0.47.1

## 0.47.0

## 0.46.1

## 0.46.0

### Minor Changes

- 54426a2: Add support native css nesting in template literal mode. Prior to this change, you need to add `&` to all
  nested selectors.

  Before:

  ```ts
  css`
    & p {
      color: red;
    }
  `
  ```

  After:

  ```ts
  css`
    p {
      color: red;
    }
  `
  ```

  > **Good to know**: Internally, this will still convert to `p` to `& p`, but the generated css will work as expected.

## 0.45.2

## 0.45.1

## 0.45.0

### Patch Changes

- 552dd4b: Fix issue where `divideY` and `divideColor` utilities, used together in a recipe, doesn't generate the
  correct css.

## 0.44.0

## 0.43.0

## 0.42.0

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.2

### Patch Changes

- 1f636eb: Fix a cache issue that leads to HMR growing slower in some cases

## 0.39.1

## 0.39.0

### Patch Changes

- 935ec86: Allow passing arrays of `SystemStyleObject` to the `css(xxx, [aaa, bbb, ccc], yyy)` fn

  This is useful when you are creating your own styled component and want to benefit
  [from the recent `css` array property support](https://github.com/bamboocss/bamboo/pull/2515).

  ```diff
  import { css } from 'styled-system/css'
  import type { HTMLStyledProps } from 'styled-system/types'

  type ButtonProps = HTMLStyledProps<'button'>

  export const Button = ({ css: cssProp = {}, children }: ButtonProps) => {
  -  const className = css(...(Array.isArray(cssProp) ? cssProp : [cssProp]))
  +  const className = css(cssProp)
    return <button className={className}>{children}</button>
  }
  ```

## 0.38.0

### Minor Changes

- 2c8b933: Add least resource used (LRU) cache in the hot parts to prevent memory from growing infinitely

## 0.37.2

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

## 0.37.0

### Patch Changes

- 7daf159: Fix a bug where some styles would be grouped together in the same rule, even if they were not related to each
  other.

  ## Internal details

  This was caused by an object reference being re-used while setting a property deeply in the hashes decoding process,
  leading to the mutation of a previous style object with additional properties.

## 0.36.1

## 0.36.0

## 0.35.0

## 0.34.3

## 0.34.2

## 0.34.1

## 0.34.0

## 0.33.0

## 0.32.1

## 0.32.0

### Patch Changes

- 8cd8c19: Always sort `all` to be first, so that other properties can easily override it

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

## 0.30.2

## 0.30.1

## 0.30.0

### Patch Changes

- ab32d1d7: Introduce 3 new hooks:

  ## `tokens:created`

  This hook is called when the token engine has been created. You can use this hook to add your format token names and
  variables.

  > This is especially useful when migrating from other css-in-js libraries, like Stitches.

  ```ts
  export default defineConfig({
    // ...
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path) => '
  ```

## 0.29.1

## 0.29.0

## 0.28.0

### Patch Changes

- 770c7aa4: Update `getArbitraryValue` so it works for values that start on a new line

## 0.27.3

## 0.27.2

## 0.27.1

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

- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/bamboocss/bamboo/pull/1986#issuecomment-1887459483) based on the React Profiler.

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- 657ca5da: Fix issue where `[]` escape hatch clashed with named grid lines

## 0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

## 0.24.0

## 0.23.0

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

## 0.22.0

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties

## 0.21.0

### Minor Changes

- 26e6051a: Add an escape-hatch for arbitrary values when using `config.strictTokens`, by prefixing the value with `[`
  and suffixing with `]`, e.g. writing `[123px]` as a value will bypass the token validation.

  ```ts
  import { css } from '../styled-system/css'

  css({
    // @ts-expect-error TS will throw when using from strictTokens: true
    color: '#fff',
    // @ts-expect-error TS will throw when using from strictTokens: true
    width: '100px',

    // ✅ but this is now allowed:
    bgColor: '[rgb(51 155 240)]',
    fontSize: '[12px]',
  })
  ```

## 0.20.1

## 0.20.0

## 0.19.0

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline

## 0.17.5

## 0.17.4

## 0.17.3

## 0.17.2

## 0.17.1

### Patch Changes

- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

## 0.16.0

## 0.15.5

## 0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work

## 0.15.2

## 0.15.1

### Patch Changes

- 26f6982c: Fix issue where slot recipe breaks when `slots` is `undefined`

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/bamboocss/bamboo/issues/1315

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

## 0.11.0

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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

## 0.9.0

## 0.8.0

## 0.7.0

### Patch Changes

- f59154fb: Fix issue where slash could not be used in token name

## 0.6.0

## 0.5.1

### Patch Changes

- c0335cf4: Fix the `astish` shared function when using `config.syntax: 'template-literal'`

  ex: css`${someVar}`

  if a value is unresolvable in the static analysis step, it would be interpreted as `undefined`, and `astish` would
  throw:

  > TypeError: Cannot read properties of undefined (reading 'replace')

- 762fd0c9: Fix issue where the `walkObject` shared helper would set an object key to a nullish value

  Example:

  ```ts
  const shorthands = {
    flexDir: 'flexDirection',
  }

  const obj = {
    flexDir: 'row',
    flexDirection: undefined,
  }

  const result = walkObject(obj, (value) => value, {
    getKey(prop) {
      return shorthands[prop] ?? prop
    },
  })
  ```

  This would set the `flexDirection` to `row` (using `getKey`) and then set the `flexDirection` property again, this
  time to `undefined`, since it existed in the original object

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

- 60df9bd1: Fix issue where escaping classname doesn't work when class starts with number.

## 0.4.0

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

* path.join('-'), }) }, }, })

````

## `utility:created`

This hook is called when the internal classname engine has been created. You can override the default `toHash` function
used when `config.hash` is set to `true`

```ts
export default defineConfig({
  // ...
  hooks: {
    'utility:created': ({ configure }) => {
      configure({
        toHash: (paths, toHash) => {
          const stringConds = paths.join(':')
          const splitConds = stringConds.split('_')
          const hashConds = splitConds.map(toHash)
          return hashConds.join('_')
        },
      })
    },
  },
})
````

## `codegen:prepare`

This hook is called right before writing the codegen files to disk. You can use this hook to tweak the codegen files

```ts
export default defineConfig({
  // ...
  hooks: {
    'codegen:prepare': ({ artifacts, changed }) => {
      // do something with the emitted js/d.ts files
    },
  },
})
```

- 49c760cd: Fix issue where responsive array in css and cva doesn't generate the correct classname

## 0.29.1

## 0.29.0

## 0.28.0

### Patch Changes

- 770c7aa4: Update `getArbitraryValue` so it works for values that start on a new line

## 0.27.3

## 0.27.2

## 0.27.1

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

- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/bamboocss/bamboo/pull/1986#issuecomment-1887459483) based on the React Profiler.

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- 657ca5da: Fix issue where `[]` escape hatch clashed with named grid lines

## 0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

## 0.24.0

## 0.23.0

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

## 0.22.0

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties

## 0.21.0

### Minor Changes

- 26e6051a: Add an escape-hatch for arbitrary values when using `config.strictTokens`, by prefixing the value with `[`
  and suffixing with `]`, e.g. writing `[123px]` as a value will bypass the token validation.

  ```ts
  import { css } from '../styled-system/css'

  css({
    // @ts-expect-error TS will throw when using from strictTokens: true
    color: '#fff',
    // @ts-expect-error TS will throw when using from strictTokens: true
    width: '100px',

    // ✅ but this is now allowed:
    bgColor: '[rgb(51 155 240)]',
    fontSize: '[12px]',
  })
  ```

## 0.20.1

## 0.20.0

## 0.19.0

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline

## 0.17.5

## 0.17.4

## 0.17.3

## 0.17.2

## 0.17.1

### Patch Changes

- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

## 0.16.0

## 0.15.5

## 0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work

## 0.15.2

## 0.15.1

### Patch Changes

- 26f6982c: Fix issue where slot recipe breaks when `slots` is `undefined`

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/bamboocss/bamboo/issues/1315

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

## 0.11.0

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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

## 0.9.0

## 0.8.0

## 0.7.0

### Patch Changes

- f59154fb: Fix issue where slash could not be used in token name

## 0.6.0

## 0.5.1

### Patch Changes

- c0335cf4: Fix the `astish` shared function when using `config.syntax: 'template-literal'`

  ex: css`${someVar}`

  if a value is unresolvable in the static analysis step, it would be interpreted as `undefined`, and `astish` would
  throw:

  > TypeError: Cannot read properties of undefined (reading 'replace')

- 762fd0c9: Fix issue where the `walkObject` shared helper would set an object key to a nullish value

  Example:

  ```ts
  const shorthands = {
    flexDir: 'flexDirection',
  }

  const obj = {
    flexDir: 'row',
    flexDirection: undefined,
  }

  const result = walkObject(obj, (value) => value, {
    getKey(prop) {
      return shorthands[prop] ?? prop
    },
  })
  ```

  This would set the `flexDirection` to `row` (using `getKey`) and then set the `flexDirection` property again, this
  time to `undefined`, since it existed in the original object

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

- 60df9bd1: Fix issue where escaping classname doesn't work when class starts with number.

## 0.4.0

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.
