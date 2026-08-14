# @bamboocss/core

## 1.41.0

### Patch Changes

- @bamboocss/is-valid-prop@1.41.0
- @bamboocss/logger@1.41.0
- @bamboocss/shared@1.41.0
- @bamboocss/token-dictionary@1.41.0
- @bamboocss/types@1.41.0

## 1.40.1

### Patch Changes

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

- @bamboocss/is-valid-prop@1.40.0
- @bamboocss/logger@1.40.0
- @bamboocss/shared@1.40.0
- @bamboocss/token-dictionary@1.40.0
- @bamboocss/types@1.40.0

## 1.39.1

### Patch Changes

- Updated dependencies [4734709]
  - @bamboocss/shared@1.39.1
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
  - @bamboocss/logger@1.39.0
  - @bamboocss/token-dictionary@1.39.0
  - @bamboocss/is-valid-prop@1.39.0
  - @bamboocss/shared@1.39.0

## 1.38.0

### Patch Changes

- @bamboocss/is-valid-prop@1.38.0
- @bamboocss/logger@1.38.0
- @bamboocss/shared@1.38.0
- @bamboocss/token-dictionary@1.38.0
- @bamboocss/types@1.38.0

## 1.37.13

### Patch Changes

- @bamboocss/is-valid-prop@1.37.13
- @bamboocss/logger@1.37.13
- @bamboocss/shared@1.37.13
- @bamboocss/token-dictionary@1.37.13
- @bamboocss/types@1.37.13

## 1.37.12

### Patch Changes

- @bamboocss/is-valid-prop@1.37.12
- @bamboocss/logger@1.37.12
- @bamboocss/shared@1.37.12
- @bamboocss/token-dictionary@1.37.12
- @bamboocss/types@1.37.12

## 1.37.11

### Patch Changes

- @bamboocss/is-valid-prop@1.37.11
- @bamboocss/logger@1.37.11
- @bamboocss/shared@1.37.11
- @bamboocss/token-dictionary@1.37.11
- @bamboocss/types@1.37.11

## 1.37.10

### Patch Changes

- @bamboocss/is-valid-prop@1.37.10
- @bamboocss/logger@1.37.10
- @bamboocss/shared@1.37.10
- @bamboocss/token-dictionary@1.37.10
- @bamboocss/types@1.37.10

## 1.37.9

### Patch Changes

- @bamboocss/is-valid-prop@1.37.9
- @bamboocss/logger@1.37.9
- @bamboocss/shared@1.37.9
- @bamboocss/token-dictionary@1.37.9
- @bamboocss/types@1.37.9

## 1.37.8

### Patch Changes

- @bamboocss/is-valid-prop@1.37.8
- @bamboocss/logger@1.37.8
- @bamboocss/shared@1.37.8
- @bamboocss/token-dictionary@1.37.8
- @bamboocss/types@1.37.8

## 1.37.7

### Patch Changes

- @bamboocss/is-valid-prop@1.37.7
- @bamboocss/logger@1.37.7
- @bamboocss/shared@1.37.7
- @bamboocss/token-dictionary@1.37.7
- @bamboocss/types@1.37.7

## 1.37.6

### Patch Changes

- @bamboocss/is-valid-prop@1.37.6
- @bamboocss/logger@1.37.6
- @bamboocss/shared@1.37.6
- @bamboocss/token-dictionary@1.37.6
- @bamboocss/types@1.37.6

## 1.37.5

### Patch Changes

- @bamboocss/is-valid-prop@1.37.5
- @bamboocss/logger@1.37.5
- @bamboocss/shared@1.37.5
- @bamboocss/token-dictionary@1.37.5
- @bamboocss/types@1.37.5

## 1.37.4

### Patch Changes

- @bamboocss/is-valid-prop@1.37.4
- @bamboocss/logger@1.37.4
- @bamboocss/shared@1.37.4
- @bamboocss/token-dictionary@1.37.4
- @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/is-valid-prop@1.37.3
- @bamboocss/logger@1.37.3
- @bamboocss/shared@1.37.3
- @bamboocss/token-dictionary@1.37.3
- @bamboocss/types@1.37.3

## 1.37.2

### Patch Changes

- @bamboocss/is-valid-prop@1.37.2
- @bamboocss/logger@1.37.2
- @bamboocss/shared@1.37.2
- @bamboocss/token-dictionary@1.37.2
- @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/is-valid-prop@1.37.1
- @bamboocss/logger@1.37.1
- @bamboocss/shared@1.37.1
- @bamboocss/token-dictionary@1.37.1
- @bamboocss/types@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/is-valid-prop@1.37.0
- @bamboocss/logger@1.37.0
- @bamboocss/shared@1.37.0
- @bamboocss/token-dictionary@1.37.0
- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/is-valid-prop@1.36.5
- @bamboocss/logger@1.36.5
- @bamboocss/shared@1.36.5
- @bamboocss/token-dictionary@1.36.5
- @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/is-valid-prop@1.36.4
- @bamboocss/logger@1.36.4
- @bamboocss/shared@1.36.4
- @bamboocss/token-dictionary@1.36.4
- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/is-valid-prop@1.36.3
- @bamboocss/logger@1.36.3
- @bamboocss/shared@1.36.3
- @bamboocss/token-dictionary@1.36.3
- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/is-valid-prop@1.36.2
- @bamboocss/logger@1.36.2
- @bamboocss/shared@1.36.2
- @bamboocss/token-dictionary@1.36.2
- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/is-valid-prop@1.36.1
- @bamboocss/logger@1.36.1
- @bamboocss/shared@1.36.1
- @bamboocss/token-dictionary@1.36.1
- @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/is-valid-prop@1.36.0
- @bamboocss/logger@1.36.0
- @bamboocss/shared@1.36.0
- @bamboocss/token-dictionary@1.36.0
- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/is-valid-prop@1.35.5
- @bamboocss/logger@1.35.5
- @bamboocss/shared@1.35.5
- @bamboocss/token-dictionary@1.35.5
- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/is-valid-prop@1.35.4
- @bamboocss/logger@1.35.4
- @bamboocss/shared@1.35.4
- @bamboocss/token-dictionary@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/is-valid-prop@1.35.3
- @bamboocss/logger@1.35.3
- @bamboocss/shared@1.35.3
- @bamboocss/token-dictionary@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/token-dictionary@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/is-valid-prop@1.35.2
  - @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

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
  - @bamboocss/is-valid-prop@1.34.1
  - @bamboocss/logger@1.34.1
  - @bamboocss/shared@1.34.1
  - @bamboocss/token-dictionary@1.34.1
  - @bamboocss/types@1.34.1

## 1.34.0

### Minor Changes

- c527ea7: Fail the build on a call to a binding the pattern or recipe entrypoint no longer exports.

  ```
  error: 1 call(s) name a binding that does not exist:

  src/modal.tsx
    `stack` is not a pattern — `../styled-system/patterns` does not export it.

  Both entrypoints are generated from your config, so what they export moves when it does — a pattern
  dropped from a preset, a recipe renamed. The call survives that as a binding to nothing: nothing
  extracts it, so every rule it would have contributed is absent from the stylesheet and the classes
  their components ask for have nothing behind them.
  ```

  Both entrypoints are generated from the config, so what they export moves when it does. The import survives that as a
  binding to nothing — `isValidPattern` declines it, so it never reaches `patternAliases`, `matchFn` declines every call
  of it, and the extractor records nothing. The call site is still there and still asks for a class.

  Removing one pattern took eleven selectors out of a release this way, along with every modal's spacing and width.
  Codegen printed four ticks and exited 0; it was found by diffing selector sets before and after. That is the outcome
  `assertExtracted` already fails on, reached from the other direction, so it now reports the same way — every file
  named in one pass, dropped once the file is fixed, deleted, or leaves `include`, and surviving the incremental passes
  that skip an unchanged file.

  **Reported per call, not per import.** Both entrypoints export types beside their functions — `FlexProperties` from
  `patterns`, `ButtonVariantProps` from `recipes` — and neither is a pattern or a recipe, so an import-only test reports
  every file that types a prop. TypeScript lets those be written without the `type` keyword and elides them either way,
  so the keyword is not a filter this can rely on. A type is never called, which is. A binding nobody calls is left
  alone for the same reason: nothing asked it for a class, so no rule is missing.

  Not governed by a severity option, unlike `unresolvedToken`. That one infers a mistake from a value's shape and can be
  wrong about a literal; this is read off the entrypoint's own export list.

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

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/shared@1.34.0
  - @bamboocss/types@1.34.0
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

- 61561a0: Remove empty nodes in one pass per container, instead of one sibling scan per removal.

  `postcss-discard-empty` removes each node through `Node.remove()`, which postcss resolves with `Container.removeChild`
  — an `indexOf` over the parent's children, then a splice. That is linear per removal, so a pass costs removals ×
  siblings. Hand-written CSS never notices. A generated stylesheet does: every condition's block sits under one cascade
  layer as a sibling of every other, and `mergeRules` runs immediately before, leaving empty `@media` shells behind. A
  663 kB sheet reaches this pass with 6,005 shells under one layer, so both factors grow with the config and the cost is
  their product.

  Measured over a sibling group half of which is empty, against a parse-only control, all three interleaved in one
  process and taken as best of seven:

  | siblings | control | before  | after  | before/control | after/control |
  | -------- | ------- | ------- | ------ | -------------- | ------------- |
  | 8,000    | 8.5ms   | 26.8ms  | 18.8ms | 3.2×           | 2.2×          |
  | 16,000   | 11.8ms  | 54.0ms  | 29.0ms | 4.6×           | 2.5×          |
  | 32,000   | 25.7ms  | 369.0ms | 53.9ms | 14.4×          | 2.1×          |

  The last two columns are the point rather than the speedup: the replacement stays a fixed multiple of the control
  across the range, the way a linear pass does, and what it replaces does not.

  Output is byte-identical — same predicate, same depth-first order, and the same `raws.before` transfer `Root` performs
  when a first child is dropped. `discard-empty.test.ts` pins all of that against upstream, which stays as a
  devDependency for exactly that purpose.

  `optimize-css.bench.ts` could not have caught this. Both of its cases are well-formed throughout, so the removal pass
  walked them and removed nothing; it now carries a case that arrives the way a real sheet does, each paired with a
  size-matched control that has nothing to remove.

- ac54258: Resolve a nested `&` against a combinator parent the same way on every call.

  `getResolvedSelectors` decides between `:is(parent)` and a bare parent with two regexes that carried the global flag
  and were driven with `.test()`. A `/g` regex resumes from `lastIndex` and advances it on a match, so the same argument
  answered `true`, then `false`, then `true` — and the branch was picked by how many times the function had run rather
  than by what it was given.

  The repo's own snapshot had it frozen in place. One input, two structurally identical parents, resolving differently:

  ```js
  globalCss({
    'body > p, body > ul': {
      margin: 0,
      '& ~ &': { marginTop: 10 },
    },
  })
  ```

  ```css
  /* before */
  :is(body > p) ~ :is(body > p),
  body > ul ~ body > ul {
    margin-top: var(--spacing-10);
  }
  /* after */
  :is(body > p) ~ :is(body > p),
  :is(body > ul) ~ :is(body > ul) {
    margin-top: var(--spacing-10);
  }
  ```

  The second half of that selector was not a cosmetic difference. `body > ul ~ body > ul` asks for a `ul` inside a
  `body` that is a _sibling_ of a `ul`, and a document has one `body` — so it matched nothing, and the rule the author
  wrote never applied to anything but the first selector in the list.

  Which selectors were affected depended on stylesheet traversal order, so the same source could emit different CSS
  between builds. Only styles reaching this shape change: a parent carrying a combinator (`` ` ` ``, `+`, `>`, `~`)
  nested under a selector that mentions `&` more than once. Every stylesheet in this repo is byte-identical either way.

- f640a68: Stop serializing the stylesheet only to parse it straight back, and stop the optimize pipeline from rewriting
  the context's own layer tree.

  `Stylesheet.toCss` built its css text and handed it to `optimizeCss`, which parsed it into the tree it needed. On a
  432 kB sheet that round trip cost 13.0ms; cloning the tree instead costs 6.8ms.

  The round trip was doing something else as well, by accident. `Layers.insert()` returns the `Layers` instance's own
  `Root`, and everything downstream rewrites what it is handed — `expandScreenAtRule`, `sortMediaQueries`, the
  cascade-layer polyfill, and then the whole optimize pipeline, which merges rules and drops nodes. A string cannot be
  mutated, so the serialization was the only thing keeping the context's layers intact between calls. Cloning does it
  deliberately, and covers the two plugins that ran against the shared tree even before:

  **Fixes `toCss()` returning different css the second time it is called.** With `config.polyfill` on, a second call
  returned 7,837 bytes where the first returned 4,283 — the polyfill re-applied itself to a tree it had already
  rewritten. Both calls now agree, with the polyfill on or off.

  The exported `optimizeCss` still serializes a `Root` it is given, so it continues to leave the caller's tree alone;
  the consuming variant is internal and used only by `toCss`, on the clone it owns.

  `dedupeNodes` folded `raws.before` into its dedupe key in a way that distinguished absent from empty — every node in a
  _parsed_ tree has one, so this could not arise while the plugin only ever saw re-parsed css, and it can now that it
  sees a tree built directly. Two identical nodes landing on opposite sides of that split would both have survived.

  One output change, in non-minified css only: a nested `@layer`'s closing brace now indents to match its opening (two
  spaces rather than four). `diff -w` against the previous output on an 85 kB sheet reports no differences, and minified
  output is byte-identical.

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0
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

- 9fdce28: One way to reference a token from a string: `token(colors.red.300)`. The curly form is gone.

  ```ts
  // before — both worked, and meant the same thing
  css({ color: '{colors.red.300}' })
  css({ color: 'token(colors.red.300)' })

  // after
  css({ color: 'token(colors.red.300)' })
  ```

  The same everywhere a reference can appear: theme and semantic token values, conditions, media queries, style values.

  `token()` was kept rather than `{…}` because it is the readable one — it reads as what it is, it can be searched for,
  and it is already the name of the javascript api that does the same job. Keeping braces would have left the concept
  with two names, one of which is punctuation.

  It also had a hole that made the choice easy: in a theme or semantic token value, `token(colors.red.300)` was never
  expanded at all. It landed in the emitted stylesheet as literal text — invalid css, no warning. That is fixed. The
  fallback form in a theme value, `token(colors.red.300, blue)`, is still not expanded; that is unchanged by this
  release and remains a known gap.

  **Upgrading.** A curly reference left behind does not fail loudly. In a style value the declaration is dropped; in a
  theme value the literal text is emitted. Nothing warns, and config validation cannot report it either, since it is no
  longer a reference to check. Search your config and styles for `{` followed by a token path.

  Emitted css does not change. What changes is that a class name derived from a value containing a reference now spells
  it `token(…)`, since class names encode the value as authored. Verified byte-identical on two real projects, one of
  them a theme with 39 references.

  Token pruning had to be taught the difference between the two things now spelled `token(`. The gate that decides
  whether javascript can reach a token is a text scan, and a reference inside a css value —
  `css({ border: '1px solid token(colors.red.300)' })` — is not javascript reaching a token. Reading it as one turned
  pruning off wholesale, which measured 3.2x the stylesheet on a sandbox: 246 colour declarations where 11 were used. A
  `token(` that survives blanking every string literal is a call; one that does not was written inside a string.

  Config validation understands the new spelling too. It carries its own copy of the reference regex, because it is the
  thing that reports a missing or circular reference — a spelling only the dictionary understood would have been silence
  rather than an error.

  The fallback form is otherwise unchanged: `token(spacing.4, 4)` still means "this token, or this literal if there is
  no such token", which is how the `bleed`, `divider` and `container` patterns accept either a token name or a raw css
  value.

- dd9d6dc: Register `globalPositionTry` names as values `positionTryFallbacks` and `positionTry` accept.

  ```ts
  globalPositionTry: { 'bottom-scrollable': { alignSelf: 'stretch' } }

  css({ positionTryFallbacks: '--bottom-scrollable' }) // autocompletes, and typechecks under strictTokens
  ```

  The same trade `globalFontface` already made for `fontFamily`: declaring the rule is what makes its name known. A rule
  written as a raw `@position-try` in `globalCss` still ships, but its name stays unknown to the generated types — which
  is now the single reason to prefer either typed option over the raw at-rule, rather than a different reason for each.

  Names are registered under the dashed spelling, because that is what the properties take:
  `position-try-fallbacks: flip` is invalid css. `GlobalPositionTry.names` is normalised for the same reason, so it says
  what the stylesheet declares rather than what the config was keyed by — the two disagreeing would autocomplete a name
  with no rule behind it.

  `positionTryOrder` is left alone: it takes keywords, not a name. Emitted css is unchanged.

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

- 232a83a: Emit css for a config recipe's variant the build could not read, instead of a class with no rule behind it.

  `buttonStyle({ size })`, where `size` is a prop, emitted only the default's rule. At runtime `size="sm"` then put
  `buttonStyle--size_sm` on the element and nothing backed it — silently unstyled, with no diagnostic anywhere. Inline
  `cva` recipes never had this: they emit every declared value precisely so a call the build cannot read still lands on
  a rule.

  The premise was written down and wrong. `hashInlineRecipe`'s comment reasons that a config recipe "can emit only what
  is used because its call sites name their variants statically" — they do not have to.

  Only the axes some call site actually left dynamic are enumerated, so a project whose recipe calls are all static
  emits exactly what it did before; verified byte-identical on the example apps. Slot recipes get the same treatment,
  where the shortfall was worse — an unread axis leaves every slot short rather than one.

  `ParserResult.setRecipe` is what supplies the signal: `buttonStyle({ size })` and `buttonStyle()` both unbox to `{}`,
  so the encoder cannot tell them apart, but the box still holds the key carrying an `unresolvable`.

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [9c32b00]
- Updated dependencies [9fdce28]
- Updated dependencies [678bdee]
- Updated dependencies [a72eb09]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0
  - @bamboocss/token-dictionary@1.31.0
  - @bamboocss/is-valid-prop@1.31.0

## 1.30.1

### Patch Changes

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

### Patch Changes

- Updated dependencies
- Updated dependencies [242b24c]
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

- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0
  - @bamboocss/token-dictionary@1.29.0
  - @bamboocss/logger@1.29.0
  - @bamboocss/is-valid-prop@1.29.0
  - @bamboocss/shared@1.29.0

## 1.28.1

### Patch Changes

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

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/token-dictionary@1.28.1
  - @bamboocss/is-valid-prop@1.28.1
  - @bamboocss/shared@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/token-dictionary@1.28.0
  - @bamboocss/is-valid-prop@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/is-valid-prop@1.27.0
- @bamboocss/logger@1.27.0
- @bamboocss/shared@1.27.0
- @bamboocss/token-dictionary@1.27.0
- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/is-valid-prop@1.26.0
- @bamboocss/logger@1.26.0
- @bamboocss/shared@1.26.0
- @bamboocss/token-dictionary@1.26.0
- @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/is-valid-prop@1.25.0
- @bamboocss/logger@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/token-dictionary@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/is-valid-prop@1.24.0
- @bamboocss/logger@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/token-dictionary@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Minor Changes

- f4a2824: Fold calls of inline recipes into the class string they produce.

  ```ts
  const badge = cva({
    base: { rounded: 'full' },
    variants: { tone: { info: { bg: 'blue.100' } } },
  })

  // you write
  const cls = badge({ tone: 'info' })

  // the bundle gets
  const cls = 'cva_1a2b3c cva_1a2b3c--tone_info'
  ```

  **The prize is the config, not the runtime.** `cva({ base, variants })` ships the whole style object to the browser so
  that `cva` can hash it into a name and pick classes off it — but those styles are already in the stylesheet. Once
  every call of a binding folds, the binding is unreferenced and your bundler drops the config with it. Measured on an
  application with 1,271 inline recipe bindings: **173 of them fold completely, dropping 9.6 kB gzipped of config**,
  while the folded call sites are themselves slightly _smaller_ than the calls they replace. The `cva` runtime is 4.5 kB
  by comparison.

  **Correct by construction.** The class names come from `getRecipeIdentity` and `getRecipeClassNames` — the same
  functions the generated `cva` runs, not a reimplementation — and prefixing and hashing from `classFormatter`, which is
  what the encoder emitted the rules under. A parity suite compares the folded string against the real generated `cva`
  across defaults, multi-axis selections, values containing spaces, a declared `className`, compound variants and a
  default naming an undeclared value.

  **What still declines,** reported as `recipe-call` exactly as before:
  - Any selection with a property the build cannot resolve — `badge({ tone })` where `tone` is a prop or state. This is
    the common case in application code, and it is deliberately all-or-nothing: an unresolved variant does not merely
    omit a class, so a partially-known selection does not fold at all.
  - A ternary, which yields several candidate selections and no single literal.
  - **A selection that could _run_ something.** `badge({ tone: pick() })` has a knowable class and a call inside it;
    folding deletes the argument, so the call would never run. Same contract the `token()` fallback already keeps.
  - **A config the build could not read**, such as `cva(makeConfig())`, which the extractor resolves to `{}`. That is
    not an empty config, and folding against it would substitute the identity of `{}` for the call that produces the
    real classes, leaving the element permanently unstyled. (A config _imported from another module_ does resolve and
    does fold — an earlier draft of this note said otherwise, and was wrong.)
  - A slot recipe. `sva(...)` invocations return one class per slot rather than a string.
  - `.raw()`, `.merge()`, and anything else reaching the recipe object rather than calling it.

  **The value a call site was written with always comes from the source.** The extractor's resolved data is consulted
  only to supply a value for a property that is present in both — because that data is lossy in the one direction that
  matters: a property it could not resolve is _dropped_ rather than flagged, so `badge({ tone })` and `badge({})` are
  indistinguishable in it. Folding the first as the second would emit a class string missing a variant and render the
  element wrongly, with nothing to report it.

  Variant keys are read from the property's name node rather than by stripping quotes from its text, so
  `badge({ '\u0074one': 'info' })` selects `tone` as the runtime does instead of silently dropping the variant.

  `classFormatter` is now exported from `@bamboocss/core`, so the fold and the naming-agreement check derive names the
  same way.

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

### Patch Changes

- Updated dependencies [b041398]
- Updated dependencies [087b884]
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

### Patch Changes

- 1036258: Replace `postcss-discard-duplicates` with a linear pass, making CSS generation 7x faster on a large
  stylesheet.

  Emitted CSS is unchanged — byte-identical on every sandbox in this repo, and the new pass is asserted against the
  plugin it replaces rather than against a snapshot.

  On one shape it removes something the old pass left behind. Upstream interleaves its recursion with its sibling walk,
  so a later sibling is compared against earlier ones before those have had their own inner duplicates removed; two
  blocks equal only after that removal both survive a pass, and one goes on the next. This pass recurses over the whole
  subtree first, so it settles them at once — one pass here is upstream run until it stops changing anything. What it
  drops is an exact duplicate, and dropping the earlier of two exact duplicates cannot change the cascade, so this is
  the same transformation applied where upstream's traversal order happened to miss it.

  On one other shape it keeps something the old pass removed, and that direction is worth stating too. Upstream's
  `equals` compares children only when both nodes have them, so it calls a bodyless at-rule equal to a bodied one
  sharing its name and params: `@media print;@media print{.a{c:1}}` loses the real block because an empty declaration
  preceded it. This keys the child count as part of the signature, so the two differ and both survive. Nothing bamboo
  emits is bodyless, so neither shape arises in generated CSS — both are pinned in `dedupe-nodes.test.ts` so the
  equivalence claim above is not read as unconditional.

  `postcss-discard-duplicates` moves to a dev dependency, since only the test that asserts agreement with it still
  imports it. Consumers stop installing it.

  **Where the time went**

  Profiling a build that emits 493 kB of CSS put 925ms of its 1,066ms in `getCss`, and 767ms of that inside
  `postcss-discard-duplicates`:

  ```
  383 ms  dedupe
  218 ms  dedupeNode
  127 ms  equals
  ```

  That plugin compares every at-rule and declaration against **all** of its preceding siblings. Rules are fine — they
  are grouped by selector first — but at-rules are not, and a generated stylesheet is the worst possible shape for it:
  one `@media` block per condition, all siblings under one layer. The measured config had 5,000 of them side by side,
  which is ~12.5M `equals()` calls. In normal operation it finds nothing, because the encoder does not emit duplicates;
  removing the pass entirely produced byte-identical output.

  `dedupeNodes` keys each node instead, so the same work is one pass over the tree:

  |                 |   before |  after |
  | --------------- | -------: | -----: |
  | encode + decode |   141 ms | 136 ms |
  | `getCss`        |   925 ms | 127 ms |
  | **total**       | 1,066 ms | 263 ms |

  Small stylesheets are unaffected either way — the pass was never the cost there.

  **Why it is asserted against the plugin rather than snapshotted**

  A snapshot would only record what the new one does. `dedupe-nodes.test.ts` runs both over the same input instead:
  fourteen hand-written cases plus 400 randomised stylesheets drawn from a deliberately tiny alphabet, so duplicates
  arise constantly rather than by luck.

  That fuzzing earned its place. The first version deduped each same-selector group against its final member only, which
  is not what upstream does — it walks from the end, so every member in turn strips its declarations out of all earlier
  ones. `.a{d:2}.a{d:2}.a{c:1}` loses its middle rule upstream and lost nothing here. 65 of 400 random stylesheets
  caught it; none of the hand-written cases did.

  What that fuzzer cannot catch is the divergence above, because it builds every node independently and two siblings
  equal only after their own contents are deduped essentially never arise — 2,000 cases produced none. So the divergence
  has its own generator, which emits a block holding duplicated content beside the same block already clean, and asserts
  the difference from a single upstream pass rather than papering over it.

  Same-selector handling stays quadratic on purpose. A selector group is a handful of rules, unlike the sibling scan
  this replaces.

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/token-dictionary@1.22.0
  - @bamboocss/is-valid-prop@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/token-dictionary@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/is-valid-prop@1.21.0
  - @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/is-valid-prop@1.20.4
- @bamboocss/logger@1.20.4
- @bamboocss/shared@1.20.4
- @bamboocss/token-dictionary@1.20.4
- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- fa63a80: Warn when a token path resolves to nothing instead of emitting it as a literal.

  Every branch of `getPropertyRawValue` ends in `|| value`, so a path that names no token was handed straight through:

  ```ts
  css({ background: 'accent.default' }) // accent.default is not a token
  ```

  ```css
  background: accent.default; /* parses, so nothing objects — the browser drops it */
  ```

  The build passed, the CSS was valid, and the declaration was discarded at compute time. It surfaced as "this colour
  never applied", a long way from the typo that caused it. One project found six of these.

  Emitted CSS is unchanged — this reports, it does not rewrite. The message names the value, the property, the token
  category, and `[…]` as the escape hatch if the value really is a literal.

  **What it does and does not fire on**

  A value only qualifies if it is shaped like a path — dot-separated segments, the first starting with a letter and the
  rest with a letter or digit. That is what keeps `0.5` and `1.5rem` out of it, and it is checked after a
  `value.includes('.')` reject, so most values never reach the regex. Cost measured at 26ns per value over control,
  across 165,000 values.

  Membership in the property's value set decides it, via `getPropertyValues`, which normalises all four shapes of
  `values` — a category name, an array, a function, an object. Reading the token category directly would have covered
  `padding` and not `margin`, whose values are a function, and that is worse than covering neither: it teaches you the
  warning can be trusted. It also cannot use "did the resolver return the value unchanged", because for an array-valued
  property it returns the value either way, so every valid `textStyle: 'headline.h1'` would be reported.

  Each `fallback(...)` candidate is checked separately. The whole string has parentheses so it is not path-shaped, and
  left alone the working candidate hides the broken one permanently — the same silent failure wearing something that
  makes it look deliberate.

  A property that enumerates no values is left alone: nothing is known, so nothing can be wrong. Each mistake is
  reported once, since `transform` runs per condition and one typo would otherwise warn once per breakpoint.
  - @bamboocss/is-valid-prop@1.20.3
  - @bamboocss/logger@1.20.3
  - @bamboocss/shared@1.20.3
  - @bamboocss/token-dictionary@1.20.3
  - @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/is-valid-prop@1.20.2
- @bamboocss/logger@1.20.2
- @bamboocss/shared@1.20.2
- @bamboocss/token-dictionary@1.20.2
- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

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

- 0e2cb31: Stop breakpoints in an unrecognised unit being read as pixels.

  `getUnit` matched anywhere in a string and only in lower case, and the conversions ran `parseFloat` over the raw
  value. `parseFloat` returns a number for plenty of strings that are not a pixel count, so a unit the conversion did
  not recognise was silently treated as one. Two ways to reach it, both producing valid CSS that matches the wrong
  viewports or none:

  | breakpoints        | `mdOnly` emitted                               | should be                                        |
  | ------------------ | ---------------------------------------------- | ------------------------------------------------ |
  | `50EM`             | `(min-width: 40EM) and (max-width: 3.1225rem)` | `(min-width: 40rem) and (max-width: 49.9975rem)` |
  | `calc(40em + 0px)` | `(min-width: NaNrem)`                          | the value, unchanged                             |
  | `50vw`             | `(max-width: 3.1225rem)`                       | `(max-width: 50vw)`                              |

  `40EM` is as valid as `40em`; CSS units are case-insensitive. Reading it as `40px` made the range sixteen times too
  small, so `min-width: 640px` and `max-width: 50px` matched nothing at all. `validateBreakpoints` did not catch any of
  it, because it asked the same function and fell back to `px` for whatever came back empty — a theme written entirely
  in `EM`, or mixing `em` with `vw`, passed the same-unit check.

  Now:
  - Unit matching is anchored and case-insensitive, so a unit inside a larger expression is not mistaken for the value's
    own, and `40EM` converts exactly as `40em` does. The number accepts what CSS accepts, including `.5rem` and `1e3px`.
  - The numeric half is read from the match rather than by `parseFloat` over the raw string, so a value that is not a
    number and a unit is passed through untouched instead of becoming `NaN`.
  - Breakpoint arithmetic only steps a value down when it is in a unit that converts to pixels. Anything else — `vw`,
    `ch`, a `calc()` — is emitted as written. That costs an overlap of one unit between adjacent ranges, against a range
    that previously matched nothing. (Superseded in the same release: range syntax removed the step entirely, so these
    units no longer overlap either.)
  - `validateBreakpoints` reads the unit generically, so it can tell `em` from `EM` from `vw` and its same-unit check
    works for units bamboo does not convert.

  `unit-conversion.ts` had no test file. It has one now, along with breakpoint cases for each shape above.

- Updated dependencies [5d2c91c]
- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0441724]
- Updated dependencies [0e2cb31]
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

- @bamboocss/is-valid-prop@1.19.0
- @bamboocss/logger@1.19.0
- @bamboocss/shared@1.19.0
- @bamboocss/token-dictionary@1.19.0
- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- 070f9da: Keep the token a custom property outside the token layer points at, and scaffold pruning into new projects.

  `pruneUnusedTokens` decided reachability by following references found in the stylesheet. A custom property the token
  system did not declare is never removed — it is not pruning's to remove — but it was only treated as reachable if
  something else in the sheet referenced it. Exporting a value is precisely the case where nothing does:

  ```ts
  globalCss: {
    ':root': { '--brand': '{colors.blue.500}' },
  }
  ```

  `--brand` survived; `--colors-blue-500` did not. The result was a `var()` with no declaration behind it, which
  resolves to the guaranteed-invalid value — so a colour falls back to _inherited_ rather than to nothing. Silently
  wrong rather than visibly missing, and invisible in a css diff unless you were looking for it.

  Any custom property pruning will not remove is now a root of the reachability walk, so what it references is kept with
  it. Costs nothing: measured byte-identical output across the website and every sandbox, none of which declares one.

  `bamboo init` now scaffolds `pruneUnusedTokens` and `pruneUnusedKeyframes` as `true`, with a note on when to turn them
  off. They stay `false` by default, so no existing project changes. A new project gets 50-60% off its stylesheet on day
  one, when it has no styles yet and anything unexpected is immediately visible — measured 5,304 -> 2,213 bytes gzipped
  on a stock Next.js app, 5,566 -> 2,601 on Remix, and 15,619 -> 13,017 on this repo's own docs site.

  The config docs also now say which `token()` form actually needs `staticCss`: `token(key)` is safe for any path,
  because javascript receives a literal for a plain token. It is `token.var(key)` that hands back a reference and needs
  the declaration to survive.

- Updated dependencies [21c6daa]
  - @bamboocss/shared@1.18.0
  - @bamboocss/token-dictionary@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/is-valid-prop@1.18.0
  - @bamboocss/logger@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3
- @bamboocss/is-valid-prop@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/shared@1.17.3
- @bamboocss/token-dictionary@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/is-valid-prop@1.17.2
- @bamboocss/logger@1.17.2
- @bamboocss/shared@1.17.2
- @bamboocss/token-dictionary@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- a1c3990: Make the naming-agreement check actually cover compound variants.

  `checkNamingAgreement` fails a build when the stylesheet and the runtime derive different class names, and its recipe
  canary has always carried a `compoundVariants` entry — with a comment saying the canary "has to carry one or that half
  is unchecked". That half was unchecked.

  A compound's rule selects on the classes the element already has, `.btn--size_sm.btn--tone_a`, and contributes none of
  its own. The check compared class names: `filterClassNames` returns none for a compound, and the build side is then
  narrowed to the runtime's set, so nothing about one survived on either side. Adding the compound to the canary changed
  nothing that was compared.

  That matters because a compound's selector is assembled from class names rather than produced by `createCss`, which is
  exactly how it came to skip `hash.className` and `prefix` once already — rules emitted for `.btn--size_sm.btn--tone_a`
  while the runtime asked for `.pfx-btn--size_sm`, every compound silently not applying, and the guard meant to catch it
  reporting success.

  The check now reads the compound's selector — `getAtomic` folds it into the rule's own style-object key, so a compound
  is the rule whose key is something other than its class — and verifies every class it selects on is one the runtime
  returns for the selection that activates it. Re-introducing the original defect now fails the check under `hash`,
  `prefix`, and both together, and correctly still passes without them, where a raw name and a formatted one are the
  same string.

  `naming-agreement.test.ts` also states the invariant directly, across every combination of `cssMode`, `hash`, `prefix`
  and `separator`: every class a compound selects on must be one the build emitted a rule for. It asserts a compound was
  found before checking it, so it cannot pass on an empty list — which is how the canary went quiet in the first place.

- Updated dependencies [fc381ca]
  - @bamboocss/shared@1.17.1
  - @bamboocss/token-dictionary@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/is-valid-prop@1.17.1
  - @bamboocss/logger@1.17.1

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

- 66cb96c: **Fix:** a recipe variant whose value looks like a number to `Number()` emitted no rule at all.

  ```ts
  cva({
    className: 'rt',
    variants: { size: { '1.0': { padding: '1' }, sm: { padding: '4' } } },
  })
  // before: only `.rt--size_sm` existed; the runtime still returned `rt--size_1.0`
  ```

  A variant value is a _key_ of the `variants` object, so it is a string by construction, and the propKey it is stored
  under keeps it as written. The decoder reinterpreted it with `parseValue` on the way back out — which coerces anything
  `Number()` accepts — so `'1.0'`, `'1e3'` and `'0x10'` returned as `1`, `1000` and `16`, the lookup missed, and the
  rule was dropped. Nothing was reported; the element simply carried a class no rule existed for.

  Canonical numerics (`0`, `1`, `01`) and booleans round-tripped, which is why this held together at all. They are
  unaffected.

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
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [355e573]
  - @bamboocss/shared@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/token-dictionary@1.17.0
  - @bamboocss/logger@1.17.0
  - @bamboocss/is-valid-prop@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1
- @bamboocss/is-valid-prop@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/shared@1.16.1
- @bamboocss/token-dictionary@1.16.1

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

- 6fb235d: Fix a recipe's base styles losing to its variants under a condition, silently dropping hover, focus and
  dark-mode styling.

  Base rules were emitted into a nested `@layer _base` inside `@layer recipes`, with the variant rules unlayered
  alongside them. A layer's own unlayered rules always beat its nested sublayers, whatever their selectors say — **layer
  order outranks specificity**. So a base declaration written under a condition lost to an unconditional variant
  declaration _even while the condition held_:

  ```ts
  base: { boxShadow: '4px…', _hover: { boxShadow: '6px…' } },
  variants: { color: { black: { boxShadow: 'none' } } }
  ```

  `<Button color="black">` computed `box-shadow: none` at rest **and while hovering** — verified in Chromium. The hover
  style was unreachable. The identical config expressed as a `cva` merges in JS and keeps it, so the two pipelines
  disagreed on the same input.

  Base rules now go into the recipe layer directly, ahead of the variants. In one layer the ordinary cascade applies
  again: the conditional selector wins on specificity, and two equal-specificity declarations fall back to source order
  — which is why base is emitted first, so an unconditional variant still overrides an unconditional base.

  The emitted CSS changes for every config recipe: `@layer recipes { @layer _base { … } … }` becomes
  `@layer recipes { … }` with the same rules in the same order, one level shallower. Slot recipes get the same
  treatment.

- 6fb235d: Fix three smaller defects found while investigating recipe cascade ordering.

  **`inferSlots` collected variant values as slot names.** `variants` nests one level deeper than `base` does —
  `{ size: { sm: { root: {…} } } }` — and the inference read the keys of `{ sm: … }`. A slot recipe with a `size.sm`
  variant grew a phantom `sm` slot, and rules were emitted for it.

  **`processAtomicSlotRecipe` mutated the config it was given.** It assigned the inferred slot list back onto
  `recipe.slots`, and that object is the extractor's own `ResultItem.data`, so the config stayed changed for everything
  downstream. It now works on a copy. Snapshots that recorded a `slots` key the source never declared have been updated.

  **A non-static string concatenation produced a wrong value rather than no value.** `css({ padding: '2' + n })` with an
  unresolved `n` extracted as the literal `'2undefined'` — not an unresolvable box and not a dropped key — and reached
  the stylesheet as `.p_2undefined { padding: 2undefined }`. The evaluator's fallback stringifies an operand it could
  not resolve; that result is now treated as unresolved. A concatenation the build _can_ resolve is unaffected.

- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
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
  - @bamboocss/token-dictionary@1.15.0
  - @bamboocss/logger@1.15.0
  - @bamboocss/is-valid-prop@1.15.0

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

- 42fab68: Look up a recipe node by name instead of scanning every recipe.

  `recipes.details` is a getter that materializes the whole node list, so finding one by name built an array of every
  recipe in the theme and then linear-scanned it. `baseName` is the key the node is already stored under, so `getNode`
  reads it straight from the map.

  Two callers did this: the parser, once per recipe-component usage in the source (via `Recipes.splitProps`), and
  `staticCss`, once per recipe in the static config.

  The lookup itself, against recipe count:

  | recipes | scan   | map    |
  | ------- | ------ | ------ |
  | 2       | 16 ns  | 6.0 ns |
  | 30      | 95 ns  | 6.0 ns |
  | 120     | 288 ns | 6.3 ns |

  It is flat where the scan is linear, so the saving grows with the size of the design system. The repo's `static-css`
  benchmarks are unmoved by it, and should be: their config names one recipe, so a `process()` run does a single lookup
  — tens of nanoseconds against a 52 µs operation.

  `getNode` is deliberately not memoized, unlike the neighbouring `getRecipe`: the node map is module-level state that
  `saveOne` and `remove` write to, so reading through keeps the freshness the scan had.

- 7f87699: Remove `StaticCss.parse`.

  It had no callers anywhere — not in this repo, its sandboxes, the playground or the docs — and was never documented.
  The private `createRegex` behind it existed only to serve it. It was stranded by the 2024 static-css engine refactor,
  which stopped returning either from `process()`, and has been unreachable in practice ever since: hooks receive a
  curated interface that `staticCss` is not on.

  That it was broken is the clearest evidence nothing called it. `matches.map((m) => m.replace('.', ''))` strips the
  first dot anywhere in the string, and generated class names contain dots — so it would have handed back `c_red300` for
  `c_red.300`.

  Worth removing rather than leaving: it built a regex alternation over every class name the decoder knows and
  recompiled it on every call, so the first thing to reach for it would have paid for the whole stylesheet per
  invocation. Deleting an uncalled method is perf-neutral by construction, so there is no measurement to report.

  The method was declared in the published types, so this is a removal from `@bamboocss/core`'s surface rather than from
  its internals. Filed as a patch, matching how this repo has treated removing an undocumented binding before — the
  package has no README, and the docs never reference it.

  `decoder.classNames`, the state it read, stays reachable through the hooks API.

- 1f5d4fb: Hoist the work `sortStyleRules` was repeating inside its comparator.

  This runs on every build, for every project. The CSS emitted from extracted app source goes through
  `Stylesheet.processDecoder`, and `StyleDecoder.collectAtomic` sorts before that — so every atomic style the extractor
  finds is sorted twice, whether or not `staticCss` is configured. It is also on the fold's path, through
  `filterClassNames`.

  A comparison sort of N rules calls its comparator on the order of N log N times, so anything derived inside one is
  recomputed roughly thirteen times per rule at the sizes a real project reaches. Three things were being derived per
  comparison rather than per rule:
  - `flatten` allocated a fresh array for **both** operands on every call. It now runs once per rule, ahead of the sort,
    and the comparator receives them already flattened.
  - `sortCSSmq` ran six regexes and a length parse over each of its two query strings. Those facts are now derived once
    per distinct query and cached on the text, so two rules carrying the same breakpoint share the entry.
  - `pseudoSelectorScore` scanned its seven-entry table per comparison, over a set of selectors that is small and
    repeats.

  All three are pure functions of their input, so no comparison can return a different answer and the sorted order is
  identical — the full suite passes unchanged, CSS output snapshots included.

  Measured on 10,000 rules, against a control of the same sort with no conditions that held at 1.00x across the pair:

  | sort                | before   | after   |         |
  | ------------------- | -------- | ------- | ------- |
  | at-rule conditions  | 26.854ms | 3.967ms | 6.77x   |
  | selector conditions | 8.298ms  | 4.064ms | 2.04x   |
  | no conditions       | 2.672ms  | 2.661ms | control |

  What this is worth end to end is not certified. The workload that made the cost visible was a `staticCss` config large
  enough to produce 13,350 atoms in a single rule set, and at the whole build level the effect read directionally
  positive but the machine would not hold still long enough to put a number on it. Worth re-taking on an idle machine.

  Adds `sort-style-rules.bench.ts`, which sorts a shuffled input rather than the decoder's already-ordered output. That
  distinction is what hid the cost: a nearly-sorted array costs TimSort far fewer comparisons, and measuring it
  flattered the comparator by about 4x.

- 4a7d40c: Make `StaticCss.clone()` return an independent instance.

  It reassigned its own encoder and decoder and handed back `this`, so every caller shared one object — and, less
  visibly, one `wildcardCache`. Callers reach for it to get isolation: `ctx.staticCss.clone().process(…)` is the idiom
  throughout the tests and benchmarks.

  The cache is what made this worth fixing. A "cold" instance inherited whatever the last caller had warmed, so the cold
  and warm `process()` benchmarks measured the same populated cache and sat within 2% of each other — a pair whose whole
  purpose was to show the difference between them. With the clone actually isolated they read 203ms against 135ms, so
  the wildcard cache is worth about a third of `process()`; it was always doing that work, and nothing could show it.

  The cloned encoder and decoder stay cloned rather than rebuilt from the context: `process()` reads whether they differ
  from `context.encoder`/`context.decoder` to tell a clone from the context's own instance, and uses fresh ones per call
  when they do.

  No production code calls `clone()` — it is a test and benchmark affordance — so this changes no CSS output.

- f2d7565: Expand `staticCss` conditions without rescanning the condition list.

  Two things in the same inner loop, which runs once per condition per computed value:
  - `formatCondition` asked whether a name is a known condition with `Array.prototype.includes` over
    `Object.keys(config.conditions)`. The base preset alone declares 107 of them, and a container query — never in that
    list — scanned all 107 before missing. It reads a `Set` now.
  - `getConditionalValues` spread its accumulator per condition, building a fresh object of growing size for each. It
    assigns into one object now.

  Rule expansion, measured on its own rather than through `process()`, which is dominated by encoding and css
  generation:

  | rule (40 values)        | before     | after      |        |
  | ----------------------- | ---------- | ---------- | ------ |
  | five interactive states | 32,620 hz  | 300,303 hz | 9.2x   |
  | four container queries  | 43,625 hz  | 325,252 hz | 7.5x   |
  | no conditions (control) | 725,933 hz | 737,085 hz | 1.015x |

  `static-css-real-world.bench.ts` now carries those three cases, the last as the control — they are the only benchmarks
  that isolate this from the rest of a `process()` run.

  Output is unchanged, key order included. A condition named `__proto__` is still defined rather than assigned, so it
  stays an own key instead of reparenting the object it lands on.

- faffa8e: Append rule results without spreading them into `push`.

  `sorted.push(...withSelectorsOnly, ...withAtRules)` and the four `results.*.push(...)` calls in `staticCss` pass every
  element as a separate argument. That is the quicker way to append while the array is small, and it stops being so
  abruptly — measured here, per element:

  | elements | ns/element |
  | -------- | ---------- |
  | 10,750   | 0.88       |
  | 11,000   | 4.37       |

  Past that it eventually throws rather than slowing down, because the arguments stop fitting on the stack. There is no
  single size where that happens: ~124,000 from an empty stack, ~16,000 from nine thousand frames down.

  Both sites are reachable on inputs that are large rather than absurd. A `staticCss` rule naming every utility with a
  wildcard expands to ~15,000 objects against this repo's own fixture, and `sortStyleRules` — which runs on every build,
  over every rule in the stylesheet — gets several times more from the same input.

  Both now append with a loop, and the cost of that is real but small. Rules shaped like the ones in the real-world
  benchmark append 87, 562 and 147 objects, and doing so with a loop takes `getStyleObjects` from 0.116 ms to 0.122 ms —
  5% of a step that is a fraction of a millisecond inside a build measured in hundreds. In exchange the cost stays
  linear at every size instead of inverting and then failing.

  A threshold that kept the spread below a few thousand elements was the first attempt, and was dropped: it cannot make
  the ceiling safe, only less likely to be met, and it left two branches where one is enough — including one where
  appending an array to itself would not terminate.

- 745727b: Stop `staticCss` rules with `responsive: true` mutating the config they came from.

  Appending the breakpoints to a rule's `conditions` pushed into the array in place. The `|| []` default only stands in
  when the field is absent, so a rule setting both `conditions` and `responsive` had the user's own array grown — and
  both callers of `process` pass `ctx.config.staticCss` itself, so it grew again on every run:

  ```
  before:  ["light"]
  after 1: ["light","sm","md","lg","xl","2xl"]
  after 2: ["light","sm","md","lg","xl","2xl","sm","md","lg","xl","2xl"]
  ```

  Under `recipes: '*'` the rule being destructured is the recipe's own `variantKeyMap`, so a recipe with a variant named
  `conditions` had that variant's list of values appended to instead — and `variantKeyMap` is module-level state that is
  stringified into the generated recipe artifact, so the damage reached emitted code.

  Affected the `css`, `patterns` and `recipes` forms alike. Nothing covered `responsive` before this; every example in
  the docs sets it on a rule with no `conditions`, where the default hid the aliasing.

- Updated dependencies [b567114]
- Updated dependencies [d1d05fc]
  - @bamboocss/types@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/logger@1.14.0
  - @bamboocss/token-dictionary@1.14.0
  - @bamboocss/is-valid-prop@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/token-dictionary@1.13.2
  - @bamboocss/types@1.13.2
  - @bamboocss/is-valid-prop@1.13.2
  - @bamboocss/logger@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/is-valid-prop@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/token-dictionary@1.13.1
- @bamboocss/types@1.13.1

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

### Patch Changes

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

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
  - @bamboocss/shared@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/token-dictionary@1.13.0
  - @bamboocss/logger@1.13.0
  - @bamboocss/is-valid-prop@1.13.0

## 1.12.3

### Patch Changes

- Rename panda to bamboo across all packages.
  - @bamboocss/is-valid-prop@1.12.3
  - @bamboocss/logger@1.12.3
  - @bamboocss/shared@1.12.3
  - @bamboocss/token-dictionary@1.12.3
  - @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/is-valid-prop@1.12.2
- @bamboocss/logger@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/token-dictionary@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/is-valid-prop@1.12.1
- @bamboocss/logger@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/token-dictionary@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/is-valid-prop@1.12.0
- @bamboocss/logger@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/token-dictionary@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- f3591d8: Fix chunk splitting in build output that produced unstable hashed filenames in published packages.
  - Build each entry point independently to prevent shared-code extraction into chunk files
  - Fix build ordering race condition where studio postbuild could run before CLI was ready
  - @bamboocss/is-valid-prop@1.11.5
  - @bamboocss/logger@1.11.5
  - @bamboocss/shared@1.11.5
  - @bamboocss/token-dictionary@1.11.5
  - @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/is-valid-prop@1.11.4
  - @bamboocss/logger@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/token-dictionary@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
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

## 1.11.1

### Patch Changes

- 2f29aa6: Bump `postcss` from `8.5.6` to `8.5.14` to address
  [CVE-2026-41305](https://www.cve.org/CVERecord?id=CVE-2026-41305).
- Updated dependencies [2ea9205]
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

- 055e69c: Pin `@csstools/postcss-cascade-layers` back to `5.0.2`.

  Version `6.0.0` dropped the CommonJS export and raised the engine requirement to Node `>=20.19.0`, which broke
  `bamboo codegen` on Node 20.0–20.18 and Node 18 with `ERR_REQUIRE_ESM` (issue #3518). Since `@bamboocss/core` ships a
  CJS build that requires the package, we stay on the last dual-published version. The two releases are functionally
  equivalent — v6 only removed CJS support.

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/token-dictionary@1.11.0
  - @bamboocss/is-valid-prop@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [bc2b8d7]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0
  - @bamboocss/token-dictionary@1.10.0
  - @bamboocss/is-valid-prop@1.10.0

## 1.9.1

### Patch Changes

- 8fda1a5: Fix pseudo-element conditions (::before, ::after) being placed before pseudo-class selectors in generated CSS

  When a pseudo-element condition like `_before` was combined with a mixed condition like `_hover` (defined as an array
  with a media query + selector), the pseudo-element would incorrectly appear before the pseudo-class in the generated
  CSS selector.

  **Before (broken):** `.class::before:is(:hover, ...)` - invalid CSS **After (fixed):**
  `.class:is(:hover, ...)::before` - valid CSS

  The fix ensures pseudo-element selectors are always sorted last in the condition chain, matching the CSS specification
  requirement that pseudo-elements must appear at the end of a selector.

- Updated dependencies [d02fcf6]
  - @bamboocss/token-dictionary@1.9.1
  - @bamboocss/is-valid-prop@1.9.1
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

- 7d66c0b: Wrap enum pattern property types with `ConditionalValue` again so generated pattern typings remain
  conditional-safe.
  - @bamboocss/is-valid-prop@1.9.0
  - @bamboocss/logger@1.9.0
  - @bamboocss/shared@1.9.0
  - @bamboocss/token-dictionary@1.9.0
  - @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- 82d23ab: Fix condition order when combining mixed conditions (array format) with nested selectors.

  When using conditions like `hover: ['&:hover']` with nested selectors like `'& > :where(svg)'`, the CSS selector order
  was incorrect:

  ```js
  // Before (broken):
  // .class > :where(svg):hover - hover applied to svg child

  // After (fixed):
  // .class:hover > :where(svg) - hover applied to parent element
  ```

  The fix ensures that:
  - At-rules are always placed first (for proper CSS wrapping)
  - Selector conditions preserve their source order (matching what you write)

  This affects users who define conditions using the array format and combine them with arbitrary/nested selectors.

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2
  - @bamboocss/is-valid-prop@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/token-dictionary@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/token-dictionary@1.8.1
  - @bamboocss/is-valid-prop@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/is-valid-prop@1.8.0
- @bamboocss/logger@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/token-dictionary@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/is-valid-prop@1.7.3
- @bamboocss/logger@1.7.3
- @bamboocss/shared@1.7.3
- @bamboocss/token-dictionary@1.7.3
- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/is-valid-prop@1.7.2
- @bamboocss/logger@1.7.2
- @bamboocss/shared@1.7.2
- @bamboocss/token-dictionary@1.7.2
- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- @bamboocss/is-valid-prop@1.7.1
- @bamboocss/logger@1.7.1
- @bamboocss/shared@1.7.1
- @bamboocss/token-dictionary@1.7.1
- @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- f37fd8d: Fix `cssgen --splitting` not fully respecting `staticCss: { recipes: "*" }`.
  - When `staticCss: { recipes: "*" }` is set globally, individual recipes with their own `staticCss` property would
    override the global wildcard, potentially omitting variants.
  - Split CSS generation was missing recipes that only have base styles (no variants).

- Updated dependencies [86b30b1]
  - @bamboocss/types@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/token-dictionary@1.7.0
  - @bamboocss/is-valid-prop@1.7.0
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

  - @bamboocss/is-valid-prop@1.6.1
  - @bamboocss/logger@1.6.1
  - @bamboocss/shared@1.6.1
  - @bamboocss/token-dictionary@1.6.1
  - @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/is-valid-prop@1.6.0
- @bamboocss/logger@1.6.0
- @bamboocss/shared@1.6.0
- @bamboocss/token-dictionary@1.6.0
- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

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

- Updated dependencies [91c65ff]
  - @bamboocss/types@1.5.0
  - @bamboocss/token-dictionary@1.5.0
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

- 84a0de9: Improve static CSS generation performance with wildcard memoization. Token lookups for wildcard (`*`)
  expansions are now cached, providing ~32% faster processing for large configs with wildcards.
  - @bamboocss/is-valid-prop@1.4.3
  - @bamboocss/logger@1.4.3
  - @bamboocss/shared@1.4.3
  - @bamboocss/token-dictionary@1.4.3
  - @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

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

- Updated dependencies [1290a27]
- Updated dependencies [70420dd]
  - @bamboocss/shared@1.4.2
  - @bamboocss/token-dictionary@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/is-valid-prop@1.4.2
  - @bamboocss/logger@1.4.2

## 1.4.1

### Patch Changes

- db237b6: Improve recipe variant props tracking in JSX
  - @bamboocss/is-valid-prop@1.4.1
  - @bamboocss/logger@1.4.1
  - @bamboocss/shared@1.4.1
  - @bamboocss/token-dictionary@1.4.1
  - @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- 4c291ca: JSX: Always track the `<component>.Root` for recipe variant props. This is a generally resilient default and
  prevents the need for manual jsx hints.
  - @bamboocss/is-valid-prop@1.4.0
  - @bamboocss/logger@1.4.0
  - @bamboocss/shared@1.4.0
  - @bamboocss/token-dictionary@1.4.0
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- 7fcd100: Fix issue where Bamboo eagerly tracks every JSX slot of a slot recipe when scanning for recipe props.

  For example, assume you have a tabs recipe with the following slots:

  ```jsx
  <Tabs.Root>
    <Tabs.List>
      <Tabs.Trigger />
    </Tabs.List>
    <Tabs.Content />
  </Tabs.Root>
  ```

  Bamboo tracks recipe props in `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content`. This can lead to slightly
  more works in the compiler.

  This PR fixes this by only tracking recipe props in the `Tabs.Root` slot.
  - @bamboocss/is-valid-prop@1.3.1
  - @bamboocss/logger@1.3.1
  - @bamboocss/shared@1.3.1
  - @bamboocss/token-dictionary@1.3.1
  - @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/token-dictionary@1.3.0
  - @bamboocss/is-valid-prop@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

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
  - @bamboocss/logger@1.1.0
  - @bamboocss/token-dictionary@1.1.0
  - @bamboocss/is-valid-prop@1.1.0

## 1.0.1

### Patch Changes

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

- a20811c: - Fix issue where `@property` fallbacks does not work correctly when global vars are used in no
  `initial-value`
  - Sort `fieldSizing` property properly

- Updated dependencies [a3bcbea]
  - @bamboocss/is-valid-prop@1.0.0
  - @bamboocss/logger@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/token-dictionary@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- Updated dependencies [efa060d]
- Updated dependencies [d2aede5]
- Updated dependencies [fdf5142]
  - @bamboocss/shared@0.54.0
  - @bamboocss/token-dictionary@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/is-valid-prop@0.54.0
  - @bamboocss/logger@0.54.0

## 0.53.7

### Patch Changes

- 5e5af6b: Fix import detection in Windows
- 9453c9b: Fix issue where `@breakpoint` from `hideBelow` or `hideFrom` might not be compiled to media query correctly
  - @bamboocss/is-valid-prop@0.53.7
  - @bamboocss/logger@0.53.7
  - @bamboocss/shared@0.53.7
  - @bamboocss/token-dictionary@0.53.7
  - @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/is-valid-prop@0.53.6
- @bamboocss/logger@0.53.6
- @bamboocss/shared@0.53.6
- @bamboocss/token-dictionary@0.53.6
- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/is-valid-prop@0.53.5
- @bamboocss/logger@0.53.5
- @bamboocss/shared@0.53.5
- @bamboocss/token-dictionary@0.53.5
- @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- 57343c1: - Fix issue where conditions generated from `themes` lead to incorrect css when used directly in style
  objects.
  - Improve handling of mixed conditions defined in the config.
  - @bamboocss/is-valid-prop@0.53.4
  - @bamboocss/logger@0.53.4
  - @bamboocss/shared@0.53.4
  - @bamboocss/token-dictionary@0.53.4
  - @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/is-valid-prop@0.53.3
- @bamboocss/logger@0.53.3
- @bamboocss/shared@0.53.3
- @bamboocss/token-dictionary@0.53.3
- @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/is-valid-prop@0.53.2
- @bamboocss/logger@0.53.2
- @bamboocss/shared@0.53.2
- @bamboocss/token-dictionary@0.53.2
- @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/is-valid-prop@0.53.1
- @bamboocss/logger@0.53.1
- @bamboocss/shared@0.53.1
- @bamboocss/token-dictionary@0.53.1
- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/is-valid-prop@0.53.0
  - @bamboocss/types@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/token-dictionary@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/is-valid-prop@0.52.0
- @bamboocss/logger@0.52.0
- @bamboocss/shared@0.52.0
- @bamboocss/token-dictionary@0.52.0
- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/is-valid-prop@0.51.1
- @bamboocss/logger@0.51.1
- @bamboocss/shared@0.51.1
- @bamboocss/token-dictionary@0.51.1
- @bamboocss/types@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/token-dictionary@0.51.0
  - @bamboocss/is-valid-prop@0.51.0
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
  - @bamboocss/types@0.50.0
  - @bamboocss/token-dictionary@0.50.0
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
  - @bamboocss/logger@0.49.0
  - @bamboocss/token-dictionary@0.49.0
  - @bamboocss/is-valid-prop@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- @bamboocss/is-valid-prop@0.48.1
- @bamboocss/logger@0.48.1
- @bamboocss/shared@0.48.1
- @bamboocss/token-dictionary@0.48.1
- @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/is-valid-prop@0.48.0
- @bamboocss/logger@0.48.0
- @bamboocss/shared@0.48.0
- @bamboocss/token-dictionary@0.48.0
- @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- Updated dependencies [144113f]
  - @bamboocss/token-dictionary@0.47.1
  - @bamboocss/is-valid-prop@0.47.1
  - @bamboocss/logger@0.47.1
  - @bamboocss/shared@0.47.1
  - @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/token-dictionary@0.47.0
  - @bamboocss/types@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/is-valid-prop@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- 9fbd2d8: Fix issue where using container query in static css results in empty styles.
  - @bamboocss/is-valid-prop@0.46.1
  - @bamboocss/logger@0.46.1
  - @bamboocss/shared@0.46.1
  - @bamboocss/token-dictionary@0.46.1
  - @bamboocss/types@0.46.1

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

### Patch Changes

- 54426a2: Fix issue where nesting `@scope` rule that use the `&` don't expand correctly
- Updated dependencies [54426a2]
  - @bamboocss/shared@0.46.0
  - @bamboocss/token-dictionary@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/is-valid-prop@0.46.0
  - @bamboocss/logger@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/is-valid-prop@0.45.2
- @bamboocss/logger@0.45.2
- @bamboocss/shared@0.45.2
- @bamboocss/token-dictionary@0.45.2
- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- Updated dependencies [3439ecf]
  - @bamboocss/token-dictionary@0.45.1
  - @bamboocss/is-valid-prop@0.45.1
  - @bamboocss/logger@0.45.1
  - @bamboocss/shared@0.45.1
  - @bamboocss/types@0.45.1

## 0.45.0

### Minor Changes

- 1e4da63: Add support resolving `DEFAULT` in textStyles and layerStyles, just like tokens.

  ```jsx
  export default defineConfig({
    theme: {
      textStyles: {
        display: {
          // 'display'
          DEFAULT: {
            value: {
              fontSize: '1.5rem',
              fontWeight: 'bold',
            },
          },
          // 'display.large'
          large: {
            value: {
              fontSize: '2rem',
              fontWeight: 'bold',
            },
          },
        },
      },
    },
  })
  ```

  In case, you can use `textStyles: display` to reference the DEFAULT display value.

  ```jsx
  css({ textStyle: 'display' })
  ```

### Patch Changes

- 552dd4b: Fix issue where `divideY` and `divideColor` utilities, used together in a recipe, doesn't generate the
  correct css.
- Updated dependencies [dcc9053]
- Updated dependencies [a21fcfe]
- Updated dependencies [552dd4b]
  - @bamboocss/types@0.45.0
  - @bamboocss/token-dictionary@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/logger@0.45.0
  - @bamboocss/is-valid-prop@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0
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

- 17a1932: [BREAKING] Removed the legacy `config.optimize` option because it was redundant. Now, we always optimize the
  generated CSS where possible.
- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/token-dictionary@0.42.0
  - @bamboocss/is-valid-prop@0.42.0
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

  - @bamboocss/types@0.41.0
  - @bamboocss/is-valid-prop@0.41.0
  - @bamboocss/logger@0.41.0
  - @bamboocss/shared@0.41.0
  - @bamboocss/token-dictionary@0.41.0

## 0.40.1

### Patch Changes

- d2cc156: Fix issue where using `jsxStyleProps: none` with the generated jsx patterns, lead to unoptimized code that
  causes the component to be recreated on every render.
  - @bamboocss/is-valid-prop@0.40.1
  - @bamboocss/logger@0.40.1
  - @bamboocss/shared@0.40.1
  - @bamboocss/token-dictionary@0.40.1
  - @bamboocss/types@0.40.1

## 0.40.0

### Minor Changes

- 5dcdae4: Improve monorepo setup DX by exposing some cli flags

  ### `bamboo init`
  - Added new flag `--no-codegen` to skip codegen during initialization
  - Added new flag `--outdir` to specify the output directory for generated files

  ### `bamboo emit-pkg`
  - Added new `--base` flag to specify the base directory for the entrypoints in the generated `package.json#exports`
    field

### Patch Changes

- @bamboocss/is-valid-prop@0.40.0
- @bamboocss/logger@0.40.0
- @bamboocss/shared@0.40.0
- @bamboocss/token-dictionary@0.40.0
- @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 1f636eb: Fix a cache issue that leads to HMR growing slower in some cases
- 8b07cdf: Allow nesting (string) token references in the fallback argument, fix an issue where using CSS var in the
  fallback argument would be mistakenly escaped
- Updated dependencies [1f636eb]
- Updated dependencies [8b07cdf]
  - @bamboocss/shared@0.39.2
  - @bamboocss/token-dictionary@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/is-valid-prop@0.39.2
  - @bamboocss/logger@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/is-valid-prop@0.39.1
- @bamboocss/logger@0.39.1
- @bamboocss/shared@0.39.1
- @bamboocss/token-dictionary@0.39.1
- @bamboocss/types@0.39.1

## 0.39.0

### Patch Changes

- c3e797e: Fix issue where `animationName` property was not connected to `theme.keyframes`, as a result, no
  autocompletion was available.
- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/types@0.39.0
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

- 2c8b933: Add least resource used (LRU) cache in the hot parts to prevent memory from growing infinitely

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
- Updated dependencies [2c8b933]
  - @bamboocss/types@0.38.0
  - @bamboocss/token-dictionary@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/logger@0.38.0
  - @bamboocss/is-valid-prop@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/token-dictionary@0.37.2
  - @bamboocss/is-valid-prop@0.37.2
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

- Updated dependencies [93dc9f5]
- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/token-dictionary@0.37.1
  - @bamboocss/types@0.37.1
  - @bamboocss/shared@0.37.1
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

### Patch Changes

- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/shared@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/token-dictionary@0.37.0
  - @bamboocss/logger@0.37.0
  - @bamboocss/is-valid-prop@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1
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

- Updated dependencies [3af3940]
- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/token-dictionary@0.36.0
  - @bamboocss/types@0.36.0
  - @bamboocss/is-valid-prop@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- c459b43: Fix extraction of JSX `styled` factory when using namespace imports

  ```tsx
  import * as bambooJsx from '../styled-system/jsx'

  // ✅ this will work now
  bambooJsx.styled('div', { base: { color: 'red' } })
  const App = () => <bambooJsx.styled.span color="blue">Hello</bambooJsx.styled.span>
  ```

- Updated dependencies [f2fdc48]
- Updated dependencies [50db354]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/token-dictionary@0.35.0
  - @bamboocss/types@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/is-valid-prop@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/is-valid-prop@0.34.3
- @bamboocss/logger@0.34.3
- @bamboocss/shared@0.34.3
- @bamboocss/token-dictionary@0.34.3
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

  - @bamboocss/types@0.34.2
  - @bamboocss/is-valid-prop@0.34.2
  - @bamboocss/logger@0.34.2
  - @bamboocss/shared@0.34.2
  - @bamboocss/token-dictionary@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [d4942e0]
  - @bamboocss/token-dictionary@0.34.1
  - @bamboocss/is-valid-prop@0.34.1
  - @bamboocss/logger@0.34.1
  - @bamboocss/shared@0.34.1
  - @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- 64d5144: Allow using the color opacity modifier syntax (`blue.300/70`) in token references:
  - `{colors.blue.300/70}`
  - `token(colors.blue.300/70)`

  Note that this works both in style usage and in build-time config.

  ```ts
  // runtime usage

  import { css } from '../styled-system/css'

  css({ bg: '{colors.blue.300/70}' })
  // => @layer utilities {
  //    .bg_token\(colors\.blue\.300\/70\) {
  //      background: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
  //    }
  //  }

  css({ bg: 'token(colors.blue.300/70)' })
  // => @layer utilities {
  //    .bg_token\(colors\.blue\.300\/70\) {
  //      background: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
  //    }
  //  }
  ```

  ```ts
  // build-time usage
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    theme: {
      tokens: {
        colors: {
          blue: {
            300: { value: '#00f' },
          },
        },
      },
      semanticTokens: {
        colors: {
          primary: {
            value: '{colors.blue.300/70}',
          },
        },
      },
    },
  })
  ```

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-blue-300: #00f;
      --colors-primary: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
    }
  }
  ```

- Updated dependencies [64d5144]
- Updated dependencies [d1516c8]
  - @bamboocss/token-dictionary@0.34.0
  - @bamboocss/types@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/is-valid-prop@0.34.0
  - @bamboocss/shared@0.34.0

## 0.33.0

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

- f419993: - Prevent extracting style props of `styled` when not explicitly imported
  - Allow using multiple aliases for the same identifier for the `/css` entrypoints just like `/patterns` and `/recipes`

  ```ts
  import { css } from '../styled-system/css'
  import { css as css2 } from '../styled-system/css'

  css({ display: 'flex' })
  css2({ flexDirection: 'column' }) // this wasn't working before, now it does
  ```

- Updated dependencies [a032375]
- Updated dependencies [5184771]
- Updated dependencies [6d8c884]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/token-dictionary@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/is-valid-prop@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- b32d817: Switch from `em` to `rem` for breakpoints and container queries to prevent side effects.

### Patch Changes

- 433a364: Automatically generate a recipe `compoundVariants` when using `staticCss`
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
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

- a17fe387: - Add a `config.polyfill` option that will polyfill the CSS @layer at-rules using a
  [postcss plugin](https://www.npmjs.com/package/@csstools/postcss-cascade-layers)
  - And `--polyfill` flag to `bamboo` and `bamboo cssgen` commands

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/token-dictionary@0.31.0
  - @bamboocss/is-valid-prop@0.31.0

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
  - @bamboocss/logger@0.30.2
  - @bamboocss/token-dictionary@0.30.2
  - @bamboocss/is-valid-prop@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

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

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
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
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
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

- e463ce0e: Fix the issue in the utility configuration where shorthand without `className` returns incorrect CSS when
  using the shorthand version.

  ```js
  utilities: {
    extend: {
      coloredBorder: {
        shorthand: 'cb', // no classname, returns incorrect css
        values: ['red', 'green', 'blue'],
        transform(value) {
          return {
            border: `1px solid ${value}`,
          };
        },
      },
    },
  },
  ```

- 77cab9fe: Fix a regression with globalCss selector order

  ```ts
  {
      globalCss: {
          html: {
            ".aaa": {
              color: "red.100",
              "& .bbb": {
                color: "red.200",
                "& .ccc": {
                  color: "red.300"
                }
              }
            }
          },
      }
  }
  ```

  would incorrectly generate (regression introduced in v0.26.2)

  ```css
  .aaa html {
    color: var(--colors-red-100);
  }

  .aaa html .bbb {
    color: var(--colors-red-200);
  }

  .aaa html .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

  will now correctly generate again:

  ```css
  html .aaa {
    color: var(--colors-red-100);
  }

  html .aaa .bbb {
    color: var(--colors-red-200);
  }

  html .aaa .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

- 9d000dcd: Fix a regression with rule insertion order after triggering HMR that re-uses some CSS already generated in
  previous triggers, introuced in v0.27.0
- 6d7e7b07: Slight perf improvement by caching a few computed properties that contains a loop
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/error@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
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

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/error@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/error@0.26.1
- @bamboocss/is-valid-prop@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/token-dictionary@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 14033e00: Display better CssSyntaxError logs
- d420c676: Refactors the parser and import analysis logic. The goal is to ensure we can re-use the import logic in
  ESLint Plugin and Node.js.
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- de282f60: Fix issue where `base` doesn't work within css function

  ```jsx
  css({
    // This didn't work, but now it does
    base: { color: 'blue' },
  })
  ```

- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value
- 61ebf3d2: Fix issue where config slot recipes with compound variants were not processed correctly
- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/error@0.24.1
- @bamboocss/is-valid-prop@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/token-dictionary@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

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
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
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

- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
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

- 788aaba3: Fix an edge-case when Bamboo eagerly extracted and tried to generate the CSS for a JSX property that
  contains an URL.

  ```tsx
  const App = () => {
    // here the content property is a valid CSS property, so Bamboo will try to generate the CSS for it
    // but since it's an URL, it would produce invalid CSS
    // we now check if the property value is an URL and skip it if needed
    return <CopyButton content="https://www.buymeacoffee.com/grizzlycodes" />
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

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- 4ba982f3: Fix issue with the `token(xxx.yyy)` fn used in AtRule, things like:

  ```ts
  css({
    '@container (min-width: token(sizes.xl))': {
      color: 'green.300',
    },
    '@media (min-width: token(sizes.2xl))': {
      color: 'red.300',
    },
  })
  ```

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 9f5711f9: Fix issue where recipe artifacts might not match the recipes defined in the theme due to the internal cache
  not being cleared as needed.
- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/error@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/shared@0.18.3
- @bamboocss/token-dictionary@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 8c76cd0f: - Fix issue where `hideBelow` breakpoints are inclusive of the specified breakpoints

  ```jsx
  css({ hideBelow: 'lg' })
  // => @media screen and (max-width: 63.9975em) { background: red; }
  ```

  - Support arbitrary breakpoints in `hideBelow` and `hideFrom` utilities

  ```jsx
  css({ hideFrom: '800px' })
  // => @media screen and (min-width: 800px) { background: red; }
  ```

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- a6dfc944: Fix issue where using array syntax in config recipe generates invalid css
  - @bamboocss/error@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/error@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- aea28c9f: Fix issue where using scale css property adds an additional 'px'
- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Patch Changes

- e73ea803: Automatically add each recipe slots to the `jsx` property, with a dot notation

  ```ts
  const button = defineSlotRecipe({
    className: 'button',
    slots: ['root', 'icon', 'label'],
    // ...
  })
  ```

  will have a default `jsx` property of: `[Button, Button.Root, Button.Icon, Button.Label]`

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/error@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/shared@0.15.5
- @bamboocss/token-dictionary@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/error@0.15.4
- @bamboocss/logger@0.15.4
- @bamboocss/shared@0.15.4
- @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work
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
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 848936e0: Allow referencing tokens with the `token()` function in media queries or any other CSS at-rule.

  ```js
  import { css } from '../styled-system/css'

  const className = css({
    '@media screen and (min-width: token(sizes.4xl))': {
      color: 'green.400',
    },
  })
  ```

- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Minor Changes

- bc3b077d: Move slot recipes styles to new `recipes.slots` layer so that classic config recipes will have a higher
  specificity

### Patch Changes

- dd47b6e6: Fix issue where hideFrom doesn't work due to incorrect breakpoint computation
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 02161d41: Fix issue with the `token()` function in CSS strings that produced CSS syntax error when non-existing token
  were left unchanged (due to the `.`)

  Before:

  ```css
  * {
    color: token(colors.magenta, pink);
  }
  ```

  Now:

  ```css
  * {
    color: token('colors.magenta', pink);
  }
  ```

- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [d0fbc7cc]
  - @bamboocss/error@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Minor Changes

- 04b5fd6c: - Add support for minification in `cssgen` command.
  - Fix issue where `bamboo --minify` does not work.

### Patch Changes

- @bamboocss/error@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/shared@0.13.0
- @bamboocss/token-dictionary@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/error@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/shared@0.12.2
- @bamboocss/token-dictionary@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/error@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/shared@0.12.1
- @bamboocss/token-dictionary@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/token-dictionary@0.12.0
- @bamboocss/error@0.12.0
- @bamboocss/logger@0.12.0
- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
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

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/error@0.10.0
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
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

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

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 12c900ee: Fix issue where unitless grid properties were converted to pixel values
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
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- f9247e52: Provide better error logs:
  - full stacktrace when using BAMBOO_DEBUG
  - specific CssSyntaxError to better spot the error

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

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/error@0.5.0
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

- 2a1e9386: Fix issue where aspect ratio css property adds `px`
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/error@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/error@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
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
  - @bamboocss/error@0.0.2
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
  - @bamboocss/logger@0.30.0
  - @bamboocss/is-valid-prop@0.30.0

## 0.29.1

### Patch Changes

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
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
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
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

- e463ce0e: Fix the issue in the utility configuration where shorthand without `className` returns incorrect CSS when
  using the shorthand version.

  ```js
  utilities: {
    extend: {
      coloredBorder: {
        shorthand: 'cb', // no classname, returns incorrect css
        values: ['red', 'green', 'blue'],
        transform(value) {
          return {
            border: `1px solid ${value}`,
          };
        },
      },
    },
  },
  ```

- 77cab9fe: Fix a regression with globalCss selector order

  ```ts
  {
      globalCss: {
          html: {
            ".aaa": {
              color: "red.100",
              "& .bbb": {
                color: "red.200",
                "& .ccc": {
                  color: "red.300"
                }
              }
            }
          },
      }
  }
  ```

  would incorrectly generate (regression introduced in v0.26.2)

  ```css
  .aaa html {
    color: var(--colors-red-100);
  }

  .aaa html .bbb {
    color: var(--colors-red-200);
  }

  .aaa html .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

  will now correctly generate again:

  ```css
  html .aaa {
    color: var(--colors-red-100);
  }

  html .aaa .bbb {
    color: var(--colors-red-200);
  }

  html .aaa .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

- 9d000dcd: Fix a regression with rule insertion order after triggering HMR that re-uses some CSS already generated in
  previous triggers, introuced in v0.27.0
- 6d7e7b07: Slight perf improvement by caching a few computed properties that contains a loop
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/error@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
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

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/error@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/error@0.26.1
- @bamboocss/is-valid-prop@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/token-dictionary@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 14033e00: Display better CssSyntaxError logs
- d420c676: Refactors the parser and import analysis logic. The goal is to ensure we can re-use the import logic in
  ESLint Plugin and Node.js.
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- de282f60: Fix issue where `base` doesn't work within css function

  ```jsx
  css({
    // This didn't work, but now it does
    base: { color: 'blue' },
  })
  ```

- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value
- 61ebf3d2: Fix issue where config slot recipes with compound variants were not processed correctly
- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/error@0.24.1
- @bamboocss/is-valid-prop@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/token-dictionary@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

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
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
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

- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
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

- 788aaba3: Fix an edge-case when Bamboo eagerly extracted and tried to generate the CSS for a JSX property that
  contains an URL.

  ```tsx
  const App = () => {
    // here the content property is a valid CSS property, so Bamboo will try to generate the CSS for it
    // but since it's an URL, it would produce invalid CSS
    // we now check if the property value is an URL and skip it if needed
    return <CopyButton content="https://www.buymeacoffee.com/grizzlycodes" />
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

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- 4ba982f3: Fix issue with the `token(xxx.yyy)` fn used in AtRule, things like:

  ```ts
  css({
    '@container (min-width: token(sizes.xl))': {
      color: 'green.300',
    },
    '@media (min-width: token(sizes.2xl))': {
      color: 'red.300',
    },
  })
  ```

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 9f5711f9: Fix issue where recipe artifacts might not match the recipes defined in the theme due to the internal cache
  not being cleared as needed.
- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/error@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/shared@0.18.3
- @bamboocss/token-dictionary@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 8c76cd0f: - Fix issue where `hideBelow` breakpoints are inclusive of the specified breakpoints

  ```jsx
  css({ hideBelow: 'lg' })
  // => @media screen and (max-width: 63.9975em) { background: red; }
  ```

  - Support arbitrary breakpoints in `hideBelow` and `hideFrom` utilities

  ```jsx
  css({ hideFrom: '800px' })
  // => @media screen and (min-width: 800px) { background: red; }
  ```

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- a6dfc944: Fix issue where using array syntax in config recipe generates invalid css
  - @bamboocss/error@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/error@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- aea28c9f: Fix issue where using scale css property adds an additional 'px'
- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Patch Changes

- e73ea803: Automatically add each recipe slots to the `jsx` property, with a dot notation

  ```ts
  const button = defineSlotRecipe({
    className: 'button',
    slots: ['root', 'icon', 'label'],
    // ...
  })
  ```

  will have a default `jsx` property of: `[Button, Button.Root, Button.Icon, Button.Label]`

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/error@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/shared@0.15.5
- @bamboocss/token-dictionary@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/error@0.15.4
- @bamboocss/logger@0.15.4
- @bamboocss/shared@0.15.4
- @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work
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
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 848936e0: Allow referencing tokens with the `token()` function in media queries or any other CSS at-rule.

  ```js
  import { css } from '../styled-system/css'

  const className = css({
    '@media screen and (min-width: token(sizes.4xl))': {
      color: 'green.400',
    },
  })
  ```

- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Minor Changes

- bc3b077d: Move slot recipes styles to new `recipes.slots` layer so that classic config recipes will have a higher
  specificity

### Patch Changes

- dd47b6e6: Fix issue where hideFrom doesn't work due to incorrect breakpoint computation
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 02161d41: Fix issue with the `token()` function in CSS strings that produced CSS syntax error when non-existing token
  were left unchanged (due to the `.`)

  Before:

  ```css
  * {
    color: token(colors.magenta, pink);
  }
  ```

  Now:

  ```css
  * {
    color: token('colors.magenta', pink);
  }
  ```

- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [d0fbc7cc]
  - @bamboocss/error@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Minor Changes

- 04b5fd6c: - Add support for minification in `cssgen` command.
  - Fix issue where `bamboo --minify` does not work.

### Patch Changes

- @bamboocss/error@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/shared@0.13.0
- @bamboocss/token-dictionary@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/error@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/shared@0.12.2
- @bamboocss/token-dictionary@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/error@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/shared@0.12.1
- @bamboocss/token-dictionary@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/token-dictionary@0.12.0
- @bamboocss/error@0.12.0
- @bamboocss/logger@0.12.0
- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
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

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/error@0.10.0
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
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

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

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 12c900ee: Fix issue where unitless grid properties were converted to pixel values
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
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- f9247e52: Provide better error logs:
  - full stacktrace when using BAMBOO_DEBUG
  - specific CssSyntaxError to better spot the error

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

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/error@0.5.0
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

- 2a1e9386: Fix issue where aspect ratio css property adds `px`
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/error@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/error@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
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
  - @bamboocss/error@0.0.2
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

- 4736057: Fix an issue with recipes that lead to in-memory duplication the resulting CSS, which would increase the time
  taken to output the CSS after each extraction in the same HMR session (by a few ms).
- 5a205e7: Fix conditions accessing `Cannot read properties of undefined (reading 'raw')`
- Updated dependencies [34d94cf]
- Updated dependencies [e855c64]
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/token-dictionary@0.33.0
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

- f419993: - Prevent extracting style props of `styled` when not explicitly imported
  - Allow using multiple aliases for the same identifier for the `/css` entrypoints just like `/patterns` and `/recipes`

  ```ts
  import { css } from '../styled-system/css'
  import { css as css2 } from '../styled-system/css'

  css({ display: 'flex' })
  css2({ flexDirection: 'column' }) // this wasn't working before, now it does
  ```

- Updated dependencies [a032375]
- Updated dependencies [5184771]
- Updated dependencies [6d8c884]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/token-dictionary@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/is-valid-prop@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- b32d817: Switch from `em` to `rem` for breakpoints and container queries to prevent side effects.

### Patch Changes

- 433a364: Automatically generate a recipe `compoundVariants` when using `staticCss`
- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
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

- a17fe387: - Add a `config.polyfill` option that will polyfill the CSS @layer at-rules using a
  [postcss plugin](https://www.npmjs.com/package/@csstools/postcss-cascade-layers)
  - And `--polyfill` flag to `bamboo` and `bamboo cssgen` commands

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/token-dictionary@0.31.0
  - @bamboocss/is-valid-prop@0.31.0

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
  - @bamboocss/logger@0.30.2
  - @bamboocss/token-dictionary@0.30.2
  - @bamboocss/is-valid-prop@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

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

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
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
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
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

- e463ce0e: Fix the issue in the utility configuration where shorthand without `className` returns incorrect CSS when
  using the shorthand version.

  ```js
  utilities: {
    extend: {
      coloredBorder: {
        shorthand: 'cb', // no classname, returns incorrect css
        values: ['red', 'green', 'blue'],
        transform(value) {
          return {
            border: `1px solid ${value}`,
          };
        },
      },
    },
  },
  ```

- 77cab9fe: Fix a regression with globalCss selector order

  ```ts
  {
      globalCss: {
          html: {
            ".aaa": {
              color: "red.100",
              "& .bbb": {
                color: "red.200",
                "& .ccc": {
                  color: "red.300"
                }
              }
            }
          },
      }
  }
  ```

  would incorrectly generate (regression introduced in v0.26.2)

  ```css
  .aaa html {
    color: var(--colors-red-100);
  }

  .aaa html .bbb {
    color: var(--colors-red-200);
  }

  .aaa html .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

  will now correctly generate again:

  ```css
  html .aaa {
    color: var(--colors-red-100);
  }

  html .aaa .bbb {
    color: var(--colors-red-200);
  }

  html .aaa .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

- 9d000dcd: Fix a regression with rule insertion order after triggering HMR that re-uses some CSS already generated in
  previous triggers, introuced in v0.27.0
- 6d7e7b07: Slight perf improvement by caching a few computed properties that contains a loop
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/error@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
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

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/error@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/error@0.26.1
- @bamboocss/is-valid-prop@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/token-dictionary@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 14033e00: Display better CssSyntaxError logs
- d420c676: Refactors the parser and import analysis logic. The goal is to ensure we can re-use the import logic in
  ESLint Plugin and Node.js.
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- de282f60: Fix issue where `base` doesn't work within css function

  ```jsx
  css({
    // This didn't work, but now it does
    base: { color: 'blue' },
  })
  ```

- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value
- 61ebf3d2: Fix issue where config slot recipes with compound variants were not processed correctly
- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/error@0.24.1
- @bamboocss/is-valid-prop@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/token-dictionary@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

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
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
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

- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
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

- 788aaba3: Fix an edge-case when Bamboo eagerly extracted and tried to generate the CSS for a JSX property that
  contains an URL.

  ```tsx
  const App = () => {
    // here the content property is a valid CSS property, so Bamboo will try to generate the CSS for it
    // but since it's an URL, it would produce invalid CSS
    // we now check if the property value is an URL and skip it if needed
    return <CopyButton content="https://www.buymeacoffee.com/grizzlycodes" />
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

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- 4ba982f3: Fix issue with the `token(xxx.yyy)` fn used in AtRule, things like:

  ```ts
  css({
    '@container (min-width: token(sizes.xl))': {
      color: 'green.300',
    },
    '@media (min-width: token(sizes.2xl))': {
      color: 'red.300',
    },
  })
  ```

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 9f5711f9: Fix issue where recipe artifacts might not match the recipes defined in the theme due to the internal cache
  not being cleared as needed.
- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/error@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/shared@0.18.3
- @bamboocss/token-dictionary@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 8c76cd0f: - Fix issue where `hideBelow` breakpoints are inclusive of the specified breakpoints

  ```jsx
  css({ hideBelow: 'lg' })
  // => @media screen and (max-width: 63.9975em) { background: red; }
  ```

  - Support arbitrary breakpoints in `hideBelow` and `hideFrom` utilities

  ```jsx
  css({ hideFrom: '800px' })
  // => @media screen and (min-width: 800px) { background: red; }
  ```

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- a6dfc944: Fix issue where using array syntax in config recipe generates invalid css
  - @bamboocss/error@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/error@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- aea28c9f: Fix issue where using scale css property adds an additional 'px'
- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Patch Changes

- e73ea803: Automatically add each recipe slots to the `jsx` property, with a dot notation

  ```ts
  const button = defineSlotRecipe({
    className: 'button',
    slots: ['root', 'icon', 'label'],
    // ...
  })
  ```

  will have a default `jsx` property of: `[Button, Button.Root, Button.Icon, Button.Label]`

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/error@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/shared@0.15.5
- @bamboocss/token-dictionary@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/error@0.15.4
- @bamboocss/logger@0.15.4
- @bamboocss/shared@0.15.4
- @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work
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
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 848936e0: Allow referencing tokens with the `token()` function in media queries or any other CSS at-rule.

  ```js
  import { css } from '../styled-system/css'

  const className = css({
    '@media screen and (min-width: token(sizes.4xl))': {
      color: 'green.400',
    },
  })
  ```

- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Minor Changes

- bc3b077d: Move slot recipes styles to new `recipes.slots` layer so that classic config recipes will have a higher
  specificity

### Patch Changes

- dd47b6e6: Fix issue where hideFrom doesn't work due to incorrect breakpoint computation
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 02161d41: Fix issue with the `token()` function in CSS strings that produced CSS syntax error when non-existing token
  were left unchanged (due to the `.`)

  Before:

  ```css
  * {
    color: token(colors.magenta, pink);
  }
  ```

  Now:

  ```css
  * {
    color: token('colors.magenta', pink);
  }
  ```

- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [d0fbc7cc]
  - @bamboocss/error@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Minor Changes

- 04b5fd6c: - Add support for minification in `cssgen` command.
  - Fix issue where `bamboo --minify` does not work.

### Patch Changes

- @bamboocss/error@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/shared@0.13.0
- @bamboocss/token-dictionary@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/error@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/shared@0.12.2
- @bamboocss/token-dictionary@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/error@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/shared@0.12.1
- @bamboocss/token-dictionary@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/token-dictionary@0.12.0
- @bamboocss/error@0.12.0
- @bamboocss/logger@0.12.0
- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
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

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/error@0.10.0
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
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

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

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 12c900ee: Fix issue where unitless grid properties were converted to pixel values
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
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- f9247e52: Provide better error logs:
  - full stacktrace when using BAMBOO_DEBUG
  - specific CssSyntaxError to better spot the error

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

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/error@0.5.0
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

- 2a1e9386: Fix issue where aspect ratio css property adds `px`
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/error@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/error@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
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
  - @bamboocss/error@0.0.2
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
  - @bamboocss/logger@0.30.0
  - @bamboocss/is-valid-prop@0.30.0

## 0.29.1

### Patch Changes

- a5c75607: Fix an issue (introduced in v0.29) with `bamboo init` and add an assert on the new `colorMix` utility
  function
  - @bamboocss/is-valid-prop@0.29.1
  - @bamboocss/logger@0.29.1
  - @bamboocss/shared@0.29.1
  - @bamboocss/token-dictionary@0.29.1
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
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
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

- e463ce0e: Fix the issue in the utility configuration where shorthand without `className` returns incorrect CSS when
  using the shorthand version.

  ```js
  utilities: {
    extend: {
      coloredBorder: {
        shorthand: 'cb', // no classname, returns incorrect css
        values: ['red', 'green', 'blue'],
        transform(value) {
          return {
            border: `1px solid ${value}`,
          };
        },
      },
    },
  },
  ```

- 77cab9fe: Fix a regression with globalCss selector order

  ```ts
  {
      globalCss: {
          html: {
            ".aaa": {
              color: "red.100",
              "& .bbb": {
                color: "red.200",
                "& .ccc": {
                  color: "red.300"
                }
              }
            }
          },
      }
  }
  ```

  would incorrectly generate (regression introduced in v0.26.2)

  ```css
  .aaa html {
    color: var(--colors-red-100);
  }

  .aaa html .bbb {
    color: var(--colors-red-200);
  }

  .aaa html .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

  will now correctly generate again:

  ```css
  html .aaa {
    color: var(--colors-red-100);
  }

  html .aaa .bbb {
    color: var(--colors-red-200);
  }

  html .aaa .bbb .ccc {
    color: var(--colors-red-300);
  }
  ```

- 9d000dcd: Fix a regression with rule insertion order after triggering HMR that re-uses some CSS already generated in
  previous triggers, introuced in v0.27.0
- 6d7e7b07: Slight perf improvement by caching a few computed properties that contains a loop
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
- Updated dependencies [d4fa5de9]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/token-dictionary@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/is-valid-prop@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- 1ed4df77: Fix issue where HMR doesn't work when tsconfig paths is used.
- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/token-dictionary@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/is-valid-prop@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/error@0.27.2
- @bamboocss/is-valid-prop@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/token-dictionary@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/token-dictionary@0.27.1
  - @bamboocss/error@0.27.1
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

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/token-dictionary@0.27.0
  - @bamboocss/is-valid-prop@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/error@0.26.2
- @bamboocss/is-valid-prop@0.26.2
- @bamboocss/logger@0.26.2
- @bamboocss/shared@0.26.2
- @bamboocss/token-dictionary@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/error@0.26.1
- @bamboocss/is-valid-prop@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/token-dictionary@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 14033e00: Display better CssSyntaxError logs
- d420c676: Refactors the parser and import analysis logic. The goal is to ensure we can re-use the import logic in
  ESLint Plugin and Node.js.
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/token-dictionary@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/is-valid-prop@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- 59fd291c: Add a way to generate the staticCss for _all_ recipes (and all variants of each recipe)
- de282f60: Fix issue where `base` doesn't work within css function

  ```jsx
  css({
    // This didn't work, but now it does
    base: { color: 'blue' },
  })
  ```

- Updated dependencies [59fd291c]
- Updated dependencies [de282f60]
  - @bamboocss/types@0.25.0
  - @bamboocss/token-dictionary@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/is-valid-prop@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value
- 61ebf3d2: Fix issue where config slot recipes with compound variants were not processed correctly
- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/token-dictionary@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/is-valid-prop@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/error@0.24.1
- @bamboocss/is-valid-prop@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/token-dictionary@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Minor Changes

- 63b3f1f2: - Boost style extraction performance by moving more work away from postcss
  - Using a hashing strategy, the compiler only computes styles/classname once per style object and prop-value-condition
    pair
  - Fix regression in previous implementation that increased memory usage per extraction, leading to slower performance
    over time

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
  - @bamboocss/token-dictionary@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/is-valid-prop@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- 1ea7459c: Fix performance issue where process could get slower due to postcss rules held in memory.
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

- 840ed66b: Fix an issue with config change detection when using a custom `config.slotRecipes[xxx].jsx` array
- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/token-dictionary@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/token-dictionary@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- 11753fea: Improve initial css extraction time by at least 5x 🚀

  Initial extraction time can get slow when using static CSS with lots of recipes or parsing a lot of files.

  **Scenarios**
  - Park UI went from 3500ms to 580ms (6x faster)
  - Bamboo Website went from 2900ms to 208ms (14x faster)

  **Potential Breaking Change**

  If you use `hooks` in your `bamboo.config` file to listen for when css is extracted, we no longer return the `css`
  string for performance reasons. We might reconsider this in the future.

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/token-dictionary@0.22.0
  - @bamboocss/error@0.22.0
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

- 788aaba3: Fix an edge-case when Bamboo eagerly extracted and tried to generate the CSS for a JSX property that
  contains an URL.

  ```tsx
  const App = () => {
    // here the content property is a valid CSS property, so Bamboo will try to generate the CSS for it
    // but since it's an URL, it would produce invalid CSS
    // we now check if the property value is an URL and skip it if needed
    return <CopyButton content="https://www.buymeacoffee.com/grizzlycodes" />
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

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/token-dictionary@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/token-dictionary@0.20.1
- @bamboocss/error@0.20.1
- @bamboocss/logger@0.20.1
- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- 4ba982f3: Fix issue with the `token(xxx.yyy)` fn used in AtRule, things like:

  ```ts
  css({
    '@container (min-width: token(sizes.xl))': {
      color: 'green.300',
    },
    '@media (min-width: token(sizes.2xl))': {
      color: 'red.300',
    },
  })
  ```

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/token-dictionary@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- 9f5711f9: Fix issue where recipe artifacts might not match the recipes defined in the theme due to the internal cache
  not being cleared as needed.
- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/token-dictionary@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/logger@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/error@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/shared@0.18.3
- @bamboocss/token-dictionary@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/token-dictionary@0.18.2
- @bamboocss/error@0.18.2
- @bamboocss/logger@0.18.2
- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 8c76cd0f: - Fix issue where `hideBelow` breakpoints are inclusive of the specified breakpoints

  ```jsx
  css({ hideBelow: 'lg' })
  // => @media screen and (max-width: 63.9975em) { background: red; }
  ```

  - Support arbitrary breakpoints in `hideBelow` and `hideFrom` utilities

  ```jsx
  css({ hideFrom: '800px' })
  // => @media screen and (min-width: 800px) { background: red; }
  ```

- Updated dependencies [566fd28a]
- Updated dependencies [43bfa510]
  - @bamboocss/token-dictionary@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/token-dictionary@0.18.0
  - @bamboocss/types@0.18.0
  - @bamboocss/error@0.18.0
  - @bamboocss/logger@0.18.0

## 0.17.5

### Patch Changes

- a6dfc944: Fix issue where using array syntax in config recipe generates invalid css
  - @bamboocss/error@0.17.5
  - @bamboocss/logger@0.17.5
  - @bamboocss/shared@0.17.5
  - @bamboocss/token-dictionary@0.17.5
  - @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/token-dictionary@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/logger@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/token-dictionary@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/logger@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/error@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/shared@0.17.2
- @bamboocss/token-dictionary@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- aea28c9f: Fix issue where using scale css property adds an additional 'px'
- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1
  - @bamboocss/token-dictionary@0.17.1
  - @bamboocss/error@0.17.1
  - @bamboocss/logger@0.17.1

## 0.17.0

### Patch Changes

- e73ea803: Automatically add each recipe slots to the `jsx` property, with a dot notation

  ```ts
  const button = defineSlotRecipe({
    className: 'button',
    slots: ['root', 'icon', 'label'],
    // ...
  })
  ```

  will have a default `jsx` property of: `[Button, Button.Root, Button.Icon, Button.Label]`

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0
  - @bamboocss/token-dictionary@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- 20f4e204: Apply a few optmizations on the resulting CSS generated from `bamboo cssgen` command
  - @bamboocss/token-dictionary@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/shared@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/error@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/shared@0.15.5
- @bamboocss/token-dictionary@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/error@0.15.4
- @bamboocss/logger@0.15.4
- @bamboocss/shared@0.15.4
- @bamboocss/token-dictionary@0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work
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
  - @bamboocss/token-dictionary@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/token-dictionary@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/logger@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 848936e0: Allow referencing tokens with the `token()` function in media queries or any other CSS at-rule.

  ```js
  import { css } from '../styled-system/css'

  const className = css({
    '@media screen and (min-width: token(sizes.4xl))': {
      color: 'green.400',
    },
  })
  ```

- Updated dependencies [26f6982c]
- Updated dependencies [4e003bfb]
  - @bamboocss/shared@0.15.1
  - @bamboocss/token-dictionary@0.15.1
  - @bamboocss/types@0.15.1
  - @bamboocss/error@0.15.1
  - @bamboocss/logger@0.15.1

## 0.15.0

### Minor Changes

- bc3b077d: Move slot recipes styles to new `recipes.slots` layer so that classic config recipes will have a higher
  specificity

### Patch Changes

- dd47b6e6: Fix issue where hideFrom doesn't work due to incorrect breakpoint computation
- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0
  - @bamboocss/token-dictionary@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- e6459a59: The utility transform fn now allow retrieving the token object with the raw value/conditions as currently
  there's no way to get it from there.
- 623e321f: Fix `config.strictTokens: true` issue where some properties would still allow arbitrary values
- 02161d41: Fix issue with the `token()` function in CSS strings that produced CSS syntax error when non-existing token
  were left unchanged (due to the `.`)

  Before:

  ```css
  * {
    color: token(colors.magenta, pink);
  }
  ```

  Now:

  ```css
  * {
    color: token('colors.magenta', pink);
  }
  ```

- Updated dependencies [b1c31fdd]
- Updated dependencies [8106b411]
- Updated dependencies [9e799554]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/token-dictionary@0.14.0
  - @bamboocss/types@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/logger@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [d0fbc7cc]
  - @bamboocss/error@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/shared@0.13.1
  - @bamboocss/token-dictionary@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Minor Changes

- 04b5fd6c: - Add support for minification in `cssgen` command.
  - Fix issue where `bamboo --minify` does not work.

### Patch Changes

- @bamboocss/error@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/shared@0.13.0
- @bamboocss/token-dictionary@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/error@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/shared@0.12.2
- @bamboocss/token-dictionary@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/error@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/shared@0.12.1
- @bamboocss/token-dictionary@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/token-dictionary@0.12.0
- @bamboocss/error@0.12.0
- @bamboocss/logger@0.12.0
- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- 23b516f4: Make layers customizable
- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1
  - @bamboocss/token-dictionary@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/token-dictionary@0.11.0
  - @bamboocss/error@0.11.0
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

- 2d2a42da: Fix staticCss recipe generation when a recipe didnt have `variants`, only a `base`
- Updated dependencies [24e783b3]
- Updated dependencies [9d4aa918]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0
  - @bamboocss/token-dictionary@0.10.0
  - @bamboocss/error@0.10.0
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
  - @bamboocss/token-dictionary@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/logger@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

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

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [ac078416]
- Updated dependencies [be0ad578]
  - @bamboocss/token-dictionary@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/logger@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/token-dictionary@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 12c900ee: Fix issue where unitless grid properties were converted to pixel values
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
  - @bamboocss/types@0.6.0
  - @bamboocss/token-dictionary@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- f9247e52: Provide better error logs:
  - full stacktrace when using BAMBOO_DEBUG
  - specific CssSyntaxError to better spot the error

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

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/token-dictionary@0.5.1
  - @bamboocss/error@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0
  - @bamboocss/token-dictionary@0.5.0
  - @bamboocss/error@0.5.0
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

- 2a1e9386: Fix issue where aspect ratio css property adds `px`
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/token-dictionary@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/logger@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/error@0.3.2
- @bamboocss/logger@0.3.2
- @bamboocss/shared@0.3.2
- @bamboocss/token-dictionary@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/error@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/shared@0.3.1
  - @bamboocss/token-dictionary@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/token-dictionary@0.3.0
  - @bamboocss/error@0.3.0
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
  - @bamboocss/error@0.0.2
  - @bamboocss/logger@0.0.2
  - @bamboocss/shared@0.0.2
  - @bamboocss/token-dictionary@0.0.2
