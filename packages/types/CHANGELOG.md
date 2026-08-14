# @bamboocss/types

## 1.43.1

## 1.43.0

### Minor Changes

- 1cef86c: `unresolvedToken` now fails the build on a misspelled token, and only warns when the grammar is the one
  objecting.

  A warning in a build log is close to invisible, and this check exists to catch something that is otherwise invisible —
  `color: 'mutedd'` ships as `color: mutedd`, which parses, and which the browser discards. Defaulting it to `warn` was
  doing very little work.

  But the two halves of the check are not equally certain, and one severity flattened them:

  | half      | when                                                                    | decided by               | default |
  | --------- | ----------------------------------------------------------------------- | ------------------------ | ------- |
  | `token`   | the property draws from a token category, or the value is a dotted path | bamboo's own bookkeeping | `error` |
  | `grammar` | a bare name on a property with no token category                        | the CSS grammar          | `warn`  |

  `top: 'navH'` is the first — `top` reads `spacing`, `navH` is declared under `sizes`, and no third party is consulted
  to know that. `containerType: 'scroll-state'` is the second: valid CSS that the grammar's data has not caught up with.

  The split is measured, not guessed. Sweeping all 10,128 (property, keyword) pairs csstype enumerates through the
  grammar found **8 disagreements — 0.08% — and every one of them on a property with no token category**:
  `container-type: scroll-state`, `dominant-baseline: text-bottom`/`text-top`, `stroke-linejoin: arcs`/`miter-clip`,
  `text-justify: distribute`, `text-orientation: sideways-right`, `glyph-orientation-vertical: auto`. So the half that
  now fails a build is the half with no measured false positives in it, and a stale grammar can still only warn.

  A single severity applies to both, as before — `unresolvedToken: 'warn'` restores the old behaviour exactly.

  It found three more real ones on the way in: `color: 'neutra.200'` in this repo's own card recipe, `rounded: 'none'`
  in its global CSS — `border-radius: none` is not CSS, so the declaration was dropped and inline-code rounding leaked
  into fenced blocks — and a `boxShadow: 'outline'` in a test fixture named "token reference", referencing a token that
  does not exist.

## 1.42.0

### Minor Changes

- 4fcae37: A `zIndex` scale in the preset, and `hash: 'auto'`.

  **`zIndex` tokens.** There was no such category, so every project invented one — usually as raw numbers scattered
  across components, occasionally as semantic names copied from another design system. The second is the one that bites:
  `zIndex: 'overlay'` against a theme declaring nothing resolves to nothing and ships `z-index: overlay`, which parses,
  so no build objects, and which the browser discards — leaving the element with no stacking context at all. This repo's
  own documentation site shipped that, in a drawer copied from Chakra.

  `hide` `base` `docked` `dropdown` `sticky` `banner` `overlay` `modal` `popover` `skipNav` `toast` `tooltip`, spaced so
  a project can slot its own layer between two without renumbering. Additive: twelve custom properties, no existing rule
  changed.

  **`hash: 'auto'`** hashes class names in production and leaves them readable in development. The mode comes from the
  integration — the Vite plugin's dev server is development, everything else is production — and is resolved once at
  context creation, so the emitted CSS and the compiled class literals cannot disagree about a name.

  Measured on a five-page react-router app, `hash: { className: 'auto' }` against the default:

  |                    | readable  | hashed            |
  | ------------------ | --------- | ----------------- |
  | stylesheet, raw    | 37,527 B  | 32,429 B (−14%)   |
  | stylesheet, gzip   | 7,610 B   | 7,894 B (**+4%**) |
  | longest class name | 105 chars | 6 chars           |

  **The gzip column is why this is not the default.** Readable names repeat, so they compress almost to nothing; hashes
  are incompressible. The raw sheet shrinks and the compressed sheet grows. Where hashing does pay is the _markup_ — a
  105-character class serialising a whole `linear-gradient()` appears in every document that uses it, and each document
  is compressed on its own — which is where the 20%-of-class-attribute-bytes figure that prompted this came from.
  Whether that trade is worth it depends on how many documents a project ships and how many arbitrary values it writes,
  so it is a decision to make with your own numbers rather than one to inherit.

- 6fa8d1a: Remove `strictTokens: 'unknown-tokens'`. The build checks names now, and it is better at it.

  The setting existed to make `css({ color: 'mutedd' })` a type error, by narrowing every generated prop type: keep the
  keywords csstype enumerates, drop the open `string` it ends with. That worked, and it was the wrong layer.
  - It could not tell `top: 'navH'` from `animationName: 'fadeIn'`. csstype describes both as `… | (string & {})`, one
    because it takes lengths and the other because it takes a `<custom-ident>`, so the generator carried a hand-written
    list of 29 property names to know the difference.
  - That trailing `(string & {})` is csstype declining to say a list is exhaustive, and it declines for **70%** of the
    properties it describes. Narrowing them anyway rejects `width: 'stretch'` and `imageRendering: 'optimizeSpeed'`.
  - It only ever saw TypeScript. Two of the four findings on this repo's own documentation site are in **config
    recipes**, which `tsc` does not check — and none of it reaches a `.vue` template or a project not using TypeScript.
  - It could not say anything useful. A type error reports that a string is not assignable to a union of two hundred
    members and guesses a near-miss by spelling, which is how `transitionProperty: 'color'` came to be rejected in
    favour of `'colors'` — a utility value that emits seven declarations instead of one.

  The build answers all four, against the real CSS grammar, and says where the name actually lives:

  ```
  `top: navH` — `navH` is declared under `sizes`, but `top` reads `spacing`.
  It is emitted as written, and the browser will drop it.
  Use a `spacing` token, or write `[navH]` to mean it literally.
  ```

  **What this costs, measured** on this repo's documentation site with `tsc --extendedDiagnostics`. Deterministic
  counts, not wall clock:

  |                | with the narrowing | without       |
  | -------------- | ------------------ | ------------- |
  | Types          | 40,995             | 18,320 (−55%) |
  | Instantiations | 181,030            | 46,230 (−74%) |

  **Migration.** Delete the setting; the check it bought is on by default and needs no configuration. `strictTokens` is
  now a boolean and means only what its `true` always meant — every raw CSS value must be written `[14px]` — which is a
  design-system policy rather than a correctness check, so `bamboo init` no longer writes it. A config still naming
  `'unknown-tokens'` is reported by validation rather than silently read as `true`, which truthiness would otherwise
  make it.

  Also gone from the generated `styled-system`: `KnownKeywords`, `CssValueShape`, and the author-identifier property
  list.

- 5c33622: `strictTokens` is now `strictValues`, and it is a build check.

  Two things were wrong with it as a set of TypeScript narrowings, and both are about the same confusion — it was
  answering a _policy_ question with a _correctness_ mechanism.

  **A utility's values replaced the property's own.** `transitionProperty` declares the sugar `common`, `colors`,
  `size`, `position` and `background`, so the setting rejected `transitionProperty: 'color'` — a real CSS property name,
  and a `<custom-ident>` exactly where the grammar asks for one — and suggested `'colors'`, which emits seven
  declarations instead of one. A utility adds vocabulary to a property; it does not take the property's own away.
  Nothing narrows now, so a property always keeps its own values:

  ```ts
  // styled-system/types/style-props.d.ts
  transitionProperty?: ConditionalValue<UtilityValues['transitionProperty'] | CssVars | CssProperties['transitionProperty'] | AnyString>
  ```

  **It could not tell a keyword from a raw value.** `display: 'flex'` is not reaching outside the design system — `flex`
  is the only way to say it — so the old setting handled `display` by not narrowing it at all, which let
  `display: 'abc'` through with it. The grammar draws that line:

  ```ts
  css({ color: 'red.300' }) //               ✅ a token
  css({ display: 'flex' }) //                ✅ a keyword
  css({ animationName: 'fadeIn' }) //        ✅ an identifier you invented
  css({ transitionProperty: 'color' }) //    ✅ a css property name

  css({ fontSize: '14px' }) //               ❌ write `[14px]`
  css({ color: '#fff' }) //                  ❌
  css({ border: '1px solid red' }) //        ❌
  ```

  It reads the styles your **source** produced, so a preset's reset and your own config recipes are not held to a policy
  about your source — which is why it is a separate pass rather than a branch in the resolver, which sees both. Graded
  by `validation`: a warning by default, and a failure under `validation: 'error'`.

  **Migration.** Rename `strictTokens` to `strictValues` in your config, and `--strict-tokens` to `--strict-values`. The
  setting means what `true` always meant; there is no type-level version of it any more, so the errors move from `tsc`
  to the build.

  Together with removing the middle mode, this takes the whole type-level narrowing out. Measured on this repo's
  documentation site with `tsc --extendedDiagnostics` — deterministic counts, not wall clock — **Types 40,995 → 18,320
  and Instantiations 181,030 → 46,230.**

## 1.41.1

## 1.41.0

## 1.40.1

## 1.40.0

## 1.39.1

## 1.39.0

### Minor Changes

- 4d27ba4: Add `strictTokens: 'unknown-tokens'`, a setting between "nothing is checked" and "only tokens".

  On the default, `css({ color: 'mutedd' })` is accepted by TypeScript and by the build. It ships as `color: mutedd`,
  which parses, so nothing objects — the browser drops the declaration at compute time and the style is simply absent.
  It surfaces as a colour that never applied, a long way from the typo.

  `strictTokens: true` catches it, and rejects every raw CSS value with it: `468` errors on one otherwise-correct
  five-page app, three of which were the class of mistake it was turned on for. That makes it a day-one decision, and a
  project that did not make it then is realistically stuck with the unchecked default.

  `'unknown-tokens'` costs no migration for a literal value. `'14px'`, `'100vh'`, `'1px solid red'`, `'rgb(0 0 0)'` and
  every keyword a property enumerates stay writable; what it rejects is a bare identifier that is neither a token nor a
  keyword — `'mutedd'`, `'accnt'`, `'colors.acent'`. The test is shape: a token path is an identifier, possibly dotted,
  so anything starting with a digit, `#` or `-`, or containing a space, a comma or a call, cannot be one.

  Properties whose values _are_ identifiers you invent are left out of it — `animationName`, `gridArea`, `counterReset`,
  `containerName`, `viewTransitionName`, `fontFamily`, `listStyleType`, `transitionProperty`, `willChange`, `content`
  and the rest — because there is nothing to check them against, and a `@keyframes` name declared in CSS is an ordinary
  thing to write.

  Two costs follow from the rule being about shape, and both are documented rather than fixed: a typo shaped like a
  value passes (`'2xll'` starts with a digit exactly as `'2rem'` does), and a value typed `string` is rejected, since
  nothing distinguishes it from a misspelled token — the same as under `strictTokens: true`, and no new restriction
  under the Vite compiler, which rejects an open runtime value whatever the types say. Over 600 `css()` call sites,
  `tsc` took 0.48s on the default, 0.59s under `strictTokens: true` and 0.70s under this setting.

  Nothing changes for a project that does not set it: the property types emitted under `false` and `true` are unchanged,
  and the only difference in those artifacts is two new exported helper aliases in `prop-type.d.ts` and the import line
  that references them.

## 1.38.0

## 1.37.13

## 1.37.12

## 1.37.11

## 1.37.10

## 1.37.9

## 1.37.8

## 1.37.7

## 1.37.6

## 1.37.5

## 1.37.4

## 1.37.3

## 1.37.2

## 1.37.1

## 1.37.0

## 1.36.5

## 1.36.4

## 1.36.3

## 1.36.2

## 1.36.1

## 1.36.0

## 1.35.5

## 1.35.4

## 1.35.3

## 1.35.2

## 1.35.1

## 1.35.0

### Minor Changes

- 9bfcf31: Replace Vite's runtime styling and named-recipe output with mandatory whole-program compilation.

  The compiler resolves `css`, `cva`, `sva`, config recipes, static `viewTransition` bags, and statically analyzable
  `cx` composition before allocating classes. Recipe identity no longer enters declaration identity, so identical
  declarations share one global atom across every API and source file. Production builds omit recipe layers, prune
  unreachable graph atoms and transition rules, compile finite runtime recipe selections into reduced decision tables,
  and use deterministic or build-local compact class names. Compilation now runs in development too, and unresolved
  runtime styling is always an error. The former transform, partial-folding, runtime-fallback, and opt-in compatibility
  options have been removed.

## 1.34.1

## 1.34.0

### Minor Changes

- c49ab36: Add `leafFallback`, which is what makes zero runtime reachable for an app that has any dynamic styling.

  The fold's payoff is not the per-call CPU it saves — it is that a bundle where everything lowered stops importing
  `styled-system/css`, and the engine drops out. One reference keeps the whole thing, and there is exactly one:
  `cssLeaf` falls back to `css({ [prop]: value })` for a value that turns out to be a condition object or a responsive
  array, which no class-name concatenation describes.

  That fallback is reachable only for a value the fold could not see the shape of, and it costs everything. On
  `sandbox/runtime-perf`, one dynamic leaf:

  |                                | raw      | gzip    | top-level bindings |
  | ------------------------------ | -------- | ------- | ------------------ |
  | `leafFallback: true` (default) | 22,154 B | 7,542 B | 39                 |
  | `leafFallback: false`          | 2,094 B  | 1,077 B | 10                 |

  7.0x on gzip, because the reference pulls in `createCss`, the merge, the utility and shorthand tables and the
  conditions — for a branch that fires only when the value is not a scalar.

  Setting `leafFallback: false` removes it. The generated `cssLeaf` then throws for the two shapes `leafClass` declines,
  naming the property, rather than returning a class with no rule behind it. What you are asserting is that **a style
  value that varies at runtime is a scalar** — write conditions and responsive values as literals at the call site,
  where the fold reads them and resolves each branch.

  `failOnUnfolded` in `@bamboocss/vite` follows: a lowered leaf is reported as `lowered-leaf` because of that reference,
  so with the fallback off it is no longer a survivor. This is the part that matters — with the fallback on,
  `failOnUnfolded` can only pass an app with _no dynamic styling at all_, which is a far narrower target than it sounds.
  Together the two options move it to "an app whose dynamic values are scalars", which is most of them.

  The option narrows what counts as surviving; it does not weaken the guarantee. A spread the build cannot see is still
  a real `css()` in the output and still fails.

  Default unchanged, so nothing moves unless you ask for it.

- c527ea7: Add `unresolvedToken`, so a style value naming a token that does not exist can fail the build.

  ```ts
  export default defineConfig({
    unresolvedToken: 'error', // 'off' | 'warn' | 'error', default 'warn'
  })
  ```

  ```
  error: 2 style value(s) name a token that does not exist:

  - `background: accent.default`. Check the path against your `colors` tokens.
  - `color: brand.foreground`. Check the path against your `colors` tokens.
  ```

  Token resolution falls back to the value it was given, so an unknown path is emitted as written and
  `background: 'accent.default'` ships as `background: accent.default`. That parses, so the stylesheet is valid and no
  build step objects — the browser drops the declaration at compute time and the style is simply absent. It had warned
  on every build for months behind a dead site-wide `::selection` rule and a `_selected` state that rendered identically
  to unselected, and there was no way to escalate it: `validation` grades the config rather than the source,
  `strictTokens` narrows generated typescript, and `prune.unresolvedPath` is about a `token()` call the prune scan
  cannot follow — a question about pruning coverage, asked of a token that usually exists.

  The default stays `warn`, which is exactly what it did before, because the test is a _shape_: a dotted value against
  the set of values the property enumerates. That is right about a mistyped token and cannot be certain about a literal,
  so escalating is a choice a project makes once it knows its own source is clean. A property that enumerates nothing is
  never reported, and `[accent.default]` marks a value as literal.

  **Under `error` the check reads the decoded stylesheet, not the transforms that built it.** The decoder memoizes each
  atom by hash, so on the second build of the same source `transform` is never re-entered — a check that accumulated
  findings as transforms ran would either keep one past the edit that fixed it, or clear its record and then pass a
  build whose source is still broken. Asking the sheet instead makes the question stateless and matches what is actually
  being written: extraction is additive within a watch process, so a value you have already fixed is reported for
  exactly as long as its rule is still in the file.

### Patch Changes

- e66c5f8: Delete artifacts codegen no longer generates, instead of leaving them on disk.

  Codegen was write-only. An artifact that stopped being produced stayed where it was: dropping a pattern from the
  config rewrote `patterns/index.mjs` without it and left `patterns/stack.mjs` beside it. Importing through the barrel
  then failed loudly, which is fine — a deep import resolved, ran, returned a class name and emitted no css. A stale
  artifact is worse than a missing one, because it answers.

  `--clean` was the only sweep, and it empties the whole directory rather than reconciling it.

  Bounded twice over, because the cost of being wrong is a deleted file rather than a stale one. Only the directories a
  codegen actually wrote to are read, so a directory bamboo does not generate into is never touched. Within them, only
  files carrying an extension this codegen wrote _there_ are eligible: `patterns/` received `.mjs` and `.d.ts` files, so
  a leftover `stack.mjs` is stale, while a `.gitignore`, a `README.md` or a `styles.css` is not the kind of thing bamboo
  puts there and is none of its business. Subdirectories are left alone.

  Reasoning from what was written, rather than from a list of known exceptions. A denylist has to name every file
  someone might legitimately keep in an output directory, and the failure mode when it misses one is silent deletion —
  it missed the `.gitignore` that ships inside a generated directory.

  Skipped for a partial codegen and for a `codegen:prepare` hook that replaced the artifact list — neither can say what
  a directory should contain, and reading a filtered list as the whole truth would delete every artifact it held back.

- 10bf63d: Keep a `@keyframes` for as long as the token declaration naming it ships.

  ```css
  --animations-drawer-in-right: slide-in-right 400ms ease-out; /* shipped */
  /* @keyframes slide-in-right — deleted */
  ```

  `pruneTokenVars` roots reachability at what the css references _plus_ what reaches a token from outside it: a
  `token()` call, a `prune.keepTokens` pattern, a theme artifact injected at runtime, a `globalCss` export.
  `pruneKeyframes` asked the same question of the same sheet a moment later and re-derived it from the css alone, which
  can see none of those. So a token one pass kept had its keyframe deleted by the other, leaving a declaration pointing
  at a definition that is not there. The stylesheet is valid, the build exits 0, and the animation simply never plays —
  the failure only a diff of the output finds.

  The token pass now hands its answer to the keyframe pass rather than each computing its own. A keyframe is dropped
  only when the declarations naming it were dropped too, so the pass keeps its saving: on the default preset an app that
  uses no animations still ships none of them, and its css is byte-identical to before.

  **It was reported as depending on whether `include` covers `outdir`, which is a second route to it rather than the
  cause.** `collectKeyframeReferences` scans source text for each declared name, and the generated token artifact
  contains `slide-in-right 400ms` verbatim — so a project whose `include` reaches its own output was keeping its
  keyframes by accident, and excluding `outdir` took the accident away. That overlap is no longer load-bearing for
  keyframes.

  Under `prune: { tokens: 'off' }` every keyframe a declaration names is now kept. Nothing is removable there, and `off`
  is the setting chosen precisely because something outside the stylesheet reads those declarations.

## 1.33.0

### Minor Changes

- f7bbc14: Move `prune.preflight` onto `preflight`, so one key owns the reset.

  ```ts
  preflight: { scope: '.app', prune: true } // was preflight: { scope: '.app' }, prune: { preflight: true }
  ```

  There were two config keys named `preflight`, one level apart, and a config had to set both to prune a scoped reset —
  asking for the reset in one place and reshaping it in another. They were never independent: pruning reads
  `preflight.scope` to strip the scope before an element can be read out of a selector, and without that the pass
  matches nothing and silently removes nothing.

  `preflight: true` still means on with the defaults, and is _not_ pruned — pruning stays opt-in, since unlike the token
  and keyframe passes there is nothing to prove it against. `scope` is now optional, which it already was at runtime.

  A config still setting `prune.preflight` fails with the edit to make, rather than reverting to the default in silence.
  That matters more here than for most removals: the reset keeps being emitted either way, just unpruned, so nothing
  about the output would have said the setting had stopped being read.

## 1.32.0

### Minor Changes

- b0ed6dc: Remove the top-level `hooks` config option, so a hook has one place to live.

  Hooks were registrable two ways — through `plugins`, or through a bare `hooks` key on the config, which was treated as
  a nameless plugin appended after all the others. Write a plugin:

  ```ts
  export default defineConfig({
    plugins: [
      {
        name: 'my-app',
        hooks: {
          'tokens:created': ({ configure }) => configure({ formatTokenName: (path) => '$' + path.join('-') }),
        },
      },
    ],
  })
  ```

  One mechanism with two spellings also meant an ordering rule you had to know — "plugins in sequence, then the config's
  own last" — and a diagnostic layer that had a name to print for one spelling and nothing for the other. Ordering is
  now just the order of the array, and every hook belongs to something named.

  A config still setting `hooks` fails naming the replacement, like any other removed option, rather than reverting to
  the default in silence.

  Internally the merged hooks no longer travel on the config object. They were written onto it by `mergeConfigs` and
  read back off in `resolveConfig`, which is what made a `hooks` key ambiguous between "what you wrote" and "what
  resolution produced"; `plugins` is the only source, so `resolveConfig` merges them once and keeps them on
  `LoadConfigResult`. `createContext` from `@bamboocss/fixture` reads hooks from `plugins` for the same reason.

- 8a66bb9: Remove the responsive array syntax, so a responsive value has one spelling.

  `fontWeight: ['medium', undefined, undefined, 'bold']` used to mean one value per breakpoint. Write the condition
  object instead:

  ```ts
  css({ fontWeight: { base: 'medium', lg: 'bold' } })
  ```

  The array form was the worse of the two on its own terms — positional, so skipping a breakpoint needed `undefined`
  padding, and inserting a breakpoint re-pointed every value after it. But the reason it had to go is that CSS already
  writes lists as arrays, so a font stack written the obvious way

  ```ts
  css({ fontFamily: ['Inter', 'sans-serif'] })
  ```

  compiled to `Inter` at base and `sans-serif` at `sm`, with no error and nothing in the type to suggest it.

  An array in a style value is now an error naming the property it was written on, rather than a silent
  reinterpretation. The type no longer admits one either: `ConditionalValue` drops its array member, and `CssProperties`
  is built from csstype's `Properties` rather than `PropertiesFallback` — that array meant repeated declarations, which
  `fallback()` already expresses and which the runtime never implemented.

  A pattern property takes the same conditional value, so `grid({ columns: [2, 3, 4] })` becomes
  `grid({ columns: { base: 2, sm: 3, md: 4 } })`.

  The generated runtime no longer carries the breakpoint key list into `css`, `cva` and `mergeCss` — it existed only to
  expand these arrays.

- da792cc: Replace `textStyles`, `layerStyles` and `animationStyles` with one `theme.mixins`.

  The three were one mechanism wearing three names: one registration, one cascade layer, and a `{ description?, value }`
  shape they all shared. They differed only in which css properties the value was allowed to set — a partition that was
  arbitrary at the edges (`color` was legal in a text style _and_ a layer style; `transform` in a layer style but
  `transformOrigin` only in an animation style) and costly in the middle, since a bundle wanting a font _and_ a border
  had to be split across two keys and applied twice.

  ```ts
  // before
  export default defineConfig({
    theme: { textStyles, layerStyles, animationStyles },
  })
  css({ textStyle: 'body' })
  css({ layerStyle: 'card' })

  // after
  export default defineConfig({ theme: { mixins } })
  css({ mixin: 'body' })
  css({ mixin: 'card' })
  ```

  - `defineTextStyles`, `defineLayerStyles` and `defineAnimationStyles` become `defineMixins`.
  - The `text-styles.json`, `layer-styles.json` and `animation-styles.json` specs become `mixins.json`, and the MCP
    tools `get_text_styles`, `get_layer_styles` and `get_animation_styles` become `get_mixins`.
  - Setting a property that does not exist is still an error. `Mixin` is built on the same property set `css()` uses
    rather than on `SystemStyleObject`, whose index signature would accept a typo — which is what the three allowlists
    were really protecting, and why one of them shipped `hypens` for as long as it did.
  - One namespace now holds every mixin, so prefix them by purpose — `text.body`, `layer.card` — if the flat list gets
    long. Nesting already supports this, and `DEFAULT` gives each group a bare name.

  A config still setting one of the three old keys fails with the replacement named, rather than reverting to the
  default in silence.

- 1cc1860: Remove `variantKeys` from a recipe, leaving `variantMap` as the one way to ask what variants it has.

  The two were never independent — `variantKeys` was `Object.keys(variantMap)`, computed once and stored beside it. Ask
  the map:

  ```ts
  Object.keys(button.variantMap) // was button.variantKeys
  button.variantMap.size //         unchanged
  ```

  `splitVariantProps` is unaffected, and remains the way to pull variant props out of a props object without naming
  them.

  Internally `RecipeNode` carried the same fact three times — `variantKeys`, `variantKeyMap`, and `props`, the last two
  being the map and a second copy of the keys. Only `variantKeyMap` remains. That type is exported from
  `@bamboocss/core`, so a plugin reading `node.props` or `node.variantKeys` reads `Object.keys(node.variantKeyMap)`
  instead.

  `variantMap` keeps its name rather than becoming `variants`: on the config that word already means the style
  definitions, and a `button.variants` that answered `{ size: ['sm', 'md'] }` instead of the objects you wrote would be
  a worse kind of ambiguity than the one being removed.

- c29044f: Add `prune.keepTokens`, so a token path the build cannot follow costs a category instead of the whole theme.

  ```ts
  prune: { tokens: 'accounted', keepTokens: ['colors.*'] }
  ```

  `accounted`'s fallback was total: **one** reference the accounting could not follow kept every declaration in the
  project, so a codebase with a single `token(key)` in it shipped the same stylesheet as one that never pruned. There
  was no middle ground between that and asserting every path resolves — which put the feature out of reach of the
  codebases that reach for `token()` most.

  `keepTokens` is the bound the build could not infer, written by hand. Under `accounted` it keeps what it matches
  **and** stands in for what could not be followed, in place of the blanket keep. Measured on `sandbox/vite-ts` with one
  unfollowable `token(key)`:

  | setting                                             | declarations | stylesheet |
  | --------------------------------------------------- | -----------: | ---------: |
  | `tokens: 'reachable'`                               |          426 |   23,412 B |
  | `tokens: 'accounted'`                               |          426 |   23,412 B |
  | `tokens: 'accounted', keepTokens: ['colors.*']`     |          270 |   17,867 B |
  | `tokens: 'accounted', keepTokens: ['colors.red.*']` |           51 |   10,649 B |

  Patterns are anchored globs over the dotted token _path_, with `*` for any run of characters and a leading `!` to
  exclude. The path, not the css variable: a token is `fontSizes.3xl` and its declaration is `--font-sizes-3xl`, so
  `font-sizes.*` matches nothing. A pattern matching no token is reported and names the spelling that would have worked,
  because it is nearly always a typo and keeping nothing is otherwise silent; so is a list holding only exclusions,
  which selects everything they do not name.

  Saying `keepTokens: ['colors.*']` is an assertion about your own code — _the reads you cannot follow land in colours_
  — which is why nothing infers it. Nothing verifies it either, so the covered references are still printed under
  `warn`. `unresolvedPath: 'error'` deliberately does **not** combine with it: one asserts every path resolves and the
  other declares where the ones that do not will land, and the build says which to drop rather than silently preferring
  the weaker claim.

  Under `reachable` it is additive only, for a token nothing in the stylesheet references and no javascript here reads —
  a sibling package consuming the output, or css outside `include`.

  This replaces `staticCss` as the way to keep a token category alive. `staticCss` emits utility _classes_: keeping the
  colours meant shipping a rule per colour purely to hold the declarations up, usually a larger stylesheet than the
  pruning saved. `CssRule.properties` also has no documented wildcard, so every value had to be enumerated by hand.

  **Docs.** The `prune` reference had not caught up with the option renames — it documented `prune.unresolved`,
  `tokens: false` and the wrong default for `unresolvedPath`. It also never mentioned that a template literal is
  **bounded rather than declined**: ``token(`colors.${shade}`)`` keeps the `colors` category and prunes everything else,
  which already covers the commonest dynamic read and is worth knowing before concluding `accounted` is unusable.

- f3a8b0d: Remove `defineParts`, leaving one way to model a multi-part component.

  A slot recipe is that way. Where you wanted the other thing `defineParts` offered — a single class on the root that
  reaches its children, so there is nothing to bind — that was never an API, only an object whose keys are selectors:

  ```ts
  defineRecipe({
    className: 'checkbox',
    base: {
      '& [data-part="root"]': {
        display: 'flex',
        alignItems: 'center',
        gap: '2',
      },
      '& [data-part="control"]': { borderWidth: '1px', borderRadius: 'sm' },
    },
  })
  ```

  `defineParts` only keyed that object by part name instead. It earned its place when the selectors came from a Zag or
  Ark `anatomy` and were tedious to spell out — `&[data-scope="card"][data-part="root"], & [data-scope=…]` per part.
  That case is still real, and still a few lines that belong in your codebase rather than in the framework:

  ```ts
  const toParts =
    <T extends Record<string, { selector: string }>>(anatomy: T) =>
    (config: Partial<Record<keyof T, SystemStyleObject>>): SystemStyleObject =>
      Object.fromEntries(Object.entries(config).map(([part, styles]) => [anatomy[part].selector, styles]))
  ```

  The `Part` and `Parts` types go with it, as does the `defineParts` declaration in the generated `styled-system/types`.

  `no-config-function-in-source` also picks up `defineMixins` and drops `defineLayerStyles` and `defineTextStyles`,
  which the preceding mixins change had left behind — writing `defineMixins` in a source file was not being flagged.

- c29044f: Throw on a config option that no longer exists, instead of warning about it.

  ```
  ERR_BAMBOO_CONFIG_ERROR: 2 config option(s) no longer exist:

  - [config] `pruneUnusedTokens` is now `prune: { tokens: 'reachable' }`.
  - [config] `themes` is now `theme.variants`.
  ```

  Removed-option detection reported every key by name with its replacement, and then warned. A warning is not a signal
  anything acts on: these removals ship in **minor** versions, so a warning is precisely what an automated dependency
  upgrade merges without a person ever reading it — while the option itself is silent in every other way. There is no
  schema walk, so a key that no longer exists is otherwise ignored outright, the build reverts to the default, and any
  assertion the option asked for stops being enforced.

  This is separate from unknown-key tolerance, which is unchanged. An unknown key may be forward-compatible — a setting
  for a version not installed yet. A _removed_ key can only point backwards: it is proof the config predates the version
  reading it.

  Not governed by `validation`, in either direction, for the same reason a retired token spelling is not. That option
  grades opinions about a config that still builds; this is evidence the config is not the one being read. Every
  occurrence is collected before throwing, so a config is fixed in one pass, and the checks run ahead of the ordinary
  findings — a config that predates the version is why the rest disagrees.

  Found one in this repository: `sandbox/waku-ts` still set `themes`, so the app's theme variants were never generated
  while it imported `getTheme` and `injectTheme` from them.

## 1.31.0

### Minor Changes

- 8fb87ac: **Config options are renamed and removed in this release.** It ships as a minor, so nothing in the version
  signals it — the migration notes below are the warning. Every removed or renamed option is reported by name on the
  next build, with the edit to make.

  Settle the config surface before the API freezes: remove the options that were a second way to say something the
  config already said, and rename the ones whose names disagreed with each other.

  Every removed or renamed option is reported by name on the next build, with the edit to make. An unknown key is
  otherwise ignored in silence, which would mean the build reverting to a default without saying so.

  **`strict` now means exactly one thing.** It was six options across three packages covering three unrelated concerns.
  `strictTokens` and `strictPropertyValues` are unchanged and are the only remaining use of the word — both narrow
  generated TypeScript and neither affects a build.
  - `vite.strict` → `vite.failOnUnfolded`. Named for what it checks.
  - `PatternConfig.strict` + `PatternConfig.blocklist` → `PatternConfig.cssProps: 'all' | 'none' | { except }`. These
    were two answers to one question, and setting both silently dropped the blocklist — it is only applied to the type
    that `strict: true` does not emit.
  - `validation: 'none'` → `validation: 'off'`, matching `prune`.

  **`prune` separates the strategy from the report.**
  - `prune.tokens` takes `'off' | 'reachable' | 'accounted'` instead of a boolean.
  - `prune.unresolved` → `prune.unresolvedPath`, and is now orthogonal: the accounting pass is `tokens: 'accounted'`,
    the severity is `unresolvedPath`. `'off'` used to mean both "do not account" and "do not report", which left
    "account, and stay quiet" unsayable.
  - `prune.propertyRegistrations` is new. Dropping unreachable `@property` registrations was a side effect of
    `prune.tokens`, and happened even when it was off — so an option documented as keeping every token declaration
    quietly removed something else, and nothing could keep them.

  **Four `global*` keys become one.** `globalCss`, `globalFontface`, `globalPositionTry` and `globalVars` are
  `global.css`, `global.fontface`, `global.positionTry` and `global.vars`. `globalVars` was the one of the four
  `PresetCore` never listed, so it kept its `extend` wrapper in the resolved config while its siblings lost theirs.

  **`themes` becomes `theme.variants`.** One character from `theme`, both spellings valid, so the typo resolved to a
  different feature rather than to an error.

  **`presets` is authoritative.** What the config lists is what is loaded; an unset `presets` loads `defaultPresets`,
  exported from `@bamboocss/dev/presets`. `eject` is removed — `presets: []` is what it meant. Previously, listing any
  preset kept `@bamboocss/preset-base` and silently dropped `@bamboocss/preset-bamboo`, so `presets` was neither
  additive nor replacing, and `presets: []` meant "base only" rather than "none". A config that lists presets without
  `preset-base` now warns, because the change is otherwise silent: `preset-base` carries the utility table, so dropping
  it changes every generated class name rather than raising an error.

  ```ts
  import { defaultPresets } from '@bamboocss/dev/presets'

  export default defineConfig({ presets: [...defaultPresets, myPreset] })
  ```

  **`lightningcss` is removed; list the plugin instead.** Its only job was to push `pluginLightningcss()` into
  `plugins`. Naming the plugin from inside `@bamboocss/node` made it a static import, so
  `@bamboocss/plugin-lightningcss` — and the `lightningcss` native binary behind it — installed with every project
  whether or not the flag was set. It is a separate package so that cost can be opt-in.

  ```ts
  import { pluginLightningcss } from '@bamboocss/plugin-lightningcss'

  export default defineConfig({ plugins: [pluginLightningcss()] })
  ```

  **Fixes**
  - `validation` no longer switches off removed-option detection. Setting it to `'none'` returned before that check ran,
    so the one mechanism that tells an upgrader their setting is no longer read was disabled by a severity setting.
  - `forceConsistentTypeExtension` now emits import specifiers as `./x.mjs` rather than `./x.d.mts`, which is only legal
    under `allowImportingTsExtensions`. The flag previously emitted imports that did not resolve.

- 8fb87ac: Make `hash`, `prefix` and `preflight` compose across a preset and an app, and wire up `logFilter`.

  **Scalar-shorthand options merge per member.** `hash: true` is shorthand for setting both `cssVar` and `className`;
  `prefix: 'bb'` is shorthand for both. Expanding the scalar before merging is what lets the object forms compose — a
  preset setting `prefix.className` and an app setting `prefix.cssVar` now end up with both.

  Before this the later object replaced the earlier one wholesale, and silently, because the two usually name
  _different_ members: a preset's `hash: { cssVar: true }` under an app's `hash: { className: true }` resolved to just
  `{ className: true }`. Both options take optional members, so writing the partial form that triggers it is the natural
  thing to do.

  `false` remains a statement about the whole option and turns it off outright.

  **`logFilter` does something.** It was declared in the config type and read by nothing. The logger's type filter —
  globs over the namespaced log type, `vite:transform`, `tokens:unresolved`, `prune:tokens`, `config` — was reachable
  only through the `BAMBOO_DEBUG` environment variable, which put it out of reach of a checked-in config. It is now
  settable and applied from the config alongside `logLevel`, so a build can stay at `warn` while one subsystem is
  followed in full.

  ```ts
  export default defineConfig({ logLevel: 'warn', logFilter: 'prune:*' })
  ```

  Also adds coverage for the behaviour introduced by the config reshape, which had none: `theme.variants` merging
  (including its nested `extend`), `prune.propertyRegistrations`, pattern `cssProps`, and the warning when `presets` no
  longer includes `@bamboocss/preset-base`.

- cd5954c: Group the three prune flags under `prune`, and rename the mode that was called `'strict'`.

  ```ts
  // before
  pruneUnusedTokens: 'strict'
  pruneUnusedKeyframes: false
  prunePreflight: true

  // after
  prune: { unresolved: 'error', keyframes: false, preflight: true }
  ```

  Three options for one concept had drifted apart on all three of naming, default and value type: two said "Unused" and
  one did not, two defaulted to `true` and one to `false`, one took a string and two did not. Each key is independent
  and setting one keeps the defaults for the rest.

  **`'strict'` is now `unresolved: 'error'`.** The word already meant something unrelated in the same config —
  `strictTokens` and `strictPropertyValues` narrow generated _typescript_, and neither implies nor is implied by failing
  a build over a token path. The option is now named for what it checks.

  **`unresolved: 'warn'` is new.** It runs the same accounting as `'error'` and reports the same references without
  failing the build, so a project can read what turning `'error'` on would reject before a build depends on the answer.
  The pruning is identical either way — only whether an unreadable path stops the build differs.

  **Upgrading.** A config still setting a removed option is now reported by name, with the replacement:

  ```
  ⚠️ Invalid config:
  - [config] `pruneUnusedTokens: 'strict'` is now `prune: { unresolved: 'error' }`.
  ```

  That check exists because an unknown config key was otherwise ignored in **silence** — there is no schema walk, so a
  stale `pruneUnusedTokens: 'strict'` would have built clean, pruned by the default instead, and quietly stopped
  enforcing the assertion it asked for. Set `validation: 'error'` to make it fail rather than warn.

  Emitted css is unchanged for an equivalent config; verified byte-identical on three example apps.

  Preset merging is per key: a preset setting `prune: { keyframes: false }` and an app setting
  `prune: { preflight: true }` get both. That needed doing deliberately — `mergeConfigs` deep-merges only the options it
  names and shallow-assigns the rest, so nesting three booleans into an object introduced a way for a preset's setting
  to vanish because an app set a _different_ key. Nothing about the output would have shown it, so it is pinned by a
  test.

- 678bdee: Remove `token(path, fallback)`. A token is referenced one way: `token(path)`.

  The fallback bundled two unrelated behaviours under one spelling — "resolve this, or use the literal if it names no
  token", answered at build time, and "emit `var(--x, fallback)`", answered by the browser. The call site could not say
  which it was getting, and the build-time half silently masked a typo'd path, which is the same reason the `fallback`
  argument was removed from `token.value()`.

  **Patterns resolve tokens directly now.** `PatternHelpers` gains `token(path, fallback)`:

  ```ts
  // before — deferred into a string for the css pipeline to parse later
  const val = isCssUnit(v) ? v : `token(spacing.${v}, ${v})`

  // after — answered where it can be answered
  const val = isCssUnit(v) ? v : token(`spacing.${v}`, v)
  ```

  Same semantics: `spacer({ size: '4' })` resolves to `var(--spacing-4)`, `spacer({ size: 'auto' })` to `auto`. The
  build, the extractor and the browser answer identically — the browser through the generated tokens artifact, so it
  cannot disagree with the build about a variable's name.

  **What this buys.** `expand-token-references.ts` was a 180-line character-state parser, and every line of it existed
  for the fallback and its nesting. It is now **22 lines and one regex**. That also closes a live bug for free:
  `token(path)` in a theme or semantic token value was never expanded — it landed in the stylesheet as literal text,
  with no warning — because the parser's shape forced a reference regex that could not see it.

  **Breaking.** A retired form now fails rather than emitting text: in a token value the build stops and names the token
  and its replacement; in a style value it throws where it is used.

  `spacer`, `grid` and `bleed` emit `var(--spacing-4)` where they emitted `token(spacing.4, 4)`, so their declarations
  lose a now-redundant css fallback and the class names derived from those values change. Apps not using those three
  patterns are byte-identical — verified on an example app.

  Cost: a pattern module now imports the generated tokens artifact, shared with any other `token()` use in the app.

### Patch Changes

- 774048b: Fix `hypens` in the `textStyles` property allowlist, which should have been `hyphens`.

  The misspelling had both halves of the same bug: a `textStyle` could set `hypens`, which is not a css property and
  emits a declaration browsers discard, and could not set `hyphens`, which is one — and which bamboo defines a utility
  for, complete with the `-webkit-hyphens` polyfill. Its two siblings, `hyphenateCharacter` and `hyphenateLimitChars`,
  were spelled correctly, which is what made the gap easy to miss.

  Removing `hypens` is technically a narrowing, but nothing could have been relying on it: the property does not exist,
  so any value set through it was already dropped.

  The three allowlists are now pinned by type-level assertions that `tsc --noEmit` checks, since a hand-maintained list
  of 72 property names has no other guard. Auditing the rest turned up no further typos — `boxShadowColor` is a bamboo
  utility, and `textDecorationSkipBox` and `textDecorationSkipInset` are css properties newer than the bundled csstype.

## 1.30.1

## 1.30.0

### Minor Changes

- Remove `token.var()` and the token `fallback` parameter.

  `token.var` was `token.var = token` — a literal alias, so two spellings for one behaviour, which is the redundancy the
  `token()` change exists to remove. `token()` is the reference.

  The second `fallback` argument is gone too: `token(path) ?? fallback` says the same thing in the language, and the
  parameter had to be proved side-effect-free before a build could fold the call away. A path naming no token resolves
  to nothing, and the property is dropped — at build time and at runtime alike, which they did not previously agree on.

  `token()` and `token.value()` return `string`. Their parameters are the closed sets of paths the theme declares, so a
  call that typechecks always answers.

## 1.29.0

### Minor Changes

- 0dbe9c4: Add `pruneUnusedTokens: 'strict'`, which prunes the token layer for projects whose token paths all resolve at
  build time.

  Since `token()` returns a css variable reference for every token, a path the build cannot read could name any of them,
  so every declaration has to be kept — and the check for that is all-or-nothing: one token call or `/tokens` import
  anywhere under `include` keeps the lot. On the default preset that is 468 declarations instead of 68.

  `'strict'` is an assertion rather than a cleverer inference. You state that every token path is spelled out at the
  call; Bamboo accounts for each reference, keeps by name only what is asked for, and prints everything it could not
  read:

  ```
  ⚠ tokens:strict  2 token reference(s) could not be resolved, so every token declaration is kept.

    src/chart.tsx
      14: unresolved-reference
    src/theme.ts
      3: unclassified-import
  ```

  A reference it cannot read is never pruned — it falls back to whatever the default would have answered for that
  project. So `strict` is never less safe and never larger than the default, and it says why when it cannot prune.

  Two things keep it inert rather than wrong: any file whose parsed tree carries syntax errors declines, which includes
  every `.ts` file using a generic arrow (`<T>(x: T) => x`) or an old-style assertion, since Bamboo hands every file to
  the parser as TSX; and a `.vue` or `.svelte` file mentioning `token` anywhere declines, because a single-file
  component is stored post-transform and the tree is not the code that ships.

  What resolves: a string literal path, either half (`token`, `token.var`, `token.value`), an aliased import, a
  namespace import. What is reported: a path built at runtime or from a constant, a binding that escapes
  (`const t = token`), a re-export, a `require`, and an import from a module Bamboo cannot classify as the artifact —
  which covers a barrel re-exporting it.

  The one thing it cannot check is a caller **outside** `include`, since that scopes style extraction rather than
  everything that may import. Confirm `include` covers every file reaching for a token before turning this on; the
  default remains unchanged.

- 38393c4: `token()` now returns the css variable reference for every token, and `token.value()` returns the resolved
  literal.

  ```ts
  token('colors.red.300') // "var(--colors-red-300)"  — was "#fca5a5"
  token.value('colors.red.300') // "#fca5a5"
  token.var('colors.red.300') // unchanged; now an alias of token()
  ```

  **Why.** `token()` used to return the literal for a plain token and the variable reference for a virtual or
  conditional one, so the kind of thing you got back was decided by the theme rather than by the call. Adding a `_dark`
  variant to a token silently changed what every caller received — same call, same path, a colour before and a variable
  after, both typed `string`, with nothing to catch it. Always-a-reference is the predictable half and the one that
  keeps responding to the cascade, so it takes the short name; the literal has to be asked for, which is also the honest
  signal, since it is the form that stops tracking the theme.

  `token.value()` keeps the old per-token split rather than always returning a literal: a virtual or conditional token
  has no single literal, so its `var()` is still the only truthful answer.

  **Migrating.** Rename any call whose result goes somewhere a css variable will not resolve — a `<canvas>` fill, a
  charting library, `<meta name="theme-color">`, or arithmetic on the value — to `token.value()`. Everything else can
  stay as it is and gets better behaviour for free. Nothing throws and no type changes, since both forms return
  `string`, so this is worth grepping for rather than waiting on.

  **Extraction and folding.** `token()`, `token.var()` and `token.value()` are all recognised by the parser and folded
  at build time, including paths built from a constant or template literal the extractor can follow. `token()` is now
  the trivially foldable form: no condition to read and no non-string case to decline.

  **Fixed along the way: negative tokens lost their sign.** A negative token has no css variable of its own — its
  `varRef` names the positive counterpart, and the negation survives only in the value — so a token whose positive
  counterpart carried a condition resolved to a _positive_ length. `token.value('spacing.-gutter')` returned
  `var(--spacing-gutter)` where it should return `calc(var(--spacing-gutter) * -1)`. Both halves now read through the
  token view, so the generated runtime, the extractor and the build-time fold cannot disagree.

  **Stylesheet size.** This makes `pruneUnusedTokens` coarser in one case. Because `token()` can hand back a `var()` for
  any token, a project that reaches for a token from javascript at all now keeps every token declaration, where before
  it kept only the virtual, conditional and negative ones. A project that never imports the tokens artifact is
  unaffected, and one whose paths all resolve statically will be too once the reachability gate is narrowed to
  distinguish them — tracked as follow-up work.

### Patch Changes

- 6114f6e: Correct the `pruneUnusedTokens` documentation for `token()` returning a css variable.

  The JSDoc every editor shows on hover still described the old contract, and inverted the advice for exactly the
  failure the new one introduces: it said `token(key)` was "safe for any path, because javascript receives a literal",
  and pointed users at `token.var()` as the form needing `staticCss`. Both halves now return `var(--x)`, and the form
  that returns a literal is `token.value()`, which the text never mentioned.

  It also quantifies the bluntness rather than repeating the old figure: a project reaching for a token from javascript
  keeps 468 declarations on the default preset where the narrower exemption kept 68.

  `bamboo init`'s scaffold comment said `token.var()` with a computed path; it is `token()`. The token spec now offers
  `token.value()` unconditionally, since the `varRef` guard it inherited asked a question only the `token.var()` alias
  cared about.

## 1.28.1

### Patch Changes

- 31749e1: Correct two stale `@default` annotations on `Config`, which shipped in the published types and showed the
  wrong value in editor IntelliSense.
  - `cssVarRoot` documented `':where(:host, :root)'`; the resolved default is `':where(:root, :host)'`.
  - `importMap` documented a `jsx: 'styled-system/jsx'` entry, which no longer exists — the JSX factory was removed —
    and omitted the `tokens` entry the default actually carries.

- be39dac: Fold `token.var()` at build time, and record it during extraction.

  `token.var('colors.red.300')` now folds to `"var(--colors-red-300)"`, the same way `token()` already folded to its
  resolved value. Previously it was left alone: the callee is a property access, so the name never matched `matchFn` and
  the extractor dropped the call before the fold could be offered it. A module whose only token use was `token.var()`
  therefore kept its import of the tokens artifact — the whole token map — to resolve a string lookup.

  It is the more foldable of the two. `token()` has to choose between a token's literal value and its variable reference
  depending on the token's condition; `.var` is the reference for every token, so there is no split to get wrong and no
  non-string case to decline.

  Extraction records it as its own kind rather than as a `token()` call, since inlining one as the other would swap a
  themeable reference for a fixed colour. That also means a path built from a constant — `token.var(KEY)` — now resolves
  through the extractor, so `pruneUnusedTokens` keeps that token by name instead of relying on the blanket exemption for
  tokens javascript can reach.

## 1.28.0

### Minor Changes

- d7fc408: Fold calls of a recipe declared in another module.

  `const badge = cva(...)` was recognised by the name the _file_ bound, so a recipe declared in `app/styles.ts` and
  called anywhere else matched nothing. Those calls were not declined — they were invisible: the extractor never
  recorded them, the fold never saw them, and they appeared in neither the folded nor the skipped tally. A build could
  report no unfolded calls while shipping hundreds of them, which made `strict` untrustworthy rather than merely
  incomplete.

  The parser now also registers recipe bindings that arrive through an import, following `export { x } from './m'`,
  `export * from './m'`, `import { x } … export { x }`, and an alias at either end to the module that declares the
  recipe. A star export contributes only names nothing else exports, as the language does. It records that origin on the
  call, and the fold pulls the config from there — on demand rather than from a registry accumulated during the build,
  since a bundler transforms a consumer before the module it imports and a registry would make the result depend on
  discovery order. The class names are hashed from the config, so a recipe lowered in a consuming module produces
  exactly the string its own module produces.

  Not followed: a namespace import (`import * as s`, then `s.textInput(...)`), a default export, and a recipe declared
  outside the project's `include`. Each stays neither folded nor reported, as every cross-module call did before.

  Resolution is a syntax walk over already-loaded statements, using the caller's module resolver. Going through the
  symbol table instead — `getModuleSpecifierSourceFile`, or a symbol's aliases — forces `initializeTypeChecker` and
  measured 4.5x on `parse only`.

  `ensureRecipeHelperImport` now writes an import declaration when the file has none to extend, which is the ordinary
  case once a recipe can come from elsewhere: such a file imports the binding, not the factory, so it need not import
  the css module at all. The declaration goes after the last existing import, leaving a `'use client'` prologue first.

## 1.27.0

## 1.26.0

## 1.25.0

## 1.24.0

## 1.23.0

### Minor Changes

- b041398: Report calls of inline recipes, which the build previously could not see at all.

  An inline recipe is one you bind yourself rather than declaring in the config:

  ```ts
  const badge = cva({
    base: { rounded: 'full' },
    variants: { tone: { info: { bg: 'blue.100' } } },
  })

  badge({ tone: 'info' }) // ← this call
  ```

  Bamboo recognises style calls by the name they were _imported_ as, and `badge` is not an import. So while the
  `cva(...)` definition was extracted normally — the CSS was always correct — the **invocations** were never looked at.
  They were absent from the transform's coverage summary and from `reportSkipped`, which meant a call the fold could not
  handle was indistinguishable from a call nothing had parsed, and the reported percentage read higher than a project's
  real coverage. They now appear as the skip reason `recipe-call`.

  The summary's denominator is `folded + declined`, so invisible calls inflated it directly. `sandbox/vite-ts` reported
  `Folded 33/41 (80%)` and now truthfully reports
  `Folded 33/43 (77%) — declined: dynamic=4 empty=2 not-foldable=2 recipe-call=2`. **Expect your coverage number to go
  down**; nothing about the build got worse.

  **Nothing changes for the ordinary case.** The rules already came from the definition; this records a call site, it
  does not encode one. Output differs only for a recipe whose name collides with another surface, tabulated below — and
  only by dropping rules nothing referenced.

  **Reported, not folded, and it does not fail `strict`** — an inline recipe keeps the recipe runtime rather than the
  `css()` engine, which is the thing `strict` exists to drive to zero.

  Only a **module-scope `const`** binding is registered, and only when its initializer resolves to the imported
  `cva`/`sva` — so a project's own `cva` helper is not picked up, and a `let` that could be reassigned to something else
  is not either. Module scope is the load-bearing part: a name is registered per file rather than per binding, so a
  nested `const css = cva({ … })` shadowing the `css` import would make the module's real `css()` calls look like recipe
  calls and emit no rules for them. A recipe declared inside a function rebuilds itself on every call anyway, and its
  rules come from the `cva(...)` definition regardless.

  **Where CSS output differs.** A module-scope recipe whose name is one the file already matched was previously routed
  to that other surface, and the variant selection at its call site read as props for that surface. Swept across every
  pattern key, every recipe key, and every bare-matched name, in each import context:

  | a module-scope `const N = cva(...)` where…        | what is no longer emitted                       |
  | ------------------------------------------------- | ----------------------------------------------- |
  | `N` is an ordinary name — the common case         | nothing; output is identical                    |
  | `N` is `sva`, `token`, `viewTransition`, `cx`     | nothing; those misroutes were never CSS-bearing |
  | `N` is `css`                                      | atomic rules built from the call's argument     |
  | `N` names a pattern, via a namespace import       | that pattern's full default output              |
  | `N` names a config recipe, via a namespace import | that recipe's whole rule set, base and variants |

  The `css` case is the reachable one — it needs no namespace import, because the name `css` is matched whatever a file
  imports. It is also the one whose removed rules look legitimate: `css({ color: 'blue.300' })` emitted `.c_blue\.300`
  before. Nothing rendered it. The call invokes a recipe, and a recipe names its classes from its config, so any rule
  derived from reading its argument as style props was unreferenced.

  **Rules are only ever removed — the swept "added" set is empty in every case** — and each removal is a correction.
  Regenerating every codegen scenario from a fresh build produces **zero artifact drift**, which also rules out a
  cascade through token and keyframe pruning.

  **One way you could notice a loss.** Mis-dispatching a call also marked that config recipe as _used_. A project that
  renders a config recipe through a path the parser cannot see — a runtime import, a computed `className` — and was
  accidentally kept alive by sharing its name with a local recipe will now lose those rules. Reach for
  [`staticCss`](https://bamboocss.com/docs/references/config#staticcss), which is the supported way to force emission.

  **Perf-neutral**, measured rather than assumed. The pass that finds these bindings has to run before extraction, since
  `matchFn` is memoized per name. Written as a recursive walk it cost **~10%** of extraction on every file, and 13% on
  files defining recipes. Restricting it to module scope makes it a walk of the top-level statement list rather than of
  the tree, gated on the file importing `cva`/`sva` at all — measured at parity on `extract-modes` (1.02x / 1.00x, in a
  back-to-back A/B whose control moved less than the effect).

## 1.22.0

### Minor Changes

- 41d9052: Add `prunePreflight`, which drops the parts of the reset that style elements your source never renders.

  Off by default. Measured on the example apps here:

  | app     |    raw |   gzip | brotli |
  | ------- | -----: | -----: | -----: |
  | vite-ts | -13.2% | -14.8% | -14.2% |
  | svelte  | -33.9% | -29.1% | -29.3% |

  Two thirds of the reset is bound to specific elements — 41 of them, covering `table`, `pre`, `kbd`, `optgroup` and the
  rest of the long tail. Being a fixed size, it dominates a small stylesheet rather than amortising the way the
  utilities layer does: a third of `vite-ts`'s css and four fifths of `svelte`'s, of which those projects render a
  fraction.

  This is the one saving of its kind that survives compression. Deduplicating or re-encoding what is already emitted
  loses to gzip, which has flattened the repetition before you get there — measured repeatedly on this codebase, from
  atomising recipes to native nesting. Emitting less does not.

  A selector list loses only the parts naming unrendered elements, so a rule shared between `button` and
  `::file-selector-button` keeps the half that still applies. `html` and `body` are never removed, and a selector naming
  no element — `*`, `::backdrop`, `[hidden]`, a class — is always kept.

  **Why it stays opt-in**

  `pruneUnusedTokens` and `pruneUnusedKeyframes` default to `true` because reachability can be established from the
  stylesheet and the source together. This has a textual scan of your own source and nothing else. An element rendered
  by a dependency's component, by `dangerouslySetInnerHTML`, or by markdown is invisible to it, and what you get wrong
  is an element quietly losing its reset — no error, no warning. It cannot be made safe by default, and should not be.

  The blind spot to check first is nearer than a dependency. The scan reads what `include` covers, and `include`
  conventionally covers components rather than markup — `./src/**/*.tsx` does not match `index.html`, which is where
  `<noscript>`, a static `<table>` and the rest of a page's hand-written markup usually live. Add the template to
  `include` to cover it; the scan reads any file listed, not only ones the parser understands.

  **What the scan reads**

  The file on disk, not the project's parsed copy of it. That distinction only shows up for single-file components, and
  it decides whether they work at all: `parseSourceFile` replaces an SFC's text with the TSX a framework plugin
  transformed it into, and every transform here is lossy in the same direction. `svelteToTsx` and `vueToTsx` both
  swallow a throw and return an empty string, a Vue SFC with a render function and no `<template>` becomes the literal
  `<template>undefined</template>`, and Svelte strips `<script>` before the scan can see it. Each of those silently
  reports no elements for the file and takes every one of its reset rules with it. Markup is what this wants, so it
  reads the markup.

  It also works with a scoped reset. `preflight: { scope: '.app' }` writes the scope onto every selector — `.app table`,
  or `table.app` under `level: 'element'` — and neither shape names an element until the scope is stripped, so the two
  options together used to produce byte-identical output with the flag doing nothing at all.

  `bamboo cssgen preflight` prunes too. It writes one artifact rather than the whole sheet, so the token and keyframe
  passes cannot run there — both read the finished stylesheet to decide reachability, and on a partial one everything
  looks unreachable. This pass reads your source instead, so it is correct either way, and without it the `reset.css`
  from `cssgen preflight` disagreed with the one `cssgen --splitting` wrote for the same project.

- a1062c9: Remove `cssMode: 'grouped'`.

  **This is a breaking change released as a minor.** Bamboo is still pre-1.0 in practice, so the version does not carry
  the signal — read the migration below before upgrading. A config setting `cssMode` will fail to typecheck, and
  `bamboocss()` from `@bamboocss/vite` now returns an array of plugins rather than one.

  Use `cva({ base: { ... } })` where you want one class per element instead of one per property. It already does exactly
  that, and it does it better.

  **Why**

  Measured on a production build of a real app — the same source built both ways:

  |           |   CSS raw | CSS gzip |
  | --------- | --------: | -------: |
  | `atomic`  | 1,411,989 |  209,489 |
  | `grouped` | 2,913,254 |  390,428 |

  **+86% gzipped**, entirely in the `utilities` layer, which goes from 673 kB to 2.17 MB. Grouping pays only where a
  style set lands on many elements; it groups every `css()` call, and most of them are one-offs where a group is one
  rule serving one element with nothing to amortise it against.

  The markup saving cannot repay that. Across eight routes of the same app, grouping saved 1.9 bytes of gzipped markup
  per element rendered — so roughly **95,000 elements** have to render before the stylesheet's extra 181 kB is earned
  back, about 112 page views with a warm cache. The documentation claimed the trade favoured SSR and SSG; the app
  measured here is server-rendered and never comes close.

  **What to use instead**

  A variant-less `cva` emits a single class carrying every declaration:

  ```ts
  const row = cva({
    base: { display: 'flex', alignItems: 'center', gap: '4' },
  })
  // .cva_gphwnw { display: flex; align-items: center; gap: var(--spacing-4) }
  ```

  It lands in the `recipes` layer rather than `utilities`, which is the part `cssMode` got wrong. Because
  `@layer reset, base, tokens, recipes, utilities` puts `utilities` last, a consumer's `css()` override beats it
  deterministically in every build — where a grouped `css()` class sat in `utilities` alongside the atoms it competed
  with, leaving conflicts to source order.

  The rule of thumb is the useful part: **if a style set is worth grouping, it is worth naming.** Grouping pays when a
  set is reused, and a reused set is a component.

  **Also removed**
  - `RuleProcessor.grouped()` and the `GroupedRule` type.
  - `groupClassName` from `@bamboocss/shared`, and the `grouped` / `knownGroups` fields on `CreateCssContext`.
  - The generated `groups` artifact (`styled-system/css/groups.mjs`) — delete it if a stale copy is left in your output
    directory.
  - The `'ambiguous-merge'` and `'too-many-combinations'` unresolved-style reasons, which only ever applied to grouping,
    and the `'grouped'` value of `UnresolvedStyle['kind']`.

  `css()` calls the build cannot fully read are still reported, unchanged: a spread or computed key warns with a file
  and line, because it looks static and is not.

### Patch Changes

- fe62614: Document what `minify` is worth and when it applies.

  The option has always been there and has always worked; nothing said what it buys or who needs it. Measured on the
  example apps in this repository:

  | app     |    raw |  gzip | brotli |
  | ------- | -----: | ----: | -----: |
  | vite-ts | -21.6% | -5.6% |  -4.8% |
  | svelte  | -20.4% | -6.6% |  -7.3% |

  The gzip column is a quarter of the raw one, because compression collapses indentation long before you get to it —
  which is also why it stays off by default rather than becoming one: for the many projects that import the stylesheet
  through a bundler, production CSS minification has already happened. It matters when `styled-system/styles.css` ships
  as-is, from an HTML file, a CDN, or inside a published component library, and that case gets the indented output
  today.

  No behaviour change.

## 1.21.0

## 1.20.4

## 1.20.3

## 1.20.2

## 1.20.1

## 1.20.0

### Minor Changes

- 5d2c91c: Prune unreachable tokens, keyframes and `@property` rules by default.

  `pruneUnusedTokens` and `pruneUnusedKeyframes` both default to `true` now. On the example apps in this repository:

  | app          |             raw |          gzip |
  | ------------ | --------------: | ------------: |
  | svelte       |  22,047 → 5,188 | 5,442 → 1,802 |
  | runtime-perf |   9,107 → 3,462 |   1,941 → 989 |
  | vite-ts      | 13,845 → 10,463 | 3,390 → 3,053 |

  That is 10–67% of the gzipped, render-blocking stylesheet, and it scales with the size of the design system rather
  than the size of the app — so the larger the theme, the more of it was being shipped for nothing. `bamboo init`
  already turned both on, so newly scaffolded projects had this and everyone else did not.

  Set either to `false` to restore the previous behaviour.

  **`@property` registrations no longer depend on the flag**

  A preset registers every custom property its utilities compose — filters, gradients, transforms, transitions — from
  the config rather than from what the app draws. That is 42 rules and 3.2 kB, byte-identical in every project here, of
  which **41 to 42 were referenced by nothing at all**.

  Those are now dropped whether or not `pruneUnusedTokens` is set. The flag exists because a token can be reached by a
  name the pass never sees — `token.var()` with a path assembled at runtime, a stylesheet outside `include`, a package
  consuming the output as design tokens. A registration has no such surface: nothing hands one to JavaScript and none
  are part of the `token()` api, verified as zero overlap with declared tokens. Whether the finished stylesheet mentions
  one is the whole question, so opting out of the half that cannot be proven should not mean carrying the half that can.

  Turning `pruneUnusedTokens` off is still exact for token declarations — every one is kept.

  **Upgrading**

  The three cases the reachability pass cannot see are unchanged and are the ones to check if a value goes missing:
  - a token named by a path the source does not spell out as a string literal, such as `token.var(key)`
  - a token referenced only from a stylesheet outside `include`
  - a token consumed by a separate package treating the output as design tokens

  List those under `staticCss`, or set `pruneUnusedTokens: false`. The equivalent for an animation name assembled at
  runtime is already covered — the keyframe pass falls back to a deliberately over-inclusive textual scan of `include`.

## 1.19.0

## 1.18.0

## 1.17.3

## 1.17.2

## 1.17.1

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

- 31d8577: **Breaking:** `scopeRoot: 'x'` becomes `scopeRoots: ['x']`, and a slot recipe can now name more than one
  anchor.

  A portal is a real break in the DOM tree, and no CSS mechanism crosses one — not inheritance, not
  `@container style()`, not `:has()`. A `<Select>` occupies two disjoint subtrees: the trigger side under `root`, the
  listbox side under a portaled `positioner`. A variant writes styles into both. One anchor can only ever reach one of
  them.

  That was not a limitation you could work around by choosing the right anchor — it only picked which half worked:

  ```ts
  scopeRoot: 'root' // 7 slots scoped, the 8 portaled ones get rules that never match
  scopeRoot: 'positioner' // 8 slots scoped, the 7 in-tree ones get rules that never match
  ```

  And the failure was quiet. Base slot styles are emitted outside the scope, so they still applied and the component
  rendered _nearly_ right — a partial failure, harder to notice than a total one.

  ```ts
  defineSlotRecipe({
    className: 'select',
    slots: ['root', 'trigger', 'positioner', 'content', 'item'],
    scopeRoots: ['root', 'positioner'],
    variants: { size: { lg: { trigger: { h: '11' }, item: { px: '3' } } } },
  })
  ```

  Each named slot takes variant props; every other slot stays a constant. Anchors are callable, so the variant still has
  to be delivered to each of them — in a compound component the consumer authors `Select.Positioner` as a sibling of
  `Select.Root`, so it needs one context to reach it. That is one delivery per _subtree the component occupies_, not per
  slot: 2 instead of 8, and the count does not grow as the recipe gains slots.

  ### No structural declaration

  You never describe the DOM. Each non-anchor slot's variant rules are emitted under **every** anchor, and only the
  anchor that is genuinely an ancestor matches at runtime. Nested anchors resolve by `@scope` proximity — the nearer one
  wins.

  Read `scopeRoots` as a cost control rather than a description of the tree: emitting every slot under every slot would
  be correct with nothing declared at all, it is just quadratic in slot count. Naming the enclosing slots prunes it to
  one copy per anchor.

  ### Cost, measured

  A 15-slot recipe shaped like Park UI's `select`, two variants over five values:

  ```
  1 anchor    raw 2,315 B   gzip 310 B    5 @scope blocks
  2 anchors   raw 4,248 B   gzip 383 B   10 @scope blocks
  ```

  +84% raw, **+24% gzipped**. The alternative — per-slot variant classes for the portaled half — gzips to 502 B,
  _larger_ than two anchors, and still needs a runtime channel to deliver those classes.

  Getting there needed a fix in the stylesheet: scoped rules are keyed by their `@scope` prelude, and identical at-rules
  only collapse when adjacent. Interleaving two anchors broke that, giving 130 blocks where 10 would do. Scoped results
  are now merged per layer before processing, so the prelude deduplicates as an object key. Unscoped output is untouched
  — merging those would also collapse a variant's declarations into one rule and reorder the layer.

  ### Other changes
  - `scopeRoots: []` explicitly turns scoping off, giving every slot its own variant class. Previously reachable only by
    _not_ having a slot named `root`.
  - A slot recipe's generated type now declares every anchor as callable, not just one.
  - Fixed: `slotScopes` was only ever written, never cleared, so a recipe that _stopped_ being scoped in a watch rebuild
    kept emitting rules under an anchor nothing rendered any more.

  ### What this does not fix

  A slot under _no_ anchor is still unreachable, and nothing at build time can detect it — reachability is a fact about
  the DOM, and there is no component layer left to check it at runtime. `scopeRoots` makes the correct thing
  expressible; it does not make it verifiable. `recipe.slotsAffectedBy` remains the tool for whatever still needs
  threading by hand.

- 2ab7f19: Give an inline `sva()` the same surface a config slot recipe has, and add a development-time check for the
  one scoping failure nothing can catch at build time.

  ### `auditSlotScopes`

  A scoped slot is styled through an `@scope` rule opened at an anchor, so it has to be rendered inside one. A slot
  moved out of every anchor's subtree — through a portal, with no second anchor named in `scopeRoots` — keeps its base
  styles and silently loses its variant styles. It renders _nearly_ right, which is harder to notice than a total
  failure, and no build step can catch it: whether one element is inside another is a fact about the DOM.

  ```js
  import { auditSlotScopes, select } from '../styled-system/css'

  if (process.env.NODE_ENV !== 'production') {
    auditSlotScopes([select], { observe: true })
  }
  ```

  ```
  [bamboo] select: the `item` slot is rendered outside every anchor (root), so its variant
  styles cannot reach it. Add the enclosing slot to `scopeRoots`, or deliver the variant to
  this slot by hand.
  ```

  Two details that decide whether it is useful or noisy. It matches the anchor's **base** class rather than its variant
  class — an anchor always carries the base one, while the variant class is absent whenever no variant is selected, so
  matching on that would report slots that are correctly placed and simply unstyled. And `observe: true` re-checks on
  DOM mutation, because portaled content mounts after a one-shot sweep would have run, which is exactly the case this
  exists to catch.

  Keep the call behind a `NODE_ENV` check and your bundler drops it, and the function, from production.

  ### Inline `sva` was missing documented members

  The scoping docs describe `slotsAffectedBy` as the way to find which slots a variant reaches, but only config slot
  recipes exposed it — an inline `sva` had no way to answer the question:
  - **`slotsAffectedBy`** is now on both.
  - **`scopeRoots`** is now on both, reporting the resolved anchors.
  - **`classNameMap`** is populated for an inline `sva` whether or not the config sets a `className`. Every slot recipe
    is given a name before the split, so the old guard left an anonymous `sva` reporting no slot classes despite
    emitting them. Config slot recipes returned a literal `{}`; they now return the real map.
  - **`SlotRecipeRuntimeFn`** declared none of `config`, `classNameMap`, `slotsAffectedBy` or `scopeRoots`, several of
    which the runtime already returned.

- ca558fb: Let a slot recipe name the slot its variants scope by, with `scopeRoot`.

  Scoping a slot recipe's variants to its root needs an enclosing slot to anchor on, and until now that had to be a slot
  literally named `root`. A component library's wrapper is not always called that — and sometimes the slot called `root`
  renders no DOM element at all, which is the case that makes this necessary rather than convenient. A menu whose only
  real ancestor is `positioner` had no way in.

  ```ts
  defineSlotRecipe({
    className: 'menu',
    slots: ['trigger', 'positioner', 'item'],
    scopeRoot: 'positioner',
    variants: { size: { sm: { item: { padding: '2' } } } },
  })
  ```

  `item` is inside `positioner`, so its variant styles are emitted as rules scoped by the class `positioner` carries,
  and its own class stays constant. Unset, the default is still a slot named `root`, so nothing changes for recipes that
  have one.

  Only slots rendered _inside_ the named one are reached. A slot a portal moves out of that subtree is not — `trigger`
  above is a sibling — and needs its variant delivered by hand. `recipe.slotsAffectedBy` says which slots each variant
  actually writes styles for, so only those need threading.

  A `scopeRoot` naming a slot the recipe does not declare is now a config error rather than a silent fallback to
  per-slot variant classes, which would have looked correct while quietly reinstating the runtime distribution the
  recipe was written to avoid.

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

## 1.13.2

## 1.13.1

## 1.13.0

### Minor Changes

- a07286f: Add `pruneUnusedKeyframes`, dropping `@keyframes` rules nothing can reach.

  A preset declares every animation it offers and an app uses a handful. The rest sit in the one stylesheet that blocks
  first paint. On the fixture preset this drops all four unused keyframes and 436 bytes; it scales with the size of the
  design system rather than the app, the same way `pruneUnusedTokens` does.

  It is **off by default** and changes nothing until switched on.

  Only keyframes the theme declares are ever removed, so one emitted by `globalCss` is left alone. A name is kept when
  an animation property in the generated css names it, when it appears anywhere under `include`, or when it is named in
  a custom property that is itself reachable.

  That last clause is what makes the pass worth having. `preset-bamboo` declares
  `--animations-spin: spin 1s linear infinite` whether or not anything uses that token, so counting every custom
  property as a reference would keep every keyframe the preset ships. References from a custom property are held back
  and only credited once the property is reached through `var()`, following the chain — the same reachability model
  `pruneTokenVars` uses.

  Names are recovered by tokenizing values and testing each token against the declared set, rather than by parsing the
  `animation` shorthand, which interleaves durations, easings and directions in any order. A keyframe named after a
  keyword therefore always looks referenced. That is the intended bias: keeping an unused keyframe costs bytes, dropping
  a used one silently stops an animation.

  The textual scan over `include` covers what the css cannot show — an animation name assembled at runtime, or applied
  through an inline `style` rather than through bamboo.

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

## 1.11.0

### Minor Changes

- 78869ae: ### Added: Multi-block conditions with object syntax

  Allow a single condition to generate multiple independent CSS blocks using a declarative object syntax with `@slot`
  markers.

  This is useful for defining conditions like hover-for-desktop + active-for-touch in one condition, where each block
  needs its own at-rule.

  **Config:**

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    conditions: {
      extend: {
        hoverActive: {
          '@media (hover: hover)': {
            '&:is(:hover, [data-hover])': '@slot',
          },
          '@media (hover: none)': {
            '&:is(:active, [data-active])': '@slot',
          },
        },
      },
    },
  })
  ```

  **Usage:**

  ```ts
  css({ _hoverActive: { bg: 'red' } })
  ```

  **Generated CSS:**

  ```css
  @media (hover: hover) {
    .hoverActive\:bg_red:is(:hover, [data-hover]) {
      background: red;
    }
  }
  @media (hover: none) {
    .hoverActive\:bg_red:is(:active, [data-active]) {
      background: red;
    }
  }
  ```

  This is backward compatible — existing `string` and `string[]` conditions continue to work as before.

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 8d3b6f8: Add support for generating theme tokens in `bamboo spec` output.

  Previously, tokens defined in the `themes` config were excluded from the spec output because they are registered as
  virtual tokens. Now, `bamboo spec` generates a `themes.json` file containing tokens and semantic tokens for each
  configured theme.

- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.

## 1.9.1

## 1.9.0

## 1.8.2

### Patch Changes

- 331d1a5: Update `csstype` from 3.1.3 to 3.2.3, which adds support for newer CSS properties including:
  - Anchor positioning: `anchorName`, `anchorScope`, `positionAnchor`, `positionArea`, `positionTry`,
    `positionTryFallbacks`, `positionTryOrder`, `positionVisibility`
  - Text wrapping: `textWrapMode`, `textWrapStyle`, `textSpacingTrim`
  - Form sizing: `fieldSizing`, `interpolateSize`

  Add support for the experimental [`corner-shape`](https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape) CSS
  property, which specifies the shape of a box's corners. Valid values include: `round`, `square`, `bevel`, `scoop`,
  `notch`, `squircle`, and `superellipse(<number>)`.

## 1.8.1

### Patch Changes

- 3c86c29: Expand `TextStyleProperty` type (consumed by `TextStyle` → `TextStyles` types) to include support for
  `text-box` properties:
  - [`text-box`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box)
  - [`text-box-edge`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-edge)
  - [`text-box-trim`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim)

## 1.8.0

## 1.7.3

## 1.7.2

## 1.7.1

## 1.7.0

### Minor Changes

- 86b30b1: Add `bamboo spec` command to generate specification files for your theme (useful for documentation). This
  command generates JSON specification files containing metadata, examples, and usage information.

  ```bash
  # Generate all spec files
  bamboo spec

  # Custom output directory
  bamboo spec --outdir custom/specs
  ```

  **Token Spec Structure:**

  ```json
  {
    "type": "tokens",
    "data": [
      {
        "type": "aspectRatios",
        "values": [
          {
            "name": "square",
            "value": "1 / 1",
            "cssVar": "var(--aspect-ratios-square)"
          }
        ],
        "tokenFunctionExamples": ["token('aspectRatios.square')"],
        "functionExamples": ["css({ aspectRatio: 'square' })"],
        "jsxExamples": ["<Box aspectRatio=\"square\" />"]
      }
    ]
  }
  ```

  **Spec Usage:**

  ```javascript
  import tokens from 'styled-system/specs/tokens'
  import recipes from 'styled-system/specs/recipes'
  ```

## 1.6.1

## 1.6.0

## 1.5.1

## 1.5.0

### Minor Changes

- 91c65ff: Add support for controlling the color palette generation via `theme.colorPalette` property.

  ```ts
  // Disable color palette generation completely
  export default defineConfig({
    theme: {
      colorPalette: {
        enabled: false,
      },
    },
  })

  // Include only specific colors
  export default defineConfig({
    theme: {
      colorPalette: {
        include: ['gray', 'blue', 'red'],
      },
    },
  })

  // Exclude specific colors
  export default defineConfig({
    theme: {
      colorPalette: {
        exclude: ['yellow', 'orange'],
      },
    },
  })
  ```

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.1

## 1.3.0

### Patch Changes

- 70efd73: Enhanced composition types with comprehensive CSS property support

  **Text Style Properties:** Added these properties to `theme.textStyles`:
  - Added `color` property
  - Text layout properties (`direction`, `textAlign`, `writingMode`)
  - Advanced text properties (`tabSize`, `hangingPunctuation`, `textDecorationSkip*`, `textStroke*`)

  **Layer Style Properties:** Added these properties to `theme.layerStyles`:
  - Layout properties (`position`, `zIndex`, `display`, `height`, `width`, `margin*`, `inset*`)
  - Visual effects (`clipPath`, `mixBlendMode`, `mask*`)
  - Modern properties (`aspectRatio`, `objectFit`, `cursor`, `content`, `transition`)
  - Background shorthands (`bg`, `bgColor`, `bgImage`)
  - Styling (`borderImage*`, `outline*`, `color`)

## 1.2.0

## 1.1.0

### Minor Changes

- 47a0011: Add missing WebKit CSS properties to resolve TypeScript errors. Adds support for:
  - `WebkitUserDrag` / `-webkit-user-drag` - Controls element drag behavior
  - `WebkitAppRegion` / `-webkit-app-region` - For Electron window controls
  - `WebkitBorderHorizontalSpacing` / `-webkit-border-horizontal-spacing` - Table border spacing
  - `WebkitBorderVerticalSpacing` / `-webkit-border-vertical-spacing` - Table border spacing
  - `WebkitTextSecurity` / `-webkit-text-security` - Text obscuring for passwords

  Fixes TypeScript errors when using these vendor-prefixed properties in Bamboo CSS.

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

## 0.53.7

## 0.53.6

## 0.53.5

## 0.53.4

## 0.53.3

## 0.53.2

## 0.53.1

## 0.53.0

### Minor Changes

- 5286731: Add support for recent baseline and experimental css properties:
  - **Size interpolation:** fieldSizing, interpolateSize
  - **Text rendering:** textWrapMode, textWrapStyle and textSpacingTrim
  - **[Experimental] Anchor positioning:** anchorName, anchorScope, positionAnchor, positionArea, positionTry,
    positionTryFallback, positionTryOrder, positionVisibility

## 0.52.0

## 0.51.1

## 0.51.0

### Minor Changes

- d68ad1f: **[BREAKING]**: Fix issue where Next.js build might fail intermittently due to version mismatch between
  internal `ts-morph` and userland `typescript`.

  > The current version of TS supported is `5.6.2`

## 0.50.0

### Minor Changes

- fea78c7: Adds support for static analysis of used tokens and recipe variants. It helps to get a birds-eye view of how
  your design system is used and answers the following questions:
  - What tokens are most used?
  - What recipe variants are most used?
  - How many hardcoded values vs tokens do we have?

  ```sh
  bamboo analyze --scope=<token|recipe>
  ```

  > Still work in progress but we're excited to get your feedback!

- ad89b90: Add support for semantic tokens in composite shadow `blur`, `offsetX`, `offsetY` and `spread` properties.

  This enables the use of semantic tokens in composite shadow properties.

  ```ts
  // bamboo.config.ts

  export default defineConfig({
    theme: {
      tokens: {
        // ...
        shadows: {
          sm: {
            value: {
              offsetX: '{spacing.3}',
              offsetY: '{spacing.3}',
              blur: '1rem',
              spread: '{spacing.3}',
              color: '{colors.red}',
            },
          },
        },
      },
    },
  })
  ```

## 0.49.0

### Minor Changes

- 97a0e4d: Add support for animation styles. Animation styles focus solely on animations, allowing you to orchestrate
  animation properties.

  > Pairing animation styles with text styles and layer styles can make your styles a lot cleaner.

  Here's an example of this:

  ```jsx
  import { defineAnimationStyles } from '@bamboocss/dev'

  export const animationStyles = defineAnimationStyles({
    'slide-fade-in': {
      value: {
        transformOrigin: 'var(--transform-origin)',
        animationDuration: 'fast',
        '&[data-placement^=top]': {
          animationName: 'slide-from-top, fade-in',
        },
        '&[data-placement^=bottom]': {
          animationName: 'slide-from-bottom, fade-in',
        },
        '&[data-placement^=left]': {
          animationName: 'slide-from-left, fade-in',
        },
        '&[data-placement^=right]': {
          animationName: 'slide-from-right, fade-in',
        },
      },
    },
  })
  ```

  With that defined, I can use it in my recipe or css like so:

  ```js
  export const popoverSlotRecipe = defineSlotRecipe({
    slots: anatomy.keys(),
    base: {
      content: {
        _open: {
          animationStyle: 'scale-fade-in',
        },
        _closed: {
          animationStyle: 'scale-fade-out',
        },
      },
    },
  })
  ```

  This feature will drive consumers to lean in towards CSS for animations rather than JS. Composing animation names is a
  powerful feature we should encourage consumers to use.

## 0.48.1

## 0.48.0

## 0.47.1

## 0.47.0

### Minor Changes

- 5e683ee: Add support for cursor token types. Useful for tokenizing cursor types for interactive components.

  Here's an example of how to define a cursor token in your `bamboo.config.ts` file:

  ```ts
  // bamboo.config.ts
  export default defineConfig({
    theme: {
      extend: {
        tokens: {
          cursor: {
            button: { value: 'pointer' },
            checkbox: { value: 'default' },
          },
        },
      },
    },
  })
  ```

  Then you can use the cursor token in your styles or recipes.

  ```tsx
  <button className={css({ cursor: 'button' })}>Click me</button>
  ```

  This makes it easy to manage cursor styles across your application.

## 0.46.1

## 0.46.0

## 0.45.2

## 0.45.1

## 0.45.0

### Minor Changes

- dcc9053: Remove `base` from `css` or pattern style objects. The `base` keyword is only supported in recipes or
  conditional styles.

  **Before**

  ```jsx
  hstack({
    // ❌ doesn't work
    base: {
      background: 'red.400',
      p: '11',
    },
    display: 'flex',
    flexDirection: 'column',
  })
  ```

  **After**

  ```jsx
  hstack({
    // ✅ works
    background: 'red.400',
    p: '11',
    display: 'flex',
    flexDirection: 'column',
  })
  ```

## 0.44.0

### Minor Changes

- c99cb75: Add a `name` mandatory key in `Preset` to make it easy to target one specifically

## 0.43.0

### Minor Changes

- e952f82: Add support for defining global font face in config and preset

  ```ts
  // bamboocss.config.js
  export default defineConfig({
    globalFontface: {
      Roboto: {
        src: 'url(/fonts/roboto.woff2) format("woff2")',
        fontWeight: '400',
        fontStyle: 'normal',
      },
    },
  })
  ```

  You can also add multiple font `src` for the same weight

  ```ts
  // bamboocss.config.js

  export default defineConfig({
    globalFontface: {
      Roboto: {
        // multiple src
        src: ['url(/fonts/roboto.woff2) format("woff2")', 'url(/fonts/roboto.woff) format("woff")'],
        fontWeight: '400',
        fontStyle: 'normal',
      },
    },
  })
  ```

  You can also define multiple font weights

  ```ts
  // bamboocss.config.js

  export default defineConfig({
    globalFontface: {
      // multiple font weights
      Roboto: [
        {
          src: 'url(/fonts/roboto.woff2) format("woff2")',
          fontWeight: '400',
          fontStyle: 'normal',
        },
        {
          src: 'url(/fonts/roboto-bold.woff2) format("woff2")',
          fontWeight: '700',
          fontStyle: 'normal',
        },
      ],
    },
  })
  ```

## 0.42.0

### Minor Changes

- e157dd1: - Ensure classnames are unique across utilities to prevent potential clash
  - Add support for `4xl` border radius token
- f00ff88: BREAKING: Remove `emitPackage` config option,

  tldr: use `importMap` instead for absolute paths (e.g can be used for component libraries)

  `emitPackage` is deprecated, it's known for causing several issues:
  - bundlers sometimes eagerly cache the `node_modules`, leading to `bamboo codegen` updates to the `styled-system` not
    visible in the browser
  - auto-imports are not suggested in your IDE.
  - in some IDE the typings are not always reflected properly

  As alternatives, you can use:
  - relative paths instead of absolute paths (e.g. `../styled-system/css` instead of `styled-system/css`)
  - use package.json #imports and/or tsconfig path aliases (prefer package.json#imports when possible, TS 5.4 supports
    them by default) like `#styled-system/css` instead of `styled-system/css`
    https://nodejs.org/api/packages.html#subpath-imports
  - for a component library, use a dedicated workspace package (e.g. `@acme/styled-system`) and use
    `importMap: "@acme/styled-system"` so that Bamboo knows which entrypoint to extract, e.g.
    `import { css } from '@acme/styled-system/css'` https://bamboocss.com/docs/guides/component-library

### Patch Changes

- 19c3a2c: Minor changes to the format of the `bamboo analyze --output coverage.json` file
- 17a1932: [BREAKING] Removed the legacy `config.optimize` option because it was redundant. Now, we always optimize the
  generated CSS where possible.

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.2

## 0.39.1

## 0.39.0

### Minor Changes

- 221c9a2: Add support for more typography related properties in text styles such as `fontFeatureSettings`,
  `fontPalette`, etc.

### Patch Changes

- c3e797e: Fix issue where `animationName` property was not connected to `theme.keyframes`, as a result, no
  autocompletion was available.

## 0.38.0

### Minor Changes

- bc09d89: Add support for deprecating tokens, utilities, patterns and config recipes.

  Set the `deprecated` property to `true` to enable deprecation warnings. Alternatively, you can also set it to a string
  to provide a custom migration message.

  **Deprecating a utility**

  ```js
  defineConfig({
    utilities: {
      ta: {
        deprecated: true,
        transform(value) {
          return { textAlign: value }
        },
      },
    },
  })
  ```

  **Deprecating a token**

  ```js
  defineConfig({
    theme: {
      tokens: {
        spacing: {
          lg: { value: '8px', deprecated: 'use `8` instead' },
        },
      },
    },
  })
  ```

  **Deprecating a pattern**

  ```js
  defineConfig({
    patterns: {
      customStack: {
        deprecated: true,
      },
    },
  })
  ```

  **Deprecating a recipe**

  ```js
  defineConfig({
    theme: {
      recipes: {
        btn: {
          deprecated: 'will be removed in v2.0',
        },
      },
    },
  })
  ```

  ### ESLint Plugin

  These deprecation warnings will translated into the ESLint plugin as a `no-deprecated` rule.

  ```json
  {
    "rules": {
      "no-deprecated": "warn"
    }
  }
  ```

  In the next release of the ESLint plugin, you will get a warning when using deprecated tokens or utilities.

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

## 0.37.2

### Patch Changes

- 74dfb3e: - Fix `sva` typings, the `splitVariantProps` was missing from the `d.ts` file
  - Add a `getVariantProps` helper to the slot recipes API (`sva` and `config slot recipes`)

  ```ts
  import { sva } from '../styled-system/css'
  import { getVariantProps } from '../styled-system/recipes'

  const button = sva({
    slots: ['root', 'icon'],
    // ...
    variants: {
      size: {
        sm: {
          // ...
        },
        md: {
          // ...
        },
      },
      variant: {
        primary: {
          // ...
        },
        danger: {
          // ...
        }
      }
    }
    defaultVariants: {
      size: 'md',
      variant: 'primary',
    }
  })

  // ✅ this will return the computed variants based on the defaultVariants + props passed
  const buttonProps = button.getVariantProps({ size: "sm" })
  //    ^? { size: "sm", variant: "primary" }
  ```

## 0.37.1

### Patch Changes

- 885963c: - Fix an issue where the `compoundVariants` classes would not be present at runtime when using
  `config recipes`

  ```ts
  // bamboo.config.ts
  import { defineConfig } from "@bamboocss/dev";

  export default defineConfig({
    theme: {
      extend: {
        recipes: {
          button: {
            // ...
            variants: {
              size: {
                sm: {
                  fontSize: "sm",
                },
                // ...
              },
            },
            compoundVariants: [
              {
                size: "sm",
                css: { color: "blue.100" },
              },
            ],
          },
        },
      },
    },
  });

  // app.tsx
  const Button = styled("button", button);

  const App = () => {
    return (
      // ❌ this would only have the classes `button button--size_sm`
      // the `text_blue` was missing
      // ✅ it's now fixed -> `button button--size_sm text_blue`
      <Button size="sm">Click me</Button>
    );
  };
  ```

  - Add a `getVariantProps` helper to the recipes API (`cva` and `config recipes`)

  ```ts
  import { cva } from '../styled-system/css'
  import { getVariantProps } from '../styled-system/recipes'

  const button = cva({
      // ...
    variants: {
      size: {
        sm: {
          fontSize: 'sm',
        },
        md: {
          fontSize: 'md',
        },
      },
      variant: {
        primary: {
          backgroundColor: 'blue.500',
        },
        danger: {
          backgroundColor: 'red.500',
        }
      }
    }
    defaultVariants: {
      size: 'md',
      variant: 'primary',
    }
  })

  // ✅ this will return the computed variants based on the defaultVariants + props passed
  const buttonProps = button.getVariantProps({ size: "sm" })
  //    ^? { size: "sm", variant: "primary" }
  ```

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

- 6247dfb: Allow multiple `importMap` (or multiple single import entrypoints if using the object format).

  It can be useful to use a component library's `styled-system` while also using your own `styled-system` in your app.

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    importMap: ['@acme/styled-system', '@ui-lib/styled-system', 'styled-system'],
  })
  ```

  Now you can use any of the `@acme/styled-system`, `@ui-lib/styled-system` and `styled-system` import sources:

  ```ts
  import { css } from '@acme/css'
  import { css as uiCss } from '@ui-lib/styled-system/css'
  import { css as appCss } from '@ui-lib/styled-system/css'
  ```

## 0.36.1

### Patch Changes

- bd0cb07: Fix theme variants typings

## 0.36.0

### Minor Changes

- 2691f16: Add `config.themes` to easily define and apply a theme on multiple tokens at once, using data attributes and
  CSS variables.

  Can pre-generate multiple themes with token overrides as static CSS, but also dynamically import and inject a theme
  stylesheet at runtime (browser or server).

  Example:

  ```ts
  // bamboo.config.ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    // main theme
    theme: {
      extend: {
        tokens: {
          colors: {
            text: { value: 'blue' },
          },
        },
        semanticTokens: {
          colors: {
            body: {
              value: {
                base: '{colors.blue.600}',
                _osDark: '{colors.blue.400}',
              },
            },
          },
        },
      },
    },
    // alternative theme variants
    themes: {
      primary: {
        tokens: {
          colors: {
            text: { value: 'red' },
          },
        },
        semanticTokens: {
          colors: {
            muted: { value: '{colors.red.200}' },
            body: {
              value: {
                base: '{colors.red.600}',
                _osDark: '{colors.red.400}',
              },
            },
          },
        },
      },
      secondary: {
        tokens: {
          colors: {
            text: { value: 'blue' },
          },
        },
        semanticTokens: {
          colors: {
            muted: { value: '{colors.blue.200}' },
            body: {
              value: {
                base: '{colors.blue.600}',
                _osDark: '{colors.blue.400}',
              },
            },
          },
        },
      },
    },
  })
  ```

  ### Pregenerating themes

  By default, no additional theme variant is generated, you need to specify the specific themes you want to generate in
  `staticCss.themes` to include them in the CSS output.

  ```ts
  // bamboo.config.ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    staticCss: {
      themes: ['primary', 'secondary'],
    },
  })
  ```

  This will generate the following CSS:

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-text: blue;
      --colors-body: var(--colors-blue-600);
    }

    [data-bamboo-theme='primary'] {
      --colors-text: red;
      --colors-muted: var(--colors-red-200);
      --colors-body: var(--colors-red-600);
    }

    @media (prefers-color-scheme: dark) {
      :where(:root, :host) {
        --colors-body: var(--colors-blue-400);
      }

      [data-bamboo-theme='primary'] {
        --colors-body: var(--colors-red-400);
      }
    }
  }
  ```

  ***

  An alternative way of applying a theme is by using the new `styled-system/themes` entrypoint where you can import the
  themes CSS variables and use them in your app.

  > ℹ️ The `styled-system/themes` will always contain every themes (tree-shaken if not used), `staticCss.themes` only
  > applies to the CSS output.

  Each theme has a corresponding JSON file with a similar structure:

  ```json
  {
    "name": "primary",
    "id": "bamboo-themes-primary",
    "dataAttr": "primary",
    "css": "[data-bamboo-theme=primary] { ... }"
  }
  ```

  > ℹ️ Note that for semantic tokens, you need to use inject the theme styles, see below

  Dynamically import a theme using its name:

  ```ts
  import { getTheme } from '../styled-system/themes'

  const theme = await getTheme('red')
  //    ^? {
  //     name: "red";
  //     id: string;
  //     css: string;
  // }
  ```

  Inject the theme styles into the DOM:

  ```ts
  import { injectTheme } from '../styled-system/themes'

  const theme = await getTheme('red')
  injectTheme(document.documentElement, theme) // this returns the injected style element
  ```

  ***

  SSR example with NextJS:

  ```tsx
  // app/layout.tsx
  import { Inter } from 'next/font/google'
  import { cookies } from 'next/headers'
  import { ThemeName, getTheme } from '../../styled-system/themes'

  export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const store = cookies()
    const themeName = store.get('theme')?.value as ThemeName
    const theme = themeName && (await getTheme(themeName))

    return (
      <html lang="en" data-bamboo-theme={themeName ? themeName : undefined}>
        {themeName && (
          <head>
            <style type="text/css" id={theme.id} dangerouslySetInnerHTML={{ __html: theme.css }} />
          </head>
        )}
        <body>{children}</body>
      </html>
    )
  }

  // app/page.tsx
  import { getTheme, injectTheme } from '../../styled-system/themes'

  export default function Home() {
    return (
      <>
        <button
          onClick={async () => {
            const current = document.documentElement.dataset.bambooTheme
            const next = current === 'primary' ? 'secondary' : 'primary'
            const theme = await getTheme(next)
            setCookie('theme', next, 7)
            injectTheme(document.documentElement, theme)
          }}
        >
          swap theme
        </button>
      </>
    )
  }

  // Set a Cookie
  function setCookie(cName: string, cValue: any, expDays: number) {
    let date = new Date()
    date.setTime(date.getTime() + expDays * 24 * 60 * 60 * 1000)
    const expires = 'expires=' + date.toUTCString()
    document.cookie = cName + '=' + cValue + '; ' + expires + '; path=/'
  }
  ```

  ***

  Finally, you can create a theme contract to ensure that all themes have the same structure:

  ```ts
  import { defineThemeContract } from '@bamboocss/dev'

  const defineTheme = defineThemeContract({
    tokens: {
      colors: {
        red: { value: '' }, // theme implementations must have a red color
      },
    },
  })

  defineTheme({
    selector: '.theme-secondary',
    tokens: {
      colors: {
        // ^^^^   Property 'red' is missing in type '{}' but required in type '{ red: { value: string; }; }'
        //
        // fixed with
        // red: { value: 'red' },
      },
    },
  })
  ```

- fabdabe: ## Changes

  When using `strictTokens: true`, if you didn't have `tokens` (or `semanticTokens`) on a given `Token category`, you'd
  still not be able to use _any_ values in properties bound to that category. Now, `strictTokens` will correctly only
  restrict properties that have values in their token category.

  Example:

  ```ts
  // bamboo.config.ts

  export default defineConfig({
    // ...
    strictTokens: true,
    theme: {
      extend: {
        colors: {
          primary: { value: 'blue' },
        },
        // borderWidths: {}, // ⚠️ nothing defined here
      },
    },
  })
  ```

  ```ts
  // app.tsx
  css({
    // ❌ before this PR, TS would throw an error as you are supposed to only use Tokens
    // even thought you don't have any `borderWidths` tokens defined !

    // ✅ after this PR, TS will not throw an error anymore as you don't have any `borderWidths` tokens
    // if you add one, this will error again (as it's supposed to)
    borderWidths: '123px',
  })
  ```

  ## Description
  - Simplify typings for the style properties.
  - Add the `csstype` comments for each property.

  You will now be able to see a utility or `csstype` values in 2 clicks !

  ## How

  Instead of relying on TS to infer the correct type for each properties, we now just generate the appropriate value for
  each property based on the config.

  This should make it easier to understand the type of each property and might also speed up the TS suggestions as
  there's less to infer.

### Patch Changes

- 861a280: Introduce a new `globalVars` config option to define type-safe
  [CSS variables](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) and custom
  [CSS @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property).

  Example:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    globalVars: {
      '--some-color': 'red',
      '--button-color': {
        syntax: '<color>',
        inherits: false,
        initialValue: 'blue',
      },
    },
  })
  ```

  > Note: Keys defined in `globalVars` will be available as a value for _every_ utilities, as they're not bound to token
  > categories.

  ```ts
  import { css } from '../styled-system/css'

  const className = css({
    '--button-color': 'colors.red.300',
    // ^^^^^^^^^^^^  will be suggested

    backgroundColor: 'var(--button-color)',
    //                ^^^^^^^^^^^^^^^^^^  will be suggested
  })
  ```

- 340f4f1: Fix `Expression produces a union type that is too complex to represent` with `splitCssProps` because of
  `JsxStyleProps` type

## 0.35.0

### Patch Changes

- 50db354: Add missing reducers to properly return the results of hooks for `config:resolved` and `parser:before`
- f6befbf: Add missing methods for ParserResultInterface (which can be used in the `parser:after` hook to dynamically
  add extraction results from your own logic, like using a custom parser)
- a0c4d27: Add an optional `className` key in `sva` config which will can be used to target slots in the DOM.

  Each slot will contain a `${className}__${slotName}` class in addition to the atomic styles.

  ```tsx
  import { sva } from '../styled-system/css'

  const button = sva({
    className: 'btn',
    slots: ['root', 'text'],
    base: {
      root: {
        bg: 'blue.500',
        _hover: {
          // v--- 🎯 this will target the `text` slot
          '& .btn__text': {
            color: 'white',
          },
        },
      },
    },
  })

  export const App = () => {
    const classes = button()
    return (
      <div className={classes.root}>
        <div className={classes.text}>Click me</div>
      </div>
    )
  }
  ```

## 0.34.3

## 0.34.2

## 0.34.1

## 0.34.0

### Minor Changes

- d1516c8: Deprecates `emitPackage`, it will be removed in the next major version.

  ## Why?

  It's known for causing several issues:
  - bundlers sometimes eagerly cache the `node_modules`, leading to `bamboo codegen` updates to the `styled-system` not
    visible in the browser
  - auto-imports are not suggested in your IDE.
  - in some IDE the typings are not always reflected properly

  ## As alternatives, you can use:
  - relative paths instead of absolute paths (e.g. `../styled-system/css` instead of `styled-system/css`)
  - use [package.json #imports](https://nodejs.org/api/packages.html#subpath-imports) and/or tsconfig path aliases
    (prefer package.json#imports when possible, TS 5.4 supports them by default) like `#styled-system/css` instead of
    `styled-system/css`
  - for a [component library](https://bamboocss.com/docs/guides/component-library), use a dedicated workspace package
    (e.g. `@acme/styled-system`) and use `importMap: "@acme/styled-system"` so that Bamboo knows which entrypoint to
    extract, e.g. `import { css } from '@acme/styled-system/css'`

## 0.33.0

### Minor Changes

- fde37d8: Add support for element level css reset via `preflight.level`. Learn more
  [here](https://github.com/gajus/bamboocss/discussions/1992).

  Setting `preflight.level` to `'element'` applies the reset directly to the individual elements that have the scope
  class assigned.

  ```js
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    preflight: {
      scope: '.my-scope',
      level: 'element', // 'element' | 'parent (default)'
    },
    // ...
  })
  ```

  This will generate CSS that looks like:

  ```css
  button.my-scope {
  }

  img.my-scope {
  }
  ```

  This approach allows for more flexibility, enabling selective application of CSS resets either to an entire parent
  container or to specific elements within a container.

### Patch Changes

- cca50d5: Add a `group` to every utility in the `@bamboocss/preset-base`, this helps Bamboo tooling organize utilities.

## 0.32.1

### Patch Changes

- a032375: Add a way to create config conditions with nested at-rules/selectors

  ```ts
  export default defaultConfig({
    conditions: {
      extend: {
        supportHover: ['@media (hover: hover) and (pointer: fine)', '&:hover'],
      },
    },
  })
  ```

  ```ts
  import { css } from '../styled-system/css'

  css({
    _supportHover: {
      color: 'red',
    },
  })
  ```

  will generate the following CSS:

  ```css
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      color: red;
    }
  }
  ```

- 89ffb6b: Add missing config dependencies for some `styled-system/types` files

## 0.32.0

### Minor Changes

- de4d9ef: Allow `config.hooks` to be shared in `plugins`

  For hooks that can transform Bamboo's internal state by returning something (like `cssgen:done` and
  `codegen:prepare`), each hook instance will be called sequentially and the return result (if any) of the previous hook
  call is passed to the next hook so that they can be chained together.

### Patch Changes

- 60cace3: This change allows the user to set `jsxFramework` to any string to enable extracting JSX components.

  ***

  Context: In a previous version, Bamboo's extractor used to always extract JSX style props even when not specifying a
  `jsxFramework`. This was considered a bug and has been fixed, which reduced the amount of work bamboo does and
  artifacts generated if the user doesn't need jsx.

  Now, in some cases like when using Svelte or Astro, the user might still to use & extract JSX style props, but the
  `jsxFramework` didn't have a way to specify that. This change allows the user to set `jsxFramework` to any string to
  enable extracting JSX components without generating any artifacts.

## 0.31.0

### Minor Changes

- a17fe387: - Add a `config.polyfill` option that will polyfill the CSS @layer at-rules using a
  [postcss plugin](https://www.npmjs.com/package/@csstools/postcss-cascade-layers)
  - And `--polyfill` flag to `bamboo` and `bamboo cssgen` commands

### Patch Changes

- 8f36f9af: Add a `RecipeVariant` type to get the variants in a strict object from `cva` function. This complements the
  `RecipeVariantprops` type that extracts the variant as optional props, mostly intended for JSX components.
- 2d69b340: Fix `styled` factory nested composition with `cva`

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

## 0.30.1

## 0.30.0

### Patch Changes

- 74485ef1: Add `utils` functions in the `config:resolved` hook, making it easy to apply transformations after all
  presets have been merged.

  For example, this could be used if you want to use most of a preset but want to completely omit a few things, while
  keeping the rest. Let's say we want to remove the `stack` pattern from the built-in `@bamboocss/preset-base`:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    hooks: {
      'config:resolved': ({ config, utils }) => {
        return utils.omit(config, ['patterns.stack'])
      },
    },
  })
  ```

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

- a2fb5cc6: - Add support for explicitly specifying config related files that should trigger a context reload on change.

  > We automatically track the config file and (transitive) files imported by the config file as much as possible, but
  > sometimes we might miss some. You can use this option as a workaround for those edge cases.

  Set the `dependencies` option in `bamboo.config.ts` to a glob or list of files.

  ```ts
  export default defineConfig({
    // ...
    dependencies: ['path/to/files/**.ts'],
  })
  ```

  - Invoke `config:change` hook in more situations (when the `--watch` flag is passed to `bamboo codegen`,
    `bamboo cssgen`, `bamboo ship`)

  - Watch for more config options paths changes, so that the related artifacts will be regenerated a bit more reliably
    (ex: updating the `config.hooks` will now trigger a full regeneration of `styled-system`)

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

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.

## 0.27.2

## 0.27.1

### Patch Changes

- ee9341db: Fix issue in windows environments where HMR doesn't work in webpack projects.

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

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- b5cf6ee6: Add `borderWidths` token to types
- 58df7d74: Remove eject type from presets

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

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

## 0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`

## 0.22.0

### Patch Changes

- 526c6e34: Fix issue where static-css types was not exported.

## 0.21.0

### Patch Changes

- 5b061615: Add a shortcut for the `config.importMap` option

  You can now also use a string to customize the base import path and keep the default entrypoints:

  ```json
  {
    "importMap": "@scope/styled-system"
  }
  ```

  is the equivalent of:

  ```json
  {
    "importMap": {
      "css": "@scope/styled-system/css",
      "recipes": "@scope/styled-system/recipes",
      "patterns": "@scope/styled-system/patterns",
      "jsx": "@scope/styled-system/jsx"
    }
  }
  ```

- 105f74ce: Add a way to specify a recipe's `staticCss` options from inside a recipe config, e.g.:

  ```js
  import { defineRecipe } from '@bamboocss/dev'

  const card = defineRecipe({
    className: 'card',
    base: { color: 'white' },
    variants: {
      size: {
        small: { fontSize: '14px' },
        large: { fontSize: '18px' },
      },
    },
    staticCss: [{ size: ['*'] }],
  })
  ```

  would be the equivalent of defining it inside the main config:

  ```js
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    staticCss: {
      recipes: {
        card: {
          size: ['*'],
        },
      },
    },
  })
  ```

## 0.20.1

## 0.20.0

### Minor Changes

- 904aec7b: - Add support for `staticCss` in presets allowing you create sharable, pre-generated styles
  - Add support for extending `staticCss` defined in presets

  ```jsx
  const presetWithStaticCss = definePreset({
    staticCss: {
      recipes: {
        // generate all button styles and variants
        button: ['*'],
      },
    },
  })

  export default defineConfig({
    presets: [presetWithStaticCss],
    staticCss: {
      extend: {
        recipes: {
          // extend and pre-generate all sizes for card
          card: [{ size: ['small', 'medium', 'large'] }],
        },
      },
    },
  })
  ```

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.5

## 0.17.4

### Patch Changes

- fa77080a: Fix issue where types package was not built correctly.

## 0.17.3

### Patch Changes

- 529a262e: Fix regression in types due to incorrect `package.json` structure

## 0.17.2

## 0.17.1

## 0.17.0

### Patch Changes

- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

## 0.16.0

## 0.15.5

## 0.15.4

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

- 58743bc4: - Fix `ExtendableUtilityConfig` typings after a regression in 0.15.2 (due to
  https://github.com/gajus/bamboocss/pull/1410)
  - Fix `ExtendableTheme` (specifically make the `RecipeConfig` Partial inside the `theme: { extend: { ... } }` object),
    same for slotRecipes

## 0.15.2

### Patch Changes

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property

## 0.15.1

## 0.15.0

### Patch Changes

- 4bc515ea: Allow `string`s as `zIndex` and `opacity` tokens in order to support css custom properties
- 39298609: Make the types suggestion faster (updated `DeepPartial`)

## 0.14.0

### Minor Changes

- 8106b411: Add `generator:done` hook to perform actions when codegen artifacts are emitted.

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency

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

- 386e5098: Update `RecipeVariantProps` to support slot recipes

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

## 0.8.0

### Patch Changes

- be0ad578: Fix parser issue with TS path mappings

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types

## 0.6.0

## 0.5.1

### Patch Changes

- 8c670d60: Remove `breakpoints` from Tokens type
- 1ed239cd: Add feature where `config.staticCss.recipes` can now use [`*`] to generate all variants of a recipe.

  before:

  ```ts
  staticCss: {
    recipes: {
      button: [{ size: ['*'], shape: ['*'] }]
    }
  }
  ```

  now:

  ```ts
  staticCss: {
    recipes: {
      button: ['*']
    }
  }
  ```

- 78ed6ed4: Fix issue where using a nested outdir like `src/styled-system` with a baseUrl like `./src` would result on
  parser NOT matching imports like `import { container } from "styled-system/patterns";` cause it would expect the full
  path `src/styled-system`

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

## 0.4.0

### Minor Changes

- 5b344b9c: Add support for disabling shorthand props

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    shorthands: false,
  })
  ```

### Patch Changes

- c7b42325: Add types for supported at-rules (`@media`, `@layer`, `@container`, `@supports`, and `@page`)

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

## 0.0.2

### Patch Changes

- c308e8be: Allow asynchronous presets
- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [fb40fff2]
  - @bamboocss/extractor@0.0.2

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

## 0.29.1

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

- a2fb5cc6: - Add support for explicitly specifying config related files that should trigger a context reload on change.

  > We automatically track the config file and (transitive) files imported by the config file as much as possible, but
  > sometimes we might miss some. You can use this option as a workaround for those edge cases.

  Set the `dependencies` option in `bamboo.config.ts` to a glob or list of files.

  ```ts
  export default defineConfig({
    // ...
    dependencies: ['path/to/files/**.ts'],
  })
  ```

  - Invoke `config:change` hook in more situations (when the `--watch` flag is passed to `bamboo codegen`,
    `bamboo cssgen`, `bamboo ship`)

  - Watch for more config options paths changes, so that the related artifacts will be regenerated a bit more reliably
    (ex: updating the `config.hooks` will now trigger a full regeneration of `styled-system`)

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

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.

## 0.27.2

## 0.27.1

### Patch Changes

- ee9341db: Fix issue in windows environments where HMR doesn't work in webpack projects.

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

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- b5cf6ee6: Add `borderWidths` token to types
- 58df7d74: Remove eject type from presets

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

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

## 0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`

## 0.22.0

### Patch Changes

- 526c6e34: Fix issue where static-css types was not exported.

## 0.21.0

### Patch Changes

- 5b061615: Add a shortcut for the `config.importMap` option

  You can now also use a string to customize the base import path and keep the default entrypoints:

  ```json
  {
    "importMap": "@scope/styled-system"
  }
  ```

  is the equivalent of:

  ```json
  {
    "importMap": {
      "css": "@scope/styled-system/css",
      "recipes": "@scope/styled-system/recipes",
      "patterns": "@scope/styled-system/patterns",
      "jsx": "@scope/styled-system/jsx"
    }
  }
  ```

- 105f74ce: Add a way to specify a recipe's `staticCss` options from inside a recipe config, e.g.:

  ```js
  import { defineRecipe } from '@bamboocss/dev'

  const card = defineRecipe({
    className: 'card',
    base: { color: 'white' },
    variants: {
      size: {
        small: { fontSize: '14px' },
        large: { fontSize: '18px' },
      },
    },
    staticCss: [{ size: ['*'] }],
  })
  ```

  would be the equivalent of defining it inside the main config:

  ```js
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    staticCss: {
      recipes: {
        card: {
          size: ['*'],
        },
      },
    },
  })
  ```

## 0.20.1

## 0.20.0

### Minor Changes

- 904aec7b: - Add support for `staticCss` in presets allowing you create sharable, pre-generated styles
  - Add support for extending `staticCss` defined in presets

  ```jsx
  const presetWithStaticCss = definePreset({
    staticCss: {
      recipes: {
        // generate all button styles and variants
        button: ['*'],
      },
    },
  })

  export default defineConfig({
    presets: [presetWithStaticCss],
    staticCss: {
      extend: {
        recipes: {
          // extend and pre-generate all sizes for card
          card: [{ size: ['small', 'medium', 'large'] }],
        },
      },
    },
  })
  ```

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.5

## 0.17.4

### Patch Changes

- fa77080a: Fix issue where types package was not built correctly.

## 0.17.3

### Patch Changes

- 529a262e: Fix regression in types due to incorrect `package.json` structure

## 0.17.2

## 0.17.1

## 0.17.0

### Patch Changes

- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

## 0.16.0

## 0.15.5

## 0.15.4

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

- 58743bc4: - Fix `ExtendableUtilityConfig` typings after a regression in 0.15.2 (due to
  https://github.com/gajus/bamboocss/pull/1410)
  - Fix `ExtendableTheme` (specifically make the `RecipeConfig` Partial inside the `theme: { extend: { ... } }` object),
    same for slotRecipes

## 0.15.2

### Patch Changes

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property

## 0.15.1

## 0.15.0

### Patch Changes

- 4bc515ea: Allow `string`s as `zIndex` and `opacity` tokens in order to support css custom properties
- 39298609: Make the types suggestion faster (updated `DeepPartial`)

## 0.14.0

### Minor Changes

- 8106b411: Add `generator:done` hook to perform actions when codegen artifacts are emitted.

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency

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

- 386e5098: Update `RecipeVariantProps` to support slot recipes

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

## 0.8.0

### Patch Changes

- be0ad578: Fix parser issue with TS path mappings

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types

## 0.6.0

## 0.5.1

### Patch Changes

- 8c670d60: Remove `breakpoints` from Tokens type
- 1ed239cd: Add feature where `config.staticCss.recipes` can now use [`*`] to generate all variants of a recipe.

  before:

  ```ts
  staticCss: {
    recipes: {
      button: [{ size: ['*'], shape: ['*'] }]
    }
  }
  ```

  now:

  ```ts
  staticCss: {
    recipes: {
      button: ['*']
    }
  }
  ```

- 78ed6ed4: Fix issue where using a nested outdir like `src/styled-system` with a baseUrl like `./src` would result on
  parser NOT matching imports like `import { container } from "styled-system/patterns";` cause it would expect the full
  path `src/styled-system`

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

## 0.4.0

### Minor Changes

- 5b344b9c: Add support for disabling shorthand props

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    shorthands: false,
  })
  ```

### Patch Changes

- c7b42325: Add types for supported at-rules (`@media`, `@layer`, `@container`, `@supports`, and `@page`)

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

## 0.0.2

### Patch Changes

- c308e8be: Allow asynchronous presets
- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [fb40fff2]
  - @bamboocss/extractor@0.0.2
