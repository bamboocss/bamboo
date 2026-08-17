# @bamboocss/generator

## 1.45.0

### Patch Changes

- @bamboocss/core@1.45.0
- @bamboocss/is-valid-prop@1.45.0
- @bamboocss/logger@1.45.0
- @bamboocss/shared@1.45.0
- @bamboocss/token-dictionary@1.45.0
- @bamboocss/types@1.45.0

## 1.44.1

### Patch Changes

- @bamboocss/types@1.44.1
- @bamboocss/core@1.44.1
- @bamboocss/is-valid-prop@1.44.1
- @bamboocss/logger@1.44.1
- @bamboocss/shared@1.44.1
- @bamboocss/token-dictionary@1.44.1

## 1.44.0

### Minor Changes

- 78b4de5: `prune.tokens` takes a boolean again, and token accounting is the default.

  It was `'off' | 'reachable' | 'accounted'`, which conflated two separate questions: how hard to try to bound the keep
  set, and what to say when that fails. `'reachable'` answered one cheap question — _does any javascript reach for a
  token_ — and threw away everything else it had read, so a single `token()` call anywhere kept all 468 declarations of
  the default preset. `'accounted'` did the work properly but was framed as an assertion, so it reported by default and
  had to be asked for. The combination nobody could ask for was the useful one: do the work, and stay quiet.
  - `prune.tokens: boolean`, default `true`. `false` is the old `'off'`; `true` accounts for each token path
    individually, which is what `'accounted'` did.
  - `prune.unresolvedPath` now defaults to `'off'` rather than `'warn'`. Pruning is an inference the build makes
    unasked, not a claim you told it to check, so it is silent unless you ask. `'warn'` names what is holding the keep
    set open; `'error'` still asserts the fallback never ships.
  - A config still passing a string fails with the edit to make. `'off'` is the dangerous direction — it asked for no
    pruning and would otherwise have silently got the opposite.

  Two things to check when upgrading:
  - **A token read from outside `include` is no longer covered by accident.** The old default kept every declaration the
    moment any javascript reached for a token, so a project with one `token()` call in it protected its scripts, configs
    and sibling workspace packages without meaning to — and a project with none did not. The accounting sees only what
    `include` covers, so name those categories with `prune: { keepTokens: ['colors.*'] }`. This is the trade the change
    makes deliberately: consistent pruning with a declared bound, rather than protection by coincidence.
  - **`prune: { unresolvedPath: 'error' }` written without `tokens` now fails builds it used to ignore.** It was inert
    unless you also asked for `'accounted'`; it is read directly now, which is what the setting always claimed to mean.

  A file that can neither name the artifact nor decline on its own is now skipped before the identifier walk, so the
  accounting costs nothing where there is nothing to account for. It has to be wider than the word `token`: a configured
  `importMap.tokens` need not contain it, an identifier may be written with unicode escapes, and `require()`/`import()`
  decline on a specifier the build cannot read whatever it names. `sandbox/vite-ts` has six files under `include` and
  not one of them mentions a token: `cssgen` there measures 22.0 ms under the old default, 31.5 ms under ungated
  accounting, and 22.9 ms now.

  Measured across the 16 sandboxes: 15 emit a byte-identical stylesheet, none keeps more than it did, and none reports
  anything. `preact-ts` goes from 448 token declarations to 37, and 20,627 B to 6,395 B. This repository's documentation
  site goes from 500 declarations to 146, 86,644 B to 73,773 B raw and 12,829 B to 10,903 B brotli, and its `cssgen`
  from 65.0 ms to 79.1 ms.

### Patch Changes

- Updated dependencies [78b4de5]
  - @bamboocss/types@1.44.0
  - @bamboocss/core@1.44.0
  - @bamboocss/logger@1.44.0
  - @bamboocss/token-dictionary@1.44.0
  - @bamboocss/is-valid-prop@1.44.0
  - @bamboocss/shared@1.44.0

## 1.43.1

### Patch Changes

- Updated dependencies [698bd49]
  - @bamboocss/core@1.43.1
  - @bamboocss/is-valid-prop@1.43.1
  - @bamboocss/logger@1.43.1
  - @bamboocss/shared@1.43.1
  - @bamboocss/token-dictionary@1.43.1
  - @bamboocss/types@1.43.1

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

### Patch Changes

- Updated dependencies [1cef86c]
  - @bamboocss/core@1.43.0
  - @bamboocss/types@1.43.0
  - @bamboocss/logger@1.43.0
  - @bamboocss/token-dictionary@1.43.0
  - @bamboocss/is-valid-prop@1.43.0
  - @bamboocss/shared@1.43.0

## 1.42.0

### Minor Changes

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

### Patch Changes

- b078253: Stop copying `is-valid-prop` into the generator's artifacts.

  `postbuild` wrote `dist/index.mjs` to `packages/generator/src/artifacts/generated/is-valid-prop.mjs.json` for the JSX
  factory to import at runtime. The factory is gone, nothing has read the artifact since, and it was still being rebuilt
  and committed on every release.

- 0ca4f32: The build now catches a misspelled token, and says where the name actually lives.

  `color: 'mutedd'` walked straight through the build. The check required a dot — it saw `color: 'blue.3000'` and
  nothing else — so the single typo the whole feature is sold on was invisible to it, and only the type layer caught it.
  That is why checking values has meant narrowing every generated prop type.

  The dot is gone. A bare identifier is a mistake when the property enumerates keywords, does not accept an identifier
  the author invents, and neither the tokens nor the keywords contain it:

  ```
  color: 'mutedd'                  reported
  display: 'flexx'                 reported
  zIndex: 'overlay'                reported   (no zIndex tokens declared)
  transform: 'auto'                reported   (bamboo has no such sugar; `transform: auto` is not css)

  display: 'flex'                  fine       (a keyword the property enumerates)
  color: 'rebeccapurple'           fine
  top: 'auto'                      fine       (a keyword on a property that also takes tokens)
  transitionProperty: 'color'      fine       (the grammar asks for a property name here)
  animationName: 'fadeIn'          fine
  gridArea: 'sidebar'              fine
  ```

  The last four are the ones a type union cannot get right, and the reason the question is put to the real grammar —
  `css-tree`'s `matchProperty` — rather than to csstype's unions:
  - csstype describes `top` and `animationName` identically, both ending in `(string & {})`, one because it takes
    lengths and the other because it takes a `<custom-ident>`. `strictTokens` needed a hand-written list of 29 property
    names to tell them apart, and still rejected `transitionProperty: 'color'` while suggesting `'colors'` — a utility
    value that emits seven declarations instead of one.
  - That trailing `(string & {})` is csstype declining to say the list is exhaustive, and it declines for **70%** of the
    properties it enumerates. Read as closed, those lists reject `width: 'stretch'` and
    `imageRendering: 'optimizeSpeed'` — ordinary css csstype has not caught up with.
  - Reaching `<custom-ident>` is not the same as admitting one: `gridTemplateColumns` reaches it through
    `'[' <custom-ident>* ']'`, where it is legal only inside literal brackets.

  Two known gaps, both in the safe direction for a setting that defaults to `warn`. `css-tree` follows the current spec,
  so a value a spec deleted but browsers still honour is reported — the 23 `DeprecatedSystemColor` names are allowed
  back explicitly, since that set is closed by history, but a value like `userSelect: 'contain'` its data has not
  reached yet is not. Write `[value]` for either.

  **The diagnostic is the point.** The resolver knows where a name lives; a type error can only say a string is not
  assignable to a union of two hundred members and guess a near-miss by spelling:

  ```
  `top: sm` — `sm` is declared under `radii`, `fontSizes` and 4 more, but `top` reads `spacing`.
  It is emitted as written, and the browser will drop it. Use a `spacing` token, or write `[sm]`
  to mean it literally.
  ```

  `warn` and `error` now build that sentence from one function, so the two modes cannot describe one mistake differently
  — which they have done before, over whether `!` was part of the value.

  Perf-neutral on `static-css-real-world`: every case within ±7% and both signs represented, which is noise at this
  repo's ~5% run-to-run agreement. The check opens with a character-code test, so a value starting with a digit, `#`,
  `-` or a quote — most CSS — is rejected before anything else runs, and the property lookups behind it are memoised.

- Updated dependencies [4fcae37]
- Updated dependencies [6fa8d1a]
- Updated dependencies [b078253]
- Updated dependencies [5c33622]
- Updated dependencies [0ca4f32]
  - @bamboocss/core@1.42.0
  - @bamboocss/types@1.42.0
  - @bamboocss/is-valid-prop@1.42.0
  - @bamboocss/shared@1.42.0
  - @bamboocss/logger@1.42.0
  - @bamboocss/token-dictionary@1.42.0

## 1.41.1

### Patch Changes

- 3b91dce: Let an important mark decorate a keyword, not only a token, under `strictTokens: 'unknown-tokens'`.

  ```ts
  css({ color: 'blue.300!' }) //  ✅
  css({ boxShadow: 'none!' }) //  ❌ was a type error
  css({ display: 'flex!' }) //    ❌ was a type error
  ```

  `WithEscapeHatch` is what carries `!` and `/`, and it wrapped the tokens alone — so whether a mark was allowed
  depended on whether the value happened to be a token, which is about the value and not about the mark. `none` is a
  csstype keyword and `blue.300` is a token; nothing an author can see distinguishes them at the point of writing `!`.
  The keywords are now held out of the plain union and wrapped alongside the tokens.

  It buys back no looseness. Only values that were already allowed can carry a mark, so `color: 'mutedd!'` is still an
  error exactly as `color: 'mutedd'` is — and the spaced form, `'none !important'`, which was the workaround, still
  works.

  It does cost. The keyword lists are the larger union — `color` alone enumerates every named colour — and
  `WithModifier` distributes over them. Measured with `tsc --extendedDiagnostics` over this repo's documentation site,
  which now runs this setting:

  |                | before  | after            |
  | -------------- | ------- | ---------------- |
  | Types          | 37,916  | 40,995 (+8.1%)   |
  | Instantiations | 150,252 | 181,030 (+20.5%) |

  Deterministic counts rather than wall clock, for the reason `escape-hatch-shape.test.ts` gives: a time is a property
  of the machine. That test still holds — one distributing form, and its brand intact — so this is a proportional
  increase rather than the 12.8x cliff losing either of those causes.

  An `authorIdentProperty` — `animationName`, `gridArea`, `fontFamily`, `content` — keeps its open `string` _outside_
  the wrapper, unchanged. Everything inside it is what a mark may decorate, so wrapping an open string would make a mark
  excuse anything.
  - @bamboocss/core@1.41.1
  - @bamboocss/is-valid-prop@1.41.1
  - @bamboocss/logger@1.41.1
  - @bamboocss/shared@1.41.1
  - @bamboocss/token-dictionary@1.41.1
  - @bamboocss/types@1.41.1

## 1.41.0

### Patch Changes

- 9b15513: `bamboo init` now writes `strictTokens: 'unknown-tokens'`, and a modifier no longer depends on how a utility
  is declared.

  The default is the setting a project keeps. Unchecked, `css({ color: 'mutedd' })` type-checks, builds, and ships
  `color: mutedd` — which parses, so nothing objects and the browser drops it at compute time; it surfaces as a colour
  that never applied, a long way from the typo. `true` catches it and rejects every raw CSS value with it, which is 468
  errors on one five-page app, so it is realistically a day-one decision and a project that did not make it then never
  will. `'unknown-tokens'` costs no migration — every literal value stays writable — and what it rejects is a bare
  identifier that names neither a token nor a keyword the property enumerates.

  Run across this repo's own documentation site it reported four, all real: `zIndex: 'overlay'` and two
  `zIndex: 'modal'` against a theme that declares no `zIndex` tokens, and a `transform: 'auto'` that is not CSS. All
  four emit a declaration the browser discards. A project created by `init` has nothing written yet, so it starts at
  zero either way — the default only decides whether the check is there when the first typo is.

  Declining still works and is not the same as saying nothing: `bamboo init --no-strict-tokens`, or "Not at all" in the
  prompt, leaves the key out. The config default is unchanged — an existing config that never mentions `strictTokens` is
  still unchecked.

  That run also turned up a false positive, which is fixed here rather than shipped as a default:

  ```ts
  css({ rounded: 'lg!' }) //        ✅
  css({ roundedBottom: 'lg!' }) //  ❌ was a type error
  ```

  Both emit `var(--radii-lg) !important`. `WithModifier` tested `[T] extends [string]` before distributing, and
  `KnownKeywords` keeps `Number` deliberately — a number cannot be a misspelled token path — so a utility declared as
  `Tokens["radii"] | KnownKeywords<…>` had one non-string member and lost every modifier form for the whole property,
  while its plain sibling kept them. It now filters with `Extract<T, string>`, which distributes over the same string
  members and yields `never` for the same empty case, so the union this expands into is the size it always was and the
  `& { __modifier?: true }` brand behind the 12.8x note is untouched.
  - @bamboocss/core@1.41.0
  - @bamboocss/is-valid-prop@1.41.0
  - @bamboocss/logger@1.41.0
  - @bamboocss/shared@1.41.0
  - @bamboocss/token-dictionary@1.41.0
  - @bamboocss/types@1.41.0

## 1.40.1

### Patch Changes

- @bamboocss/core@1.40.1
- @bamboocss/is-valid-prop@1.40.1
- @bamboocss/logger@1.40.1
- @bamboocss/shared@1.40.1
- @bamboocss/token-dictionary@1.40.1
- @bamboocss/types@1.40.1

## 1.40.0

### Minor Changes

- 21fdf4c: Say which elements `preflight.prune` removed the reset for.

  The pass drops reset rules for elements your source never renders, and its one real objection is that being wrong is
  silent: an element rendered by a dependency's component, by markdown, or through `dangerouslySetInnerHTML` is
  invisible to the scan, loses its reset, and reports nothing — the page just looks slightly off, usually on one route,
  usually later. The docs' answer was "check the result", with nothing to check it against: the pass logged counts, at
  debug level, which no one has on.

  It now names them, at info level, which only a project that opted in ever sees:

  ```
  🎋 info [prune:preflight] Reset rules removed for 20 element(s) your source never renders: abbr, audio, b, canvas,
  dialog, embed, h5, h6, iframe, input, menu, object, optgroup, progress, samp, select, small, sub, sup, textarea.
  ```

  That is a list a reader can check against what they know their own app renders, which a count is not — so it is not
  truncated, and it is printed once per project rather than once per watch rebuild and once per environment of a build.
  The sample above is this repo's own documentation site, where `h5` is on the list and the docs render one.

  The list says a rule for that element went, not that nothing styles it any more: a reset naming `table` both alone and
  as `.prose table` loses only the first and still reports it. The cost is one `Set.add` per removed selector part — at
  most 41, once per build.

### Patch Changes

- Updated dependencies [21fdf4c]
  - @bamboocss/core@1.40.0
  - @bamboocss/is-valid-prop@1.40.0
  - @bamboocss/logger@1.40.0
  - @bamboocss/shared@1.40.0
  - @bamboocss/token-dictionary@1.40.0
  - @bamboocss/types@1.40.0

## 1.39.1

### Patch Changes

- Updated dependencies [4734709]
  - @bamboocss/shared@1.39.1
  - @bamboocss/core@1.39.1
  - @bamboocss/token-dictionary@1.39.1
  - @bamboocss/types@1.39.1
  - @bamboocss/is-valid-prop@1.39.1
  - @bamboocss/logger@1.39.1

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

### Patch Changes

- Updated dependencies [4d27ba4]
  - @bamboocss/types@1.39.0
  - @bamboocss/core@1.39.0
  - @bamboocss/logger@1.39.0
  - @bamboocss/token-dictionary@1.39.0
  - @bamboocss/is-valid-prop@1.39.0
  - @bamboocss/shared@1.39.0

## 1.38.0

### Patch Changes

- @bamboocss/core@1.38.0
- @bamboocss/is-valid-prop@1.38.0
- @bamboocss/logger@1.38.0
- @bamboocss/shared@1.38.0
- @bamboocss/token-dictionary@1.38.0
- @bamboocss/types@1.38.0

## 1.37.13

### Patch Changes

- @bamboocss/core@1.37.13
- @bamboocss/is-valid-prop@1.37.13
- @bamboocss/logger@1.37.13
- @bamboocss/shared@1.37.13
- @bamboocss/token-dictionary@1.37.13
- @bamboocss/types@1.37.13

## 1.37.12

### Patch Changes

- @bamboocss/core@1.37.12
- @bamboocss/is-valid-prop@1.37.12
- @bamboocss/logger@1.37.12
- @bamboocss/shared@1.37.12
- @bamboocss/token-dictionary@1.37.12
- @bamboocss/types@1.37.12

## 1.37.11

### Patch Changes

- @bamboocss/core@1.37.11
- @bamboocss/is-valid-prop@1.37.11
- @bamboocss/logger@1.37.11
- @bamboocss/shared@1.37.11
- @bamboocss/token-dictionary@1.37.11
- @bamboocss/types@1.37.11

## 1.37.10

### Patch Changes

- @bamboocss/core@1.37.10
- @bamboocss/is-valid-prop@1.37.10
- @bamboocss/logger@1.37.10
- @bamboocss/shared@1.37.10
- @bamboocss/token-dictionary@1.37.10
- @bamboocss/types@1.37.10

## 1.37.9

### Patch Changes

- @bamboocss/core@1.37.9
- @bamboocss/is-valid-prop@1.37.9
- @bamboocss/logger@1.37.9
- @bamboocss/shared@1.37.9
- @bamboocss/token-dictionary@1.37.9
- @bamboocss/types@1.37.9

## 1.37.8

### Patch Changes

- @bamboocss/core@1.37.8
- @bamboocss/is-valid-prop@1.37.8
- @bamboocss/logger@1.37.8
- @bamboocss/shared@1.37.8
- @bamboocss/token-dictionary@1.37.8
- @bamboocss/types@1.37.8

## 1.37.7

### Patch Changes

- @bamboocss/core@1.37.7
- @bamboocss/is-valid-prop@1.37.7
- @bamboocss/logger@1.37.7
- @bamboocss/shared@1.37.7
- @bamboocss/token-dictionary@1.37.7
- @bamboocss/types@1.37.7

## 1.37.6

### Patch Changes

- @bamboocss/core@1.37.6
- @bamboocss/is-valid-prop@1.37.6
- @bamboocss/logger@1.37.6
- @bamboocss/shared@1.37.6
- @bamboocss/token-dictionary@1.37.6
- @bamboocss/types@1.37.6

## 1.37.5

### Patch Changes

- @bamboocss/core@1.37.5
- @bamboocss/is-valid-prop@1.37.5
- @bamboocss/logger@1.37.5
- @bamboocss/shared@1.37.5
- @bamboocss/token-dictionary@1.37.5
- @bamboocss/types@1.37.5

## 1.37.4

### Patch Changes

- @bamboocss/core@1.37.4
- @bamboocss/is-valid-prop@1.37.4
- @bamboocss/logger@1.37.4
- @bamboocss/shared@1.37.4
- @bamboocss/token-dictionary@1.37.4
- @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/core@1.37.3
- @bamboocss/is-valid-prop@1.37.3
- @bamboocss/logger@1.37.3
- @bamboocss/shared@1.37.3
- @bamboocss/token-dictionary@1.37.3
- @bamboocss/types@1.37.3

## 1.37.2

### Patch Changes

- @bamboocss/core@1.37.2
- @bamboocss/is-valid-prop@1.37.2
- @bamboocss/logger@1.37.2
- @bamboocss/shared@1.37.2
- @bamboocss/token-dictionary@1.37.2
- @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/core@1.37.1
- @bamboocss/is-valid-prop@1.37.1
- @bamboocss/logger@1.37.1
- @bamboocss/shared@1.37.1
- @bamboocss/token-dictionary@1.37.1
- @bamboocss/types@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/core@1.37.0
- @bamboocss/is-valid-prop@1.37.0
- @bamboocss/logger@1.37.0
- @bamboocss/shared@1.37.0
- @bamboocss/token-dictionary@1.37.0
- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/core@1.36.5
- @bamboocss/is-valid-prop@1.36.5
- @bamboocss/logger@1.36.5
- @bamboocss/shared@1.36.5
- @bamboocss/token-dictionary@1.36.5
- @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/core@1.36.4
- @bamboocss/is-valid-prop@1.36.4
- @bamboocss/logger@1.36.4
- @bamboocss/shared@1.36.4
- @bamboocss/token-dictionary@1.36.4
- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/core@1.36.3
- @bamboocss/is-valid-prop@1.36.3
- @bamboocss/logger@1.36.3
- @bamboocss/shared@1.36.3
- @bamboocss/token-dictionary@1.36.3
- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/core@1.36.2
- @bamboocss/is-valid-prop@1.36.2
- @bamboocss/logger@1.36.2
- @bamboocss/shared@1.36.2
- @bamboocss/token-dictionary@1.36.2
- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/core@1.36.1
- @bamboocss/is-valid-prop@1.36.1
- @bamboocss/logger@1.36.1
- @bamboocss/shared@1.36.1
- @bamboocss/token-dictionary@1.36.1
- @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/core@1.36.0
- @bamboocss/is-valid-prop@1.36.0
- @bamboocss/logger@1.36.0
- @bamboocss/shared@1.36.0
- @bamboocss/token-dictionary@1.36.0
- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/core@1.35.5
- @bamboocss/is-valid-prop@1.35.5
- @bamboocss/logger@1.35.5
- @bamboocss/shared@1.35.5
- @bamboocss/token-dictionary@1.35.5
- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/core@1.35.4
- @bamboocss/is-valid-prop@1.35.4
- @bamboocss/logger@1.35.4
- @bamboocss/shared@1.35.4
- @bamboocss/token-dictionary@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/core@1.35.3
- @bamboocss/is-valid-prop@1.35.3
- @bamboocss/logger@1.35.3
- @bamboocss/shared@1.35.3
- @bamboocss/token-dictionary@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/core@1.35.2
  - @bamboocss/token-dictionary@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/is-valid-prop@1.35.2
  - @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/core@1.35.1
- @bamboocss/is-valid-prop@1.35.1
- @bamboocss/logger@1.35.1
- @bamboocss/shared@1.35.1
- @bamboocss/token-dictionary@1.35.1
- @bamboocss/types@1.35.1

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

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/core@1.35.0
  - @bamboocss/types@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/token-dictionary@1.35.0
  - @bamboocss/is-valid-prop@1.35.0
  - @bamboocss/shared@1.35.0

## 1.34.1

### Patch Changes

- e2ec2ae: Grade the styles a config supplies under `unresolvedToken`, instead of going silent on them under `error`.

  `globalCss`, the preflight scope, config recipes and mixins reach the sheet through `transformStyles`, which decodes
  into a _clone_ of the decoder — so their atoms never enter `decoder.atomic`, which is the set `error` reads. Because
  `error` also suppresses the warning in favour of that read, setting the option to the value that exists to escalate an
  unresolved token made those styles **quieter than leaving it unset**:

  ```ts
  export default defineConfig({
    globalCss: { body: { background: 'accent.default' } }, // no such token
  })
  ```

  Unset, that warned. With `unresolvedToken: 'error'`, no warning, exit 0, and the dead declaration still in
  `styles.css` — the one setting that promised to fail on it was the one setting that could not see it. A typo in a
  config recipe's base or variant behaved the same way. Only `css()` call sites and `staticCss` were ever graded,
  because only those go through the real decoder.

  The finding is now recorded where it is first visible, as the value is transformed, and `error` fails on that set
  together with the sheet it already read. Both halves key on the resolved property and the bare token path, so an
  atomic style — which passes through both, being transformed once before the decoder memoizes it — is one finding
  rather than two.

  Accumulating is what the earlier design deliberately avoided, and it stays avoided for the half that needed it. Atomic
  styles are still read off the finished sheet: the decoder memoizes each atom by hash, so a rebuild never re-enters
  `transform`, and a record of what transforms saw would either outlive the edit that fixed it or be cleared and never
  refilled. The config half has neither problem, because a config is fixed for a context's lifetime — it is transformed
  once when the context is built, and editing it constructs a new context. A record cleared per build would have
  reported these on the first build and passed every build after it.

  `warn` and `off` are unchanged, in output and in cost. Under `error` the shape test now runs per transformed value
  rather than not at all, which is the cost `warn` already paid.

- Updated dependencies [e2ec2ae]
  - @bamboocss/core@1.34.1
  - @bamboocss/is-valid-prop@1.34.1
  - @bamboocss/logger@1.34.1
  - @bamboocss/shared@1.34.1
  - @bamboocss/token-dictionary@1.34.1
  - @bamboocss/types@1.34.1

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

- c49ab36: Resolve the path under a token modifier, and stop paying five templates per token to describe one.

  `unresolvedToken` tested the value as written, so a path wearing `!important` or a `/opacity` modifier failed the
  shape test on the modifier's own punctuation and was reported as fine. `color: red.3000!` shipped a declaration the
  browser drops with nothing said about it. The normalization existed, but it lived in `assertNoUnresolvedTokens` rather
  than in the shared predicate — so `unresolvedToken: 'error'` could see through `!` while `'warn'` could not, and
  neither could see through `/`. It moves into `isUnresolvedTokenValue`, where both modes read it:
  - `accent.default!`, `accent.default !important` and `accent.default/50` all resolve as `accent.default`, and report
    once between them rather than not at all.
  - The opacity modifier is stripped only for a property drawing on `colors`, so a slash stays part of the value in
    `font: 12px/1.5 serif` or `gridArea: 1 / 2 / 3 / 4`.
  - A resolvable path wearing a modifier is still fine, which is the half that would break first.

  With the build seeing those forms, the generated types no longer have to spell each one out.
  `WithColorOpacityModifier` and the per-token `WithImportant` are replaced by a single `WithModifier<T>` covering `/`,
  `!` and ` !` as one open-ended tail.

  A template literal distributes over a union in every placeholder, so `` `${T}` `` against a 258-token colour palette
  is 258 members and `` `${T}${Important}` `` was four times that. Between them the two modifier forms were 5N of a
  ~1,560-member union for `color` alone. Folding them to 3N is **14.5% off `tsc`** — 7.09s against 8.29s over 4,000 call
  sites, with a control repeat agreeing to 3.5%.

  What that gives up is the tail: `red.300!nonsense` typechecks now, where five exact templates rejected it. The build
  still reports it, so the diagnostic moves rather than disappears, and only for a value nobody writes on purpose.

  CSS output is unchanged — this grades reports and types, not what is emitted.

  One thing worth knowing before tidying the generated types: the `& { __modifier?: true }` and
  `& { __important?: true }` brands look like dead weight and nothing reads them, but they are what stops TypeScript
  attempting subtype reduction across the union these expand into. Removing them costs **12.8x** on `tsc` — 87.2s
  against 6.8s on the same fixture. There is now a comment saying so at the definition.

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

- c49ab36: Cap the diagnostic lists, and group a dead call by the binding rather than by the file.

  A build error's job is to name the mistake, and every list in one was joined whole. A pattern dropped from a preset
  and called across an app produced **400 identical blocks and 1,221 lines of stderr** carrying one line of information,
  with the paragraph explaining the failure scrolled off the top. The same error is now six lines:

  ```txt
  ERR_BAMBOO_DEAD_IMPORT: 400 call(s) name a binding that does not exist:

  `stack` is not a pattern — `../styled-system/patterns` does not export it.
    400 file(s): src/comp-0.tsx, src/comp-1.tsx, src/comp-10.tsx, src/comp-100.tsx, src/comp-101.tsx, … and 395 more

  Both entrypoints are generated from your config, so what they export moves when it does — …
  ```

  Grouping is by the binding because that is the unit of the mistake; two distinct dead bindings stay two findings.
  Files within a group are deduplicated, since one module can call the same one twice.

  The other three unbounded lists are capped rather than grouped, each carrying a distinct message with nothing to
  collapse: files that could not be extracted, unresolved token values (25, being one line each), and the
  `failOnUnfolded` survivor list. In every case the count is of what was withheld, and a list that fits is joined
  exactly as before.

  `truncateList` and `groupBy` are exported from `@bamboocss/shared`.

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

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/shared@1.34.0
  - @bamboocss/types@1.34.0
  - @bamboocss/core@1.34.0
  - @bamboocss/token-dictionary@1.34.0
  - @bamboocss/logger@1.34.0
  - @bamboocss/is-valid-prop@1.34.0

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

### Patch Changes

- Updated dependencies [f7bbc14]
- Updated dependencies [61561a0]
- Updated dependencies [ac54258]
- Updated dependencies [f640a68]
  - @bamboocss/types@1.33.0
  - @bamboocss/core@1.33.0
  - @bamboocss/logger@1.33.0
  - @bamboocss/token-dictionary@1.33.0
  - @bamboocss/is-valid-prop@1.33.0
  - @bamboocss/shared@1.33.0

## 1.32.0

### Minor Changes

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

- 2b84dfa: Remove the array argument from `css()` and `css.raw()`, leaving one way to pass a list of styles.

  `css([a, b])` meant `css(a, b)` — the runtime flattened one level before merging. Spread instead, which is what you
  already write when the operands are named:

  ```ts
  css(...styles) // was css(styles)
  css(a, b) //      was css([a, b])
  ```

  The declared type also carried the single-object overload twice, verbatim, so the emitted `styled-system/css/css.d.ts`
  advertised four signatures where the variadic one covers every call. It is now one:

  ```ts
  (...styles: Styles[]): string
  ```

  An array argument throws rather than being ignored, at build time where the file is known and at runtime otherwise.
  That matters more than it sounds: an array and a style object disagree about what indices mean. The parser flattened
  one before encoding precisely because hashing it instead read `[{ color }, { padding }]` as a responsive array and
  emitted the padding at the `sm` breakpoint — and merely dropping the flatten would have returned no class at all,
  silently.

  Removing it also takes the `flat()` out of every merge and the `some(Array.isArray)` scan out of every extracted
  `css()` call, both of which every call paid to serve a shape that was never documented.

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

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/shared@1.32.0
  - @bamboocss/types@1.32.0
  - @bamboocss/core@1.32.0
  - @bamboocss/token-dictionary@1.32.0
  - @bamboocss/logger@1.32.0
  - @bamboocss/is-valid-prop@1.32.0

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

- 8fb87ac: Declare the generated output's entry points in its `package.json`, so `node16`/`nodenext` resolve them and
  the modules behind them stop being importable.

  `styled-system/tokens` did not resolve under those modes at all. They do no directory-index lookup and the file
  declared no `exports`, so the artifact had to be spelled `styled-system/tokens/index.mjs` — a workaround the token
  scanner still has to recognise because projects have it written down. Both spellings resolve now.

  The map also states the boundary: `./css`, `./tokens`, `./types`, `./patterns`, `./recipes`, `./themes`,
  `./styles.css`, `./styles/*` and `./specs/*` are the output. `css/merge-css`, `css/utilities`, `tokens/tokens` and
  `helpers` exist for the modules beside them and are no longer reachable from outside. A relative import within the
  generated directory is unaffected.

  This enforces where the output is resolved as a package — the component-library layout `emit-pkg` produces. It cannot
  enforce against a `paths` alias like `"styled-system/*": ["./styled-system/*"]`, which resolves straight to the
  filesystem without consulting `exports`; there the map documents intent rather than imposing it.

  `emit-pkg` now derives its map from the same builder instead of restating it. That copy had drifted: it advertised a
  `require` condition pointing at `.mjs`, for output that is ESM under every setting, and listed `./types` as a runtime
  entry for a directory holding only declarations.

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

- 9c32b00: Narrow `styled-system/css` to the authoring API.

  The barrel was four `export *` lines, so every binding its modules happened to export became part of the public API.
  Seven were plumbing:

  ```text
  what `import { … } from 'styled-system/css'` offered before:

    css, css.raw, cx, cva, sva, fallback, viewTransition, auditSlotScopes
    cssLeaf, cvaPick, splitProps           <- written by the source transform, never by hand
    mergeCss, assignCss, mergeCssUncached  <- internal merge plumbing
  ```

  The barrel is now a deliberate list. `cssLeaf`, `cvaPick` and `splitProps` are still exported at runtime — the fold
  adds them to whatever `styled-system/css` import a file already has, so that is the specifier its emitted calls
  resolve against — but the declaration file omits them. Folded code is rewritten in memory during the bundler's
  transform and never typechecked, so a declaration bought nothing beyond an autocomplete entry advertising them as API.
  Each stays typed in the module that defines it.

  **`mergeCss` and `mergeCssUncached` leave the barrel.** They remain at `styled-system/css/merge-css`, which is where
  `cva` imports them from. `css.raw(...)` is the authoring API for merging style objects and always was the documented
  one: it is `mergeCss` plus the clone that makes a shared, memoized result safe to hand back, so the uncloned function
  beside it was a footgun under a second name.

  **`assignCss` is removed.** It had no callers — not in the runtime, the artifacts, the sandboxes or the docs — and no
  documented purpose.

  The runtime/declaration split was already there and pointing the other way: `css.mjs` re-exported the merge trio while
  `css.d.ts` never declared it, so `mergeCss` was importable but untyped through the barrel. That is now consistent.

  A test pins the half that nothing else could catch. The barrel is a hand-written list, the emitted calls are never
  typechecked, and a bundler only _warns_ about an import naming a missing export — so dropping `cvaPick` from the list
  would leave the fold emitting calls that silently receive `undefined`. The test asserts every name the fold can inject
  is exported by the barrel's runtime, and that none of them is declared in its types.

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

- 725223e: Name a config recipe's classes by lookup when its variants are scalars.

  Every config recipe call rebuilt its class string through `createCss` — merge defaults, filter against the variant
  map, walk conditions, prefix, hash — to arrive at the recipe's own class plus one per selected variant. That is what
  `getRecipeClassNames` already returns for an inline `cva`, so a scalar selection now takes the same route.

  Measured on a three-variant recipe, in one run so the two share a machine:

  | path                        | before     | after                    |
  | --------------------------- | ---------- | ------------------------ |
  | scalar variants, unmemoized | 720,958 hz | 2,278,994 hz (**3.16x**) |
  | conditional variant         | 569,009 hz | unchanged                |
  | memoized re-call            | 11.5M hz   | unchanged                |

  The gain lands on a `memo` miss — the first call for each variant combination — since a hit never reaches the body at
  all. So it is cold render and variant-heavy trees that get it, not steady-state re-renders. `packages/generator`'s
  `recipe.bench.ts` is new: nothing covered the config recipe path, and `cva.bench.ts` covers only the inline one.

  Responsive and conditional variants are untouched: `button({ visual: { base: 'solid', _hover: 'outline' } })` still
  resolves through `createCss`, because its classes carry condition prefixes a lookup cannot build. The gate is "no
  object-typed value", which also routes `null` — kept by `compact` — down the same path it took before.

  A side effect worth having: the build's fold and the browser now derive a config recipe's class names from one
  function rather than two. That duplication is what `naming-agreement.ts` exists to police, and there is one less of
  it.

  Emitted css is unchanged, and so are the class names — verified against the generated artifacts and byte-identical
  cssgen on an example app.

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [232a83a]
- Updated dependencies [cd5954c]
- Updated dependencies [9c32b00]
- Updated dependencies [9fdce28]
- Updated dependencies [dd9d6dc]
- Updated dependencies [678bdee]
- Updated dependencies [a72eb09]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/core@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0
  - @bamboocss/token-dictionary@1.31.0
  - @bamboocss/is-valid-prop@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/core@1.30.1
- @bamboocss/is-valid-prop@1.30.1
- @bamboocss/logger@1.30.1
- @bamboocss/shared@1.30.1
- @bamboocss/token-dictionary@1.30.1
- @bamboocss/types@1.30.1

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

- Type `token.value()` to the tokens that actually have a literal.

  Not every token has one. A virtual or conditional token resolves to its `var()` because there is no single value to
  hand back, and a negative token to `calc(var(--spacing-4) * -1)` because it has no declaration of its own.
  `token.value()` returned those references — truthful, and useless to the caller who reached for it precisely because a
  css variable will not resolve where they are: a canvas fill, a charting library, arithmetic on the number.

  The parameter is now a generated `LiteralToken` union, so asking for a literal that cannot exist is a type error
  rather than a reference handed to a canvas. On the default preset that is 432 of 480 tokens.

  The rule is read off the emitted value rather than re-derived, so the type cannot drift from what the runtime returns:
  anything the browser still has to compute — `var()`, `env()`, `attr()` — is not a literal.

  The generated token spec no longer offers a `token.value()` example for a token the type rejects.

### Patch Changes

- Updated dependencies
- Updated dependencies [242b24c]
  - @bamboocss/core@1.30.0
  - @bamboocss/types@1.30.0
  - @bamboocss/shared@1.30.0
  - @bamboocss/logger@1.30.0
  - @bamboocss/token-dictionary@1.30.0
  - @bamboocss/is-valid-prop@1.30.0

## 1.29.0

### Minor Changes

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

- f2c61d7: Resolve token paths inside style objects that are not spelled out at the call.

  `css({ color: token(BRAND) })` emitted nothing for that property, while `const c = token(BRAND)` outside a style
  object resolved fine — the fold follows a constant or a template literal into a token path, and the in-style-object
  resolution required a string literal. Nothing errored; the declaration simply never existed. Same for a namespaced
  call, `css({ color: ds.token('colors.red.300') })`, which asked whether the _namespace_ was a token function.

  Both now resolve, through the same machinery every other extracted value already uses. A path that genuinely only
  exists at runtime is still left alone.

  Also `??` rather than `||` in the generated `token()` and `token.value()`. The fallback is for a path that names no
  token, and `||` also swallowed a token whose value is legitimately falsy — `zIndex: { base: { value: 0 } }` returned
  the fallback instead of `0`. No token in the default preset has a falsy value, so this only ever bit a custom theme.

  Verified byte-identical CSS output on the example apps, which spell their token paths at the call.

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

- Updated dependencies [0dbe9c4]
- Updated dependencies [f2c61d7]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0
  - @bamboocss/core@1.29.0
  - @bamboocss/token-dictionary@1.29.0
  - @bamboocss/logger@1.29.0
  - @bamboocss/is-valid-prop@1.29.0
  - @bamboocss/shared@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1
  - @bamboocss/core@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/token-dictionary@1.28.1
  - @bamboocss/is-valid-prop@1.28.1
  - @bamboocss/shared@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/core@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/token-dictionary@1.28.0
  - @bamboocss/is-valid-prop@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- b975ba7: A config recipe no longer names a class for a variant its config does not declare.

  `createRecipe`'s transform was `${name}--${prop}_${value}` with no check that the variant exists, so any prop handed
  to a recipe became a class:

  ```ts
  button({ nope: 'x' }) // → "button button--nope_x"   ← no rule was ever emitted for it
  button({ visual: 'bogus' }) // → "button button--visual_bogus"
  ```

  The build emits rules only for values the config declares, so those classes styled nothing. `cva` already skipped them
  — `getRecipeClassNames` checks the declared values — which left the two recipe kinds returning different class strings
  for the same call.

  Both now agree, and **the stylesheet is unchanged**: nothing backed those classes, so removing them removes only dead
  markup.

  Scalars only. A conditional or responsive value is an object of leaves and the leaves are what name classes, so those
  pass through as before — including the case where a conditional variant on a recipe with compound variants throws,
  which still throws where the author put it.

  **This is what unblocks folding config recipes generally.** A lowering derived from the config can reproduce a class
  for a declared variant, never for a key it cannot enumerate — so while the two runtimes disagreed, the fold had to
  restrict itself to selections that provably held no undeclared key, meaning the output of `splitVariantProps`. With
  them in agreement that restriction is gone, and a config recipe call lowers on the same terms as an inline one:

  ```tsx
  const [variantProps, rest] = button.splitVariantProps(props)
  cx(button(variantProps), className) // ✅ lowered
  cx(button({ size })) // ✅ lowered — was declined before
  ```

  The build-side resolver the transform uses for static recipe calls applies the identical filter, so folded output and
  the browser continue to agree; a parity suite compares the two across defaults, multi-axis selections, compound
  variants and conditional values.
  - @bamboocss/core@1.27.0
  - @bamboocss/is-valid-prop@1.27.0
  - @bamboocss/logger@1.27.0
  - @bamboocss/shared@1.27.0
  - @bamboocss/token-dictionary@1.27.0
  - @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/core@1.26.0
- @bamboocss/is-valid-prop@1.26.0
- @bamboocss/logger@1.26.0
- @bamboocss/shared@1.26.0
- @bamboocss/token-dictionary@1.26.0
- @bamboocss/types@1.26.0

## 1.25.0

### Minor Changes

- 94991ea: Fold recipe calls in wrapper components, and fix recipe calls written with no arguments.

  **Wrapper components.** A component that forwards its own props to a recipe is the shape that kept the recipe alive:

  ```tsx
  export const Input = ({ className, ...props }: InputProps) => {
    const [variantProps, rest] = input.splitVariantProps(props)
    return <ark.input className={cx(input(variantProps), className)} {...rest} />
  }
  ```

  The build cannot see inside `variantProps` — the variants are the component's public API, so they can never be
  literals. It does not need to. A recipe emits one class per **declared** variant, so the call is one term per variant
  reading that binding:

  ```tsx
  className={cx(
    'cva_x' + cvaPick(variantProps.size, { sm: ' cva_x--size_sm', md: ' cva_x--size_md' }, ' cva_x--size_md'),
    className,
  )}
  ```

  `splitVariantProps` is lowered alongside it, to the `splitProps` it already called — the keys it splits on are
  `Object.keys(variants)`, known at build time. That matters because it is the last thing reading the binding; without
  it the recipe object stays referenced and its config cannot leave the bundle. `splitProps` is now re-exported from the
  generated `cx` module, so both lowerings reach for one place.

  **`Input` keeps taking variants at runtime.** Measured on a bundle of exactly this shape: **10,459 B → 3,558 B**,
  4,073 → **1,598 B gzipped**, with both the recipe config and the style engine dropping out.

  **Calls written with no arguments.** `buttonStyle()` declined while `buttonStyle({})` folded — the parser stores a
  fallback box for a call with no argument, and the fold required a static one. Nothing to account for is not the same
  as something unaccounted for. This affected config recipes, inline recipes and patterns alike:

  ```ts
  buttonStyle() // → "buttonStyle buttonStyle--size_md buttonStyle--variant_solid"
  stack() // → "d_flex flex-d_column gap_8px"
  ```

  Class names are still derived through `getRecipeIdentity` and `getRecipeClassNames` — the same functions the browser
  runs — and a parity suite compares the lowered expression against the real generated `cva` across every shape of
  props, including `{}`, `undefined`, `null`, an undeclared value, and keys the recipe does not declare.

### Patch Changes

- @bamboocss/core@1.25.0
- @bamboocss/is-valid-prop@1.25.0
- @bamboocss/logger@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/token-dictionary@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/core@1.24.0
- @bamboocss/is-valid-prop@1.24.0
- @bamboocss/logger@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/token-dictionary@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Minor Changes

- 087b884: Lower inline recipe calls the build cannot resolve, so the recipe config leaves the bundle.

  `badge({ tone })` where `tone` is a prop or state used to keep the whole recipe. Every class it can produce is
  knowable — only _which one_ applies is not — so what ships is the choice:

  ```ts
  // you write
  const badge = cva({ base: { rounded: 'full' }, variants: { tone: { info: {…}, warn: {…} } } })
  const cls = badge({ tone })

  // the bundle gets
  const cls = 'cva_1a2b3c' + cvaPick(tone, { info: ' cva_1a2b3c--tone_info', warn: ' cva_1a2b3c--tone_warn' })
  ```

  `cvaPick` is a new export of the generated `cx` module — chosen because it pulls no engine — and is about 45 bytes. A
  recipe's classes are **additive**, one per variant, so N runtime axes lower to N terms rather than to every
  combination of their values.

  **Measured end to end**, bundling a module with one dynamic recipe call:

  |        | minified  | gzipped   |
  | ------ | --------- | --------- |
  | before | 10,347 B  | 4,034 B   |
  | after  | **139 B** | **150 B** |

  **The saving is the config, and it needs `/*#__PURE__*/` to happen at all.** `cva({ base, variants })` ships the whole
  style object so the runtime can hash it into a name — but those styles are already in the stylesheet. Once every call
  of a binding lowers, nothing reads it; a bundler still will not drop `cva(…)`, because it cannot prove the call is
  side-effect free, so the build now annotates it. Without that annotation folding made modules **larger**: 10,347 →
  10,447 B, classes added and nothing removed. The annotation is only emitted when every call of that binding lowered —
  while one survives, the binding is still read.

  Across an application with 1,271 inline recipe bindings, **1,024 lower completely**, freeing 62 kB gzipped of config
  against 17 kB of added call sites.

  **What still declines,** reported as `recipe-call`: a spread or computed key, whose selection cannot be enumerated; a
  selection that could _run_ something, since folding deletes the argument; a config the build could not read; and slot
  recipes, which resolve to one class per slot rather than a string.

  **Classes are emitted in the config's variant order**, which is the order the runtime appends them — so a folded
  module and a dev build produce the same `class` attribute rather than the same set in a different order.

  `getRecipeClassNames` now looks variant values up as own keys. A value of `'toString'` or `'constructor'` previously
  found `Object.prototype`'s member, passed the null check and named a class no rule backs; both sides now agree it
  selects nothing.

- 3d141e5: Give `mergeCss` a shorthand-only table, so `cva` stops carrying the class-name map it never reads.

  A bundle using only recipes is **33.9% smaller**: 6,769 → **4,477 B gzipped** on `sandbox/vite-ts`, measured as a
  tree-shaken production build of an entry that calls `cva` and `cx`.

  **Why it was there.** `cva` reaches `mergeCss` through `raw()` and `merge()` — properties on the object `cva()`
  returns, so neither can be shaken away — and while class names and shorthands shared one table, that pulled the
  _naming_ half into every bundle using recipes. It measured 2,786 B gzipped of a 6,769 B `cva`-only bundle: 41% of it,
  for a map the recipe path never touches. `cvaFn` names classes through `getRecipeClassNames`, semantically, from the
  config.

  **What it costs.** The two halves share every property name, so each now spells the property list. A bundle that still
  calls `css()` at runtime grows by **93 B gzipped** — 8,453 → 8,546 B. That is the trade, and it points the right way:
  a surviving `css()` call already costs 1,684 B for the engine behind it, and
  [`strict`](https://bamboocss.com/docs/guides/source-transformation) exists to drive that count to zero.

  No API change. `css.mjs` re-exports the merge, and `resolveShorthand` moves with it.

### Patch Changes

- Updated dependencies [f4a2824]
- Updated dependencies [b041398]
- Updated dependencies [087b884]
  - @bamboocss/core@1.23.0
  - @bamboocss/types@1.23.0
  - @bamboocss/shared@1.23.0
  - @bamboocss/logger@1.23.0
  - @bamboocss/token-dictionary@1.23.0
  - @bamboocss/is-valid-prop@1.23.0

## 1.22.0

### Minor Changes

- 39c699f: Split `mergeCss` and the utility table out of `styled-system/css`, so `cva` no longer imports the `css()`
  engine.

  `cva` needs exactly one thing from `css.mjs`: `mergeCss`, to resolve shorthands while merging a base with its active
  variants. Importing it pulled in `createCss`, `cssLeaf`, `viewTransition` and the property→className table alongside —
  which meant `css.mjs` could never be tree-shaken out of a bundle using recipes, however completely
  [`@bamboocss/vite`](https://bamboocss.com/docs/guides/source-transformation) folded that bundle's `css()` calls away.

  Three modules now, where there was one:

  | module              | holds                                                    |
  | ------------------- | -------------------------------------------------------- |
  | `css/utilities.mjs` | the utility table, `classNameByProp`, `resolveShorthand` |
  | `css/merge-css.mjs` | `mergeCss`, `assignCss`, `mergeCssUncached`              |
  | `css/css.mjs`       | `css()`, `cva`-independent, re-exports the merge         |

  **No API change.** `css.mjs` re-exports `mergeCss`/`assignCss`/`mergeCssUncached`, so every import that worked before
  works now.

  **No cost today, and a measurable one avoided.** The obvious version of this — giving `mergeCss` its own
  shorthand-only table — measured **+402 B gzipped**, because the naming half and the shorthand half share every
  property name and splitting spells the list twice. Sharing one table between the two readers instead, the `vite-ts`
  example app went from 221.24 kB / 70.83 kB gzipped to **220.79 kB / 70.62 kB**, with byte-identical CSS.

  **What it enables.** Once every `css()` call in a bundle folds, `css.mjs` — 1.3 kB gzipped of engine — can now drop
  out of it, where before `cva` held it in. That is the point of the change; it does nothing on its own.

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

- 43ae8a7: Stop keeping token declarations for `token()` when nothing calls it.

  Some declarations survive pruning purely so JavaScript can ask for them: virtual tokens, conditional ones, and the
  positive counterpart of every negative token. That last case is the expensive one — a negative is never declared
  itself, so it pins its positive and keeps the entire spacing scale alive whether or not anything uses it. The config
  documentation put that at "roughly a third of what survives pruning", and said there was no opt-out.

  There is now, and it needs no flag. The tokens artifact is generated into your project rather than installed, so the
  import is written in your own source and a scan of `include` finds it. When no file reaches for a token from
  JavaScript, the exemption has no caller to serve and is skipped.

  This changes emitted CSS by default, which is why it is a minor rather than the patch it started as.

  **What the scan looks for**

  A call — `token(`, `token.var(`, with whatever whitespace a formatter left around the dot — or a `from` / `import` /
  `require` of any module specifier carrying a `/tokens` path segment. Both tests over-match on purpose: keeping a
  declaration nothing reads costs bytes, and dropping one that is read returns a `var()` nothing declares.

  The import test is loose because the literal `styled-system/tokens` was too tight in three ways at once. `outdir` is
  configurable, so the artifact is only at `styled-system/` by default; a tsconfig path alias spells it something else
  again; and the artifact is a **directory**, so under NodeNext the only legal specifier is
  `styled-system/tokens/index.mjs` — which the literal did not match either. It is still anchored to an import keyword,
  because otherwise a URL or a route (`fetch('/api/tokens')`, an `href` of `/docs/theming/tokens`) reads as an import
  and switches the whole optimisation off without saying so.

  Measured on the sandboxes here:

  | app          |    raw |   gzip | brotli |
  | ------------ | -----: | -----: | -----: |
  | svelte       | -20.2% | -12.9% | -12.2% |
  | gatsby-ts    | -19.0% | -11.8% | -11.3% |
  | next-js-app  | -18.6% | -11.7% | -10.8% |
  | vite-ts      |  -6.9% |  -4.9% |  -4.1% |
  | runtime-perf |  -2.0% |  -1.9% |  -1.9% |
  | preact-ts    |     0% |     0% |     0% |

  `preact-ts` is the control, and it is the shape you want to check yourself against: it calls `token()`, so the
  exemption has a caller, nothing is skipped, and its stylesheet is byte-for-byte what it was. Every other app here
  reaches for no token from JavaScript, and the spread between them is how much of their theme the CSS alone could not
  account for.

  Across all sixteen example apps: 0% wherever a project reaches for a token, and -2.0% to -20.2% raw wherever none
  does, most of them between -11% and -19%.

  A project that calls `token()`, `token.var()`, or imports the tokens artifact anywhere under `include` is unaffected —
  and a hand-written `var(--x)` in source was already covered by the existing reference scan.

  Two shapes the scan does not see, both rare and neither loud. `include` scopes style extraction rather than everything
  that may import, so a build script, a config file, or a sibling workspace package calling `token()` is not covered;
  nor is a binding renamed away from `token`, as in `const t = token`. In both the declaration is pruned and the call
  returns a `var()` nothing declares. `pruneUnusedTokens: false` keeps every declaration if you are in that position.

### Patch Changes

- Updated dependencies [39c699f]
- Updated dependencies [fe62614]
- Updated dependencies [1036258]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/core@1.22.0
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/token-dictionary@1.22.0
  - @bamboocss/is-valid-prop@1.22.0

## 1.21.0

### Patch Changes

- 81f8789: Stop a single `css([...])` or pattern call from deoptimizing every later `css()` call in the process.

  `flatHashOrNull` in `memo.ts` hashed an array argument with a marker and then fell through to the same `for...in` loop
  it uses for plain objects. That loop and its `obj[k]` read are the hottest sites in the file, and V8 specializes them
  against the element kinds they have seen. Once an array reached them the specialization widened and never narrowed
  again — and because `memo` is shared by every memoized function in the runtime (`css`, `cva`, the patterns), the cost
  landed on all of them, process-wide, permanently, including on instances built afterwards.

  Arrays now take the string key instead. Correctness never depended on the fall-through: an array reaching there holds
  style objects, so the `typeof v === 'object'` check returned `null` on its first element anyway. Keeping the shape out
  of the loop is the whole change.

  **What it cost.** Measured on the flat `css()` case, 10k calls per iteration:

  ```
  objects only                             0.80ms
  objects and arrays interleaved           7.02ms   <- before
  objects only, after an array was seen    6.74ms   <- and it never recovered
  ```

  Any app calling both `css({...})` and `css([...])` — or any pattern, which merges through the same path — was paying
  roughly 8x on every call. An app that only ever passed a plain object was unaffected, which is why this survived: the
  benchmarks measured that state, and the deoptimizing bench sat next to them in the same file.

  **After**, on the same benches (`packages/generator/__tests__/css-fn.bench.ts`, 10k calls per iteration):

  | bench                       | before    | after     |
  | --------------------------- | --------- | --------- |
  | `pattern stack()`           | 4.3141 ms | 0.6533 ms |
  | `high-cardinality css()`    | 21.264 ms | 11.361 ms |
  | `composed css([a, [b, c]])` | 2.9576 ms | 2.3802 ms |
  | `inline css()`              | 0.7336 ms | 0.8250 ms |

  Patterns gain the most because they pass arrays through the merge on every call. `inline css()` is unchanged within
  noise — it is the case that was already monomorphic.

  CSS output is byte-identical; this changes only how the runtime caches. Verified by rebuilding a real project's
  stylesheet and diffing against the pre-fix build.

  **A benchmark that reported the opposite.** The same deopt is why `css-fn.bench.ts` reported `cssMode: 'grouped'` as
  9.4x slower than atomic on the cached path. `grouped inline css()` ran after `composed css([a, [b, c]])` and inherited
  the deoptimized runtime; atomic measured after that same bench read 6.72ms too. The two are at parity — 0.85ms against
  0.83ms — and the file now warms every argument shape up front so a reintroduced deopt shows up everywhere at once
  instead of only after whichever bench first passes an array.

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/core@1.21.0
  - @bamboocss/token-dictionary@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/is-valid-prop@1.21.0
  - @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

- 1f94d5a: Fix slot recipes without a `root` slot naming every slot class twice over, so they rendered completely
  unstyled.

  `createRecipe` routes the name it is given through `createCss`, which applies `hash.className` and `prefix.className`
  itself. The generated template has two branches, and only one accounted for that:

  ```js
  // a recipe that anchors: raw name, formatted once by createCss — correct
  createRecipe(`combobox__${slotName}`, …)

  // a recipe with no anchors: slotKey has already been through formatRecipeClass — formatted twice
  createRecipe(slotKey, …)
  ```

  So the runtime asked for `toHash(toHash(name))` while `cssgen` emitted rules under `toHash(name)`. Confirmed against a
  production build: `menu__content` is emitted as `gwnspZ` and the DOM carried `jyBcnE`; `menu__positioner` is emitted
  as `cXdnZS` and the DOM carried `iRSbhH`. Neither runtime class occurs anywhere in the shipped stylesheet.

  Six recipes have that shape — `dialog`, `drawer`, `hover-card`, `menu`, `popover` and `tooltip` — and every slot on
  them was unstyled. It reads as a stacking bug rather than a naming one, because `menu.positioner` carries the `zIndex`
  that holds a popover above the page: the rule is emitted, nothing matches it, and the popover falls to
  `z-index: auto`.

  **It was not only hashed builds.** `formatRecipeClass` applies the prefix as well, and that is not idempotent either —
  a prefixed build produced `bam-bam-menu__trigger` against a stylesheet emitting `.bam-menu__trigger`. The bug is
  invisible only when neither `hash` nor `prefix` is set, where both applications are identities, which is why it
  survived development and appeared in production.

  **Regression coverage**

  `slot-recipe-class-parity.test.ts` writes the generated system to disk, imports it, and asserts that every class the
  recipe returns — and every entry in `classNameMap` — is a class the stylesheet emits a rule for. Across the whole
  `{hash} × {prefix}` matrix, for a recipe that anchors and one that does not.

  Reading the class from the artifact rather than recomputing it is the point. An earlier version of this test derived
  both sides from the context, which only asserts that `cssgen` agrees with itself — it passed while every one of these
  slots was unstyled, and it passed again when the slot separator was changed to something the stylesheet never emits.
  - @bamboocss/core@1.20.4
  - @bamboocss/is-valid-prop@1.20.4
  - @bamboocss/logger@1.20.4
  - @bamboocss/shared@1.20.4
  - @bamboocss/token-dictionary@1.20.4
  - @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- Updated dependencies [fa63a80]
  - @bamboocss/core@1.20.3
  - @bamboocss/is-valid-prop@1.20.3
  - @bamboocss/logger@1.20.3
  - @bamboocss/shared@1.20.3
  - @bamboocss/token-dictionary@1.20.3
  - @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/core@1.20.2
- @bamboocss/is-valid-prop@1.20.2
- @bamboocss/logger@1.20.2
- @bamboocss/shared@1.20.2
- @bamboocss/token-dictionary@1.20.2
- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/core@1.20.1
- @bamboocss/is-valid-prop@1.20.1
- @bamboocss/logger@1.20.1
- @bamboocss/shared@1.20.1
- @bamboocss/token-dictionary@1.20.1
- @bamboocss/types@1.20.1

## 1.20.0

### Minor Changes

- 15e2d53: Emit semantic tokens with an `_osDark` value as `light-dark()`, and raise the browser baseline to match.

  A token whose only conditional value is `_osDark` cost two declarations and a media block. It now costs one line:

  ```diff
    :where(:root, :host) {
  +   color-scheme: light dark;
  -   --colors-text: var(--colors-gray-600);
  +   --colors-text: light-dark(var(--colors-gray-600), var(--colors-gray-400));
    }
  -
  - @media (prefers-color-scheme: dark) {
  -   :where(:root, :host) {
  -     --colors-text: var(--colors-gray-400)
  -   }
  - }
  ```

  The saving is one media block per stylesheet plus one declaration per token, so it scales with how many `_osDark`
  semantic tokens a design system carries. Class names and hashes are unchanged.

  **An explicit toggle stops meaning "restate every token"**

  This is the more useful half. `_osDark` is a media query and `[data-theme=dark]` is a selector, so the two are
  separate mechanisms that resolve against each other by source order — supporting both meant emitting every token
  twice. `light-dark()` reads `color-scheme`, which is an ordinary inherited property, so a toggle is one declaration on
  a subtree:

  ```css
  [data-theme='dark'] {
    color-scheme: dark;
  }
  ```

  **`color-scheme: light dark` ships with the tokens**

  `light-dark()` returns its light value whenever `color-scheme` does not name both, so a sheet that folds without
  declaring it is a sheet where dark mode silently never engages. It is emitted in the tokens layer rather than the
  reset for that reason — the reset can be turned off with `preflight: false`, and this is a prerequisite of the
  declarations above it, not a nicety. It sits at zero specificity and only appears when something actually folded.

  **Three shapes are left alone**
  - A token carrying `_osLight` as well keeps both media blocks. Folding it would put the light arm and an
    `@media (prefers-color-scheme: light)` block in play for one variable, where the block wins on order and the arm is
    dead.
  - `_dark` is a class selector, not a media query, so it stays a rule of its own.
  - A redefined `osDark` condition — pointed at `[data-os=dark] &`, say — does not fold at all. It is a configurable
    condition rather than a keyword, and `light-dark()` cannot express a selector, so folding on the name alone would
    silently rewrite the mechanism the user picked.

  **The baseline moves**

  ```diff
  - Chrome >= 118      + Chrome >= 123
  - Edge >= 118        + Edge >= 123
  - iOS >= 17.4        + iOS >= 17.5
  - Safari >= 17.4     + Safari >= 17.5
  - Android >= 118     + Android >= 123
  - Opera >= 106       + Opera >= 109
    Firefox >= 146
  ```

  `light-dark()` is Baseline 2024 and lands later than `@scope` everywhere except Firefox, which got it at 120 against
  `@scope` at 146 — so the two features now set the baseline between them. This is not optional the way a minifier
  setting is: an unsupported browser does not fall back to the light value, it fails substitution and the declaration
  using the token becomes invalid at computed-value time.

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

### Patch Changes

- 6512d6b: Update the PostCSS toolchain, and fold shared selector prefixes into `:is()` when minifying.

  | package                            |   from |     to |
  | ---------------------------------- | -----: | -----: |
  | `postcss`                          | 8.5.25 | 8.5.26 |
  | `postcss-selector-parser`          |  7.1.1 |  7.1.5 |
  | `postcss-discard-duplicates`       |  7.0.2 |  8.0.2 |
  | `postcss-discard-empty`            |  7.0.1 |  8.0.2 |
  | `postcss-minify-selectors`         |  7.0.5 |  8.0.3 |
  | `postcss-nested`                   |  7.0.2 |  8.0.1 |
  | `postcss-normalize-whitespace`     |  7.0.1 |  8.0.2 |
  | `@csstools/postcss-cascade-layers` |  5.0.2 |  6.0.0 |
  | `browserslist`                     | 4.28.1 | 4.28.7 |

  The cssnano majors raise their engine floor to `^22.11.0 || ^24.11.0 || >=26.0`. Nothing here declares `engines`, so
  it is not enforced at install time, but a build on Node 24.10 or older 24.x runs these plugins outside their supported
  range.

  **Minified `globalCss` changes**

  `postcss-minify-selectors` 8 adds `convertToIs`, which factors a shared prefix or suffix in a selector list into
  `:is(...)` where that shortens it. It is on, and it reaches `globalCss` — a selector list nested under a parent is the
  common case:

  ```diff
    '.card': { '& h1, & h2': { fontWeight: 'bold' } }

  - .card h1,.card h2 { font-weight: … }
  + .card :is(h1,h2) { font-weight: … }
  ```

  Class names and hashes are unchanged, `:is()` takes the highest specificity of its arguments so the folded rule
  matches and ranks exactly as the list did, and unminified output is untouched.

  Atomic and recipe output is unaffected, and not incidentally: each atomic class carries a unique declaration, so
  `merge-rules` never combines two into a list with shared structure, and a scoped slot variant is a plain selector
  inside an `@scope` block rather than a list. Measured over every stylesheet this repo generates — 59 selector lists,
  none foldable, zero bytes moved. The fold is worth having for authored CSS; it is not a size win on generated CSS, and
  nothing here should be read as claiming one.

  **The browser baseline is now fixed, and `@scope` sets it**

  Upstream gates the fold on `caniuse-api`, and resolves the target it asks about from `process.cwd()` — the consuming
  project, not `config.browserslist`. Two things follow, and both break the guarantee that a given input compiles to one
  stylesheet: output would depend on where the build ran, and it would flip on its own as `caniuse-lite` refreshed. So
  the baseline is passed explicitly and no longer consults the ambient config.

  Documenting that baseline turned up errors in it. `@scope` was described as a raised floor that only projects with
  `root`-slot recipes reach, with a lower general baseline beneath it — which made the supported set depend on how a
  project's recipes happen to be written. `@scope` is the documented baseline now, one floor, and `scopeRoots: []` is no
  longer offered as a way under it: it controls scoping, not what Bamboo supports.

  The numbers behind it were wrong in two places. Firefox is **146**, not 128 — caniuse records 128 through 145 as no
  support, not partial — and Opera is **106**, not 104. Anyone on Firefox 128–145 had been told slot recipes would work.
  The retired lower tier had its own version of this: it claimed `:is()` as a baseline feature while listing
  `Opera >= 73`, which predates it by two majors.

  **Coverage**

  The minified branch had no tests, which is how a plugin swapping "sort and dedupe a selector list" for "fold it into
  `:is()`" changed emitted CSS without a snapshot moving. `packages/core/__tests__/optimize-minify.test.ts` now locks
  the minified output, and asserts it is unchanged under a hostile ambient `BROWSERSLIST`.

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
  - @bamboocss/token-dictionary@1.20.0
  - @bamboocss/logger@1.20.0
  - @bamboocss/is-valid-prop@1.20.0

## 1.19.0

### Minor Changes

- 510cdd3: Drop `@property` registrations for custom properties the stylesheet never uses, under `pruneUnusedTokens`.

  `preset-base` registers the custom properties its utilities compose with — filters, gradients, transforms, transitions
  — so a value cannot inherit into a descendant that declares its own. Those registrations are derived from the config
  rather than from usage, so an app that draws no gradients still ships all 42. Across the projects in this repo,
  93-100% of them are dead:

  | project               | @property before -> after | raw              | gzip             |
  | --------------------- | ------------------------- | ---------------- | ---------------- |
  | `sandbox/next-js-app` | 42 -> 0                   | 17,203 -> 3,812  | 5,051 -> 1,606   |
  | `website`             | 42 -> 3                   | 72,675 -> 60,590 | 14,796 -> 11,912 |

  (Those totals include the token and keyframe pruning that already ran; the registrations are about 250-300 bytes
  gzipped of it. The raw share is much larger than the compressed one — 42 near-identical blocks gzip well — so judge it
  on the gzip column.)

  A registration is removed only when the finished stylesheet neither declares nor reads the property, using the same
  reachability walk the token declarations already use. It is deliberately _not_ gated on which utility the project
  used: `--gradient-stops` is registered once, by `backgroundGradient`, and composed by `bgLinear`, `bgRadial`,
  `bgConic` and `textGradient`, so a project using only `bgRadial` uses the property without using the utility that
  declares it. Gating on the declaring utility would drop it and let a parent's gradient inherit again — the bug that
  registering these fixed in the first place. Asking what the finished stylesheet contains avoids that question
  entirely.

  Registrations written through `globalVars` are never removed, the same way pruning only ever removes custom properties
  the token system declared.

  The one shape this cannot see is a property both written and read entirely outside the emitted css — a hand-written
  stylesheet outside `include` doing `.a { filter: var(--blur,) }`. Inside `include` the source scan already catches it.
  Hold it with `staticCss`, or declare the `@property` yourself through `globalVars`.

### Patch Changes

- Updated dependencies [510cdd3]
  - @bamboocss/core@1.19.0
  - @bamboocss/is-valid-prop@1.19.0
  - @bamboocss/logger@1.19.0
  - @bamboocss/shared@1.19.0
  - @bamboocss/token-dictionary@1.19.0
  - @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- 21c6daa: Drop the class-name cache under `css()`'s own memo.

  `createCss` returned `memo(...)`, so the generated `css()` carried two caches in a row:

  ```js
  css = memo((...styles) => cssFn(mergeCssUncached(...styles)))
  ```

  `cssFn` is reached only when the outer memo missed, and the merged object it receives is a deterministic function of
  the same arguments — so the second cache cannot hit. Instrumented over 25k calls it served zero hits in every
  workload, including working sets past `MAX_ENTRIES`, where both caches rotate in lockstep rather than one rescuing the
  other. This is the same redundancy already removed for the merge, one layer down.

  A new `createCssUncached` export carries the uncached form, and `createCss` keeps the cache. That split matters: the
  vite fold reaches `createCss` directly with no memo above it, and the merge feeding it is many-to-one there, so it
  hits 2-35% across real projects — removing its cache outright measured +187% on the fold. The generated `css()` and
  the generated recipe runtime both take the uncached form, the latter because it constructs one _inside_ a memoized
  function, where the cache is built per call and used once.

  Measured on the generated runtime, isolated against the merge change that preceded it:

  | shape            | before | after  | delta  |
  | ---------------- | ------ | ------ | ------ |
  | flat miss        | 1425ns | 1113ns | −21.9% |
  | conditional miss | 1956ns | 1601ns | −18.1% |
  | realistic miss   | 2706ns | 2371ns | −12.4% |
  | hit (control)    | 85ns   | 88ns   | noise  |

  Class names are unchanged; the hit path is untouched. `packages/shared/__tests__/memo.test.ts` counts the reads rather
  than timing them, so the guard holds on any machine.

  `createRuntimeCss` in `@bamboocss/vite` now genuinely mirrors the shape its own comment described — one memo on the
  argument list, neither inner cache — which is 37-51% faster on every fold workload measured.

- Updated dependencies [21c6daa]
- Updated dependencies [070f9da]
  - @bamboocss/shared@1.18.0
  - @bamboocss/core@1.18.0
  - @bamboocss/token-dictionary@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/is-valid-prop@1.18.0
  - @bamboocss/logger@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3
- @bamboocss/core@1.17.3
- @bamboocss/is-valid-prop@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/shared@1.17.3
- @bamboocss/token-dictionary@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/core@1.17.2
- @bamboocss/is-valid-prop@1.17.2
- @bamboocss/logger@1.17.2
- @bamboocss/shared@1.17.2
- @bamboocss/token-dictionary@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [a1c3990]
- Updated dependencies [fc381ca]
  - @bamboocss/core@1.17.1
  - @bamboocss/shared@1.17.1
  - @bamboocss/token-dictionary@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/is-valid-prop@1.17.1
  - @bamboocss/logger@1.17.1

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

- 29f9bbe: Fix conditional token values being silently dropped on postcss `>= 8.5.25`.

  A semantic token declared with a conditional value emitted only its `base` half — no error, no warning — so a themed
  app kept its light values in dark mode:

  ```ts
  semanticTokens: {
    colors: {
      panel: { value: { base: '#ffffff', _osDark: '#131211' } },
    },
  }
  ```

  ```css
  /* before — the `_osDark` half never reached the tokens layer */
  @layer tokens {
    :where(:root, :host) {
      --colors-panel: #ffffff;
    }
  }
  ```

  `getDeepestRule` seeded its nesting chain with an empty-selector rule and relied on postcss-nested erasing `&` against
  it. postcss 8.5.25 ("Fixed 8.5.17 visitor regression") changed that edge case to collapse the whole selector, so every
  conditional token was emitted as a selectorless — and therefore discarded — rule. The chain is now built on a `Root`,
  and the top-level `&` is resolved directly instead of through postcss-nested.

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

- 6577023: **Fix:** a scoped slot recipe rendered every non-anchor slot unstyled under `hash: true` or `prefix`.

  A scoped slot's class is a constant — that is the point of scoping, since the slot takes no variant props. Constants
  never pass through `createCss`, which is where `hash.className` and `prefix` are applied, so the runtime handed back a
  raw `checkbox__control` while the stylesheet emitted its rule as `.hEeOkj`. The `@scope` prelude had the same problem:

  ```css
  /* before, with `hash: true` */
  .dHwbLC { … }                                          /* base rules hashed */
  @scope (.checkbox__root--size_sm) to (.checkbox__root) /* prelude not hashed */
    { .checkbox__control { … } }                         /* selector not hashed */
  ```

  Neither the anchor class nor the slot class existed in the DOM under those names, so the slot lost its base styles
  _and_ its variant styles. Nothing was reported — it simply rendered unstyled. Both defaults (no `hash`, no `prefix`)
  were unaffected, which is why it went unnoticed.

  Fixed on both sides: the build stores the scope's class names raw and formats them through `formatSelector`, and the
  generated runtime formats a constant slot class through the same prefix-and-hash the rest of a recipe's classes go
  through. Inline `sva` had the identical bug and is fixed with it.

  `checkNamingAgreement` now covers slot recipes, so this derivation cannot drift again — it already covered `css()` and
  inline `cva`, and a slot recipe's constant half was exactly the gap.

  To be precise about what that guard does and does not do: it runs a **canary config** through both derivations, so it
  checks that hashing, prefixing and separators agree. It never looks at your code, so it cannot see a class name that
  diverges because the build read a _different config_ than the browser holds — see the separate fix for a recipe config
  the build cannot fully read.

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

- Updated dependencies [3cdd0d1]
- Updated dependencies [29f9bbe]
- Updated dependencies [66cb96c]
- Updated dependencies [28463ce]
- Updated dependencies [6577023]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [355e573]
  - @bamboocss/shared@1.17.0
  - @bamboocss/core@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/token-dictionary@1.17.0
  - @bamboocss/logger@1.17.0
  - @bamboocss/is-valid-prop@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1
- @bamboocss/core@1.16.1
- @bamboocss/is-valid-prop@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/shared@1.16.1
- @bamboocss/token-dictionary@1.16.1

## 1.16.0

### Minor Changes

- ca558fb: **Breaking:** `cx` joins class names in every build. It no longer resolves conflicts between them.

  It used to, when the class names happened to carry a property to compare — atomic mode with `hash.className` off. In
  any other build it silently concatenated instead. `hash` is commonly wired to a minification flag, so the same source
  resolved overrides while you developed and stopped when you shipped, with nothing raised at build time either way.

  The two could not be reconciled by teaching the matcher to read hashed names. `cssMode: 'grouped'` names a _whole_
  `css()` call with one class, so there is no single property behind it to compare, whatever the naming scheme. While
  grouped exists, some builds can never merge — and a `cx` that merges in the rest is a behavioural difference keyed on
  a config flag.

  ```js
  cx(css({ paddingX: '4' }), css({ paddingX: '2' }))
  // before, in some builds: 'px_2'
  // now, in every build:    'px_4 px_2'
  ```

  Precedence is decided where every build can decide it the same way — by cascade layer:
  - **A component you want reliably overridable** needs a lower layer than its consumer, and a **recipe** puts it there.
    `cva()` and `sva()` name their classes from the config and emit them into `recipes`, whether declared inline or in
    `theme.recipes`.
  - **Or accept a style object rather than a class name.** `css(base, props.css)` merges per property before any class
    name exists, so it resolves the same way in every build and needs no layer.
  - **Two `css()` calls you own** are in the same layer, so merge the objects instead: `css(a, b)`.

  The case to check when upgrading is a component that styles itself with bare `css()` _and_ accepts a `className`. Both
  classes are in `utilities`, so the winner is now stylesheet order rather than argument order. Moving those styles to
  `cva` makes the override deterministic again.

  Two things this also fixes. A hand-written class shaped like a utility — `top_bar`, or anything
  `<utility><separator><value>` — is no longer dropped, since nothing is matching on shape any more. And the merge
  matcher is gone from the runtime, which shipped a list of every registered utility to the browser to do its work.

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

- 99ab42f: **Breaking:** scope a slot recipe's variants to its root, so every other slot is static.

  A slot recipe that declares a slot named `root` now emits its non-root slots' variant styles as rules scoped by the
  class the root already carries, instead of as classes each slot has to be given:

  ```css
  /* before — the control had to be told which size it is */
  .checkbox__control--size_md {
    width: 10;
  }

  /* after — the root already says so */
  @scope (.checkbox__root--size_md) to (.checkbox__root) {
    .checkbox__control {
      width: 10;
    }
  }
  ```

  Nothing has to reach a slot at runtime, so a compound component needs no context, no provider and no wrapper per slot
  — which is what made `createStyleContext` necessary and is the reason it could be removed.

  ```js
  checkbox.root({ size: 'md' }) // 'checkbox__root checkbox__root--size_md'  — only the root takes variants
  checkbox.control //              'checkbox__control'                       — a property, not a call

  checkbox({ size: 'md' }) // still returns the whole record
  ```

  `to (.checkbox__root)` bounds the scope at the next nested instance, so an outer `size="md"` does not style the
  control of a checkbox nested inside it. Without it both rules would match at equal specificity and the winner would be
  stylesheet order rather than proximity.

  Two things this relies on, both now under test:
  - The root carries a class for **every** variant any slot references, including one that writes no root styles at all
    — it is the selector the scope opens on. A test asserts the prelude the build emits is exactly the class the runtime
    puts on the root, because the two are derived independently and only meet in the browser.
  - Precedence is unchanged. The scoped selector is more specific, but specificity never crosses a cascade layer: a
    consumer's `css()` output is in `utilities` and still beats anything in `recipes`.

  Also new: `recipe.slotsAffectedBy` — which slots each variant writes styles for. A **portal** renders outside the
  root's subtree, so DOM ancestry breaks and CSS cannot reach it; that case still needs the variant delivered by hand,
  and this says which slots it has to reach rather than leaving the component layer to guess.

  A recipe whose slots are siblings, with no slot named `root`, has no ancestor to scope by. Those are unchanged: a
  variant class per slot, every slot callable.

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

### Patch Changes

- 1be9171: Stop `cva` merging against an empty compound-variant result.

  `resolve` ended in `mergeCss(variantCss, compoundVariantCss)` unconditionally. `mergeCss` is memoized on its
  arguments, so that call hashes the whole accumulated style object before discovering the second operand is empty —
  which it is for every recipe that declares no compound variants, and most declare none. Slot recipes get it too, since
  `sva` builds one `cva` per slot.

  Measured on the `cva` bench, both forms built in the same process so the pair shares a warm-up and a machine:

  | `raw()`, no compound variants | hz        | mean    | rme    |
  | ----------------------------- | --------- | ------- | ------ |
  | all-miss, short-circuited     | **59.19** | 16.89ms | ±1.25% |
  | all-miss, merging against {}  | 42.31     | 23.64ms | ±1.03% |
  | warm, short-circuited         | 380.69    | 2.63ms  | ±0.48% |
  | warm, merging against {}      | 384.54    | 2.60ms  | ±0.37% |

  **+40% on the miss path, neutral warm** — warm returns from the memo without reaching `resolve` at all, which is also
  why this shows up as a cold-start and first-render cost rather than a steady-state one. The untouched `raw() all-miss`
  control moved 0.7% between the two runs.

  The bench previously mirrored the artifact with a compound variant present, so it never exercised this path; it now
  carries the compound-free recipe in both forms. `cva-resolve-work.test.ts` counts `mergeCss` calls rather than timing
  them, so the saving is pinned in CI where a wall-clock threshold could not be.

  No CSS output changes. `resolve` returns what the merge returned in every shape asserted against it, with one
  exception worth naming: a recipe whose `base` defines _nothing_ (every value `undefined`) and has no active variant
  now resolves to `{ color: undefined }` rather than `{}`, because `compactStyles` used to drop a style object with no
  defined value in it. Both produce no class, so nothing downstream can tell; the difference is only reachable by
  spreading `raw()` over another object, where the `undefined` key would shadow what it lands on.

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
  - @bamboocss/core@1.16.0
  - @bamboocss/shared@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/token-dictionary@1.16.0
  - @bamboocss/logger@1.16.0
  - @bamboocss/is-valid-prop@1.16.0

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
  - @bamboocss/token-dictionary@1.15.0
  - @bamboocss/logger@1.15.0
  - @bamboocss/is-valid-prop@1.15.0

## 1.14.0

### Minor Changes

- 7cc6235: `cx` now resolves conflicting utility classes instead of concatenating them.

  Two atomic classes that set the same property under the same conditions cannot both apply. Concatenating them handed
  the decision to whichever rule came later in the stylesheet rather than to the order they were passed, so the common
  composition pattern did not reliably work:

  ```js
  cx(css({ paddingX: '4' }), css({ paddingX: '2' }))
  // before: 'px_4 px_2' — whichever rule the stylesheet ordered last applied
  // now:    'px_2'
  ```

  That is the pattern every generated JSX factory uses (`cx(recipeClasses, props.className)`), so a caller's `className`
  now overrides the component's own styles as expected.

  Conditions are part of the declaration, so they only merge with each other — `hover:px_4` and `px_4` are unrelated. An
  `!important` class is the same declaration as its plain form, so argument order decides between them rather than the
  cascade.

  ## What this changes in your output

  **The class strings your components render are different.** Elements carry only the winning class where they
  previously carried both, and the winner keeps the position of the class it replaced — so
  `cx('px_4 c_red', 'c_blue px_2')` is now `'px_2 c_blue'`. Expect DOM snapshots in consuming test suites to need
  updating. If you relied on stylesheet order to pick between two classes on one element, that no longer happens.

  ## What is and isn't protected

  A class is only merged when the property segment matches a utility bamboo actually registered, matched at its longest
  — `bd-w` beats `bd`, so `bd-w-4px` and `bd-c-red` stay separate under `separator: '-'`. Recipe class names are
  excluded outright, bare and with a `--variant` suffix, so a recipe called `my_btn` is not mistaken for the `my`
  utility. When a `prefix` is configured a class must carry it to be eligible at all.

  **A hand-written class that is shaped exactly like a utility class is indistinguishable from one and will be merged.**
  `top_bar` is what bamboo emits for `css({ top: 'bar' })`, so `cx('top_bar', 'top_0')` keeps only `top_0`. Provenance
  cannot be recovered from a class string at runtime, and `tailwind-merge` has the same limitation. If you pass
  hand-written classes through a bamboo component, avoid names of the form `<utility><separator><value>` — the risk is
  highest under `separator: '-'`, where ordinary kebab-case names like `p-4` or `top-nav` collide.

  With `hash.className` enabled a class name carries no property, so `cx` cannot merge and keeps concatenating — compose
  with `css(a, b)` instead. The smaller function is emitted in that case.

  ## Cost

  Measured against the previous implementation, both compiled in the same process, on the call shapes generated code
  actually emits (every site passes at least two arguments):

  |                                | merging             | concatenating         |
  | ------------------------------ | ------------------- | --------------------- |
  | no `className` passed          | 41.3M ops/s         | 47.4M ops/s           |
  | 12 tokens + a 2-token override | 707K ops/s (~1.4µs) | 42.7M ops/s (~0.02µs) |

  So a component that renders without a `className` pays ~13%, and one that merges pays about a microsecond. The React
  render benchmark cannot resolve that either way — it is dominated by React — so it is not evidence the cost is free,
  only that it is small next to a render.

  The emitted `cx` grows from ~290 bytes to ~7.5KB raw (~1.5KB min+gzip), most of it the list of utility class names the
  matcher checks against. It is imported by the JSX factory, `sva` and `create-style-context`, so it is not
  tree-shakeable in a real app.

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
  - @bamboocss/logger@1.14.0
  - @bamboocss/token-dictionary@1.14.0
  - @bamboocss/is-valid-prop@1.14.0

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

- ba60cf5: Memoize the variant resolution behind `cva.raw()`.

  Every JSX factory calls `cva.raw()` once per element per render to build the styles it merges with style props, and
  resolving them is not cheap: a `mergeCss` per active variant plus a scan of every compound variant. That ran again for
  every element, even when a hundred of them shared the same variant props.
  - `raw()` on repeated variant props: **7.0x** faster
  - A React SSR render of elements with a `cva` config: **2.19 → 1.28 µs** per element (1.7x)
  - Markup and class names are unchanged

  `raw()` still returns an independent copy — more importantly than before, since the object it copies from is now
  cached twice over, by `mergeCss` and by the resolution itself.

  The cost is on the other side: when every call carries a distinct variant combination nothing is reusable, and that
  path measures ~8% slower. Variant props come from a fixed set, so the reusable case is the normal one — but
  `cva.bench.ts` now tracks both, where nothing covered `cva` at all before.

  One behavioural note: mutating a `cva` config object after creating the recipe no longer changes what `raw()` returns.
  Calling the recipe itself was already memoized, so the two now agree rather than disagreeing.

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

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/core@1.13.2
  - @bamboocss/token-dictionary@1.13.2
  - @bamboocss/types@1.13.2
  - @bamboocss/is-valid-prop@1.13.2
  - @bamboocss/logger@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/core@1.13.1
- @bamboocss/is-valid-prop@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/token-dictionary@1.13.1
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

- 8a6c23e: Drop two `useMemo` calls from the React and Preact factories that could never hit.

  `restProps` comes from rest destructuring, so it is a fresh object on every render and the dependency on it never
  matches — even when React hands back the identical props object. The second memo depends on the first's output and
  misses for the same reason. Every element that is not folded away paid for two hook slots, two dependency arrays and
  two retained memo cells to recompute both values anyway.

  Measured at ~3% faster on an unfolded tree of factory elements, and ~7% on the hooks in isolation.

  Solid and Vue are untouched: their `createMemo`/`computed` track reactive sources rather than a dependency array, and
  do cache.

- 17de3d0: Stop shipping the JSX property list twice.

  `jsx/is-valid-prop` carried two string constants that the runtime immediately concatenated into one lookup: the
  browser CSS properties, and the project's own properties and shorthands. They overlap heavily — 285 of the 1,134
  entries appeared in both — and every consumer of the JSX factory downloaded and parsed the overlap twice. At 15,684
  bytes it was the largest single module in the generated runtime, and roughly a third of what
  `import { Box } from 'styled-system/jsx'` pulled in.

  The two lists are now merged into one deduplicated list at generation time. The module drops to 11,468 bytes. Combined
  with the `sideEffects` declaration, a JSX barrel import goes from 41.2 KB to 30.1 KB minified and 12.6 KB to 10.2 KB
  gzipped.

  The set of recognised properties is unchanged — 849 before and after, verified by diffing the two — so `isCssProperty`
  answers identically and no prop that used to be treated as a style prop now leaks to the DOM. The exported
  `allCssProperties` holds the same members, without the duplicates; anything reading its `length` rather than its
  contents will see 849 instead of 1,134.

  Two related fixes fall out of the rewrite:
  - A failure to match the prebuilt module is now an error rather than an empty list. These rewrites match bundler
    output and have silently missed before; an empty list is not a degraded system but a broken one, since every style
    prop would render as a raw HTML attribute.
  - The substitution runs through a replacer function, so a `$` in a project property is no longer interpreted as a
    replacement pattern.

  Under `jsxStyleProps: 'minimal'` or `'none'` the browser list was already dropped, and still is; that path now emits
  `"css"` instead of an empty string alongside it.

- cd76ba7: Stop style props leaking into the DOM as raw HTML attributes.

  `isCssProperty` is generated by rewriting a prebuilt module, and all three of those rewrites matched shapes the
  bundler stopped emitting after the tsdown migration. The rewrites failed silently — the file still parsed — so the
  effects were only visible in rendered output:
  - The list of the project's own properties came out empty, so shorthands and custom utilities were not recognised.
    `<styled.button mx="2">` rendered `mx="2"` as a literal attribute instead of applying the class, and a `css` prop
    rendered as `css="[object Object]"`.
  - Under `jsxStyleProps: 'minimal'` or `'none'`, the full browser CSS property list was still shipped rather than
    stripped.
  - The module's own `memo` was left in place next to the imported one, which is a duplicate declaration — a syntax
    error in any generated `styled-system` using style props.

  All three now match what the bundler emits, and are asserted so a future change to the build output fails loudly
  instead of silently producing a styled-system that renders the wrong markup.

- 9ffb84f: Key scalar arguments by value in the generated runtime's memo.

  Every non-object argument hashed to the same constant, so distinct strings shared one bucket and competed for its
  fixed number of slots. Past that count the hit rate fell to zero and each call also paid a scan of the bucket and a
  fresh snapshot of its arguments.

  This hit `isCssProperty`, which is called for every prop on every render when `jsx.styleProps` is `'all'` (the
  default) and sees hundreds of distinct property names — so the hottest path in the runtime was missing its cache
  entirely.

  Scalars now hash by value, and a call with a single scalar argument is keyed directly, which is the shape of the
  callers that run most often.

- fd03a10: Give the generated `styled-system/package.json` a name.

  That file was emitted without one, deliberately, so that two outputs in a single workspace could not collide on the
  same name. But a nameless `package.json` is not one a workspace scanner skips — it is one it refuses. pnpm, npm and
  changesets all abort with `missing the "name" field`, and none of them say which directory produced it. Any project
  whose workspace globs reach an output directory hit this, and a recursive glob such as `packages/**` reaches every one
  of them.

  The name is derived from `outdir`, the only input that is both deterministic and portable (`cwd` is absolute, so
  putting it in generated output would make that output differ per machine). Two projects in one workspace that both
  keep the default `outdir` therefore still collide — but on a duplicate-name error that names both paths, rather than
  on a missing field that points nowhere.

  `bamboo emit-pkg` used to treat a missing name as its signal that the file was generated rather than hand-authored. It
  now keys on the file being `private` with no `version`, which is what actually distinguishes generated output from a
  package the consumer owns — a private _named_ package in the output directory is the `@acme/styled-system` workspace
  layout the component-library guide recommends, and that is still left alone.

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

- 5b16a67: Emit a `package.json` into the generated output so bundlers can tree-shake the barrels.

  The output is a plain directory rather than an installed package, so it carried no `sideEffects` hint and bundlers had
  to assume every module mutates something. Nothing a barrel reached could be dropped:
  `import { Box } from 'styled-system/jsx'` retained all twenty pattern modules, and a deep import at
  `styled-system/jsx/box.mjs` — which nobody writes — produced a materially smaller bundle than the documented one.

  Declaring `sideEffects` closes that gap. A barrel import now costs what the deep import costs: 41.2 KB to 34.1 KB
  minified, 12.6 KB to 10.7 KB gzipped, with nineteen unused pattern modules dropped. The patterns barrel improves by
  about 26%; recipes scale with how many are defined. In a real Vite build of `sandbox/vite-ts` — an app that does use
  several patterns, so it sees less than the ceiling — JS goes from 242.22 KB to 236.95 KB with the CSS byte-identical.

  Two details in the emitted file are load-bearing:
  - `sideEffects` lists CSS globs rather than being a bare `false`. A bare `false` permits a bundler to drop
    `import 'styled-system/styles.css'`, which is how the stylesheet reaches CLI-flow apps. Vite happens to retain CSS
    imports regardless, but webpack historically does not. Both `*.css` and `**/*.css` are listed because the stylesheet
    is emitted at the root and, under `splitting`, in `styles/`.
  - `type` is set to `module`. Adding a `package.json` makes the output its own package boundary, so `.js` output would
    stop inheriting the consumer's `type` and be re-read as CommonJS. The emitted code is always ESM. This is a no-op
    under the default `mjs` extension and only matters for `outExtension: 'js'`.
  - `private` is set, and the file stays nameless. That same package boundary lets a workspace glob match the output
    directory — this repo's own `packages/**` now does — so it is marked unpublishable, and left unnamed so that several
    outputs in one workspace cannot collide.

  Unlike the rest of the output, `package.json` is not exclusively ours — `emit-pkg` writes entrypoints to the same path
  and consumers hand-edit it — so it is merged rather than overwritten. Only absent keys are filled in: an existing
  `exports` map survives, and a deliberate `sideEffects` or `type` is left as it stands. A file that cannot be parsed as
  JSON is reported and skipped rather than replaced. The merged file keeps its trailing newline, so a consumer who
  tracks it in source control does not see a diff on every codegen.

  `emit-pkg` had to learn the other half of that arrangement. It used to write a whole package only when the directory
  had none, and codegen now always leaves one there, so it would have contributed an entrypoint map to a nameless
  `private` file and stopped — no `name`, no `version`, no `license`, nothing publishable or resolvable. It now reads a
  file without a `name` as ours: it supplies the identity that file lacks and lifts the `private` flag that kept a
  nameless directory unpublishable, which is the whole point of running it. A file that already carries a `name` belongs
  to the consumer and is still left alone but for `exports`.

  This only affects what bundlers may discard, so no CSS output or class name changes.

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
- Updated dependencies [a24d37a]
  - @bamboocss/shared@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/core@1.13.0
  - @bamboocss/token-dictionary@1.13.0
  - @bamboocss/logger@1.13.0
  - @bamboocss/is-valid-prop@1.13.0

## 1.12.3

### Patch Changes

- Updated dependencies
  - @bamboocss/core@1.12.3
  - @bamboocss/is-valid-prop@1.12.3
  - @bamboocss/logger@1.12.3
  - @bamboocss/shared@1.12.3
  - @bamboocss/token-dictionary@1.12.3
  - @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/core@1.12.2
- @bamboocss/is-valid-prop@1.12.2
- @bamboocss/logger@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/token-dictionary@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/core@1.12.1
- @bamboocss/is-valid-prop@1.12.1
- @bamboocss/logger@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/token-dictionary@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/core@1.12.0
- @bamboocss/is-valid-prop@1.12.0
- @bamboocss/logger@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/token-dictionary@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- Updated dependencies [f3591d8]
  - @bamboocss/core@1.11.5
  - @bamboocss/is-valid-prop@1.11.5
  - @bamboocss/logger@1.11.5
  - @bamboocss/shared@1.11.5
  - @bamboocss/token-dictionary@1.11.5
  - @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/core@1.11.4
  - @bamboocss/is-valid-prop@1.11.4
  - @bamboocss/logger@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/token-dictionary@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/core@1.11.3
  - @bamboocss/is-valid-prop@1.11.3
  - @bamboocss/logger@1.11.3
  - @bamboocss/shared@1.11.3
  - @bamboocss/token-dictionary@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/token-dictionary@1.11.2
  - @bamboocss/is-valid-prop@1.11.2
  - @bamboocss/logger@1.11.2
  - @bamboocss/shared@1.11.2
  - @bamboocss/types@1.11.2
  - @bamboocss/core@1.11.2

## 1.11.1

### Patch Changes

- 2f29aa6: Bump `postcss` from `8.5.6` to `8.5.14` to address
  [CVE-2026-41305](https://www.cve.org/CVERecord?id=CVE-2026-41305).
- 1d781ff: Fix `css.d.ts` for `syntax: 'template-literal'` mode to match the runtime implementation.

  Previously the generated `styled-system/css/css.d.ts` only declared a single tagged-template signature:

  ```ts
  export declare function css(template: { raw: readonly string[] | ArrayLike<string> }): string
  ```

  But the runtime already supported both multi-arg invocations (`css(styleA, styleB, ...)`) and a `css.raw` companion.
  Calling these features failed type-checking with `TS2554` ("Expected 1 arguments, but got N") and `TS2339` ("Property
  'raw' does not exist").

  The generated `dts` is now aligned with the runtime so that both forms type-check, and `css.raw` returns
  `SystemStyleObject` so it composes cleanly with `Record<Variant, SystemStyleObject>` patterns and
  `cx(css(...), externalClassName)` migrations:

  ```ts
  import type { SystemStyleObject } from '../types/index'

  type Styles = { raw: readonly string[] | ArrayLike<string> } | SystemStyleObject | boolean | null | undefined

  interface CssRawFunction {
    (...styles: Styles[]): SystemStyleObject
  }

  interface CssFunction {
    (...styles: Styles[]): string

    raw: CssRawFunction
  }

  export declare const css: CssFunction
  ```

  Closes #3534.

- Updated dependencies [2f29aa6]
- Updated dependencies [2ea9205]
  - @bamboocss/core@1.11.1
  - @bamboocss/types@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/token-dictionary@1.11.1
  - @bamboocss/is-valid-prop@1.11.1
  - @bamboocss/shared@1.11.1

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

### Patch Changes

- Updated dependencies [055e69c]
- Updated dependencies [78869ae]
  - @bamboocss/core@1.11.0
  - @bamboocss/types@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/token-dictionary@1.11.0
  - @bamboocss/is-valid-prop@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 8d3b6f8: Add support for generating theme tokens in `bamboo spec` output.

  Previously, tokens defined in the `themes` config were excluded from the spec output because they are registered as
  virtual tokens. Now, `bamboo spec` generates a `themes.json` file containing tokens and semantic tokens for each
  configured theme.

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [bc2b8d7]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0
  - @bamboocss/core@1.10.0
  - @bamboocss/token-dictionary@1.10.0
  - @bamboocss/is-valid-prop@1.10.0

## 1.9.1

### Patch Changes

- Updated dependencies [d02fcf6]
- Updated dependencies [8fda1a5]
  - @bamboocss/token-dictionary@1.9.1
  - @bamboocss/core@1.9.1
  - @bamboocss/is-valid-prop@1.9.1
  - @bamboocss/logger@1.9.1
  - @bamboocss/shared@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- 7d66c0b: Wrap enum pattern property types with `ConditionalValue` again so generated pattern typings remain
  conditional-safe.
- Updated dependencies [3ca1f24]
- Updated dependencies [7d66c0b]
  - @bamboocss/core@1.9.0
  - @bamboocss/is-valid-prop@1.9.0
  - @bamboocss/logger@1.9.0
  - @bamboocss/shared@1.9.0
  - @bamboocss/token-dictionary@1.9.0
  - @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
- Updated dependencies [82d23ab]
  - @bamboocss/types@1.8.2
  - @bamboocss/is-valid-prop@1.8.2
  - @bamboocss/core@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/token-dictionary@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/core@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/token-dictionary@1.8.1
  - @bamboocss/is-valid-prop@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/core@1.8.0
- @bamboocss/is-valid-prop@1.8.0
- @bamboocss/logger@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/token-dictionary@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/core@1.7.3
- @bamboocss/is-valid-prop@1.7.3
- @bamboocss/logger@1.7.3
- @bamboocss/shared@1.7.3
- @bamboocss/token-dictionary@1.7.3
- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/core@1.7.2
- @bamboocss/is-valid-prop@1.7.2
- @bamboocss/logger@1.7.2
- @bamboocss/shared@1.7.2
- @bamboocss/token-dictionary@1.7.2
- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- 3f5fea2: ### Spec
  - Fixed issue in recipe specs where boolean variant values were incorrectly formatted with quotes (e.g.,
    `button({ primary: true })` instead of `button({ primary: 'true' })`)
  - Updated color palette spec generation to dynamically discover and use actual available tokens
  - @bamboocss/core@1.7.1
  - @bamboocss/is-valid-prop@1.7.1
  - @bamboocss/logger@1.7.1
  - @bamboocss/shared@1.7.1
  - @bamboocss/token-dictionary@1.7.1
  - @bamboocss/types@1.7.1

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

### Patch Changes

- f37fd8d: Fix `cssgen --splitting` not fully respecting `staticCss: { recipes: "*" }`.
  - When `staticCss: { recipes: "*" }` is set globally, individual recipes with their own `staticCss` property would
    override the global wildcard, potentially omitting variants.
  - Split CSS generation was missing recipes that only have base styles (no variants).

- Updated dependencies [86b30b1]
- Updated dependencies [f37fd8d]
  - @bamboocss/types@1.7.0
  - @bamboocss/core@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/token-dictionary@1.7.0
  - @bamboocss/is-valid-prop@1.7.0
  - @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [8f43369]
  - @bamboocss/core@1.6.1
  - @bamboocss/is-valid-prop@1.6.1
  - @bamboocss/logger@1.6.1
  - @bamboocss/shared@1.6.1
  - @bamboocss/token-dictionary@1.6.1
  - @bamboocss/types@1.6.1

## 1.6.0

### Minor Changes

- 8aa3c64: Add `--splitting` flag to `cssgen` command for per-layer CSS output.

  When enabled, CSS is emitted as separate files instead of a single `styles.css`:

  ```
  styled-system/
  ├── styles.css              # @layer declaration + @imports
  └── styles/
      ├── reset.css           # Preflight/reset CSS
      ├── global.css          # Global CSS
      ├── tokens.css          # Design tokens
      ├── utilities.css       # Utility classes
      ├── recipes/
      │   ├── index.css       # @imports all recipe files
      │   └── {recipe}.css    # Individual recipe styles
      └── themes/
          └── {theme}.css     # Theme tokens (not auto-imported)
  ```

  Usage:

  ```bash
  bamboo cssgen --splitting
  ```

### Patch Changes

- @bamboocss/core@1.6.0
- @bamboocss/is-valid-prop@1.6.0
- @bamboocss/logger@1.6.0
- @bamboocss/shared@1.6.0
- @bamboocss/token-dictionary@1.6.0
- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- bd2f8c9: fix(solid): allow defaultProps to be an Accessor
- 827566b: - **Style Context**:
  - Improve `createStyleContext` error messages to include component name, slot, and recipe name when Provider is
    missing.
  - Fix TypeScript types for `withProvider` and `withContext` to include the `as` prop, matching the behavior of the
    `styled` factory.
  - @bamboocss/core@1.5.1
  - @bamboocss/is-valid-prop@1.5.1
  - @bamboocss/logger@1.5.1
  - @bamboocss/shared@1.5.1
  - @bamboocss/token-dictionary@1.5.1
  - @bamboocss/types@1.5.1

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

### Patch Changes

- 52e2399: Fix TypeScript error when using `data-*` attributes in `defaultProps` for `createStyleContext` and JSX
  factory functions.

  ```tsx
  const TabsList = withContext(TabsPrimitive.List, 'list', {
    defaultProps: {
      'data-slot': 'tabs-list', // now works without type errors
    },
  })
  ```

- Updated dependencies [91c65ff]
  - @bamboocss/types@1.5.0
  - @bamboocss/token-dictionary@1.5.0
  - @bamboocss/core@1.5.0
  - @bamboocss/logger@1.5.0
  - @bamboocss/is-valid-prop@1.5.0
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- bb32028: Fix "Browserslist: caniuse-lite is outdated" warning by updating `browserslist` and PostCSS-related packages:
  - Update `browserslist` from 4.23.3 to 4.24.4
  - Update `postcss` from 8.4.49 to 8.5.6
  - Update `postcss-nested` from 6.0.1 to 7.0.2
  - Update `postcss-merge-rules` from 7.0.4 to 7.0.6
  - Update other PostCSS plugins to latest patch versions

  This resolves the outdated `caniuse-lite` warning that appeared when using lightningcss without affecting CSS output
  or requiring snapshot updates.

- 58f492a: **Style Context (Solid)**
  - Fix issue where `withProvider` does not properly provide context leading to runtime errors when wrapping headless
    component libraries like Ark UI.
  - Refactor `withProvider` and `withContext` types to ensure required props are properly extracted from the component
    props.

- Updated dependencies [bb32028]
- Updated dependencies [84a0de9]
  - @bamboocss/core@1.4.3
  - @bamboocss/is-valid-prop@1.4.3
  - @bamboocss/logger@1.4.3
  - @bamboocss/shared@1.4.3
  - @bamboocss/token-dictionary@1.4.3
  - @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- 0679f6f: Fix issue where `create-recipe.mjs` helper was not generated when adding the first recipe to a project that
  previously had no recipes.
- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.
- Updated dependencies [1290a27]
- Updated dependencies [70420dd]
  - @bamboocss/shared@1.4.2
  - @bamboocss/token-dictionary@1.4.2
  - @bamboocss/core@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/is-valid-prop@1.4.2
  - @bamboocss/logger@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [db237b6]
  - @bamboocss/core@1.4.1
  - @bamboocss/is-valid-prop@1.4.1
  - @bamboocss/logger@1.4.1
  - @bamboocss/shared@1.4.1
  - @bamboocss/token-dictionary@1.4.1
  - @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- ce12373: Refactor the type signature of `defineStyles` to return the object passed to it. This improves its
  composition with `defineRecipe` and `defineSlotRecipe`
- Updated dependencies [4c291ca]
  - @bamboocss/core@1.4.0
  - @bamboocss/is-valid-prop@1.4.0
  - @bamboocss/logger@1.4.0
  - @bamboocss/shared@1.4.0
  - @bamboocss/token-dictionary@1.4.0
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- e0fca65: Fixes issue where `defaultProps` was not supported in `withRootProvider` across all framework implementations
  (React, Preact, Vue, Solid)

  ```tsx
  const RootProvider = withRootProvider(Component, {
    defaultProps: {
      className: 'root-provider',
      // other default props
    },
  })
  ```

- ff9afbc: - **Style Context**: Fix type issue where `withRootProvider` from style context incorrectly allowed JSX style
  props to be passed through to the root component.
  - **React**: Fix issue where combining wrapping a style context component with `styled` caused `ref` to be incorrectly
    typed

- 5bfaef3: Correct exposed type from the generator that was causing errors in the generated .d.ts files.
- Updated dependencies [7fcd100]
  - @bamboocss/core@1.3.1
  - @bamboocss/is-valid-prop@1.3.1
  - @bamboocss/logger@1.3.1
  - @bamboocss/shared@1.3.1
  - @bamboocss/token-dictionary@1.3.1
  - @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- 7eaeb3c: Added `as` prop to JSX types for polymorphic component support to enable basic polymorphic components.

  **Note:** The `as` prop does not infer types of the target element.

- 2e683fa: Fix issue where specifying `defaultProps.children` in the `styled` or `createStyleContext` factories makes it
  impossible to override children.

  The fix ensures that explicitly passed children take precedence over default children in React, Preact, and Qwik JSX
  factories.

- 43be051: Fix TypeScript types for `defaultProps` in `withProvider` and `withContext` to be partial
- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0
  - @bamboocss/core@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/token-dictionary@1.3.0
  - @bamboocss/is-valid-prop@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- a1f5c64: - Add reset styles for `::selection` pseudo element that maps to `var(--global-color-selection, revert)`.
  - Add support for `unstyled` prop in the `styled` factory. This makes it possible to opt out recipe styles as needed.

  ```tsx
  const Notice = styled('div', {
    base: {
      bg: 'red',
      color: 'white',
    },
  })

  // This will remove the recipe styles and only apply the inline styles
  <Notice unstyled bg="pink" color="green">
    Hello
  </Notice>
  ```

  - @bamboocss/core@1.2.0
  - @bamboocss/is-valid-prop@1.2.0
  - @bamboocss/logger@1.2.0
  - @bamboocss/shared@1.2.0
  - @bamboocss/token-dictionary@1.2.0
  - @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0
  - @bamboocss/shared@1.1.0
  - @bamboocss/core@1.1.0
  - @bamboocss/logger@1.1.0
  - @bamboocss/token-dictionary@1.1.0
  - @bamboocss/is-valid-prop@1.1.0

## 1.0.1

### Patch Changes

- d236e21: - **createStyleContext**: Ensure the `defaultProps.className` is applied correctly when no explicit `class`
  prop is provided
  - @bamboocss/core@1.0.1
  - @bamboocss/is-valid-prop@1.0.1
  - @bamboocss/logger@1.0.1
  - @bamboocss/shared@1.0.1
  - @bamboocss/token-dictionary@1.0.1
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
  - @bamboocss/core@1.0.0
  - @bamboocss/is-valid-prop@1.0.0
  - @bamboocss/logger@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/token-dictionary@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- 941a208: Fix TS generated pattern dts code when `strict: true` is set.
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

- fdf5142: Fix issue where `borderWidth` token reference adds an extra `px` to the generated css value
- Updated dependencies [efa060d]
- Updated dependencies [d2aede5]
- Updated dependencies [fdf5142]
  - @bamboocss/shared@0.54.0
  - @bamboocss/token-dictionary@0.54.0
  - @bamboocss/core@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/is-valid-prop@0.54.0
  - @bamboocss/logger@0.54.0

## 0.53.7

### Patch Changes

- a67f920: This change fixes a issue where if two themes had shared a similar start name, both would be outputted in the
  token generation process
- Updated dependencies [5e5af6b]
- Updated dependencies [9453c9b]
  - @bamboocss/core@0.53.7
  - @bamboocss/is-valid-prop@0.53.7
  - @bamboocss/logger@0.53.7
  - @bamboocss/shared@0.53.7
  - @bamboocss/token-dictionary@0.53.7
  - @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- a292e9a: Fix issue where generated type for `CssVarKeys` was incorrect resulting in partial autocompletion
  - @bamboocss/core@0.53.6
  - @bamboocss/is-valid-prop@0.53.6
  - @bamboocss/logger@0.53.6
  - @bamboocss/shared@0.53.6
  - @bamboocss/token-dictionary@0.53.6
  - @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- fe3e943: - **React, Preact, Qwik, Solid**: Improve style composition when creating multiple `styled` instances
  - **Vue**: Fix issue where template literal syntax doesn't work
  - @bamboocss/core@0.53.5
  - @bamboocss/is-valid-prop@0.53.5
  - @bamboocss/logger@0.53.5
  - @bamboocss/shared@0.53.5
  - @bamboocss/token-dictionary@0.53.5
  - @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- a2bc49d: - Fix issue where input placeholder styles cause crash in Safari `16.5`
  - Fix issue where `mergeProps` can cause DoS due to prototype pollution
- Updated dependencies [57343c1]
  - @bamboocss/core@0.53.4
  - @bamboocss/is-valid-prop@0.53.4
  - @bamboocss/logger@0.53.4
  - @bamboocss/shared@0.53.4
  - @bamboocss/token-dictionary@0.53.4
  - @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- 00aa868: Add cursor utility config
  - @bamboocss/core@0.53.3
  - @bamboocss/is-valid-prop@0.53.3
  - @bamboocss/logger@0.53.3
  - @bamboocss/shared@0.53.3
  - @bamboocss/token-dictionary@0.53.3
  - @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/core@0.53.2
- @bamboocss/is-valid-prop@0.53.2
- @bamboocss/logger@0.53.2
- @bamboocss/shared@0.53.2
- @bamboocss/token-dictionary@0.53.2
- @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/core@0.53.1
- @bamboocss/is-valid-prop@0.53.1
- @bamboocss/logger@0.53.1
- @bamboocss/shared@0.53.1
- @bamboocss/token-dictionary@0.53.1
- @bamboocss/types@0.53.1

## 0.53.0

### Minor Changes

- 5286731: Add support for recent baseline and experimental css properties:
  - **Size interpolation:** fieldSizing, interpolateSize
  - **Text rendering:** textWrapMode, textWrapStyle and textSpacingTrim
  - **[Experimental] Anchor positioning:** anchorName, anchorScope, positionAnchor, positionArea, positionTry,
    positionTryFallback, positionTryOrder, positionVisibility

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/is-valid-prop@0.53.0
  - @bamboocss/types@0.53.0
  - @bamboocss/core@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/token-dictionary@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/core@0.52.0
- @bamboocss/is-valid-prop@0.52.0
- @bamboocss/logger@0.52.0
- @bamboocss/shared@0.52.0
- @bamboocss/token-dictionary@0.52.0
- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/core@0.51.1
- @bamboocss/is-valid-prop@0.51.1
- @bamboocss/logger@0.51.1
- @bamboocss/shared@0.51.1
- @bamboocss/token-dictionary@0.51.1
- @bamboocss/types@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0
  - @bamboocss/core@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/token-dictionary@0.51.0
  - @bamboocss/is-valid-prop@0.51.0
  - @bamboocss/shared@0.51.0

## 0.50.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
- Updated dependencies [7c85ac7]
  - @bamboocss/types@0.50.0
  - @bamboocss/token-dictionary@0.50.0
  - @bamboocss/core@0.50.0
  - @bamboocss/logger@0.50.0
  - @bamboocss/is-valid-prop@0.50.0
  - @bamboocss/shared@0.50.0

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

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/types@0.49.0
  - @bamboocss/core@0.49.0
  - @bamboocss/logger@0.49.0
  - @bamboocss/token-dictionary@0.49.0
  - @bamboocss/is-valid-prop@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- af9715a: Fix issue where `scrollbarGutter` property incorrectly referenced spacing tokens. The only valid values are
  `auto`, `stable`, and `both-edges`.
  - @bamboocss/core@0.48.1
  - @bamboocss/is-valid-prop@0.48.1
  - @bamboocss/logger@0.48.1
  - @bamboocss/shared@0.48.1
  - @bamboocss/token-dictionary@0.48.1
  - @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- 2bc12d2: Fix multi-theme issue where calling the `getTheme` function throws a Vite error due to invalid dynamic import
  format.

  ```js
  import { getTheme } from 'styled-system/themes'

  getTheme('default')
  // -> The above dynamic import cannot be analyzed by Vite.
  ```

  - @bamboocss/core@0.48.0
  - @bamboocss/is-valid-prop@0.48.0
  - @bamboocss/logger@0.48.0
  - @bamboocss/shared@0.48.0
  - @bamboocss/token-dictionary@0.48.0
  - @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [144113f]
  - @bamboocss/token-dictionary@0.47.1
  - @bamboocss/core@0.47.1
  - @bamboocss/is-valid-prop@0.47.1
  - @bamboocss/logger@0.47.1
  - @bamboocss/shared@0.47.1
  - @bamboocss/types@0.47.1

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

### Patch Changes

- ff8602f: Improve preflight css such that elements with `hidden=until-found` are visible. Previously, we always hide
  all elements with the `hidden` attribute
- Updated dependencies [5e683ee]
  - @bamboocss/token-dictionary@0.47.0
  - @bamboocss/types@0.47.0
  - @bamboocss/core@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/is-valid-prop@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- Updated dependencies [9fbd2d8]
  - @bamboocss/core@0.46.1
  - @bamboocss/is-valid-prop@0.46.1
  - @bamboocss/logger@0.46.1
  - @bamboocss/shared@0.46.1
  - @bamboocss/token-dictionary@0.46.1
  - @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- b7ed157: fix: use sizing tokens for flexBasis instead of spacing tokens
- Updated dependencies [54426a2]
- Updated dependencies [54426a2]
  - @bamboocss/core@0.46.0
  - @bamboocss/shared@0.46.0
  - @bamboocss/token-dictionary@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/is-valid-prop@0.46.0
  - @bamboocss/logger@0.46.0

## 0.45.2

### Patch Changes

- 8c276ff: make `WithEscapeHatch<T>` much more performant

  This pull request is a follow-up pull request to #2466.

  Make `WithEscapeHatch<T>` much more performant and typescript happy by updating the type signature of
  `WithImportant<T>` and `WithColorOpacityModifier<T>` to use _branded type_ and _non-distributive conditional types_,
  while keeping such tokens valid and also not appearing in autocompletions to prevent them from polluting
  autocompletion result (which is the current behavior).
  - @bamboocss/core@0.45.2
  - @bamboocss/is-valid-prop@0.45.2
  - @bamboocss/logger@0.45.2
  - @bamboocss/shared@0.45.2
  - @bamboocss/token-dictionary@0.45.2
  - @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- Updated dependencies [3439ecf]
  - @bamboocss/token-dictionary@0.45.1
  - @bamboocss/core@0.45.1
  - @bamboocss/is-valid-prop@0.45.1
  - @bamboocss/logger@0.45.1
  - @bamboocss/shared@0.45.1
  - @bamboocss/types@0.45.1

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

### Patch Changes

- Updated dependencies [dcc9053]
- Updated dependencies [a21fcfe]
- Updated dependencies [1e4da63]
- Updated dependencies [552dd4b]
  - @bamboocss/types@0.45.0
  - @bamboocss/token-dictionary@0.45.0
  - @bamboocss/core@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/logger@0.45.0
  - @bamboocss/is-valid-prop@0.45.0

## 0.44.0

### Patch Changes

- a8c0cde: Replace `JSX` with `React.JSX` for better React 19 support
- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0
  - @bamboocss/core@0.44.0
  - @bamboocss/logger@0.44.0
  - @bamboocss/token-dictionary@0.44.0
  - @bamboocss/is-valid-prop@0.44.0
  - @bamboocss/shared@0.44.0

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

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0
  - @bamboocss/core@0.43.0
  - @bamboocss/logger@0.43.0
  - @bamboocss/token-dictionary@0.43.0
  - @bamboocss/is-valid-prop@0.43.0
  - @bamboocss/shared@0.43.0

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

- 17a1932: [BREAKING] Removed the legacy `config.optimize` option because it was redundant. Now, we always optimize the
  generated CSS where possible.
- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [ec64819]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0
  - @bamboocss/core@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/token-dictionary@0.42.0
  - @bamboocss/is-valid-prop@0.42.0
  - @bamboocss/shared@0.42.0

## 0.41.0

### Minor Changes

- af8a29a: Annotate config recipe default variants with the `@default` js doc comment. This makes it easy to know the
  default value of a variant.

### Patch Changes

- Updated dependencies [2750261]
  - @bamboocss/core@0.41.0
  - @bamboocss/types@0.41.0
  - @bamboocss/is-valid-prop@0.41.0
  - @bamboocss/logger@0.41.0
  - @bamboocss/shared@0.41.0
  - @bamboocss/token-dictionary@0.41.0

## 0.40.1

### Patch Changes

- d2cc156: Fix issue where using `jsxStyleProps: none` with the generated jsx patterns, lead to unoptimized code that
  causes the component to be recreated on every render.
- Updated dependencies [d2cc156]
  - @bamboocss/core@0.40.1
  - @bamboocss/is-valid-prop@0.40.1
  - @bamboocss/logger@0.40.1
  - @bamboocss/shared@0.40.1
  - @bamboocss/token-dictionary@0.40.1
  - @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- Updated dependencies [5dcdae4]
  - @bamboocss/core@0.40.0
  - @bamboocss/is-valid-prop@0.40.0
  - @bamboocss/logger@0.40.0
  - @bamboocss/shared@0.40.0
  - @bamboocss/token-dictionary@0.40.0
  - @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 39c305f: Vue JSX: Fix issue where using custom `jsxFactory` name causes a runtime error
- Updated dependencies [1f636eb]
- Updated dependencies [8b07cdf]
  - @bamboocss/shared@0.39.2
  - @bamboocss/core@0.39.2
  - @bamboocss/token-dictionary@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/is-valid-prop@0.39.2
  - @bamboocss/logger@0.39.2

## 0.39.1

### Patch Changes

- 99be6f1: Fix `css.raw` typings after recent ([0.39.0](https://github.com/gajus/bamboocss/discussions/2560)) changes
  allowing arrays of `SystemStyleObject`
  - @bamboocss/core@0.39.1
  - @bamboocss/is-valid-prop@0.39.1
  - @bamboocss/logger@0.39.1
  - @bamboocss/shared@0.39.1
  - @bamboocss/token-dictionary@0.39.1
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

- 221c9a2: Add support for more typography related properties in text styles such as `fontFeatureSettings`,
  `fontPalette`, etc.

### Patch Changes

- 0714f31: Fix issue where `mergeCss` import in `styled-system/jsx/*` could be unused.
- 2116abe: Fix issue where `float` property did not allow inherited values (auto, initial, none, etc.)
- c3e797e: Fix issue where `animationName` property was not connected to `theme.keyframes`, as a result, no
  autocompletion was available.
- 935ec86: Allow passing arrays of `SystemStyleObject` to the `css(xxx, [aaa, bbb, ccc], yyy)` fn

  This is useful when you are creating your own styled component and want to benefit
  [from the recent `css` array property support](https://github.com/gajus/bamboocss/pull/2515).

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

- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/types@0.39.0
  - @bamboocss/core@0.39.0
  - @bamboocss/shared@0.39.0
  - @bamboocss/logger@0.39.0
  - @bamboocss/token-dictionary@0.39.0
  - @bamboocss/is-valid-prop@0.39.0

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

- 1e50336: Fix type import
- b1e9e36: - Fix css reset regressions where:
  - first letter gets a different color
  - input or select gets a default border
- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
- Updated dependencies [7a96298]
- Updated dependencies [2c8b933]
  - @bamboocss/types@0.38.0
  - @bamboocss/core@0.38.0
  - @bamboocss/token-dictionary@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/logger@0.38.0
  - @bamboocss/is-valid-prop@0.38.0

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

- b3beef4: Make `WithImportant<T>` more performant and ensure typescript is happy. This changes will make code
  autocompletion and ts-related linting much faster than before.
- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2
  - @bamboocss/core@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/token-dictionary@0.37.2
  - @bamboocss/is-valid-prop@0.37.2
  - @bamboocss/shared@0.37.2

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

- Updated dependencies [93dc9f5]
- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/token-dictionary@0.37.1
  - @bamboocss/types@0.37.1
  - @bamboocss/shared@0.37.1
  - @bamboocss/core@0.37.1
  - @bamboocss/logger@0.37.1
  - @bamboocss/is-valid-prop@0.37.1

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

- 4e6cf85: Add missing typings for CSS vars in properties bound to utilities (and that are not part of the list affected
  by `strictPropertyValues`)
- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/shared@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/core@0.37.0
  - @bamboocss/token-dictionary@0.37.0
  - @bamboocss/logger@0.37.0
  - @bamboocss/is-valid-prop@0.37.0

## 0.36.1

### Patch Changes

- bd0cb07: Fix theme variants typings
- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1
  - @bamboocss/core@0.36.1
  - @bamboocss/logger@0.36.1
  - @bamboocss/token-dictionary@0.36.1
  - @bamboocss/is-valid-prop@0.36.1
  - @bamboocss/shared@0.36.1

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

- 656ff02: Fix `strictPropertyValues` typings should allow for `CssVars` (either predefined from `globalVars` or any
  custom CSS variable)

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    strictPropertyValues: true,
    globalVars: {
      extend: {
        '--some-color': 'red',
        '--button-color': {
          syntax: '<color>',
          inherits: false,
          initialValue: 'blue',
        },
      },
    },
  })
  ```

  ```ts
  css({
    // ❌ was not allowed before when `strictPropertyValues` was enabled
    display: 'var(--button-color)', // ✅ will now be allowed/suggested
  })
  ```

  If no `globalVars` are defined, any `var(--*)` will be allowed

  ```ts
  css({
    // ✅ will be allowed
    display: 'var(--xxx)',
  })
  ```

- 340f4f1: Fix `Expression produces a union type that is too complex to represent` with `splitCssProps` because of
  `JsxStyleProps` type
- Updated dependencies [3af3940]
- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/token-dictionary@0.36.0
  - @bamboocss/types@0.36.0
  - @bamboocss/core@0.36.0
  - @bamboocss/is-valid-prop@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- 5585696: Allow using `!` or `!important` when using `strictTokens: true` (without TS throwing an error)
- 44589ec: Change the `styled-system/token` JS token function to use raw value for semanticToken that do not have
  conditions other than `base`

  ```ts
  export default defineConfig({
    semanticTokens: {
      colors: {
        blue: { value: 'blue' },
        green: {
          value: {
            base: 'green',
            _dark: 'white',
          },
        },
        red: {
          value: {
            base: 'red',
          },
        },
      },
    },
  })
  ```

  This is the output of the `styled-system/token` JS token function:

  ```diff
  const tokens = {
      "colors.blue": {
  -     "value": "var(--colors-blue)",
  +     "value": "blue",
        "variable": "var(--colors-blue)"
      },
      "colors.green": {
        "value": "var(--colors-green)",
        "variable": "var(--colors-green)"
      },
      "colors.red": {
  -     "value": "var(--colors-red)",
  +     "value": "red",
        "variable": "var(--colors-red)"
      },
  }
  ```

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

- Updated dependencies [f2fdc48]
- Updated dependencies [50db354]
- Updated dependencies [c459b43]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/token-dictionary@0.35.0
  - @bamboocss/types@0.35.0
  - @bamboocss/core@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/is-valid-prop@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- 39f529e: Allow color opacity modifier when using `strictTokens`, e.g `color: "blue.200/50"` will not throw a TS error
  anymore
- 4576a60: Fix nested `styled` factory composition

  ```tsx
  import { styled } from '../styled-system/jsx'

  const BasicBox = styled('div', { base: { fontSize: '10px' } })
  const ExtendedBox1 = styled(BasicBox, { base: { fontSize: '20px' } })
  const ExtendedBox2 = styled(ExtendedBox1, { base: { fontSize: '30px' } })

  export const App = () => {
    return (
      <>
        {/* ✅ fs_10px */}
        <BasicBox>text1</BasicBox>
        {/* ✅ fs_20px */}
        <ExtendedBox1>text2</ExtendedBox1>
        {/* BEFORE: ❌ fs_10px fs_30px */}
        {/* NOW: ✅ fs_30px */}
        <ExtendedBox2>text3</ExtendedBox2>
      </>
    )
  }
  ```

  - @bamboocss/core@0.34.3
  - @bamboocss/is-valid-prop@0.34.3
  - @bamboocss/logger@0.34.3
  - @bamboocss/shared@0.34.3
  - @bamboocss/token-dictionary@0.34.3
  - @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- a48f963: Fix `strictPropertyValues` with border\* properties

  We had listed `border\*` properties as affected by `strictPropertyValues` but they shouldn't be restricted as their
  syntax is too complex to be restricted. This removes any `border*` properties that do not specifically end with
  `Style` like `borderTopStyle`.

  ```ts
  import { css } from '../styled-system/css'

  css({
    borderTop: '1px solid red', // ✅ will now be fine as it should be
    borderTopStyle: 'abc', // ✅ will still report a TS error
  })
  ```

  ```diff

    type StrictableProps =
      | 'alignContent'
      | 'alignItems'
      | 'alignSelf'
      | 'all'
      | 'animationComposition'
      | 'animationDirection'
      | 'animationFillMode'
      | 'appearance'
      | 'backfaceVisibility'
      | 'backgroundAttachment'
      | 'backgroundClip'
      | 'borderCollapse'
  -    | 'border'
  -    | 'borderBlock'
  -    | 'borderBlockEnd'
  -    | 'borderBlockStart'
  -    | 'borderBottom'
  -    | 'borderInline'
  -    | 'borderInlineEnd'
  -    | 'borderInlineStart'
  -    | 'borderLeft'
  -    | 'borderRight'
  -    | 'borderTop'
      | 'borderBlockEndStyle'
      | 'borderBlockStartStyle'
      | 'borderBlockStyle'
      | 'borderBottomStyle'
      | 'borderInlineEndStyle'
      | 'borderInlineStartStyle'
      | 'borderInlineStyle'
      | 'borderLeftStyle'
      | 'borderRightStyle'
      | 'borderTopStyle'
      | 'boxDecorationBreak'
      | 'boxSizing'
      | 'breakAfter'
      | 'breakBefore'
      | 'breakInside'
      | 'captionSide'
      | 'clear'
      | 'columnFill'
      | 'columnRuleStyle'
      | 'contentVisibility'
      | 'direction'
      | 'display'
      | 'emptyCells'
      | 'flexDirection'
      | 'flexWrap'
      | 'float'
      | 'fontKerning'
      | 'forcedColorAdjust'
      | 'isolation'
      | 'lineBreak'
      | 'mixBlendMode'
      | 'objectFit'
      | 'outlineStyle'
      | 'overflow'
      | 'overflowX'
      | 'overflowY'
      | 'overflowBlock'
      | 'overflowInline'
      | 'overflowWrap'
      | 'pointerEvents'
      | 'position'
      | 'resize'
      | 'scrollBehavior'
      | 'touchAction'
      | 'transformBox'
      | 'transformStyle'
      | 'userSelect'
      | 'visibility'
      | 'wordBreak'
      | 'writingMode'
  ```

- Updated dependencies [0bf09f2]
  - @bamboocss/core@0.34.2
  - @bamboocss/types@0.34.2
  - @bamboocss/is-valid-prop@0.34.2
  - @bamboocss/logger@0.34.2
  - @bamboocss/shared@0.34.2
  - @bamboocss/token-dictionary@0.34.2

## 0.34.1

### Patch Changes

- d4942e0: Fix the color opacity modifier syntax for `semanticTokens` inside of conditions

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    conditions: {
      light: '.light &',
      dark: '.dark &',
    },
    theme: {
      tokens: {
        colors: {
          blue: { 500: { value: 'blue' } },
          green: { 500: { value: 'green' } },
        },
        opacity: {
          half: { value: 0.5 },
        },
      },
      semanticTokens: {
        colors: {
          secondary: {
            value: {
              base: 'red',
              _light: '{colors.blue.500/32}', // <-- wasn't working as expected
              _dark: '{colors.green.500/half}',
            },
          },
        },
      },
    },
  })
  ```

  will now correctly generate the following CSS:

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-blue-500: blue;
      --colors-green-500: green;
      --opacity-half: 0.5;
      --colors-secondary: red;
    }

    .light {
      --colors-secondary: color-mix(in srgb, var(--colors-blue-500) 32%, transparent);
    }

    .dark {
      --colors-secondary: color-mix(in srgb, var(--colors-green-500) 50%, transparent);
    }
  }
  ```

- Updated dependencies [d4942e0]
  - @bamboocss/token-dictionary@0.34.1
  - @bamboocss/core@0.34.1
  - @bamboocss/is-valid-prop@0.34.1
  - @bamboocss/logger@0.34.1
  - @bamboocss/shared@0.34.1
  - @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- 1c63216: Add a config validation check to prevent using spaces in token keys, show better error logs when there's a
  CSS parsing error
- 7e348ae: Fix `splitCssProps` typings, it would sometimes throw
  `Expression produces a union type that is too complex to represent"`
- Updated dependencies [64d5144]
- Updated dependencies [d1516c8]
  - @bamboocss/token-dictionary@0.34.0
  - @bamboocss/core@0.34.0
  - @bamboocss/types@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/is-valid-prop@0.34.0
  - @bamboocss/shared@0.34.0

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

- 34d94cf: Unify the token path syntax when using `formatTokenName`

  Example with the following config:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path: string[]) => '
  ```

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

- Updated dependencies [a032375]
- Updated dependencies [31071ba]
- Updated dependencies [5184771]
- Updated dependencies [f419993]
- Updated dependencies [6d8c884]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/core@0.32.1
  - @bamboocss/token-dictionary@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/is-valid-prop@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- b32d817: Switch from `em` to `rem` for breakpoints and container queries to prevent side effects.

### Patch Changes

- 60cace3: This change allows the user to set `jsxFramework` to any string to enable extracting JSX components.

  ***

  Context: In a previous version, Bamboo's extractor used to always extract JSX style props even when not specifying a
  `jsxFramework`. This was considered a bug and has been fixed, which reduced the amount of work bamboo does and
  artifacts generated if the user doesn't need jsx.

  Now, in some cases like when using Svelte or Astro, the user might still to use & extract JSX style props, but the
  `jsxFramework` didn't have a way to specify that. This change allows the user to set `jsxFramework` to any string to
  enable extracting JSX components without generating any artifacts.

- Updated dependencies [433a364]
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
- Updated dependencies [b32d817]
  - @bamboocss/core@0.32.0
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/token-dictionary@0.32.0
  - @bamboocss/logger@0.32.0
  - @bamboocss/is-valid-prop@0.32.0

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

- 8f36f9af: Add a `RecipeVariant` type to get the variants in a strict object from `cva` function. This complements the
  `RecipeVariantprops` type that extracts the variant as optional props, mostly intended for JSX components.
- 2d69b340: Fix `styled` factory nested composition with `cva`
- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/core@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/token-dictionary@0.31.0
  - @bamboocss/is-valid-prop@0.31.0

## 0.30.2

### Patch Changes

- 97efdb43: Fix issue where `v-model` does not work in vue styled factory
- 7233cd2e: Fix issue where styled factory in Solid.js could results in `Maximum call stack exceeded` when composing
  with another library that uses the `as` prop.
- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/core@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/token-dictionary@0.30.2
  - @bamboocss/is-valid-prop@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/core@0.30.1
- @bamboocss/is-valid-prop@0.30.1
- @bamboocss/logger@0.30.1
- @bamboocss/shared@0.30.1
- @bamboocss/token-dictionary@0.30.1
- @bamboocss/types@0.30.1

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

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- f778d3e5: You can now set and override `defaultValues` in pattern configurations.

  Here's an example of how to define a new `hstack` pattern with a default `gap` value of `40px`:

  ```js
  defineConfig({
    patterns: {
      hstack: {
        properties: {
          justify: { type: 'property', value: 'justifyContent' },
          gap: { type: 'property', value: 'gap' },
        },
        // you can also use a token like '10'
        defaultValues: { gap: '40px' },
        transform(props) {
          const { justify, gap, ...rest } = props
          return {
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap,
            ...rest,
          }
        },
      },
    },
  })
  ```

### Patch Changes

- 2e32794d: Set `display: none` for hidden elements in `reset` css
- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/is-valid-prop@0.29.0
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

- 1edadf30: Fix issue where `/* @__PURE__ */` annotation threw a warning in Vite build due to incorrect placement.
- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/core@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/is-valid-prop@0.27.1
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

- dce0b3b2: Enhance `splitCssProps` typings
- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/gajus/bamboocss/pull/1986#issuecomment-1887459483) based on the React Profiler.

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/core@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- 6de4c737: Hotfix `strictTokens` after introducing `strictPropertyValues`
  - @bamboocss/core@0.26.1
  - @bamboocss/is-valid-prop@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- a179d74f: tl;dr:
  - `config.strictTokens` will only affect properties that have config tokens, such as `color`, `bg`, `borderColor`,
    etc.
  - `config.strictPropertyValues` is added and will throw for properties that do not have config tokens, such as
    `display`, `content`, `willChange`, etc. when the value is not a predefined CSS value.

  ***

  In version
  [0.19.0 we changed `config.strictTokens`](https://github.com/gajus/bamboocss/blob/main/CHANGELOG.md#0190---2023-11-24)
  typings a bit so that the only property values allowed were the config tokens OR the predefined CSS values, ex: `flex`
  for the property `display`, which prevented typos such as `display: 'aaa'`.

  The problem with this change is that it means you would have to provide every CSS properties a given set of values so
  that TS wouldn't throw any error. Thus, we will partly revert this change and make it so that `config.strictTokens`
  shouldn't affect properties that do not have config tokens, such as `content`, `willChange`, `display`, etc.

  v0.19.0:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ would throw since 'abc' is not part of predefined values of 'display' even thought there is no config token for 'abc'
  ```

  now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will not throw there is no config token for 'abc'
  ```

  Instead, if you want the v.19.0 behavior, you can use the new `config.strictPropertyValues` option. You can combine it
  with `config.strictTokens` if you want to be strict on both properties with config tokens and properties without
  config tokens.

  The new `config.strictPropertyValues` option will only be applied to this exhaustive list of properties:

  ```ts
  type StrictableProps =
    | 'alignContent'
    | 'alignItems'
    | 'alignSelf'
    | 'all'
    | 'animationComposition'
    | 'animationDirection'
    | 'animationFillMode'
    | 'appearance'
    | 'backfaceVisibility'
    | 'backgroundAttachment'
    | 'backgroundClip'
    | 'borderCollapse'
    | 'border'
    | 'borderBlock'
    | 'borderBlockEnd'
    | 'borderBlockStart'
    | 'borderBottom'
    | 'borderInline'
    | 'borderInlineEnd'
    | 'borderInlineStart'
    | 'borderLeft'
    | 'borderRight'
    | 'borderTop'
    | 'borderBlockEndStyle'
    | 'borderBlockStartStyle'
    | 'borderBlockStyle'
    | 'borderBottomStyle'
    | 'borderInlineEndStyle'
    | 'borderInlineStartStyle'
    | 'borderInlineStyle'
    | 'borderLeftStyle'
    | 'borderRightStyle'
    | 'borderTopStyle'
    | 'boxDecorationBreak'
    | 'boxSizing'
    | 'breakAfter'
    | 'breakBefore'
    | 'breakInside'
    | 'captionSide'
    | 'clear'
    | 'columnFill'
    | 'columnRuleStyle'
    | 'contentVisibility'
    | 'direction'
    | 'display'
    | 'emptyCells'
    | 'flexDirection'
    | 'flexWrap'
    | 'float'
    | 'fontKerning'
    | 'forcedColorAdjust'
    | 'isolation'
    | 'lineBreak'
    | 'mixBlendMode'
    | 'objectFit'
    | 'outlineStyle'
    | 'overflow'
    | 'overflowX'
    | 'overflowY'
    | 'overflowBlock'
    | 'overflowInline'
    | 'overflowWrap'
    | 'pointerEvents'
    | 'position'
    | 'resize'
    | 'scrollBehavior'
    | 'touchAction'
    | 'transformBox'
    | 'transformStyle'
    | 'userSelect'
    | 'visibility'
    | 'wordBreak'
    | 'writingMode'
  ```

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [d420c676]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
  - @bamboocss/core@0.24.1
  - @bamboocss/is-valid-prop@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
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

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- d30b1737: Fix issue where style props wouldn't be properly passed when using `config.jsxStyleProps` set to `minimal`
  or `none` with JSX patterns (`Box`, `Stack`, `Flex`, etc.)
- a3b6ed5f: Fix & perf improvement: skip JSX parsing when not using `config.jsxFramework` / skip tagged template literal
  parsing when not using `config.syntax` set to "template-literal"
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/core@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`
- 647f05c9: Fix a typing issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with property-based
  conditionals

  ```ts
  css({
    bg: '[#3B00B9]', // ✅ was okay
    _dark: {
      // ✅ was okay
      color: '[#3B00B9]',
    },

    // ❌ Not okay, will be fixed in this patch
    color: {
      _dark: '[#3B00B9]',
    },
  })
  ```

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
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Minor Changes

- e83afef0: Update csstype to support newer css features

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties
- 9c0d3f8f: Fix regression where `styled-system/jsx/index` had the wrong exports
- c95c40bd: Fix issue where `children` does not work in styled factory's `defaultProps` in React, Preact and Qwik
- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [11753fea]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

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

- d81dcbe6: - Fix an issue where recipe variants that clash with utility shorthand don't get generated due to the
  normalization that happens internally.
  - Fix issue where Preact JSX types are not merging recipes correctly
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

- 052283c2: Fix vue `styled` factory internal class merging, for example:

  ```vue
  <script setup>
  import { styled } from '../styled-system/jsx'

  const StyledButton = styled('button', {
    base: {
      bgColor: 'red.300',
    },
  })
  </script>
  <template>
    <StyledButton id="test" class="test">
      <slot></slot>
    </StyledButton>
  </template>
  ```

  Will now correctly include the `test` class in the final output.

- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
  - @bamboocss/core@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/core@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- e4fdc64a: Fix issue where conditional recipe variant doesn't work as expected
- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 92a7fbe5: Fix issue in preflight where monospace fallback pointed to the wrong variable
- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.
- 402afbee: Improves the `config.strictTokens` type-safety by allowing CSS predefined values (like 'flex' or 'block' for
  the property 'display') and throwing when using anything else than those, if no theme tokens was found on that
  property.

  Before:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ didn't throw even though 'abc' is not a valid value for 'display'
  ```

  Now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will throw since 'abc' is not a valid value for 'display'
  ```

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
- Updated dependencies [9f5711f9]
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- 78b940b2: Fix issue with `forceConsistentTypeExtension` where the `composition.d.mts` had an incorrect type import
  - @bamboocss/core@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/core@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Minor Changes

- b7cb2073: Add a `splitCssProps` utility exported from the {outdir}/jsx entrypoint

  ```tsx
  import { splitCssProps, styled } from '../styled-system/jsx'
  import type { HTMLStyledProps } from '../styled-system/types'

  function SplitComponent({ children, ...props }: HTMLStyledProps<'div'>) {
    const [cssProps, restProps] = splitCssProps(props)
    return (
      <styled.div {...restProps} className={css({ display: 'flex', height: '20', width: '20' }, cssProps)}>
        {children}
      </styled.div>
    )
  }

  // Usage

  function App() {
    return <SplitComponent margin="2">Click me</SplitComponent>
  }
  ```

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline
- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 6718f81b: Fix issue where Solid.js styled factory fails with pattern styles includes a css variable (e.g. Divider)
- 3ce70c37: Fix issue where cva composition in styled components doens't work as expected.
- Updated dependencies [a6dfc944]
  - @bamboocss/core@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/core@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 296d62b1: Change `OmittedHTMLProps` to be empty when using `config.jsxStyleProps` as `minimal` or `none`

  Fixes https://github.com/gajus/bamboocss/issues/1549

- 42520626: Fix issue where conditions don't work in semantic tokens when using template literal syntax.
- 7b981422: Fix issue in reset styles where button does not inherit color style
- 9382e687: remove export types from jsx when no jsxFramework configuration
- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM
- Updated dependencies [aea28c9f]
- Updated dependencies [5ce359f6]
  - @bamboocss/core@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

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

- fbf062c6: Added a new type to extract variants out of styled components

  ```tsx
  import { StyledVariantProps } from '../styled-system/jsx'

  const Button = styled('button', {
    base: { color: 'black' },
    variants: {
      state: {
        error: { color: 'red' },
        success: { color: 'green' },
      },
    },
  })

  type ButtonVariantProps = StyledVariantProps<typeof Button>
  //   ^ { state?: 'error' | 'success' | undefined }
  ```

### Patch Changes

- 93996aaf: Fix an issue with the `@layer tokens` CSS declarations when using `cssVarRoot` with multiple selectors, like
  `root, :host, ::backdrop`
- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 2b5cbf73: correct typings for Qwik components
- Updated dependencies [20f4e204]
  - @bamboocss/core@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- d12aed2b: Fix issue where unused recipes and slot recipes doesn't get treeshaken properly
- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- 3d5971e5: - **Vue**: Fix issue where elements created from styled factory does not forward DOM attributes and events
  to the underlying element.
  - **Vue**: Fix regression in generated types
  - **Preact**: Fix regression in generated types
  - @bamboocss/core@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
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

  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- d34c8b48: Fix issue where HMR does not work for Vue JSX factory and patterns
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

- 1eb31118: Automatically allow overriding config recipe compoundVariants styles within the `styled` JSX factory,
  example below

  With this config recipe:

  ```ts file="bamboo.config.ts"
  const button = defineRecipe({
    className: 'btn',
    base: { color: 'green', fontSize: '16px' },
    variants: {
      size: { small: { fontSize: '14px' } },
    },
    compoundVariants: [{ size: 'small', css: { color: 'blue' } }],
  })
  ```

  This would previously not merge the `color` property overrides, but now it does:

  ```tsx file="example.tsx"
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button)

  function App() {
    return (
      <>
        <Button size="small" color="red.100">
          Click me
        </Button>
      </>
    )
  }
  ```

  - Before: `btn btn--size_small text_blue text_red.100`
  - After: `btn btn--size_small text_red.100`

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- 6d15776c: When bundling the `outdir` in a library, you usually want to generate type declaration files (`d.ts`).
  Sometimes TS will complain about types not being exported.
  - Export all types from `{outdir}/types/index.d.ts`, this fixes errors looking like this:

  ```
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/system-types'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/csstype'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/conditions'. This is likely not portable. A type annotation is necessary.
  ```

  - Export generated recipe interfaces from `{outdir}/recipes/{recipeFn}.d.ts`, this fixes errors looking like this:

  ```
  src/ui/avatar.tsx (16:318) "AvatarRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/avatar.tsx".
  src/ui/card.tsx (2:164) "CardRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/card.tsx".
  src/ui/checkbox.tsx (19:310) "CheckboxRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/checkbox.tsx".
  ```

  - Export type `ComponentProps` from `{outdir}/types/jsx.d.ts`, this fixes errors looking like this:

  ```
   "ComponentProps" is not exported by "styled-system/types/jsx.d.ts", imported by "src/ui/form-control.tsx".
  ```

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property
- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 7e8bcb03: Fix an issue when wrapping a component with `styled` would display its name as `styled.[object Object]`
- 433f88cd: Fix issue in css reset where number input field spinner still show.
- 7499bbd2: Add the property `-moz-osx-font-smoothing: grayscale;` to the `reset.css` under the `html` selector.
- Updated dependencies [848936e0]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/core@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- 93d9ee7e: Refactor: Prefer `NativeElements` type for vue jsx elements
- 35793d85: Fix issue with cva when using compoundVariants and not passing any variants in the usage (ex: `button()`
  with `const button = cva({ ... })`)
- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/gajus/bamboocss/issues/1315

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [bc3b077d]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- bdd30d18: Fix issue where `pattern.raw(...)` did not share the same signature as `pattern(...)`
- bff17df2: Add each condition raw value information on hover using JSDoc annotation
- 6548f4f7: Add missing types (`StyledComponents`, `RecipeConfig`, `PatternConfig` etc) to solve a TypeScript issue (The
  inferred type of xxx cannot be named without a reference...) when generating declaration files in addition to using
  `emitPackage: true`
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 542d1ebc: Change the typings for the `css(...args)` function so that you can pass possibly undefined values to it.

  This is mostly intended for component props that have optional values like `cssProps?: SystemStyleObject` and would
  use it like `css({ ... }, cssProps)`

- 39b20797: Change the `css.raw` function signature to match the one from
  [`css()`](https://github.com/gajus/bamboocss/pull/1264), to allow passing multiple style objects that will be smartly
  merged.
- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- a5d7d514: Add `forceConsistentTypeExtension` config option for enforcing consistent file extension for emitted type
  definition files. This is useful for projects that use `moduleResolution: node16` which requires explicit file
  extensions in imports/exports.

  > If set to `true` and `outExtension` is set to `mjs`, the generated typescript `.d.ts` files will have the extension
  > `.d.mts`.

- 192d5e49: Fix issue where `cva` is undefined in preact styled factory
  - @bamboocss/core@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- a9690110: Fix issue where `defineTextStyle` and `defineLayerStyle` return types are incompatible with `config.theme`
  type.
- 32ceac3f: Fix an issue with custom JSX components not finding their matching patterns
- Updated dependencies [04b5fd6c]
  - @bamboocss/core@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- 6588c8e0: - Change the `css` function signature to allow passing multiple style objects that will be smartly merged.
  - Rename the `{cvaFn}.resolve` function to `{cva}.raw` for API consistency.
  - Change the behaviour of `{patternFn}.raw` to return the resulting `SystemStyleObject` instead of the arguments
    passed in. This is to allow the `css` function to merge the styles correctly.

  ```tsx
  import { css } from '../styled-system/css'
  css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' }) // => mx_10 pt_6
  ```

  > ⚠️ This approach should be preferred for merging styles over the current `cx` function, which will be reverted to
  > its original classname concatenation behaviour.

  ```diff
  import { css, cx } from '../styled-system/css'

  const App = () => {
    return (
      <>
  -      <div className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>
  +      <div className={css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' })}>
          Will result in `class="mx_10 pt_6"`
        </div>
      </>
    )
  }
  ```

  To design a component that supports style overrides, you can now provide the `css` prop as a style object, and it'll
  be merged correctly.

  ```tsx title="src/components/Button.tsx"
  import { css } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css({ display: 'flex', alignItem: 'center', color: 'black' }, cssProp)
    return <button className={className}>{children}</button>
  }
  ```

  Then you can use the `Button` component like this:

  ```tsx title="src/app/page.tsx"
  import { css } from '../../styled-system/css'
  import { Button, Thingy } from './Button'

  export default function Page() {
    return (
      <Button css={{ color: 'pink', _hover: { color: 'red' } }}>
        will result in `class="d_flex items_center text_pink hover:text_red"`
      </Button>
    )
  }
  ```

  ***

  You can use this approach as well with the new `{cvaFn}.raw` and `{patternFn}.raw` functions, will allow style objects
  to be merged as expected in any situation.

  **Pattern Example:**

  ```tsx title="src/components/Button.tsx"
  import { hstack } from '../../styled-system/patterns'
  import { css, cva } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    // using the flex pattern
    const hstackProps = hstack.raw({
      border: '1px solid',
      _hover: { color: 'blue.400' },
    })

    // merging the styles
    const className = css(hstackProps, cssProp)

    return <button className={className}>{children}</button>
  }
  ```

  **CVA Example:**

  ```tsx title="src/components/Button.tsx"
  import { css, cva } from '../../styled-system/css'

  const buttonRecipe = cva({
    base: { display: 'flex', fontSize: 'lg' },
    variants: {
      variant: {
        primary: { color: 'white', backgroundColor: 'blue.500' },
      },
    },
  })

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css(
      // using the button recipe
      buttonRecipe.raw({ variant: 'primary' }),

      // adding style overrides (internal)
      { _hover: { color: 'blue.400' } },

      // adding style overrides (external)
      cssProp,
    )

    return <button className={className}>{props.children}</button>
  }
  ```

- 36fdff89: Fix bug in generated js code for atomic slot recipe produce where `splitVariantProps` didn't work without
  the first slot key.
  - @bamboocss/core@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- 599fbc1a: Fix issue where `AnimationName` type was generated wrongly if keyframes were not resolved
  - @bamboocss/core@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- a41515de: Fix issue where styled factory does not respect union prop types like `type Props = AProps | BProps`
- bf2ff391: Add `animationName` utility
- ad1518b8: fix failed styled component for solid-js when using recipe
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

- dfb3f85f: Add missing svg props types
- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency
- 39b80b49: Fix an issue with the runtime className generation when using an utility that maps to multiple shorthands
- 1dc788bd: Fix issue where some style properties shows TS error when using `!important`
- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- 386e5098: Update `RecipeVariantProps` to support slot recipes
- 6d4eaa68: Refactor code
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
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
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/token-dictionary@0.9.0
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

- 3f1e7e32: Adds the `{recipe}.raw()` in generated runtime
- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- be0ad578: Fix parser issue with TS path mappings
- b75905d8: Improve generated react jsx types to remove legacy ref. This fixes type composition issues.
- 0520ba83: Refactor generated recipe js code
- 156b6bde: Fix issue where generated package json does not respect `outExtension` when `emitPackage` is `true`
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/core@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- cd912f35: Fix `definePattern` module overriden type, was missing an `extends` constraint which lead to a type error:

  ```
  styled-system/types/global.d.ts:14:58 - error TS2344: Type 'T' does not satisfy the constraint 'PatternProperties'.

  14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                                              ~

    styled-system/types/global.d.ts:14:33
      14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                         ~
      This type parameter might need an `extends PatternProperties` constraint.

  ```

- dc4e80f7: Export `isCssProperty` helper function from styled-system/jsx
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

- ef1dd676: Fix issue where `staticCss` did not generate all variants in the array of `css` rules
- b50675ca: Refactor parser to support extracting `css` prop in JSX elements correctly.
- Updated dependencies [12c900ee]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/core@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 53fb0708: Fix `config.staticCss` by filtering types on getPropertyKeys

  It used to throw because of them:

  ```bash
  <css input>:33:21: Missed semicolon
   ELIFECYCLE  Command failed with exit code 1.
  ```

  ```css
  @layer utilities {
      .m_type\:Tokens\[\"spacing\"\] {
          margin: type:Tokens["spacing"]
      }
  }
  ```

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
- b8f8c2a6: Fix reset.css (generated when config has `preflight: true`) import order, always place it first so that it
  can be easily overriden
- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/token-dictionary@0.5.1
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

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

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

- 54a8913c: Fix issue where patterns that include css selectors doesn't work in JSX
- a48e5b00: Add support for watch mode in codegen command via the `--watch` or `-w` flag.

  ```bash
  bamboo codegen --watch
  ```

- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/core@0.3.2
- @bamboocss/is-valid-prop@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/core@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
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
  - @bamboocss/core@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2

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

- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
- Updated dependencies [d5977c24]
  - @bamboocss/types@0.30.0
  - @bamboocss/token-dictionary@0.30.0
  - @bamboocss/shared@0.30.0
  - @bamboocss/core@0.30.0
  - @bamboocss/logger@0.30.0
  - @bamboocss/is-valid-prop@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- f778d3e5: You can now set and override `defaultValues` in pattern configurations.

  Here's an example of how to define a new `hstack` pattern with a default `gap` value of `40px`:

  ```js
  defineConfig({
    patterns: {
      hstack: {
        properties: {
          justify: { type: 'property', value: 'justifyContent' },
          gap: { type: 'property', value: 'gap' },
        },
        // you can also use a token like '10'
        defaultValues: { gap: '40px' },
        transform(props) {
          const { justify, gap, ...rest } = props
          return {
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap,
            ...rest,
          }
        },
      },
    },
  })
  ```

### Patch Changes

- 2e32794d: Set `display: none` for hidden elements in `reset` css
- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/is-valid-prop@0.29.0
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

- 1edadf30: Fix issue where `/* @__PURE__ */` annotation threw a warning in Vite build due to incorrect placement.
- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/core@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/is-valid-prop@0.27.1
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

- dce0b3b2: Enhance `splitCssProps` typings
- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/gajus/bamboocss/pull/1986#issuecomment-1887459483) based on the React Profiler.

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/core@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- 6de4c737: Hotfix `strictTokens` after introducing `strictPropertyValues`
  - @bamboocss/core@0.26.1
  - @bamboocss/is-valid-prop@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- a179d74f: tl;dr:
  - `config.strictTokens` will only affect properties that have config tokens, such as `color`, `bg`, `borderColor`,
    etc.
  - `config.strictPropertyValues` is added and will throw for properties that do not have config tokens, such as
    `display`, `content`, `willChange`, etc. when the value is not a predefined CSS value.

  ***

  In version
  [0.19.0 we changed `config.strictTokens`](https://github.com/gajus/bamboocss/blob/main/CHANGELOG.md#0190---2023-11-24)
  typings a bit so that the only property values allowed were the config tokens OR the predefined CSS values, ex: `flex`
  for the property `display`, which prevented typos such as `display: 'aaa'`.

  The problem with this change is that it means you would have to provide every CSS properties a given set of values so
  that TS wouldn't throw any error. Thus, we will partly revert this change and make it so that `config.strictTokens`
  shouldn't affect properties that do not have config tokens, such as `content`, `willChange`, `display`, etc.

  v0.19.0:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ would throw since 'abc' is not part of predefined values of 'display' even thought there is no config token for 'abc'
  ```

  now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will not throw there is no config token for 'abc'
  ```

  Instead, if you want the v.19.0 behavior, you can use the new `config.strictPropertyValues` option. You can combine it
  with `config.strictTokens` if you want to be strict on both properties with config tokens and properties without
  config tokens.

  The new `config.strictPropertyValues` option will only be applied to this exhaustive list of properties:

  ```ts
  type StrictableProps =
    | 'alignContent'
    | 'alignItems'
    | 'alignSelf'
    | 'all'
    | 'animationComposition'
    | 'animationDirection'
    | 'animationFillMode'
    | 'appearance'
    | 'backfaceVisibility'
    | 'backgroundAttachment'
    | 'backgroundClip'
    | 'borderCollapse'
    | 'border'
    | 'borderBlock'
    | 'borderBlockEnd'
    | 'borderBlockStart'
    | 'borderBottom'
    | 'borderInline'
    | 'borderInlineEnd'
    | 'borderInlineStart'
    | 'borderLeft'
    | 'borderRight'
    | 'borderTop'
    | 'borderBlockEndStyle'
    | 'borderBlockStartStyle'
    | 'borderBlockStyle'
    | 'borderBottomStyle'
    | 'borderInlineEndStyle'
    | 'borderInlineStartStyle'
    | 'borderInlineStyle'
    | 'borderLeftStyle'
    | 'borderRightStyle'
    | 'borderTopStyle'
    | 'boxDecorationBreak'
    | 'boxSizing'
    | 'breakAfter'
    | 'breakBefore'
    | 'breakInside'
    | 'captionSide'
    | 'clear'
    | 'columnFill'
    | 'columnRuleStyle'
    | 'contentVisibility'
    | 'direction'
    | 'display'
    | 'emptyCells'
    | 'flexDirection'
    | 'flexWrap'
    | 'float'
    | 'fontKerning'
    | 'forcedColorAdjust'
    | 'isolation'
    | 'lineBreak'
    | 'mixBlendMode'
    | 'objectFit'
    | 'outlineStyle'
    | 'overflow'
    | 'overflowX'
    | 'overflowY'
    | 'overflowBlock'
    | 'overflowInline'
    | 'overflowWrap'
    | 'pointerEvents'
    | 'position'
    | 'resize'
    | 'scrollBehavior'
    | 'touchAction'
    | 'transformBox'
    | 'transformStyle'
    | 'userSelect'
    | 'visibility'
    | 'wordBreak'
    | 'writingMode'
  ```

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [d420c676]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
  - @bamboocss/core@0.24.1
  - @bamboocss/is-valid-prop@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
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

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- d30b1737: Fix issue where style props wouldn't be properly passed when using `config.jsxStyleProps` set to `minimal`
  or `none` with JSX patterns (`Box`, `Stack`, `Flex`, etc.)
- a3b6ed5f: Fix & perf improvement: skip JSX parsing when not using `config.jsxFramework` / skip tagged template literal
  parsing when not using `config.syntax` set to "template-literal"
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/core@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`
- 647f05c9: Fix a typing issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with property-based
  conditionals

  ```ts
  css({
    bg: '[#3B00B9]', // ✅ was okay
    _dark: {
      // ✅ was okay
      color: '[#3B00B9]',
    },

    // ❌ Not okay, will be fixed in this patch
    color: {
      _dark: '[#3B00B9]',
    },
  })
  ```

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
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Minor Changes

- e83afef0: Update csstype to support newer css features

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties
- 9c0d3f8f: Fix regression where `styled-system/jsx/index` had the wrong exports
- c95c40bd: Fix issue where `children` does not work in styled factory's `defaultProps` in React, Preact and Qwik
- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [11753fea]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

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

- d81dcbe6: - Fix an issue where recipe variants that clash with utility shorthand don't get generated due to the
  normalization that happens internally.
  - Fix issue where Preact JSX types are not merging recipes correctly
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

- 052283c2: Fix vue `styled` factory internal class merging, for example:

  ```vue
  <script setup>
  import { styled } from '../styled-system/jsx'

  const StyledButton = styled('button', {
    base: {
      bgColor: 'red.300',
    },
  })
  </script>
  <template>
    <StyledButton id="test" class="test">
      <slot></slot>
    </StyledButton>
  </template>
  ```

  Will now correctly include the `test` class in the final output.

- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
  - @bamboocss/core@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/core@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- e4fdc64a: Fix issue where conditional recipe variant doesn't work as expected
- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 92a7fbe5: Fix issue in preflight where monospace fallback pointed to the wrong variable
- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.
- 402afbee: Improves the `config.strictTokens` type-safety by allowing CSS predefined values (like 'flex' or 'block' for
  the property 'display') and throwing when using anything else than those, if no theme tokens was found on that
  property.

  Before:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ didn't throw even though 'abc' is not a valid value for 'display'
  ```

  Now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will throw since 'abc' is not a valid value for 'display'
  ```

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
- Updated dependencies [9f5711f9]
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- 78b940b2: Fix issue with `forceConsistentTypeExtension` where the `composition.d.mts` had an incorrect type import
  - @bamboocss/core@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/core@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Minor Changes

- b7cb2073: Add a `splitCssProps` utility exported from the {outdir}/jsx entrypoint

  ```tsx
  import { splitCssProps, styled } from '../styled-system/jsx'
  import type { HTMLStyledProps } from '../styled-system/types'

  function SplitComponent({ children, ...props }: HTMLStyledProps<'div'>) {
    const [cssProps, restProps] = splitCssProps(props)
    return (
      <styled.div {...restProps} className={css({ display: 'flex', height: '20', width: '20' }, cssProps)}>
        {children}
      </styled.div>
    )
  }

  // Usage

  function App() {
    return <SplitComponent margin="2">Click me</SplitComponent>
  }
  ```

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline
- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 6718f81b: Fix issue where Solid.js styled factory fails with pattern styles includes a css variable (e.g. Divider)
- 3ce70c37: Fix issue where cva composition in styled components doens't work as expected.
- Updated dependencies [a6dfc944]
  - @bamboocss/core@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/core@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 296d62b1: Change `OmittedHTMLProps` to be empty when using `config.jsxStyleProps` as `minimal` or `none`

  Fixes https://github.com/gajus/bamboocss/issues/1549

- 42520626: Fix issue where conditions don't work in semantic tokens when using template literal syntax.
- 7b981422: Fix issue in reset styles where button does not inherit color style
- 9382e687: remove export types from jsx when no jsxFramework configuration
- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM
- Updated dependencies [aea28c9f]
- Updated dependencies [5ce359f6]
  - @bamboocss/core@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

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

- fbf062c6: Added a new type to extract variants out of styled components

  ```tsx
  import { StyledVariantProps } from '../styled-system/jsx'

  const Button = styled('button', {
    base: { color: 'black' },
    variants: {
      state: {
        error: { color: 'red' },
        success: { color: 'green' },
      },
    },
  })

  type ButtonVariantProps = StyledVariantProps<typeof Button>
  //   ^ { state?: 'error' | 'success' | undefined }
  ```

### Patch Changes

- 93996aaf: Fix an issue with the `@layer tokens` CSS declarations when using `cssVarRoot` with multiple selectors, like
  `root, :host, ::backdrop`
- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 2b5cbf73: correct typings for Qwik components
- Updated dependencies [20f4e204]
  - @bamboocss/core@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- d12aed2b: Fix issue where unused recipes and slot recipes doesn't get treeshaken properly
- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- 3d5971e5: - **Vue**: Fix issue where elements created from styled factory does not forward DOM attributes and events
  to the underlying element.
  - **Vue**: Fix regression in generated types
  - **Preact**: Fix regression in generated types
  - @bamboocss/core@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
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

  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- d34c8b48: Fix issue where HMR does not work for Vue JSX factory and patterns
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

- 1eb31118: Automatically allow overriding config recipe compoundVariants styles within the `styled` JSX factory,
  example below

  With this config recipe:

  ```ts file="bamboo.config.ts"
  const button = defineRecipe({
    className: 'btn',
    base: { color: 'green', fontSize: '16px' },
    variants: {
      size: { small: { fontSize: '14px' } },
    },
    compoundVariants: [{ size: 'small', css: { color: 'blue' } }],
  })
  ```

  This would previously not merge the `color` property overrides, but now it does:

  ```tsx file="example.tsx"
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button)

  function App() {
    return (
      <>
        <Button size="small" color="red.100">
          Click me
        </Button>
      </>
    )
  }
  ```

  - Before: `btn btn--size_small text_blue text_red.100`
  - After: `btn btn--size_small text_red.100`

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- 6d15776c: When bundling the `outdir` in a library, you usually want to generate type declaration files (`d.ts`).
  Sometimes TS will complain about types not being exported.
  - Export all types from `{outdir}/types/index.d.ts`, this fixes errors looking like this:

  ```
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/system-types'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/csstype'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/conditions'. This is likely not portable. A type annotation is necessary.
  ```

  - Export generated recipe interfaces from `{outdir}/recipes/{recipeFn}.d.ts`, this fixes errors looking like this:

  ```
  src/ui/avatar.tsx (16:318) "AvatarRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/avatar.tsx".
  src/ui/card.tsx (2:164) "CardRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/card.tsx".
  src/ui/checkbox.tsx (19:310) "CheckboxRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/checkbox.tsx".
  ```

  - Export type `ComponentProps` from `{outdir}/types/jsx.d.ts`, this fixes errors looking like this:

  ```
   "ComponentProps" is not exported by "styled-system/types/jsx.d.ts", imported by "src/ui/form-control.tsx".
  ```

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property
- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 7e8bcb03: Fix an issue when wrapping a component with `styled` would display its name as `styled.[object Object]`
- 433f88cd: Fix issue in css reset where number input field spinner still show.
- 7499bbd2: Add the property `-moz-osx-font-smoothing: grayscale;` to the `reset.css` under the `html` selector.
- Updated dependencies [848936e0]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/core@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- 93d9ee7e: Refactor: Prefer `NativeElements` type for vue jsx elements
- 35793d85: Fix issue with cva when using compoundVariants and not passing any variants in the usage (ex: `button()`
  with `const button = cva({ ... })`)
- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/gajus/bamboocss/issues/1315

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [bc3b077d]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- bdd30d18: Fix issue where `pattern.raw(...)` did not share the same signature as `pattern(...)`
- bff17df2: Add each condition raw value information on hover using JSDoc annotation
- 6548f4f7: Add missing types (`StyledComponents`, `RecipeConfig`, `PatternConfig` etc) to solve a TypeScript issue (The
  inferred type of xxx cannot be named without a reference...) when generating declaration files in addition to using
  `emitPackage: true`
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 542d1ebc: Change the typings for the `css(...args)` function so that you can pass possibly undefined values to it.

  This is mostly intended for component props that have optional values like `cssProps?: SystemStyleObject` and would
  use it like `css({ ... }, cssProps)`

- 39b20797: Change the `css.raw` function signature to match the one from
  [`css()`](https://github.com/gajus/bamboocss/pull/1264), to allow passing multiple style objects that will be smartly
  merged.
- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- a5d7d514: Add `forceConsistentTypeExtension` config option for enforcing consistent file extension for emitted type
  definition files. This is useful for projects that use `moduleResolution: node16` which requires explicit file
  extensions in imports/exports.

  > If set to `true` and `outExtension` is set to `mjs`, the generated typescript `.d.ts` files will have the extension
  > `.d.mts`.

- 192d5e49: Fix issue where `cva` is undefined in preact styled factory
  - @bamboocss/core@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- a9690110: Fix issue where `defineTextStyle` and `defineLayerStyle` return types are incompatible with `config.theme`
  type.
- 32ceac3f: Fix an issue with custom JSX components not finding their matching patterns
- Updated dependencies [04b5fd6c]
  - @bamboocss/core@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- 6588c8e0: - Change the `css` function signature to allow passing multiple style objects that will be smartly merged.
  - Rename the `{cvaFn}.resolve` function to `{cva}.raw` for API consistency.
  - Change the behaviour of `{patternFn}.raw` to return the resulting `SystemStyleObject` instead of the arguments
    passed in. This is to allow the `css` function to merge the styles correctly.

  ```tsx
  import { css } from '../styled-system/css'
  css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' }) // => mx_10 pt_6
  ```

  > ⚠️ This approach should be preferred for merging styles over the current `cx` function, which will be reverted to
  > its original classname concatenation behaviour.

  ```diff
  import { css, cx } from '../styled-system/css'

  const App = () => {
    return (
      <>
  -      <div className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>
  +      <div className={css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' })}>
          Will result in `class="mx_10 pt_6"`
        </div>
      </>
    )
  }
  ```

  To design a component that supports style overrides, you can now provide the `css` prop as a style object, and it'll
  be merged correctly.

  ```tsx title="src/components/Button.tsx"
  import { css } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css({ display: 'flex', alignItem: 'center', color: 'black' }, cssProp)
    return <button className={className}>{children}</button>
  }
  ```

  Then you can use the `Button` component like this:

  ```tsx title="src/app/page.tsx"
  import { css } from '../../styled-system/css'
  import { Button, Thingy } from './Button'

  export default function Page() {
    return (
      <Button css={{ color: 'pink', _hover: { color: 'red' } }}>
        will result in `class="d_flex items_center text_pink hover:text_red"`
      </Button>
    )
  }
  ```

  ***

  You can use this approach as well with the new `{cvaFn}.raw` and `{patternFn}.raw` functions, will allow style objects
  to be merged as expected in any situation.

  **Pattern Example:**

  ```tsx title="src/components/Button.tsx"
  import { hstack } from '../../styled-system/patterns'
  import { css, cva } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    // using the flex pattern
    const hstackProps = hstack.raw({
      border: '1px solid',
      _hover: { color: 'blue.400' },
    })

    // merging the styles
    const className = css(hstackProps, cssProp)

    return <button className={className}>{children}</button>
  }
  ```

  **CVA Example:**

  ```tsx title="src/components/Button.tsx"
  import { css, cva } from '../../styled-system/css'

  const buttonRecipe = cva({
    base: { display: 'flex', fontSize: 'lg' },
    variants: {
      variant: {
        primary: { color: 'white', backgroundColor: 'blue.500' },
      },
    },
  })

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css(
      // using the button recipe
      buttonRecipe.raw({ variant: 'primary' }),

      // adding style overrides (internal)
      { _hover: { color: 'blue.400' } },

      // adding style overrides (external)
      cssProp,
    )

    return <button className={className}>{props.children}</button>
  }
  ```

- 36fdff89: Fix bug in generated js code for atomic slot recipe produce where `splitVariantProps` didn't work without
  the first slot key.
  - @bamboocss/core@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- 599fbc1a: Fix issue where `AnimationName` type was generated wrongly if keyframes were not resolved
  - @bamboocss/core@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- a41515de: Fix issue where styled factory does not respect union prop types like `type Props = AProps | BProps`
- bf2ff391: Add `animationName` utility
- ad1518b8: fix failed styled component for solid-js when using recipe
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

- dfb3f85f: Add missing svg props types
- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency
- 39b80b49: Fix an issue with the runtime className generation when using an utility that maps to multiple shorthands
- 1dc788bd: Fix issue where some style properties shows TS error when using `!important`
- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- 386e5098: Update `RecipeVariantProps` to support slot recipes
- 6d4eaa68: Refactor code
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
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
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/token-dictionary@0.9.0
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

- 3f1e7e32: Adds the `{recipe}.raw()` in generated runtime
- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- be0ad578: Fix parser issue with TS path mappings
- b75905d8: Improve generated react jsx types to remove legacy ref. This fixes type composition issues.
- 0520ba83: Refactor generated recipe js code
- 156b6bde: Fix issue where generated package json does not respect `outExtension` when `emitPackage` is `true`
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/core@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- cd912f35: Fix `definePattern` module overriden type, was missing an `extends` constraint which lead to a type error:

  ```
  styled-system/types/global.d.ts:14:58 - error TS2344: Type 'T' does not satisfy the constraint 'PatternProperties'.

  14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                                              ~

    styled-system/types/global.d.ts:14:33
      14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                         ~
      This type parameter might need an `extends PatternProperties` constraint.

  ```

- dc4e80f7: Export `isCssProperty` helper function from styled-system/jsx
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

- ef1dd676: Fix issue where `staticCss` did not generate all variants in the array of `css` rules
- b50675ca: Refactor parser to support extracting `css` prop in JSX elements correctly.
- Updated dependencies [12c900ee]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/core@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 53fb0708: Fix `config.staticCss` by filtering types on getPropertyKeys

  It used to throw because of them:

  ```bash
  <css input>:33:21: Missed semicolon
   ELIFECYCLE  Command failed with exit code 1.
  ```

  ```css
  @layer utilities {
      .m_type\:Tokens\[\"spacing\"\] {
          margin: type:Tokens["spacing"]
      }
  }
  ```

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
- b8f8c2a6: Fix reset.css (generated when config has `preflight: true`) import order, always place it first so that it
  can be easily overriden
- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/token-dictionary@0.5.1
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

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

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

- 54a8913c: Fix issue where patterns that include css selectors doesn't work in JSX
- a48e5b00: Add support for watch mode in codegen command via the `--watch` or `-w` flag.

  ```bash
  bamboo codegen --watch
  ```

- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/core@0.3.2
- @bamboocss/is-valid-prop@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/core@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
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
  - @bamboocss/core@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2

* path.join('-'), }) }, }, })

````

Will now allow you to use the following syntax for token path:

```diff
- css({ boxShadow: '10px 10px 10px {colors.$primary}' })
+ css({ boxShadow: '10px 10px 10px {$colors-primary}' })

- token.var('colors.$primary')
+ token.var('$colors-black')
````

- 5a205e7: Fix conditions accessing `Cannot read properties of undefined (reading 'raw')`
- Updated dependencies [34d94cf]
- Updated dependencies [4736057]
- Updated dependencies [e855c64]
- Updated dependencies [5a205e7]
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/token-dictionary@0.33.0
  - @bamboocss/core@0.33.0
  - @bamboocss/types@0.33.0
  - @bamboocss/logger@0.33.0
  - @bamboocss/is-valid-prop@0.33.0
  - @bamboocss/shared@0.33.0

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

- Updated dependencies [a032375]
- Updated dependencies [31071ba]
- Updated dependencies [5184771]
- Updated dependencies [f419993]
- Updated dependencies [6d8c884]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/core@0.32.1
  - @bamboocss/token-dictionary@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/is-valid-prop@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- b32d817: Switch from `em` to `rem` for breakpoints and container queries to prevent side effects.

### Patch Changes

- 60cace3: This change allows the user to set `jsxFramework` to any string to enable extracting JSX components.

  ***

  Context: In a previous version, Bamboo's extractor used to always extract JSX style props even when not specifying a
  `jsxFramework`. This was considered a bug and has been fixed, which reduced the amount of work bamboo does and
  artifacts generated if the user doesn't need jsx.

  Now, in some cases like when using Svelte or Astro, the user might still to use & extract JSX style props, but the
  `jsxFramework` didn't have a way to specify that. This change allows the user to set `jsxFramework` to any string to
  enable extracting JSX components without generating any artifacts.

- Updated dependencies [433a364]
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
- Updated dependencies [b32d817]
  - @bamboocss/core@0.32.0
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/token-dictionary@0.32.0
  - @bamboocss/logger@0.32.0
  - @bamboocss/is-valid-prop@0.32.0

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

- 8f36f9af: Add a `RecipeVariant` type to get the variants in a strict object from `cva` function. This complements the
  `RecipeVariantprops` type that extracts the variant as optional props, mostly intended for JSX components.
- 2d69b340: Fix `styled` factory nested composition with `cva`
- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/core@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/token-dictionary@0.31.0
  - @bamboocss/is-valid-prop@0.31.0

## 0.30.2

### Patch Changes

- 97efdb43: Fix issue where `v-model` does not work in vue styled factory
- 7233cd2e: Fix issue where styled factory in Solid.js could results in `Maximum call stack exceeded` when composing
  with another library that uses the `as` prop.
- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/core@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/token-dictionary@0.30.2
  - @bamboocss/is-valid-prop@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/core@0.30.1
- @bamboocss/is-valid-prop@0.30.1
- @bamboocss/logger@0.30.1
- @bamboocss/shared@0.30.1
- @bamboocss/token-dictionary@0.30.1
- @bamboocss/types@0.30.1

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

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- f778d3e5: You can now set and override `defaultValues` in pattern configurations.

  Here's an example of how to define a new `hstack` pattern with a default `gap` value of `40px`:

  ```js
  defineConfig({
    patterns: {
      hstack: {
        properties: {
          justify: { type: 'property', value: 'justifyContent' },
          gap: { type: 'property', value: 'gap' },
        },
        // you can also use a token like '10'
        defaultValues: { gap: '40px' },
        transform(props) {
          const { justify, gap, ...rest } = props
          return {
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap,
            ...rest,
          }
        },
      },
    },
  })
  ```

### Patch Changes

- 2e32794d: Set `display: none` for hidden elements in `reset` css
- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/is-valid-prop@0.29.0
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

- 1edadf30: Fix issue where `/* @__PURE__ */` annotation threw a warning in Vite build due to incorrect placement.
- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/core@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/is-valid-prop@0.27.1
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

- dce0b3b2: Enhance `splitCssProps` typings
- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/gajus/bamboocss/pull/1986#issuecomment-1887459483) based on the React Profiler.

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/core@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- 6de4c737: Hotfix `strictTokens` after introducing `strictPropertyValues`
  - @bamboocss/core@0.26.1
  - @bamboocss/is-valid-prop@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- a179d74f: tl;dr:
  - `config.strictTokens` will only affect properties that have config tokens, such as `color`, `bg`, `borderColor`,
    etc.
  - `config.strictPropertyValues` is added and will throw for properties that do not have config tokens, such as
    `display`, `content`, `willChange`, etc. when the value is not a predefined CSS value.

  ***

  In version
  [0.19.0 we changed `config.strictTokens`](https://github.com/gajus/bamboocss/blob/main/CHANGELOG.md#0190---2023-11-24)
  typings a bit so that the only property values allowed were the config tokens OR the predefined CSS values, ex: `flex`
  for the property `display`, which prevented typos such as `display: 'aaa'`.

  The problem with this change is that it means you would have to provide every CSS properties a given set of values so
  that TS wouldn't throw any error. Thus, we will partly revert this change and make it so that `config.strictTokens`
  shouldn't affect properties that do not have config tokens, such as `content`, `willChange`, `display`, etc.

  v0.19.0:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ would throw since 'abc' is not part of predefined values of 'display' even thought there is no config token for 'abc'
  ```

  now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will not throw there is no config token for 'abc'
  ```

  Instead, if you want the v.19.0 behavior, you can use the new `config.strictPropertyValues` option. You can combine it
  with `config.strictTokens` if you want to be strict on both properties with config tokens and properties without
  config tokens.

  The new `config.strictPropertyValues` option will only be applied to this exhaustive list of properties:

  ```ts
  type StrictableProps =
    | 'alignContent'
    | 'alignItems'
    | 'alignSelf'
    | 'all'
    | 'animationComposition'
    | 'animationDirection'
    | 'animationFillMode'
    | 'appearance'
    | 'backfaceVisibility'
    | 'backgroundAttachment'
    | 'backgroundClip'
    | 'borderCollapse'
    | 'border'
    | 'borderBlock'
    | 'borderBlockEnd'
    | 'borderBlockStart'
    | 'borderBottom'
    | 'borderInline'
    | 'borderInlineEnd'
    | 'borderInlineStart'
    | 'borderLeft'
    | 'borderRight'
    | 'borderTop'
    | 'borderBlockEndStyle'
    | 'borderBlockStartStyle'
    | 'borderBlockStyle'
    | 'borderBottomStyle'
    | 'borderInlineEndStyle'
    | 'borderInlineStartStyle'
    | 'borderInlineStyle'
    | 'borderLeftStyle'
    | 'borderRightStyle'
    | 'borderTopStyle'
    | 'boxDecorationBreak'
    | 'boxSizing'
    | 'breakAfter'
    | 'breakBefore'
    | 'breakInside'
    | 'captionSide'
    | 'clear'
    | 'columnFill'
    | 'columnRuleStyle'
    | 'contentVisibility'
    | 'direction'
    | 'display'
    | 'emptyCells'
    | 'flexDirection'
    | 'flexWrap'
    | 'float'
    | 'fontKerning'
    | 'forcedColorAdjust'
    | 'isolation'
    | 'lineBreak'
    | 'mixBlendMode'
    | 'objectFit'
    | 'outlineStyle'
    | 'overflow'
    | 'overflowX'
    | 'overflowY'
    | 'overflowBlock'
    | 'overflowInline'
    | 'overflowWrap'
    | 'pointerEvents'
    | 'position'
    | 'resize'
    | 'scrollBehavior'
    | 'touchAction'
    | 'transformBox'
    | 'transformStyle'
    | 'userSelect'
    | 'visibility'
    | 'wordBreak'
    | 'writingMode'
  ```

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [d420c676]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
  - @bamboocss/core@0.24.1
  - @bamboocss/is-valid-prop@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
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

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- d30b1737: Fix issue where style props wouldn't be properly passed when using `config.jsxStyleProps` set to `minimal`
  or `none` with JSX patterns (`Box`, `Stack`, `Flex`, etc.)
- a3b6ed5f: Fix & perf improvement: skip JSX parsing when not using `config.jsxFramework` / skip tagged template literal
  parsing when not using `config.syntax` set to "template-literal"
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/core@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`
- 647f05c9: Fix a typing issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with property-based
  conditionals

  ```ts
  css({
    bg: '[#3B00B9]', // ✅ was okay
    _dark: {
      // ✅ was okay
      color: '[#3B00B9]',
    },

    // ❌ Not okay, will be fixed in this patch
    color: {
      _dark: '[#3B00B9]',
    },
  })
  ```

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
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Minor Changes

- e83afef0: Update csstype to support newer css features

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties
- 9c0d3f8f: Fix regression where `styled-system/jsx/index` had the wrong exports
- c95c40bd: Fix issue where `children` does not work in styled factory's `defaultProps` in React, Preact and Qwik
- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [11753fea]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

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

- d81dcbe6: - Fix an issue where recipe variants that clash with utility shorthand don't get generated due to the
  normalization that happens internally.
  - Fix issue where Preact JSX types are not merging recipes correctly
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

- 052283c2: Fix vue `styled` factory internal class merging, for example:

  ```vue
  <script setup>
  import { styled } from '../styled-system/jsx'

  const StyledButton = styled('button', {
    base: {
      bgColor: 'red.300',
    },
  })
  </script>
  <template>
    <StyledButton id="test" class="test">
      <slot></slot>
    </StyledButton>
  </template>
  ```

  Will now correctly include the `test` class in the final output.

- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
  - @bamboocss/core@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/core@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- e4fdc64a: Fix issue where conditional recipe variant doesn't work as expected
- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 92a7fbe5: Fix issue in preflight where monospace fallback pointed to the wrong variable
- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.
- 402afbee: Improves the `config.strictTokens` type-safety by allowing CSS predefined values (like 'flex' or 'block' for
  the property 'display') and throwing when using anything else than those, if no theme tokens was found on that
  property.

  Before:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ didn't throw even though 'abc' is not a valid value for 'display'
  ```

  Now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will throw since 'abc' is not a valid value for 'display'
  ```

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
- Updated dependencies [9f5711f9]
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- 78b940b2: Fix issue with `forceConsistentTypeExtension` where the `composition.d.mts` had an incorrect type import
  - @bamboocss/core@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/core@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Minor Changes

- b7cb2073: Add a `splitCssProps` utility exported from the {outdir}/jsx entrypoint

  ```tsx
  import { splitCssProps, styled } from '../styled-system/jsx'
  import type { HTMLStyledProps } from '../styled-system/types'

  function SplitComponent({ children, ...props }: HTMLStyledProps<'div'>) {
    const [cssProps, restProps] = splitCssProps(props)
    return (
      <styled.div {...restProps} className={css({ display: 'flex', height: '20', width: '20' }, cssProps)}>
        {children}
      </styled.div>
    )
  }

  // Usage

  function App() {
    return <SplitComponent margin="2">Click me</SplitComponent>
  }
  ```

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline
- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 6718f81b: Fix issue where Solid.js styled factory fails with pattern styles includes a css variable (e.g. Divider)
- 3ce70c37: Fix issue where cva composition in styled components doens't work as expected.
- Updated dependencies [a6dfc944]
  - @bamboocss/core@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/core@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 296d62b1: Change `OmittedHTMLProps` to be empty when using `config.jsxStyleProps` as `minimal` or `none`

  Fixes https://github.com/gajus/bamboocss/issues/1549

- 42520626: Fix issue where conditions don't work in semantic tokens when using template literal syntax.
- 7b981422: Fix issue in reset styles where button does not inherit color style
- 9382e687: remove export types from jsx when no jsxFramework configuration
- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM
- Updated dependencies [aea28c9f]
- Updated dependencies [5ce359f6]
  - @bamboocss/core@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

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

- fbf062c6: Added a new type to extract variants out of styled components

  ```tsx
  import { StyledVariantProps } from '../styled-system/jsx'

  const Button = styled('button', {
    base: { color: 'black' },
    variants: {
      state: {
        error: { color: 'red' },
        success: { color: 'green' },
      },
    },
  })

  type ButtonVariantProps = StyledVariantProps<typeof Button>
  //   ^ { state?: 'error' | 'success' | undefined }
  ```

### Patch Changes

- 93996aaf: Fix an issue with the `@layer tokens` CSS declarations when using `cssVarRoot` with multiple selectors, like
  `root, :host, ::backdrop`
- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 2b5cbf73: correct typings for Qwik components
- Updated dependencies [20f4e204]
  - @bamboocss/core@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- d12aed2b: Fix issue where unused recipes and slot recipes doesn't get treeshaken properly
- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- 3d5971e5: - **Vue**: Fix issue where elements created from styled factory does not forward DOM attributes and events
  to the underlying element.
  - **Vue**: Fix regression in generated types
  - **Preact**: Fix regression in generated types
  - @bamboocss/core@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
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

  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- d34c8b48: Fix issue where HMR does not work for Vue JSX factory and patterns
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

- 1eb31118: Automatically allow overriding config recipe compoundVariants styles within the `styled` JSX factory,
  example below

  With this config recipe:

  ```ts file="bamboo.config.ts"
  const button = defineRecipe({
    className: 'btn',
    base: { color: 'green', fontSize: '16px' },
    variants: {
      size: { small: { fontSize: '14px' } },
    },
    compoundVariants: [{ size: 'small', css: { color: 'blue' } }],
  })
  ```

  This would previously not merge the `color` property overrides, but now it does:

  ```tsx file="example.tsx"
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button)

  function App() {
    return (
      <>
        <Button size="small" color="red.100">
          Click me
        </Button>
      </>
    )
  }
  ```

  - Before: `btn btn--size_small text_blue text_red.100`
  - After: `btn btn--size_small text_red.100`

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- 6d15776c: When bundling the `outdir` in a library, you usually want to generate type declaration files (`d.ts`).
  Sometimes TS will complain about types not being exported.
  - Export all types from `{outdir}/types/index.d.ts`, this fixes errors looking like this:

  ```
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/system-types'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/csstype'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/conditions'. This is likely not portable. A type annotation is necessary.
  ```

  - Export generated recipe interfaces from `{outdir}/recipes/{recipeFn}.d.ts`, this fixes errors looking like this:

  ```
  src/ui/avatar.tsx (16:318) "AvatarRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/avatar.tsx".
  src/ui/card.tsx (2:164) "CardRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/card.tsx".
  src/ui/checkbox.tsx (19:310) "CheckboxRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/checkbox.tsx".
  ```

  - Export type `ComponentProps` from `{outdir}/types/jsx.d.ts`, this fixes errors looking like this:

  ```
   "ComponentProps" is not exported by "styled-system/types/jsx.d.ts", imported by "src/ui/form-control.tsx".
  ```

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property
- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 7e8bcb03: Fix an issue when wrapping a component with `styled` would display its name as `styled.[object Object]`
- 433f88cd: Fix issue in css reset where number input field spinner still show.
- 7499bbd2: Add the property `-moz-osx-font-smoothing: grayscale;` to the `reset.css` under the `html` selector.
- Updated dependencies [848936e0]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/core@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- 93d9ee7e: Refactor: Prefer `NativeElements` type for vue jsx elements
- 35793d85: Fix issue with cva when using compoundVariants and not passing any variants in the usage (ex: `button()`
  with `const button = cva({ ... })`)
- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/gajus/bamboocss/issues/1315

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [bc3b077d]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- bdd30d18: Fix issue where `pattern.raw(...)` did not share the same signature as `pattern(...)`
- bff17df2: Add each condition raw value information on hover using JSDoc annotation
- 6548f4f7: Add missing types (`StyledComponents`, `RecipeConfig`, `PatternConfig` etc) to solve a TypeScript issue (The
  inferred type of xxx cannot be named without a reference...) when generating declaration files in addition to using
  `emitPackage: true`
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 542d1ebc: Change the typings for the `css(...args)` function so that you can pass possibly undefined values to it.

  This is mostly intended for component props that have optional values like `cssProps?: SystemStyleObject` and would
  use it like `css({ ... }, cssProps)`

- 39b20797: Change the `css.raw` function signature to match the one from
  [`css()`](https://github.com/gajus/bamboocss/pull/1264), to allow passing multiple style objects that will be smartly
  merged.
- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- a5d7d514: Add `forceConsistentTypeExtension` config option for enforcing consistent file extension for emitted type
  definition files. This is useful for projects that use `moduleResolution: node16` which requires explicit file
  extensions in imports/exports.

  > If set to `true` and `outExtension` is set to `mjs`, the generated typescript `.d.ts` files will have the extension
  > `.d.mts`.

- 192d5e49: Fix issue where `cva` is undefined in preact styled factory
  - @bamboocss/core@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- a9690110: Fix issue where `defineTextStyle` and `defineLayerStyle` return types are incompatible with `config.theme`
  type.
- 32ceac3f: Fix an issue with custom JSX components not finding their matching patterns
- Updated dependencies [04b5fd6c]
  - @bamboocss/core@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- 6588c8e0: - Change the `css` function signature to allow passing multiple style objects that will be smartly merged.
  - Rename the `{cvaFn}.resolve` function to `{cva}.raw` for API consistency.
  - Change the behaviour of `{patternFn}.raw` to return the resulting `SystemStyleObject` instead of the arguments
    passed in. This is to allow the `css` function to merge the styles correctly.

  ```tsx
  import { css } from '../styled-system/css'
  css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' }) // => mx_10 pt_6
  ```

  > ⚠️ This approach should be preferred for merging styles over the current `cx` function, which will be reverted to
  > its original classname concatenation behaviour.

  ```diff
  import { css, cx } from '../styled-system/css'

  const App = () => {
    return (
      <>
  -      <div className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>
  +      <div className={css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' })}>
          Will result in `class="mx_10 pt_6"`
        </div>
      </>
    )
  }
  ```

  To design a component that supports style overrides, you can now provide the `css` prop as a style object, and it'll
  be merged correctly.

  ```tsx title="src/components/Button.tsx"
  import { css } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css({ display: 'flex', alignItem: 'center', color: 'black' }, cssProp)
    return <button className={className}>{children}</button>
  }
  ```

  Then you can use the `Button` component like this:

  ```tsx title="src/app/page.tsx"
  import { css } from '../../styled-system/css'
  import { Button, Thingy } from './Button'

  export default function Page() {
    return (
      <Button css={{ color: 'pink', _hover: { color: 'red' } }}>
        will result in `class="d_flex items_center text_pink hover:text_red"`
      </Button>
    )
  }
  ```

  ***

  You can use this approach as well with the new `{cvaFn}.raw` and `{patternFn}.raw` functions, will allow style objects
  to be merged as expected in any situation.

  **Pattern Example:**

  ```tsx title="src/components/Button.tsx"
  import { hstack } from '../../styled-system/patterns'
  import { css, cva } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    // using the flex pattern
    const hstackProps = hstack.raw({
      border: '1px solid',
      _hover: { color: 'blue.400' },
    })

    // merging the styles
    const className = css(hstackProps, cssProp)

    return <button className={className}>{children}</button>
  }
  ```

  **CVA Example:**

  ```tsx title="src/components/Button.tsx"
  import { css, cva } from '../../styled-system/css'

  const buttonRecipe = cva({
    base: { display: 'flex', fontSize: 'lg' },
    variants: {
      variant: {
        primary: { color: 'white', backgroundColor: 'blue.500' },
      },
    },
  })

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css(
      // using the button recipe
      buttonRecipe.raw({ variant: 'primary' }),

      // adding style overrides (internal)
      { _hover: { color: 'blue.400' } },

      // adding style overrides (external)
      cssProp,
    )

    return <button className={className}>{props.children}</button>
  }
  ```

- 36fdff89: Fix bug in generated js code for atomic slot recipe produce where `splitVariantProps` didn't work without
  the first slot key.
  - @bamboocss/core@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- 599fbc1a: Fix issue where `AnimationName` type was generated wrongly if keyframes were not resolved
  - @bamboocss/core@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- a41515de: Fix issue where styled factory does not respect union prop types like `type Props = AProps | BProps`
- bf2ff391: Add `animationName` utility
- ad1518b8: fix failed styled component for solid-js when using recipe
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

- dfb3f85f: Add missing svg props types
- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency
- 39b80b49: Fix an issue with the runtime className generation when using an utility that maps to multiple shorthands
- 1dc788bd: Fix issue where some style properties shows TS error when using `!important`
- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- 386e5098: Update `RecipeVariantProps` to support slot recipes
- 6d4eaa68: Refactor code
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
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
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/token-dictionary@0.9.0
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

- 3f1e7e32: Adds the `{recipe}.raw()` in generated runtime
- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- be0ad578: Fix parser issue with TS path mappings
- b75905d8: Improve generated react jsx types to remove legacy ref. This fixes type composition issues.
- 0520ba83: Refactor generated recipe js code
- 156b6bde: Fix issue where generated package json does not respect `outExtension` when `emitPackage` is `true`
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/core@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- cd912f35: Fix `definePattern` module overriden type, was missing an `extends` constraint which lead to a type error:

  ```
  styled-system/types/global.d.ts:14:58 - error TS2344: Type 'T' does not satisfy the constraint 'PatternProperties'.

  14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                                              ~

    styled-system/types/global.d.ts:14:33
      14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                         ~
      This type parameter might need an `extends PatternProperties` constraint.

  ```

- dc4e80f7: Export `isCssProperty` helper function from styled-system/jsx
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

- ef1dd676: Fix issue where `staticCss` did not generate all variants in the array of `css` rules
- b50675ca: Refactor parser to support extracting `css` prop in JSX elements correctly.
- Updated dependencies [12c900ee]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/core@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 53fb0708: Fix `config.staticCss` by filtering types on getPropertyKeys

  It used to throw because of them:

  ```bash
  <css input>:33:21: Missed semicolon
   ELIFECYCLE  Command failed with exit code 1.
  ```

  ```css
  @layer utilities {
      .m_type\:Tokens\[\"spacing\"\] {
          margin: type:Tokens["spacing"]
      }
  }
  ```

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
- b8f8c2a6: Fix reset.css (generated when config has `preflight: true`) import order, always place it first so that it
  can be easily overriden
- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/token-dictionary@0.5.1
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

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

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

- 54a8913c: Fix issue where patterns that include css selectors doesn't work in JSX
- a48e5b00: Add support for watch mode in codegen command via the `--watch` or `-w` flag.

  ```bash
  bamboo codegen --watch
  ```

- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/core@0.3.2
- @bamboocss/is-valid-prop@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/core@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
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
  - @bamboocss/core@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2

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

- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
- Updated dependencies [d5977c24]
  - @bamboocss/types@0.30.0
  - @bamboocss/token-dictionary@0.30.0
  - @bamboocss/shared@0.30.0
  - @bamboocss/core@0.30.0
  - @bamboocss/logger@0.30.0
  - @bamboocss/is-valid-prop@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [a5c75607]
  - @bamboocss/core@0.29.1
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
  - @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- f778d3e5: You can now set and override `defaultValues` in pattern configurations.

  Here's an example of how to define a new `hstack` pattern with a default `gap` value of `40px`:

  ```js
  defineConfig({
    patterns: {
      hstack: {
        properties: {
          justify: { type: 'property', value: 'justifyContent' },
          gap: { type: 'property', value: 'gap' },
        },
        // you can also use a token like '10'
        defaultValues: { gap: '40px' },
        transform(props) {
          const { justify, gap, ...rest } = props
          return {
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap,
            ...rest,
          }
        },
      },
    },
  })
  ```

### Patch Changes

- 2e32794d: Set `display: none` for hidden elements in `reset` css
- Updated dependencies [5fcdeb75]
- Updated dependencies [7c7340ec]
- Updated dependencies [f778d3e5]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/core@0.29.0
  - @bamboocss/token-dictionary@0.29.0
  - @bamboocss/is-valid-prop@0.29.0
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

- 1edadf30: Fix issue where `/* @__PURE__ */` annotation threw a warning in Vite build due to incorrect placement.
- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [e463ce0e]
- Updated dependencies [77cab9fe]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
- Updated dependencies [9d000dcd]
- Updated dependencies [6d7e7b07]
  - @bamboocss/types@0.28.0
  - @bamboocss/core@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/core@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/core@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/core@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/is-valid-prop@0.27.1
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

- dce0b3b2: Enhance `splitCssProps` typings
- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/gajus/bamboocss/pull/1986#issuecomment-1887459483) based on the React Profiler.

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0
  - @bamboocss/core@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/core@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- 6de4c737: Hotfix `strictTokens` after introducing `strictPropertyValues`
  - @bamboocss/core@0.26.1
  - @bamboocss/is-valid-prop@0.26.1
  - @bamboocss/logger@0.26.1
  - @bamboocss/shared@0.26.1
  - @bamboocss/token-dictionary@0.26.1
  - @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- a179d74f: tl;dr:
  - `config.strictTokens` will only affect properties that have config tokens, such as `color`, `bg`, `borderColor`,
    etc.
  - `config.strictPropertyValues` is added and will throw for properties that do not have config tokens, such as
    `display`, `content`, `willChange`, etc. when the value is not a predefined CSS value.

  ***

  In version
  [0.19.0 we changed `config.strictTokens`](https://github.com/gajus/bamboocss/blob/main/CHANGELOG.md#0190---2023-11-24)
  typings a bit so that the only property values allowed were the config tokens OR the predefined CSS values, ex: `flex`
  for the property `display`, which prevented typos such as `display: 'aaa'`.

  The problem with this change is that it means you would have to provide every CSS properties a given set of values so
  that TS wouldn't throw any error. Thus, we will partly revert this change and make it so that `config.strictTokens`
  shouldn't affect properties that do not have config tokens, such as `content`, `willChange`, `display`, etc.

  v0.19.0:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ would throw since 'abc' is not part of predefined values of 'display' even thought there is no config token for 'abc'
  ```

  now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will not throw there is no config token for 'abc'
  ```

  Instead, if you want the v.19.0 behavior, you can use the new `config.strictPropertyValues` option. You can combine it
  with `config.strictTokens` if you want to be strict on both properties with config tokens and properties without
  config tokens.

  The new `config.strictPropertyValues` option will only be applied to this exhaustive list of properties:

  ```ts
  type StrictableProps =
    | 'alignContent'
    | 'alignItems'
    | 'alignSelf'
    | 'all'
    | 'animationComposition'
    | 'animationDirection'
    | 'animationFillMode'
    | 'appearance'
    | 'backfaceVisibility'
    | 'backgroundAttachment'
    | 'backgroundClip'
    | 'borderCollapse'
    | 'border'
    | 'borderBlock'
    | 'borderBlockEnd'
    | 'borderBlockStart'
    | 'borderBottom'
    | 'borderInline'
    | 'borderInlineEnd'
    | 'borderInlineStart'
    | 'borderLeft'
    | 'borderRight'
    | 'borderTop'
    | 'borderBlockEndStyle'
    | 'borderBlockStartStyle'
    | 'borderBlockStyle'
    | 'borderBottomStyle'
    | 'borderInlineEndStyle'
    | 'borderInlineStartStyle'
    | 'borderInlineStyle'
    | 'borderLeftStyle'
    | 'borderRightStyle'
    | 'borderTopStyle'
    | 'boxDecorationBreak'
    | 'boxSizing'
    | 'breakAfter'
    | 'breakBefore'
    | 'breakInside'
    | 'captionSide'
    | 'clear'
    | 'columnFill'
    | 'columnRuleStyle'
    | 'contentVisibility'
    | 'direction'
    | 'display'
    | 'emptyCells'
    | 'flexDirection'
    | 'flexWrap'
    | 'float'
    | 'fontKerning'
    | 'forcedColorAdjust'
    | 'isolation'
    | 'lineBreak'
    | 'mixBlendMode'
    | 'objectFit'
    | 'outlineStyle'
    | 'overflow'
    | 'overflowX'
    | 'overflowY'
    | 'overflowBlock'
    | 'overflowInline'
    | 'overflowWrap'
    | 'pointerEvents'
    | 'position'
    | 'resize'
    | 'scrollBehavior'
    | 'touchAction'
    | 'transformBox'
    | 'transformStyle'
    | 'userSelect'
    | 'visibility'
    | 'wordBreak'
    | 'writingMode'
  ```

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
- Updated dependencies [14033e00]
- Updated dependencies [d420c676]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/core@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/core@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
- Updated dependencies [61ebf3d2]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/core@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- 10e74428: - Fix an issue with the `@bamboocss/postcss` (and therefore `@bamboocss/astro`) where the initial @layer CSS
  wasn't applied correctly
  - Fix an issue with `staticCss` where it was only generated when it was included in the config (we can generate it
    through the config recipes)
  - @bamboocss/core@0.24.1
  - @bamboocss/is-valid-prop@0.24.1
  - @bamboocss/logger@0.24.1
  - @bamboocss/shared@0.24.1
  - @bamboocss/token-dictionary@0.24.1
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

- Updated dependencies [63b3f1f2]
- Updated dependencies [f6881022]
  - @bamboocss/core@0.24.0
  - @bamboocss/types@0.24.0
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- d30b1737: Fix issue where style props wouldn't be properly passed when using `config.jsxStyleProps` set to `minimal`
  or `none` with JSX patterns (`Box`, `Stack`, `Flex`, etc.)
- a3b6ed5f: Fix & perf improvement: skip JSX parsing when not using `config.jsxFramework` / skip tagged template literal
  parsing when not using `config.syntax` set to "template-literal"
- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [1ea7459c]
- Updated dependencies [80ada336]
- Updated dependencies [bd552b1f]
- Updated dependencies [840ed66b]
  - @bamboocss/core@0.23.0
  - @bamboocss/logger@0.23.0
  - @bamboocss/is-valid-prop@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- 8f4ce97c: Fix `slotRecipes` typings,
  [the recently added `recipe.staticCss`](https://github.com/gajus/bamboocss/pull/1765) added to `config.recipes`
  weren't added to `config.slotRecipes`
- 647f05c9: Fix a typing issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with property-based
  conditionals

  ```ts
  css({
    bg: '[#3B00B9]', // ✅ was okay
    _dark: {
      // ✅ was okay
      color: '[#3B00B9]',
    },

    // ❌ Not okay, will be fixed in this patch
    color: {
      _dark: '[#3B00B9]',
    },
  })
  ```

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
  - @bamboocss/core@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/is-valid-prop@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Minor Changes

- e83afef0: Update csstype to support newer css features

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties
- 9c0d3f8f: Fix regression where `styled-system/jsx/index` had the wrong exports
- c95c40bd: Fix issue where `children` does not work in styled factory's `defaultProps` in React, Preact and Qwik
- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [11753fea]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/core@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/is-valid-prop@0.22.0
  - @bamboocss/logger@0.22.0

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

- d81dcbe6: - Fix an issue where recipe variants that clash with utility shorthand don't get generated due to the
  normalization that happens internally.
  - Fix issue where Preact JSX types are not merging recipes correctly
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

- 052283c2: Fix vue `styled` factory internal class merging, for example:

  ```vue
  <script setup>
  import { styled } from '../styled-system/jsx'

  const StyledButton = styled('button', {
    base: {
      bgColor: 'red.300',
    },
  })
  </script>
  <template>
    <StyledButton id="test" class="test">
      <slot></slot>
    </StyledButton>
  </template>
  ```

  Will now correctly include the `test` class in the final output.

- Updated dependencies [788aaba3]
- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [d81dcbe6]
- Updated dependencies [105f74ce]
  - @bamboocss/core@0.21.0
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/is-valid-prop@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/core@0.20.1
- @bamboocss/token-dictionary@0.20.1
- @bamboocss/is-valid-prop@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- e4fdc64a: Fix issue where conditional recipe variant doesn't work as expected
- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [4ba982f3]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/core@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/is-valid-prop@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 61831040: Fix issue where typescript error is shown in recipes when `exactOptionalPropertyTypes` is set.

  > To learn more about this issue, see [this issue](https://github.com/gajus/bamboocss/issues/1688)

- 92a7fbe5: Fix issue in preflight where monospace fallback pointed to the wrong variable
- 89f86923: Fix issue where css variables were not supported in layer styles and text styles types.
- 402afbee: Improves the `config.strictTokens` type-safety by allowing CSS predefined values (like 'flex' or 'block' for
  the property 'display') and throwing when using anything else than those, if no theme tokens was found on that
  property.

  Before:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ❌ didn't throw even though 'abc' is not a valid value for 'display'
  ```

  Now:

  ```ts
  // config.strictTokens = true
  css({ display: 'flex' }) // OK, didn't throw
  css({ display: 'block' }) // OK, didn't throw
  css({ display: 'abc' }) // ✅ will throw since 'abc' is not a valid value for 'display'
  ```

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
- Updated dependencies [9f5711f9]
  - @bamboocss/types@0.19.0
  - @bamboocss/core@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/is-valid-prop@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- 78b940b2: Fix issue with `forceConsistentTypeExtension` where the `composition.d.mts` had an incorrect type import
  - @bamboocss/core@0.18.3
  - @bamboocss/is-valid-prop@0.18.3
  - @bamboocss/logger@0.18.3
  - @bamboocss/shared@0.18.3
  - @bamboocss/token-dictionary@0.18.3
  - @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/core@0.18.2
- @bamboocss/token-dictionary@0.18.2
- @bamboocss/is-valid-prop@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
- Updated dependencies [8c76cd0f]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/core@0.18.1
  - @bamboocss/is-valid-prop@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Minor Changes

- b7cb2073: Add a `splitCssProps` utility exported from the {outdir}/jsx entrypoint

  ```tsx
  import { splitCssProps, styled } from '../styled-system/jsx'
  import type { HTMLStyledProps } from '../styled-system/types'

  function SplitComponent({ children, ...props }: HTMLStyledProps<'div'>) {
    const [cssProps, restProps] = splitCssProps(props)
    return (
      <styled.div {...restProps} className={css({ display: 'flex', height: '20', width: '20' }, cssProps)}>
        {children}
      </styled.div>
    )
  }

  // Usage

  function App() {
    return <SplitComponent margin="2">Click me</SplitComponent>
  }
  ```

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline
- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/core@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/is-valid-prop@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- 6718f81b: Fix issue where Solid.js styled factory fails with pattern styles includes a css variable (e.g. Divider)
- 3ce70c37: Fix issue where cva composition in styled components doens't work as expected.
- Updated dependencies [a6dfc944]
  - @bamboocss/core@0.17.5
  - @bamboocss/is-valid-prop@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/core@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/is-valid-prop@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/core@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/is-valid-prop@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/core@0.17.2
- @bamboocss/is-valid-prop@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- 296d62b1: Change `OmittedHTMLProps` to be empty when using `config.jsxStyleProps` as `minimal` or `none`

  Fixes https://github.com/gajus/bamboocss/issues/1549

- 42520626: Fix issue where conditions don't work in semantic tokens when using template literal syntax.
- 7b981422: Fix issue in reset styles where button does not inherit color style
- 9382e687: remove export types from jsx when no jsxFramework configuration
- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM
- Updated dependencies [aea28c9f]
- Updated dependencies [5ce359f6]
  - @bamboocss/core@0.17.1
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/is-valid-prop@0.17.1
  - @bamboocss/logger@0.17.1

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

- fbf062c6: Added a new type to extract variants out of styled components

  ```tsx
  import { StyledVariantProps } from '../styled-system/jsx'

  const Button = styled('button', {
    base: { color: 'black' },
    variants: {
      state: {
        error: { color: 'red' },
        success: { color: 'green' },
      },
    },
  })

  type ButtonVariantProps = StyledVariantProps<typeof Button>
  //   ^ { state?: 'error' | 'success' | undefined }
  ```

### Patch Changes

- 93996aaf: Fix an issue with the `@layer tokens` CSS declarations when using `cssVarRoot` with multiple selectors, like
  `root, :host, ::backdrop`
- fc4688e6: Export all types from @bamboocss/types, which will also export all types exposed in the outdir/types

  Also make the `config.prefix` object Partial so that each key is optional.

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
- Updated dependencies [e73ea803]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/core@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/is-valid-prop@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Minor Changes

- 36252b1d: ## --minimal flag

  Adds a new `--minimal` flag for the CLI on the `bamboo cssgen` command to skip generating CSS for theme tokens,
  preflightkeyframes, static and global css

  Thich means that the generated CSS will only contain the CSS related to the styles found in the included files.

  > Note that you can use a `glob` to override the `config.include` option like this:
  > `bamboo cssgen "src/**/*.css" --minimal`

  This is useful when you want to split your CSS into multiple files, for example if you want to split by pages.

  Use it like this:

  ```bash
  bamboo cssgen "src/**/pages/*.css" --minimal --outfile dist/pages.css
  ```

  ***

  ## cssgen {type}

  In addition to the optional `glob` that you can already pass to override the config.include option, the
  `bamboo cssgen` command now accepts a new `{type}` argument to generate only a specific type of CSS:
  - preflight
  - tokens
  - static
  - global
  - keyframes

  > Note that this only works when passing an `--outfile`.

  You can use it like this:

  ```bash
  bamboo cssgen "static" --outfile dist/static.css
  ```

### Patch Changes

- 2b5cbf73: correct typings for Qwik components
- Updated dependencies [20f4e204]
  - @bamboocss/core@0.16.0
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/is-valid-prop@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- d12aed2b: Fix issue where unused recipes and slot recipes doesn't get treeshaken properly
- 909fcbe8: - Fix issue with `Promise.all` where it aborts premature ine weird events. Switched to `Promise.allSettled`
- 3d5971e5: - **Vue**: Fix issue where elements created from styled factory does not forward DOM attributes and events
  to the underlying element.
  - **Vue**: Fix regression in generated types
  - **Preact**: Fix regression in generated types
  - @bamboocss/core@0.15.5
  - @bamboocss/is-valid-prop@0.15.5
  - @bamboocss/logger@0.15.5
  - @bamboocss/shared@0.15.5
  - @bamboocss/token-dictionary@0.15.5
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

  - @bamboocss/types@0.15.4
  - @bamboocss/core@0.15.4
  - @bamboocss/is-valid-prop@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/shared@0.15.4
  - @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- d34c8b48: Fix issue where HMR does not work for Vue JSX factory and patterns
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

- 1eb31118: Automatically allow overriding config recipe compoundVariants styles within the `styled` JSX factory,
  example below

  With this config recipe:

  ```ts file="bamboo.config.ts"
  const button = defineRecipe({
    className: 'btn',
    base: { color: 'green', fontSize: '16px' },
    variants: {
      size: { small: { fontSize: '14px' } },
    },
    compoundVariants: [{ size: 'small', css: { color: 'blue' } }],
  })
  ```

  This would previously not merge the `color` property overrides, but now it does:

  ```tsx file="example.tsx"
  import { styled } from '../styled-system/jsx'
  import { button } from '../styled-system/recipes'

  const Button = styled('button', button)

  function App() {
    return (
      <>
        <Button size="small" color="red.100">
          Click me
        </Button>
      </>
    )
  }
  ```

  - Before: `btn btn--size_small text_blue text_red.100`
  - After: `btn btn--size_small text_red.100`

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/core@0.15.3
  - @bamboocss/types@0.15.3
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/is-valid-prop@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- 6d15776c: When bundling the `outdir` in a library, you usually want to generate type declaration files (`d.ts`).
  Sometimes TS will complain about types not being exported.
  - Export all types from `{outdir}/types/index.d.ts`, this fixes errors looking like this:

  ```
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/system-types'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/csstype'. This is likely not portable. A type annotation is necessary.
  src/components/Checkbox/index.tsx(8,7): error TS2742: The inferred type of 'Root' cannot be named without a reference to '../../../node_modules/@acmeorg/styled-system/types/conditions'. This is likely not portable. A type annotation is necessary.
  ```

  - Export generated recipe interfaces from `{outdir}/recipes/{recipeFn}.d.ts`, this fixes errors looking like this:

  ```
  src/ui/avatar.tsx (16:318) "AvatarRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/avatar.tsx".
  src/ui/card.tsx (2:164) "CardRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/card.tsx".
  src/ui/checkbox.tsx (19:310) "CheckboxRecipe" is not exported by "styled-system/recipes/index.d.ts", imported by "src/ui/checkbox.tsx".
  ```

  - Export type `ComponentProps` from `{outdir}/types/jsx.d.ts`, this fixes errors looking like this:

  ```
   "ComponentProps" is not exported by "styled-system/types/jsx.d.ts", imported by "src/ui/form-control.tsx".
  ```

- 26a788c0: - Switch to interface for runtime types
  - Create custom partial types for each config object property
- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/core@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/is-valid-prop@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 7e8bcb03: Fix an issue when wrapping a component with `styled` would display its name as `styled.[object Object]`
- 433f88cd: Fix issue in css reset where number input field spinner still show.
- 7499bbd2: Add the property `-moz-osx-font-smoothing: grayscale;` to the `reset.css` under the `html` selector.
- Updated dependencies [848936e0]
- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/core@0.15.1
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/is-valid-prop@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- 93d9ee7e: Refactor: Prefer `NativeElements` type for vue jsx elements
- 35793d85: Fix issue with cva when using compoundVariants and not passing any variants in the usage (ex: `button()`
  with `const button = cva({ ... })`)
- 39298609: Make the types suggestion faster (updated `DeepPartial`)
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/gajus/bamboocss/issues/1315

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [bc3b077d]
- Updated dependencies [39298609]
- Updated dependencies [dd47b6e6]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/core@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/is-valid-prop@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- bdd30d18: Fix issue where `pattern.raw(...)` did not share the same signature as `pattern(...)`
- bff17df2: Add each condition raw value information on hover using JSDoc annotation
- 6548f4f7: Add missing types (`StyledComponents`, `RecipeConfig`, `PatternConfig` etc) to solve a TypeScript issue (The
  inferred type of xxx cannot be named without a reference...) when generating declaration files in addition to using
  `emitPackage: true`
- 6f7ee198: Add `{svaFn}.raw` function to get raw styles and allow reusable components with style overrides, just like
  with `{cvaFn}.raw`
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 542d1ebc: Change the typings for the `css(...args)` function so that you can pass possibly undefined values to it.

  This is mostly intended for component props that have optional values like `cssProps?: SystemStyleObject` and would
  use it like `css({ ... }, cssProps)`

- 39b20797: Change the `css.raw` function signature to match the one from
  [`css()`](https://github.com/gajus/bamboocss/pull/1264), to allow passing multiple style objects that will be smartly
  merged.
- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
- Updated dependencies [623e321f]
- Updated dependencies [02161d41]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/core@0.14.0
  - @bamboocss/is-valid-prop@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- a5d7d514: Add `forceConsistentTypeExtension` config option for enforcing consistent file extension for emitted type
  definition files. This is useful for projects that use `moduleResolution: node16` which requires explicit file
  extensions in imports/exports.

  > If set to `true` and `outExtension` is set to `mjs`, the generated typescript `.d.ts` files will have the extension
  > `.d.mts`.

- 192d5e49: Fix issue where `cva` is undefined in preact styled factory
  - @bamboocss/core@0.13.1
  - @bamboocss/is-valid-prop@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- a9690110: Fix issue where `defineTextStyle` and `defineLayerStyle` return types are incompatible with `config.theme`
  type.
- 32ceac3f: Fix an issue with custom JSX components not finding their matching patterns
- Updated dependencies [04b5fd6c]
  - @bamboocss/core@0.13.0
  - @bamboocss/is-valid-prop@0.13.0
  - @bamboocss/logger@0.13.0
  - @bamboocss/shared@0.13.0
  - @bamboocss/token-dictionary@0.13.0
  - @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- 6588c8e0: - Change the `css` function signature to allow passing multiple style objects that will be smartly merged.
  - Rename the `{cvaFn}.resolve` function to `{cva}.raw` for API consistency.
  - Change the behaviour of `{patternFn}.raw` to return the resulting `SystemStyleObject` instead of the arguments
    passed in. This is to allow the `css` function to merge the styles correctly.

  ```tsx
  import { css } from '../styled-system/css'
  css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' }) // => mx_10 pt_6
  ```

  > ⚠️ This approach should be preferred for merging styles over the current `cx` function, which will be reverted to
  > its original classname concatenation behaviour.

  ```diff
  import { css, cx } from '../styled-system/css'

  const App = () => {
    return (
      <>
  -      <div className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>
  +      <div className={css({ mx: '3', paddingTop: '4' }, { mx: '10', pt: '6' })}>
          Will result in `class="mx_10 pt_6"`
        </div>
      </>
    )
  }
  ```

  To design a component that supports style overrides, you can now provide the `css` prop as a style object, and it'll
  be merged correctly.

  ```tsx title="src/components/Button.tsx"
  import { css } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css({ display: 'flex', alignItem: 'center', color: 'black' }, cssProp)
    return <button className={className}>{children}</button>
  }
  ```

  Then you can use the `Button` component like this:

  ```tsx title="src/app/page.tsx"
  import { css } from '../../styled-system/css'
  import { Button, Thingy } from './Button'

  export default function Page() {
    return (
      <Button css={{ color: 'pink', _hover: { color: 'red' } }}>
        will result in `class="d_flex items_center text_pink hover:text_red"`
      </Button>
    )
  }
  ```

  ***

  You can use this approach as well with the new `{cvaFn}.raw` and `{patternFn}.raw` functions, will allow style objects
  to be merged as expected in any situation.

  **Pattern Example:**

  ```tsx title="src/components/Button.tsx"
  import { hstack } from '../../styled-system/patterns'
  import { css, cva } from '../../styled-system/css'

  export const Button = ({ css: cssProp = {}, children }) => {
    // using the flex pattern
    const hstackProps = hstack.raw({
      border: '1px solid',
      _hover: { color: 'blue.400' },
    })

    // merging the styles
    const className = css(hstackProps, cssProp)

    return <button className={className}>{children}</button>
  }
  ```

  **CVA Example:**

  ```tsx title="src/components/Button.tsx"
  import { css, cva } from '../../styled-system/css'

  const buttonRecipe = cva({
    base: { display: 'flex', fontSize: 'lg' },
    variants: {
      variant: {
        primary: { color: 'white', backgroundColor: 'blue.500' },
      },
    },
  })

  export const Button = ({ css: cssProp = {}, children }) => {
    const className = css(
      // using the button recipe
      buttonRecipe.raw({ variant: 'primary' }),

      // adding style overrides (internal)
      { _hover: { color: 'blue.400' } },

      // adding style overrides (external)
      cssProp,
    )

    return <button className={className}>{props.children}</button>
  }
  ```

- 36fdff89: Fix bug in generated js code for atomic slot recipe produce where `splitVariantProps` didn't work without
  the first slot key.
  - @bamboocss/core@0.12.2
  - @bamboocss/is-valid-prop@0.12.2
  - @bamboocss/logger@0.12.2
  - @bamboocss/shared@0.12.2
  - @bamboocss/token-dictionary@0.12.2
  - @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- 599fbc1a: Fix issue where `AnimationName` type was generated wrongly if keyframes were not resolved
  - @bamboocss/core@0.12.1
  - @bamboocss/is-valid-prop@0.12.1
  - @bamboocss/logger@0.12.1
  - @bamboocss/shared@0.12.1
  - @bamboocss/token-dictionary@0.12.1
  - @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- a41515de: Fix issue where styled factory does not respect union prop types like `type Props = AProps | BProps`
- bf2ff391: Add `animationName` utility
- ad1518b8: fix failed styled component for solid-js when using recipe
  - @bamboocss/core@0.12.0
  - @bamboocss/token-dictionary@0.12.0
  - @bamboocss/is-valid-prop@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/shared@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

- dfb3f85f: Add missing svg props types
- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [dfb3f85f]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/is-valid-prop@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/core@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- 5b95caf5: Add a hook call when the final `styles.css` content has been generated, remove cyclic (from an unused hook)
  dependency
- 39b80b49: Fix an issue with the runtime className generation when using an utility that maps to multiple shorthands
- 1dc788bd: Fix issue where some style properties shows TS error when using `!important`
- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/core@0.11.0
  - @bamboocss/token-dictionary@0.11.0
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

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- 386e5098: Update `RecipeVariantProps` to support slot recipes
- 6d4eaa68: Refactor code
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [2d2a42da]
- Updated dependencies [386e5098]
- Updated dependencies [6d4eaa68]
- Updated dependencies [a669f4d5]
  - @bamboocss/is-valid-prop@0.10.0
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/core@0.10.0
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
  - @bamboocss/types@0.9.0
  - @bamboocss/core@0.9.0
  - @bamboocss/token-dictionary@0.9.0
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

- 3f1e7e32: Adds the `{recipe}.raw()` in generated runtime
- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- be0ad578: Fix parser issue with TS path mappings
- b75905d8: Improve generated react jsx types to remove legacy ref. This fixes type composition issues.
- 0520ba83: Refactor generated recipe js code
- 156b6bde: Fix issue where generated package json does not respect `outExtension` when `emitPackage` is `true`
- Updated dependencies [fb449016]
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/core@0.8.0
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/is-valid-prop@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- a9c189b7: Fix issue where `splitVariantProps` in cva doesn't resolve the correct types
- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/core@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/is-valid-prop@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- cd912f35: Fix `definePattern` module overriden type, was missing an `extends` constraint which lead to a type error:

  ```
  styled-system/types/global.d.ts:14:58 - error TS2344: Type 'T' does not satisfy the constraint 'PatternProperties'.

  14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                                              ~

    styled-system/types/global.d.ts:14:33
      14   export function definePattern<T>(config: PatternConfig<T>): PatternConfig
                                         ~
      This type parameter might need an `extends PatternProperties` constraint.

  ```

- dc4e80f7: Export `isCssProperty` helper function from styled-system/jsx
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

- ef1dd676: Fix issue where `staticCss` did not generate all variants in the array of `css` rules
- b50675ca: Refactor parser to support extracting `css` prop in JSX elements correctly.
- Updated dependencies [12c900ee]
- Updated dependencies [5bd88c41]
- Updated dependencies [ef1dd676]
- Updated dependencies [b50675ca]
  - @bamboocss/core@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/is-valid-prop@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- 53fb0708: Fix `config.staticCss` by filtering types on getPropertyKeys

  It used to throw because of them:

  ```bash
  <css input>:33:21: Missed semicolon
   ELIFECYCLE  Command failed with exit code 1.
  ```

  ```css
  @layer utilities {
      .m_type\:Tokens\[\"spacing\"\] {
          margin: type:Tokens["spacing"]
      }
  }
  ```

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
- b8f8c2a6: Fix reset.css (generated when config has `preflight: true`) import order, always place it first so that it
  can be easily overriden
- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/core@0.5.1
  - @bamboocss/token-dictionary@0.5.1
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

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/core@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/is-valid-prop@0.5.0
  - @bamboocss/logger@0.5.0

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

- 54a8913c: Fix issue where patterns that include css selectors doesn't work in JSX
- a48e5b00: Add support for watch mode in codegen command via the `--watch` or `-w` flag.

  ```bash
  bamboo codegen --watch
  ```

- Updated dependencies [2a1e9386]
- Updated dependencies [54a8913c]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/core@0.4.0
  - @bamboocss/is-valid-prop@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/core@0.3.2
- @bamboocss/is-valid-prop@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/core@0.3.1
  - @bamboocss/is-valid-prop@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Minor Changes

- 6d81ee9e: - Set default jsx factory to 'styled'
  - Fix issue where pattern JSX was not being generated correctly when properties are not defined

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/core@0.3.0
  - @bamboocss/token-dictionary@0.3.0
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
  - @bamboocss/core@0.0.2
  - @bamboocss/is-valid-prop@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2
