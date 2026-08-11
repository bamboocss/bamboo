# @bamboocss/extractor

## 1.32.0

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
  - @bamboocss/shared@1.32.0

## 1.31.0

### Patch Changes

- Updated dependencies [9c32b00]
- Updated dependencies [678bdee]
  - @bamboocss/shared@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/shared@1.30.1

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

- Updated dependencies [242b24c]
  - @bamboocss/shared@1.30.0

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
  - @bamboocss/shared@1.29.0

## 1.28.1

### Patch Changes

- @bamboocss/shared@1.28.1

## 1.28.0

### Patch Changes

- @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/shared@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/shared@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/shared@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/shared@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [087b884]
  - @bamboocss/shared@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [a1062c9]
  - @bamboocss/shared@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/shared@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/shared@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/shared@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/shared@1.20.1

## 1.20.0

### Patch Changes

- 0441724: Update the runtime dependencies that decide how the framework behaves. Emitted CSS is unchanged — Lightning
  CSS 1.33 produces the sandbox stylesheet byte for byte as 1.31 did.

  | package              |   from |     to | reaches                   |
  | -------------------- | -----: | -----: | ------------------------- |
  | `lightningcss`       | 1.31.1 | 1.33.0 | CSS output when enabled   |
  | `ts-evaluator`       |  1.2.0 |  2.0.0 | expression evaluation     |
  | `chokidar`           |  4.0.3 |  5.0.0 | watch mode                |
  | `@vue/compiler-sfc`  | 3.5.25 | 3.5.41 | Vue SFC extraction        |
  | `@vue/compiler-core` | 3.5.25 | 3.5.41 | the types the above emits |
  | `picomatch`          |  4.0.4 |  4.0.5 | file matching             |

  `@vue/compiler-core` is a dev-only type import in `plugin-vue`, and it was pinned a version behind `compiler-sfc`.
  That had been invisible while both were 3.5.25; moving only `compiler-sfc` put two copies of the AST types in the tree
  and `BaseElementNode` stopped matching the nodes `parse` actually returns. Both move together from here.

  **Three were deliberately left alone**

  `magic-string` stays at 0.30.21. 1.x is ESM-only — `"type": "module"`, no `require` export — and `@bamboocss/vite`,
  `plugin-vue` and `plugin-svelte` all ship a CJS build that emits `require("magic-string")`. It resolves today and
  would not on 1.x, breaking every CJS consumer. Nothing in the suite would notice, since the tests run ESM.

  `open-props` stays at 1.7.16. 1.7.23 hardcodes the shadow scale:

  ```diff
  - --shadow-1: 0 1px 2px -1px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 9%))
  + --shadow-1: 0 1px 2px -1px hsl(220 3% 15% / 10%)
  ```

  The `--shadow-color` and `--shadow-strength` indirection is gone, and with it `--shadow-color-@media:dark` and
  `--inner-shadow-highlight`. `preset-open-props` reads these values straight out of `open-props/src`, so taking the
  bump means shadows stop responding to dark mode. Upstream moved that into separate light and dark files; adopting it
  is a port, not a version bump.

  `typescript` stays at 6.0.2, which is what `@ts-morph/common@0.29.0` bundles. ts-morph 28 is current, so TypeScript 7
  would put the compiler the parser runs on out of step with the one the repo type-checks against.

- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0e2cb31]
  - @bamboocss/shared@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/shared@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [21c6daa]
  - @bamboocss/shared@1.18.0

## 1.17.3

### Patch Changes

- a1df32d: Follow imports without a TypeScript type checker, fixing a large extraction slowdown in 1.17.

  1.17.0 taught the extractor to resolve a style helper called from another module, by handing the evaluator a
  TypeScript type checker. Asking for a single symbol makes TypeScript bind and check the **entire program**, every
  reachable `.d.ts` included — so the cost is paid once by the whole build and grows with the size of the codebase
  rather than with the number of style calls.

  Measured on a 400-file project, `bamboo cssgen` end to end:

  |             | user CPU | peak RSS |
  | ----------- | -------- | -------- |
  | 1.16        | 1.31s    | 386 MB   |
  | 1.17        | 2.12s    | 504 MB   |
  | this change | 1.31s    | 388 MB   |

  A project reported extraction going from 2.6s to 14.3s and peak build memory rising 2.45 GiB, enough to OOM a 7.8 GiB
  CI runner. That report attributed it to the slot-recipe folding in the same release; that change lives in
  `@bamboocss/vite`, is off unless `transform` is set, and never runs under the PostCSS plugin. This is the actual
  cause.

  None of the checker was necessary. Following an import is two cheap steps this package already had — resolve the
  specifier to a file with `ts.resolveModuleName`, a path lookup, then read that file's exported declaration — and the
  evaluator resolves everything _within_ a module by walking scopes on its own. Crossing the import boundary was the
  only thing the checker was doing, and `resolve-imported-value.ts` now does it directly.

  Resolution is attempted only after an evaluation has already failed. Everything that resolves today does so on the
  first attempt, so no working call pays for it, and an expression reaching an unresolvable import was dropped outright
  before — so nothing that pays for it was working.

  Behaviour is unchanged, including the project boundary: a call into `node_modules` is still left alone, because a
  dependency's code is not ours to run at build time. The tests that pinned the 1.17 behaviour pass untouched.

  The benchmark that should have caught this could not: `extract-speed` runs one inlined sample through a project
  holding nothing else, where checking the whole program is free, and it measured **0%** difference across the
  regression. `cross-file-cost.bench.ts` now works over a project of 60 files instead. It is a tripwire rather than a
  measurement — reintroducing the checker slows the inline _control_ by 44% and takes `rme` from ±0.75% to ±11.9%,
  because the cost lands as GC pressure across the process — and its docblock says so, and says that peak RSS over a
  real project is the signal that actually resolves this class.
  - @bamboocss/shared@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/shared@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [fc381ca]
  - @bamboocss/shared@1.17.1

## 1.17.0

### Minor Changes

- 57b2e66: Resolve a style helper called from another module, instead of silently dropping what it returns.

  ```jsx
  // helpers.ts
  export const focusRing = (options = {}) => {
    const { color, width } = { ...defaults, ...options }
    return { _focusVisible: { outlineColor: color, outlineWidth: width } }
  }

  // Link.tsx
  css({ ...focusRing({ color: 'labs.blue.40' }), color: 'red' })
  ```

  The spread came back empty and those declarations never reached the stylesheet — no error, no warning, just a
  component missing its focus ring. Calling the same helper from _within_ the file always worked, which is what made
  this hard to see: the pattern looks identical and only the import boundary decides.

  The evaluator was given no type checker, so it could not follow an import to a declaration. It has one now.

  For `css()` this was a partial loss — everything else in the call still applied. For a `cva`/`sva` it is not: the
  classes are named from a hash of the config, so a dropped declaration gives the build and the browser different names
  and the element renders with **no styles at all**.

  **The boundary is the project.** A call that resolves into `node_modules` is still left alone — a dependency's code is
  not ours to run at build time, however pure it looks. That is unchanged behaviour, not a new restriction.

  The checker is passed only for a call that resolves within the project. Handing it to the evaluator unconditionally
  cost a third again on a file of plain `css()` calls, which is most files; narrowed this way, a file that does not use
  the pattern measures the same as before (median of 5 × 200 parses: 0.494 ms before, 0.480 ms after).

### Patch Changes

- Updated dependencies [3cdd0d1]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
  - @bamboocss/shared@1.17.0

## 1.16.1

### Patch Changes

- c9b6bc7: Resolve a locally-declared callee lexically instead of through the language service.

  Every call expression is offered to the compiled-JSX runtime matcher, and a callee that is not in the file's import
  map fell through to `identifier.getDefinitions()`. That is a language-service query: the first one forces
  `synchronizeHostData` -> `createProgram`, which resolves, parses and binds the whole transitive `.d.ts` closure of the
  project.

  The fallback runs for the most ordinary shape in application source — `const badge = cva({…})` followed by
  `badge(props)`, or any local helper — and even for a callee that is never declared at all. In a five-file sandbox it
  built a 161-file, 5.1MB program, most of it `node_modules`; the size tracks the dependency graph rather than the
  user's source. Inside a bundler that program is built in the same heap as the module graph, which showed up as an
  extraction step that went from ~3s to ~24s and then ran out of memory.

  Since `resolveCallee` matches against the imports first, the declaration being looked for is always in the same file,
  so a walk out through the enclosing scopes replaces the query with no change in what resolves.

  Measured on one file containing a single locally-declared call site:

  | project        | before        | after     |
  | -------------- | ------------- | --------- |
  | 5-file sandbox | 498ms, +123MB | 3ms, +0MB |
  | 96-file site   | 770ms, +137MB | 4ms, +0MB |
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
- Updated dependencies [d7226f0]
  - @bamboocss/shared@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/shared@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
- Updated dependencies [d1d05fc]
  - @bamboocss/shared@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/shared@1.13.1

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

### Patch Changes

- 328a926: Stop re-export cycles crashing the build.

  Importing a name that does not resolve inside a cycle of re-exporting files — a typo, a stale import, a type-only
  export, or a name that lives outside the cycle — made export lookup walk the cycle until the stack overflowed, failing
  the whole build with `RangeError: Maximum call stack size exceeded`.

  `export * from './other'` is the worst case, since a star re-export matches every name and so every unresolved lookup
  traverses the entire graph. A barrel that re-exports itself hit it with a single file.

  Lookup now tracks the files it has already searched and stops on revisit, so such an import degrades to unresolvable
  like any other rather than throwing. Names that do resolve through a cycle are still found.

- d7825f6: Resolve values through renaming re-exports.

  Export lookup compared a requested name against the name in the _source_ module rather than the one the module
  actually exposes, so `export { btn as button } from './styles'` failed in both directions:
  - Importing `button` — the name the barrel really exports — resolved to nothing, and the style silently vanished from
    the CSS. Renaming re-exports are ordinary barrel hygiene, so this is the one that bites.
  - Importing `btn` — a name the barrel does **not** export — resolved anyway. TypeScript already rejects that import,
    so it only affected code that does not typecheck. **If you were relying on it, those styles will now disappear**;
    import the name the barrel exposes.

  A value declared locally and renamed on the way out (`const btn = …; export { btn as button }`) now resolves too, and
  a star re-export sitting over a renaming barrel forwards correctly.

  Lookup carries the source name across each hop, so the cycle guard added alongside it now tracks file-and-name pairs.
  Keyed on the file alone, a file searched unsuccessfully for one name would have blocked a later search of that same
  file for a different one — a value that is genuinely reachable.

- 5b881ee: Serve fresh values to importers after a shared style file is edited or deleted.

  Resolved values are memoized against the AST node that produced them, but a node's value can come from another file —
  `css(button)` folds whatever `./styles` exports. Editing that file replaces only its own nodes, so an importer's nodes
  stayed identical and kept serving the value read before the edit. Re-parsing the importer was not enough to clear it.

  The memo is now dropped whenever a file's contents are replaced or reloaded, which is the point at which another
  file's resolutions can have gone out of date. Deleting a shared file also rebuilds its importers, resolving them
  before the file leaves the project rather than after, when its path can no longer be matched.

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
  - @bamboocss/shared@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/shared@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/shared@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/shared@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/shared@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/shared@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/shared@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/shared@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/shared@1.11.2

## 1.11.1

### Patch Changes

- @bamboocss/shared@1.11.1

## 1.11.0

### Patch Changes

- b567ae6: Improve compiled JSX extraction so `css` props are recognized from framework runtime helper output, including
  React, Preact, Vue, Solid, and Qwik builds.
  - @bamboocss/shared@1.11.0

## 1.10.0

### Patch Changes

- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.
- Updated dependencies [c31f3a2]
- Updated dependencies [44457bb]
  - @bamboocss/shared@1.10.0

## 1.9.1

### Patch Changes

- @bamboocss/shared@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/shared@1.9.0

## 1.8.2

### Patch Changes

- @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/shared@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/shared@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/shared@1.7.2

## 1.7.1

### Patch Changes

- @bamboocss/shared@1.7.1

## 1.7.0

### Patch Changes

- @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/shared@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/shared@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/shared@1.5.1

## 1.5.0

### Patch Changes

- 1b85b61: Add `endLineNumber` and `endColumn` fields to AST JSON output from `bamboo debug` command.

  The `*.ast.json` files generated by `bamboo debug` now include complete position information for detected CSS usage
  locations. Previously, only start position (`line` and `column`) was exported. Now the output includes:
  - `line`: Start line number
  - `column`: Start column number
  - `endLineNumber`: End line number (new)
  - `endColumn`: End column number (new)

  This provides complete span coverage for each detected node, making it easier to precisely locate CSS usage in source
  files.

  Fixes #3407
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- @bamboocss/shared@1.4.3

## 1.4.2

### Patch Changes

- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.
- Updated dependencies [1290a27]
  - @bamboocss/shared@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/shared@1.4.1

## 1.4.0

### Patch Changes

- @bamboocss/shared@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/shared@1.3.1

## 1.3.0

### Patch Changes

- @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- @bamboocss/shared@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [e8ec0aa]
  - @bamboocss/shared@1.1.0

## 1.0.1

### Patch Changes

- @bamboocss/shared@1.0.1

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
  - @bamboocss/shared@1.0.0

## 0.54.0

### Patch Changes

- Updated dependencies [efa060d]
- Updated dependencies [d2aede5]
  - @bamboocss/shared@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/shared@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/shared@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/shared@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/shared@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/shared@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/shared@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/shared@0.53.1

## 0.53.0

### Patch Changes

- @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/shared@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/shared@0.51.1

## 0.51.0

### Minor Changes

- d68ad1f: **[BREAKING]**: Fix issue where Next.js build might fail intermittently due to version mismatch between
  internal `ts-morph` and userland `typescript`.

  > The current version of TS supported is `5.6.2`

### Patch Changes

- @bamboocss/shared@0.51.0

## 0.50.0

### Patch Changes

- @bamboocss/shared@0.50.0

## 0.49.0

### Patch Changes

- @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- @bamboocss/shared@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/shared@0.48.0

## 0.47.1

### Patch Changes

- @bamboocss/shared@0.47.1

## 0.47.0

### Patch Changes

- @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/shared@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [54426a2]
  - @bamboocss/shared@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/shared@0.45.2

## 0.45.1

### Patch Changes

- @bamboocss/shared@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [552dd4b]
  - @bamboocss/shared@0.45.0

## 0.44.0

### Patch Changes

- @bamboocss/shared@0.44.0

## 0.43.0

### Patch Changes

- @bamboocss/shared@0.43.0

## 0.42.0

### Patch Changes

- 19c3a2c: Minor changes to the format of the `bamboo analyze --output coverage.json` file
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

  - @bamboocss/shared@0.41.0

## 0.40.1

### Patch Changes

- @bamboocss/shared@0.40.1

## 0.40.0

### Patch Changes

- @bamboocss/shared@0.40.0

## 0.39.2

### Patch Changes

- Updated dependencies [1f636eb]
  - @bamboocss/shared@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/shared@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [935ec86]
  - @bamboocss/shared@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [2c8b933]
  - @bamboocss/shared@0.38.0

## 0.37.2

### Patch Changes

- @bamboocss/shared@0.37.2

## 0.37.1

### Patch Changes

- Updated dependencies [99870bb]
  - @bamboocss/shared@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [7daf159]
  - @bamboocss/shared@0.37.0

## 0.36.1

### Patch Changes

- @bamboocss/shared@0.36.1

## 0.36.0

### Patch Changes

- @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/shared@0.34.3

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

  - @bamboocss/shared@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/shared@0.34.1

## 0.34.0

### Patch Changes

- @bamboocss/shared@0.34.0

## 0.33.0

### Patch Changes

- @bamboocss/shared@0.33.0

## 0.32.1

### Patch Changes

- @bamboocss/shared@0.32.1

## 0.32.0

### Patch Changes

- 7e70b6b: Fix issue where `0` values doesn't get extracted when used in a condition
- Updated dependencies [8cd8c19]
  - @bamboocss/shared@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [f0296249]
  - @bamboocss/shared@0.31.0

## 0.30.2

### Patch Changes

- @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/shared@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
  - @bamboocss/shared@0.30.0

## 0.29.1

### Patch Changes

- @bamboocss/shared@0.29.1

## 0.29.0

### Patch Changes

- @bamboocss/shared@0.29.0

## 0.28.0

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

## 0.26.2

## 0.26.1

## 0.26.0

## 0.25.0

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.1

## 0.22.0

## 0.21.0

### Patch Changes

- 1464460f: Fix static extraction issue when using JSX attributes (props) that are other JSX nodes

  While parsing over the AST Nodes, due to an optimization where we skipped retrieving the current JSX element and
  instead kept track of the latest one, the logic was flawed and did not extract other properties after encountering a
  JSX attribute that was another JSX node.

  ```tsx
  const Component = () => {
    return (
      <>
        {/* ❌ this wasn't extracting ml="2" */}
        <Flex icon={<svg className="icon" />} ml="2" />

        {/* ✅ this was fine */}
        <Stack ml="4" icon={<div className="icon" />} />
      </>
    )
  }
  ```

  Now both will be fine again.

## 0.20.1

## 0.20.0

## 0.19.0

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- 336fd0b0: Perf: use raw `if` instead of ts-pattern in the extractor (hot path)

## 0.17.5

## 0.17.4

## 0.17.3

## 0.17.2

## 0.17.1

### Patch Changes

- a76b279e: Extract identifier values coming from an `EnumDeclaration` member

  Example:

  ```ts
  enum Color {
    Red = 'red.400',
    Blue = 'blue.400',
  }

  const className = css({ color: Color.Red, backgroundColor: Color['Blue'] })
  ```

## 0.17.0

## 0.16.0

## 0.15.5

## 0.15.4

### Patch Changes

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

## 0.15.3

## 0.15.2

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

## 0.15.0

### Patch Changes

- be24d1a0: Fix issue (https://github.com/gajus/bamboocss/issues/1365) with the `unbox` fn that removed nullish values,
  which could be useful for the [Array Syntax](https://bamboocss.com/docs/concepts/responsive-design#the-array-syntax)

  ```ts
  const className = css({
    color: ['black', undefined, 'orange', 'red'],
  })
  ```

- 7c1ab170: Fix issue where the `satisfies` would prevent an object from being extracted

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

## 0.11.0

## 0.10.0

## 0.9.0

### Patch Changes

- 3269b411: Fix extractor issue where we didn't explore both branches when using a default value as the condition
  expression

  In the example below, only the `yellow` color would be generated although the `blue` color should also be generated in
  case the `disabled` prop is `true`.

  ```tsx
  const CompB = ({ disabled = false }: { disabled: boolean }) => {
    return <div className={css({ color: disabled ? 'blue' : 'yellow' })}>Component B is disabled</div>
  }
  ```

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

- 78612d7f: Fix node evaluation in extractor process (can happen when using a BinaryExpression, simple CallExpression or
  conditions)

## 0.7.0

### Patch Changes

- f2abf34d: Fix extractor behaviour when encoutering operation tokens, try to evaluate them instead of resolving them as
  string

  before:

  ```tsx
  <AspectRatio ratio={1 / 2} asterisk={1 * 5} exp={1 ** 4} minus={5 - 1} />
  ```

  would be extracted to:

  ```json
  {
    "asterisk": "1 *5",
    "exp": "1**4",
    "minus": "5 -1",
    "ratio": "1 / 2"
  }
  ```

  now, it will be extracted to the actual values:

  ```json
  {
    "asterisk": 5,
    "exp": 1,
    "minus": 4,
    "ratio": 0.5
  }
  ```

- 7bc69e4b: Fix issue where extraction does not work when the spread syntax is used or prop contains string that ends
  with ':'
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- 21295f2e: Resolve identifier default value from parameter, code like `position` and `inset` here:

  ```tsx
  export const Positioned: React.FC<PositionedProps> = ({ children, position = 'absolute', inset = 0, ...rest }) => (
    <styled.div position={position} inset={inset} {...rest}>
      {children}
    </styled.div>
  )
  ```

  - @bamboocss/logger@0.6.0

## 0.5.1

### Patch Changes

- 6f03ead3: Fix issue where operation tokens did not get extracted.

  This means that values such as `1 / 2`, `3*5`, `2 **4`, `8- 1` will now properly be extracted

- e48b130a: - Remove `stack` from `box.toJSON()` so that generated JSON files have less noise, mostly useful to get make
  the `bamboo debug` command easier to read
  - Also use the `ParserResult.toJSON()` method on `bamboo debug` command for the same reason

  instead of:

  ```json
  [
    {
      "type": "map",
      "value": {
        "padding": {
          "type": "literal",
          "value": "25px",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "Identifier",
            "Identifier",
            "VariableDeclaration",
            "StringLiteral"
          ],
          "line": 10,
          "column": 20
        },
        "fontSize": {
          "type": "literal",
          "value": "2xl",
          "node": "StringLiteral",
          "stack": [
            "CallExpression",
            "ObjectLiteralExpression",
            "PropertyAssignment",
            "ConditionalExpression"
          ],
          "line": 11,
          "column": 67
        }
      },
      "node": "CallExpression",
      "stack": [
        "CallExpression",
        "ObjectLiteralExpression"
      ],
      "line": 11,
      "column": 21
    },
  ```

  we now have:

  ```json
  {
    "css": [
      {
        "type": "object",
        "name": "css",
        "box": {
          "type": "map",
          "value": {},
          "node": "CallExpression",
          "line": 15,
          "column": 27
        },
        "data": [
          {
            "alignItems": "center",
            "backgroundColor": "white",
            "border": "1px solid black",
            "borderRadius": "8px",
            "display": "flex",
            "gap": "16px",
            "p": "8px",
            "pr": "16px"
          }
        ]
      }
    ],
    "cva": [],
    "recipe": {
      "checkboxRoot": [
        {
          "type": "recipe",
          "name": "checkboxRoot",
          "box": {
            "type": "map",
            "value": {},
            "node": "CallExpression",
            "line": 38,
            "column": 47
          },
          "data": [
            {}
          ]
        }
      ],
  ```

- d9bc63e7: Fix `ShorthandPropertyAssignment` handling on root objects, it was only handled when accessing an object
  from a prop acces / element access

  this was fine:

  ```ts
  const aliased = 'green.600'
  const colorMap = { aliased }
  const className = css({ color: colorMap['aliased'] })
  ```

  this was not (weirdly):

  ```ts
  const color = 'green.600'
  const className = css({ color })
  ```

- Updated dependencies [f9247e52]
  - @bamboocss/logger@0.5.1

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

- @bamboocss/logger@0.5.0

## 0.4.0

### Patch Changes

- @bamboocss/logger@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/logger@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/logger@0.3.1

## 0.3.0

### Patch Changes

- @bamboocss/logger@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [fb40fff2]
  - @bamboocss/logger@0.0.2
