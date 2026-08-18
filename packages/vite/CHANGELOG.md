# @bamboocss/vite

## 1.45.2

### Patch Changes

- 46013b7: Announce a folded consumer when the module it read from accepts itself, instead of invalidating it and
  telling nobody.

  The fold compiles a class into the module that _calls_ a recipe or shares a style object, so editing the module that
  value came from has to re-transform its consumers. Those consumers are hard-invalidated on the way out — Vite only
  _soft_-invalidates a static importer, which keeps the cached transform, and that cache is where the compiled class
  string lives.

  Naming them back to Vite was gated on `modules.length`, on the reasoning that `addWatchFile` has made each consumer a
  direct importer, so Vite's own pass walks to them and sends the same update. That is true right up until the changed
  module accepts itself: `propagateUpdate` stops at the first self-accepting module and never walks its importers, and
  React Fast Refresh makes every file exporting a component self-accepting. Editing a component that a sibling folds a
  class out of therefore invalidated the sibling and announced nothing, and the browser kept running the class compiled
  from the previous contents until a full reload — with Vite and Bamboo both logging as though the edit had landed. It
  also made the fan-out look cheap in React apps, when it was only deferred.

  The gate is now on whether Vite's walk will actually arrive rather than on whether it has anywhere to start: one
  non-self-accepting module is enough for it to reach the consumers, so the duplicate updates that gate was added for
  are still avoided. An empty list keeps its old meaning. The existing fixture could not catch this because its
  dependency is a plain module, which does propagate outward; the new test uses a self-accepting one.

- Updated dependencies [00e7af9]
  - @bamboocss/core@1.45.2
  - @bamboocss/node@1.45.2
  - @bamboocss/config@1.45.2
  - @bamboocss/extractor@1.45.2
  - @bamboocss/logger@1.45.2
  - @bamboocss/shared@1.45.2
  - @bamboocss/types@1.45.2

## 1.45.1

### Patch Changes

- Updated dependencies [2d97c50]
  - @bamboocss/node@1.45.1
  - @bamboocss/config@1.45.1
  - @bamboocss/core@1.45.1
  - @bamboocss/extractor@1.45.1
  - @bamboocss/logger@1.45.1
  - @bamboocss/shared@1.45.1
  - @bamboocss/types@1.45.1

## 1.45.0

### Patch Changes

- @bamboocss/config@1.45.0
- @bamboocss/core@1.45.0
- @bamboocss/extractor@1.45.0
- @bamboocss/logger@1.45.0
- @bamboocss/node@1.45.0
- @bamboocss/shared@1.45.0
- @bamboocss/types@1.45.0

## 1.44.1

### Patch Changes

- 2792174: The fold reads a module's AST as often as it has questions to answer, rather than once per question it could
  have been asked.

  Profiling a dev server over 24 real HMR edits put ts-morph at 87ms per edit against 2.4ms of extraction, with half the
  ts-morph time inside descendant iterators. Every `getDescendantsOfKind` and `forEachDescendant` visits each node in
  the file and wraps it, so the cost is whole-tree reads. There were five, and none of them was conditional on the
  module containing anything to find.
  - The `cx` walk is skipped when the module imports no `cx`. `cxBindings` is a strict precondition of the loop body's
    own test, so an empty set made the walk's predicate constant-false.
  - The `splitVariantProps` walk is skipped when the name cannot appear. It ran for _every_ styled module, because its
    `if (recipeSourceFile)` guard is true whenever the module holds any candidate at all.
  - The runtime-binding scan reads its two node kinds from one traversal instead of two.
  - `identifierIndex` walks compiler nodes and wraps only the buckets a caller reads. `SyntaxKind.Identifier` sorts
    below `SyntaxKind.FirstNode`, which is what ts-morph tests before it may search the parse tree — so for that kind it
    materialises the whole _token_ tree, every brace and comma, on the way to the identifiers. Parse plus index build
    measures 6.6x faster on 20KB of real tsx, and the deferral that used to protect most modules from it no longer does:
    `css` is not in `PERMITTED_BINDINGS`, so the index is built for every module importing `css`.

  A styled module now pays no whole-tree reads where it paid two, and one where it paid five.

  Output is unchanged, checked node-for-node rather than asserted: `identifier-index.test.ts` holds the index to the
  output of the walk it replaced across every sandbox source file, and `fold-traversal.test.ts` pins the read counts so
  they cannot drift back one walk at a time.

  Two guards are text scans, and both are necessary conditions rather than sufficient ones — the name inside a comment
  costs the walk it always cost. Both also have to allow a unicode escape through: `access.getName()` and
  `Identifier.getText()` return the name as the compiler resolves it, so `badge.splitVariantProps(p)` matches while the
  literal appears nowhere in the source. Guarding on the literal alone left that call unlowered against an erased
  binding, and dropping JSDoc from the identifier walk lost names mentioned only in a `@type` annotation. Both are fixed
  and pinned.

- Updated dependencies [632b75c]
  - @bamboocss/extractor@1.44.1
  - @bamboocss/types@1.44.1
  - @bamboocss/node@1.44.1
  - @bamboocss/config@1.44.1
  - @bamboocss/core@1.44.1
  - @bamboocss/logger@1.44.1
  - @bamboocss/shared@1.44.1

## 1.44.0

### Patch Changes

- Updated dependencies [78b4de5]
- Updated dependencies [f7a6d4c]
  - @bamboocss/types@1.44.0
  - @bamboocss/core@1.44.0
  - @bamboocss/config@1.44.0
  - @bamboocss/node@1.44.0
  - @bamboocss/logger@1.44.0
  - @bamboocss/extractor@1.44.0
  - @bamboocss/shared@1.44.0

## 1.43.1

### Patch Changes

- Updated dependencies [698bd49]
  - @bamboocss/core@1.43.1
  - @bamboocss/node@1.43.1
  - @bamboocss/config@1.43.1
  - @bamboocss/extractor@1.43.1
  - @bamboocss/logger@1.43.1
  - @bamboocss/shared@1.43.1
  - @bamboocss/types@1.43.1

## 1.43.0

### Patch Changes

- Updated dependencies [1cef86c]
  - @bamboocss/core@1.43.0
  - @bamboocss/types@1.43.0
  - @bamboocss/node@1.43.0
  - @bamboocss/config@1.43.0
  - @bamboocss/logger@1.43.0
  - @bamboocss/extractor@1.43.0
  - @bamboocss/shared@1.43.0

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

### Patch Changes

- Updated dependencies [4fcae37]
- Updated dependencies [6fa8d1a]
- Updated dependencies [5c33622]
- Updated dependencies [0ca4f32]
  - @bamboocss/core@1.42.0
  - @bamboocss/types@1.42.0
  - @bamboocss/node@1.42.0
  - @bamboocss/config@1.42.0
  - @bamboocss/shared@1.42.0
  - @bamboocss/logger@1.42.0
  - @bamboocss/extractor@1.42.0

## 1.41.1

### Patch Changes

- @bamboocss/node@1.41.1
- @bamboocss/config@1.41.1
- @bamboocss/core@1.41.1
- @bamboocss/extractor@1.41.1
- @bamboocss/logger@1.41.1
- @bamboocss/shared@1.41.1
- @bamboocss/types@1.41.1

## 1.41.0

### Patch Changes

- @bamboocss/node@1.41.0
- @bamboocss/config@1.41.0
- @bamboocss/core@1.41.0
- @bamboocss/extractor@1.41.0
- @bamboocss/logger@1.41.0
- @bamboocss/shared@1.41.0
- @bamboocss/types@1.41.0

## 1.40.1

### Patch Changes

- 8985e58: Generate `styled-system/` from the build, so a clone does not need the CLI first.

  `Builder.emit` is what puts the generated system on disk for an integration, and on the first call it wrote nothing:

  ```ts
  if (this.hasEmitted && this.affecteds?.hasConfigChanged) { … }
  this.hasEmitted = true
  ```

  The flag it reads is set by the same method, one line down, so the first call could only fall through — artifacts
  appeared on a _later_ call that also carried a config change. The Vite plugin's call site has always been commented "a
  fresh clone has to get those files from the first `vite dev`", and it did not: with no `styled-system/` on disk,
  `vite dev` served an error overlay and `vite build` failed with
  `Rolldown failed to resolve import "styled-system/css"`. Nothing caught it because every project runs `bamboo codegen`
  from a `prepare` script, so the directory was always already there.

  Reaching `emit` through `load` would not have been enough either. A module's imports are all resolved before any of
  them is loaded, so a `root.tsx` importing both `styled-system/css` and `virtual:bamboo.css` has the first resolved
  while the directory is still absent. The Vite plugin therefore generates in `buildStart` — the first hook Rollup calls
  — and the first `load` is handed that pass rather than repeating it. The dev watcher drops it when an extracted file
  changes, so a first load that arrives after an edit still regenerates.

  What this buys is a build step deleted rather than made faster. A project that runs `bamboo codegen && vite build` can
  drop the first half: on one react-router app that step is 585 ms, of which ~20 ms is generating the files and the rest
  is a second Node process loading `ts-morph` and the extractor to do it. `prepare` scripts stay useful — `tsc` and the
  editor want the types before anything builds — and nothing about their output changes: the same 55 artifacts,
  byte-identical CSS.

  Later emits stay narrow, which is what the original guard was reaching for: a watch rebuild re-emits only the
  artifacts a config change affected, and one that changed no config writes nothing.

- f481f05: Stop re-announcing HMR updates Vite is already sending.

  One `css()` edit to a module two routes share moved **554 kB** over the dev socket on a five-route react-router app.
  `root.tsx` and `dashboard.tsx` were each fetched five times, at ~46 kB a copy, and the stylesheet twice — 469 kB of
  the 554 was duplicates of the other 85. Extraction in the same log took 2.49 ms, so essentially none of the wall clock
  was Bamboo doing work. It is now **331 kB** and 9 responses instead of 14, with the same modules re-transformed and
  the edit applying in the same time.

  Two places announced something Vite had in hand:
  - `hotUpdate` returned the modules that folded a value out of the changed file, alongside invalidating them.
    Invalidating is the actual fix — Vite _soft_-invalidates a static importer, and a soft invalidation keeps the cached
    transform, which is where the compiled class string lives. Naming them as well is redundant, because `addWatchFile`
    already makes each one a direct importer, so `propagateUpdate` reaches all of them by itself. It is also not free: a
    framework plugin reading the result re-drives HMR _per entry_ — react-router's
    `react-router-server-change-trigger-client-hmr` calls `reloadModule` once per module, in both its client and its ssr
    pass — so every extra name was another full round trip. Eight `hmr update` messages for one edit; now three, of
    which two are react-router duplicating Vite.
  - The dev watcher forced a reload of the virtual stylesheet for every extracted file. `vite:css-analysis` turns the
    `addWatchFile` calls in `load` into real importer edges, so the sheet is already a direct importer of every file the
    extractor read and Vite propagates an edit to it unprompted. Forcing one as well is a second `updateModules`, which
    the browser answers by refetching the whole stylesheet again — 36 kB a copy, per keystroke.

  Both now defer when Vite has matched a module for the changed file, and both still fire when it has not: a dependency
  the fold read that never became a module of its own is the case they were written for, and nothing else would repaint
  at all.

- Updated dependencies [8985e58]
  - @bamboocss/node@1.40.1
  - @bamboocss/config@1.40.1
  - @bamboocss/core@1.40.1
  - @bamboocss/extractor@1.40.1
  - @bamboocss/logger@1.40.1
  - @bamboocss/shared@1.40.1
  - @bamboocss/types@1.40.1

## 1.40.0

### Patch Changes

- Updated dependencies [3151b14]
- Updated dependencies [21fdf4c]
  - @bamboocss/node@1.40.0
  - @bamboocss/config@1.40.0
  - @bamboocss/core@1.40.0
  - @bamboocss/extractor@1.40.0
  - @bamboocss/logger@1.40.0
  - @bamboocss/shared@1.40.0
  - @bamboocss/types@1.40.0

## 1.39.1

### Patch Changes

- 4734709: Stop failing an SSR build for not emitting a stylesheet it is not supposed to emit.

  `build.ssrEmitAssets` is off by default, so Vite discards CSS assets from an SSR build — the client build is what
  carries the sheet. A server bundle that imports `virtual:bamboo.css` from shared code, which a root component or a
  layout does, therefore asked this plugin to load the stylesheet and then emitted nothing, and the guard against a
  vanished stylesheet read that as the failure it exists to catch.

  It failed a build that was entirely correct. Qwik's `vite build --ssr` is the shape that showed it: every call
  compiled, the client bundle carrying the stylesheet, and the server bundle refusing to finish. React Router escapes it
  only because its plugin turns `ssrEmitAssets` on. The guard still applies wherever assets are emitted, including an
  SSR build that asks for them.

  Separately, `truncateList` reads `BAMBOO_DIAGNOSTIC_LIMIT` off `globalThis` rather than through a bare `process`. The
  value was already guarded, but the _name_ still had to exist: an app type-checking its own source without
  `@types/node` — every Vite template — failed on this file for naming a global it has never heard of, which is what a
  `tsc` step in two of this repo's own sandboxes was doing.

- Updated dependencies [4734709]
  - @bamboocss/shared@1.39.1
  - @bamboocss/config@1.39.1
  - @bamboocss/core@1.39.1
  - @bamboocss/extractor@1.39.1
  - @bamboocss/node@1.39.1
  - @bamboocss/types@1.39.1
  - @bamboocss/logger@1.39.1

## 1.39.0

### Minor Changes

- ae53479: Restart the dev server when `bamboo.config.ts` changes, the way Vite does for its own config.

  Nothing told Vite that file mattered. `watch` is the CLI's own watcher, and a project running `vite dev` never reaches
  it — so editing a token, which is the thing a designer iterates on most, did nothing until something else happened to
  touch a source file, and the instruction was to restart the server by hand.

  A restart rather than a re-emitted stylesheet, because the integration holds two contexts — the CSS plugin's
  `Builder`, which reloads its config, and the compiler's, which does not. A token _value_ edit therefore came out right
  on the next source change, while an edit that changes what compiles — adding a token, a condition, a utility — left
  the compiler naming classes from the old config against a sheet emitted from the new one. Half-updated is worse than
  stale.

  Declared through Vite's own config-file list rather than a watcher of Bamboo's. That list is what reaches a config
  _outside_ `root` — a monorepo with one config above `apps/web`, or a preset resolved into `node_modules`, neither of
  which the project watcher covers — and it makes the restart Vite's, with its concurrency guard and its error reporting
  rather than a second copy of both. The config's import graph is included, so editing a preset restarts too.

### Patch Changes

- 72abce3: Apply an edit to a recipe, or to any module a compiled call reads from, without restarting the dev server.

  The compiler erases an inline `cva`/`sva` declaration and compiles each **call site** into a literal class string, so
  the class for a recipe lives in the module that calls it. Vite's dev server only _soft_-invalidates a module that
  statically imports the changed one — it keeps that module's cached transform result and rewrites nothing but the
  timestamps on its import specifiers — and the class string is inside that cached result. Editing a recipe therefore
  updated the stylesheet and never the markup: Vite logged its update, Bamboo logged a fresh extraction, the new rule
  was emitted, and every element kept the class it had before. Only restarting the server applied the edit.

  `css(sharedObject)` across modules failed the same way. It surfaced less often because a consumer that compiles
  _nothing but_ recipe calls has its import erased, and an erased import is not a static one, so Vite hard-invalidated
  it and the staleness disappeared — which is also why the smallest reproduction of the bug does not reproduce it.

  The Vite plugin now tracks which modules compiled a value out of which other module, and invalidates those consumers
  itself when the dependency changes. Builds are unaffected: Rollup already discards a module whose watched dependency
  changed.

- 2b6a58b: Say what to do with a value that has no finite set of possibilities, and stop describing extraction-only
  fallbacks as if they applied to the compiler.

  A progress bar's width or a dragged element's offset has no rule a build could emit for it, so it belongs in the
  `style` attribute — which is smaller than any alternative and needs nothing from Bamboo. Every styling system hands
  that back to the author eventually; Bamboo's docs did not say so, which left it reading as a gap the reader had missed
  rather than as the answer.

  The CSS-variable pattern is for the one thing the `style` attribute cannot do, since it sits outside the cascade: a
  value that has to vary by condition — a dragged width that still collapses on a small screen — or stay overridable by
  a consumer, which is the one place "a consumer's `css()` wins" otherwise does not hold. The guide now says that, in
  that order, rather than listing five techniques and leaving the choice to the reader.

  The dynamic-styling guide now opens with which option applies to which kind of value, and the two sections that
  describe a fallback — `staticCss` pre-generation and "a runtime condition generates the CSS for every branch" — say
  that they describe the CLI and PostCSS path. Under the Vite compiler both of those calls fail the build instead, which
  is verified rather than assumed: `css({ color: on ? 'red600' : 'blue600' })` is rejected as `dynamic`, and a recipe
  variant compiles to a lookup over precompiled class strings.

- 4c66fdb: Say when a Vite project is emitting the stylesheet through PostCSS, which silently ships the style engine.

  `@bamboocss/postcss` emits CSS and nothing else. Under it, `css()` and `cva()` stay runtime calls and the generated
  style engine goes out in the client bundle — where `@bamboocss/vite` compiles those calls to literal class strings and
  ships no engine at all. Nothing about the result distinguishes the two: the stylesheet is correct, the app renders,
  and the engine is the only difference — 20 kB of client JavaScript in one reported app. Bamboo's own React Router
  guide described the PostCSS setup, so projects reached it by following the docs rather than by choosing it.

  Both entry points now say so. `bamboo init --postcss` warns when the directory already has a Vite config, and the
  PostCSS plugin warns once per project when it runs in one — suppressed when a Bamboo source compiler is loaded in the
  same process, so a project that has both installed is not told off for the setup it already has. Pass
  `{ runtimeStyling: true }` to the plugin where resolving styles at runtime is deliberate.

  A Svelte, Vue or Astro project is the exception and is never warned: `@bamboocss/vite` compiles JavaScript and
  TypeScript, and their components are templates it leaves alone — moving one onto it would prune every rule only those
  components reach. The React Router guide now uses `@bamboocss/vite`, and the other Vite-framework guides say which
  integration they are describing.

- Updated dependencies [4c66fdb]
- Updated dependencies [4d27ba4]
  - @bamboocss/node@1.39.0
  - @bamboocss/types@1.39.0
  - @bamboocss/core@1.39.0
  - @bamboocss/config@1.39.0
  - @bamboocss/logger@1.39.0
  - @bamboocss/extractor@1.39.0
  - @bamboocss/shared@1.39.0

## 1.38.0

### Minor Changes

- ad375b2: Stop compiling a destructuring default as if it were the value.

  A component taking a `css` prop with a default returned the default's classes no matter what its caller passed:

  ```tsx
  const A = ({ css: cssProp = { color: 'red.300' } }) => css(cssProp)

  A({ css: { color: 'blue.500' } }) // → "c_red.300". Not blue.
  ```

  Not missing styles — _wrong_ styles, silently. The build was green, the class names in the markup were real, and no
  skip was recorded, so the survivor check that exists to catch uncompilable calls never saw it. The empty spelling,
  `({ css: cssProp = {} }) => css(cssProp)`, folded to `""`, which reads like "nothing to do here" rather than like a
  caller's styles being discarded.

  It is not limited to parameters. The default wins over a source object that plainly carries the key:

  ```ts
  const source = { tone: 'blue.500' }
  const { tone = 'red.300' } = source
  css({ color: tone }) // → c_red.300
  ```

  The extractor resolves a binding element's default without consulting what is being destructured: its
  `maybeDefinitionValue` tests for an initializer first and returns the boxed default, never reaching the branch that
  would read the source object.

  Extraction is left alone, and not only because emitted CSS is sacred — the rule is _wanted_ there. A CLI or PostCSS
  build ships a runtime `css()`, where the default genuinely does apply when a caller omits the key, so it needs CSS
  behind it. Being optimistic costs extraction one rule; it costs compilation the right answer, because compilation
  _replaces_ the call. So the fix is in the compiler's `isStaticBox`, and emitted CSS is unchanged.

  **A call whose value comes from a destructuring default is now declined**, which under mandatory compilation is a
  build error naming the call. That is the intended outcome: there is no runtime styling fallback to degrade to, so the
  alternatives are a failed build or wrong styles in production. Move the variation into declared recipe variants, pass
  a finite set of values, or safelist with `staticCss`.

  Note the direction this had been pointing: `const { tone } = source` was already declined, and adding a default to
  that same line made it start folding — to the default. More information made the compiler more confident and less
  correct.

  Two things this does not reach. A call _written inside_ a default — `({ cls = css({ color: 'red.300' }) }) => cls` —
  still folds, correctly, since its argument is written right there; but a later read of `cls` is not refused, and a
  caller can still have replaced it. And a default destructured in one module and consumed in another still folds, as
  the no-default spelling there always did. Both are narrower than what this closes, and neither is new.

  `sandbox/vite-ts/src/Button.tsx` still ships the broken pattern — it is why those call sites were not among the ones
  that sandbox already failed to build on, and it now declines two more. Fixing the example is separate.

  Measured by counting the work rather than timing it, since this sits on the dev server's per-transform path and
  wall-clock could not resolve it against a loaded machine: the guard's parent walks over `sandbox/vite-ts/src/App.tsx`
  are **281**, against 8,416 for a first cut that walked to the root from every stack entry. The walk stops at the first
  parent that computes rather than composes a value, which is also what keeps a call inside a default foldable.

- 21d1559: Replace `renameCssAsset` with `pruneCss`. **Breaking:** `renameCssAsset` is removed;
  `bamboocss({ renameCssAsset: false })` becomes `bamboocss({ pruneCss: false })`.

  The option never controlled what its name said. Since 1.37.1, `renameCssAsset: false` skipped the _pruning_ as well —
  because prune-without-rename is the stale-CDN failure the rename exists to prevent — so the flag's larger effect was
  the one it did not mention. That mismatch had a cost: a project losing rules to the cross-environment pruning bug
  fixed in 1.37.13 reached for a rename flag to fix it, which worked, and left the real bug undiagnosed for eleven
  releases.

  The two operations were never independently meaningful in either direction. Prune-without-rename is unsafe. And
  rename-without-prune was already a no-op: `optimizeStaticCssAssets` returns early on `optimized === source`, so a
  sheet nothing was removed from keeps its name because its bytes are unchanged. Renaming is a consequence of having
  changed the bytes, not a feature. So the `rename` argument is gone from `optimizeStaticCssAssets` too, and the unsafe
  combination is now unrepresentable rather than merely unreachable.

  Setting the old name now throws instead of being ignored. Vite loads `vite.config.ts` through esbuild, which strips
  types without checking them, so a removed option is not a type error to anyone who does not separately run `tsc` over
  their config — it is a key that quietly stops doing anything. A project that set `renameCssAsset: false` because a
  renamed asset breaks something downstream would otherwise have had both halves switched back on by upgrading, which is
  the same class of silent reversal this whole change is about.

  Pruning also no longer goes off in silence. A build with `pruneCss: false` prints one line saying so, matching the
  line 1.37.13 added for an environment that has not compiled yet, and the user's own setting is the one reported when
  both apply. Four tests cover those branches; before this, deleting either line broke nothing.

  `pruneCss: false` also declines more than `renameCssAsset: false` did, and this is a fix rather than a side effect.
  The old flag ran the prune pass and then put the original bytes back, so the pass's assertion — every compiled class
  has a rule in the sheet — still ran and could still fail the build. That made the escape hatch not an escape:
  1.37.13's advice to reach for it when reachability accounting goes wrong did not actually work. The whole pass is now
  skipped, so the setting cannot fail a build over reachability. The cost is that a project running with it off forfeits
  that assertion, which is the right trade for a switch whose purpose is to take this machinery out of the picture.

  The documented reason to reach for it is narrower and more honest than "something cannot follow a renamed asset": what
  pruning breaks is anything deriving an artifact from the stylesheet's _content_ during `generateBundle` before Bamboo
  runs. Subresource integrity is the clear case — `integrity` is a digest of the bytes rather than a filename, so the
  reference rewriting cannot carry it across, and a browser handed a stale digest refuses the stylesheet outright.
  Renaming is irrelevant there; only declining to prune helps. Where such a consumer can be moved after Bamboo instead
  (`order: 'post'`, `writeBundle`, `closeBundle`), the docs now say to do that and keep the pruning.

  Emitted CSS is unchanged at the default, and `pruneCss: false` emits what `renameCssAsset: false` emitted.

### Patch Changes

- bb267fd: Count a module once in the compiler's coverage summary, and print the summary once.

  1.37.13 gave both plugins `sharedDuringBuild: true`, so one instance now serves every environment of a build rather
  than one instance per environment. The summary's totals were accumulated as the transforms arrived, which was correct
  when each environment had its own counters and is not correct now: both environments transform the modules they have
  in common, which in a real app is most of them, and each of those was counted once per environment.

  A fixture of one shared module and one entry each — three files, one `css()` call — reported:

  ```
  Compiled 1/1 (100%) across 1/2 files      <- client, partial
  Compiled 2/2 (100%) across 2/4 files      <- both, double-counted
  ```

  It now reports `Compiled 1/1 (100%) across 1/3 files`, once. Coverage describes the source rather than how many times
  a bundler handed the same file over, so results are kept per file and summed at the end, and the line waits for the
  last environment the way the reachability judgements beside it already do.

  Two things follow from keeping results per file rather than summing as they arrive.

  **Dev stops inflating too.** Every HMR re-transform of a file counted as another file, so a long session's totals grew
  without bound. They now describe the modules, however many times each was handed over.

  **Waiting for the last environment is a build-only rule.** Dev satisfies its premise in name only: a resolved config
  always lists both `client` and `ssr`, so a project configuring `builder` announces two environments — while the dev
  server only ever starts the client one, since `perEnvironmentStartEndDuringDev` is off by default. Deferring to an
  environment that was never going to start suppressed the summary outright, for exactly the framework projects that
  configure `builder`. The gate is scoped to `command === 'build'`, and a test pins it.

  Nothing about compilation changes — this is only what gets printed. The regression was cosmetic but misleading in the
  one direction that matters for this number: a project reading the summary to find out how much of its source compiles
  would have seen inflated file counts, and a partial line for the client scrolling past before the real one.

  The summary is still skipped for a build that declares an environment it never builds, which is the same gap the
  reachability judgements beside it have.

- 5f85489: Stop a `?raw` import of a `.tsx` file from overwriting that file in the compiler.

  Importing a module both normally and as text — `import text from './theme.tsx?raw'` beside
  `import { shared } from './theme'` — could fail the build with a diagnostic that could not be acted on:

  ```
  bamboocss: 1 call(s) could not be compiled.
    src/consumer.tsx
      3: css() — dynamic
  Make the values finite and statically analyzable …
  ```

  The value already was. `./theme.tsx?raw` is a module whose text is `export default "…"`, and the transform's id filter
  strips the query before testing the extension — it has to, or nothing matches `.tsx` — which made the wrapper look
  like the file itself. Its text was then handed to ts-morph under the _real_ file's path, replacing the parsed module
  that every fold resolves against. The next module to fold `css(shared)` read `export default "…"`, found no `shared`,
  and declined.

  `?url`, `?worker` and `?sharedworker` are the same shape and are rejected too — Vite's own `SPECIAL_QUERY_RE`, and
  nothing beyond it. They have nothing to fold: they are wrappers Vite generates, not source.

  The list was drafted wider, with `?inline`, `?no-inline`, `?worklet` and `?init`, and all four were wrong. Vite has no
  `worklet` query; `?init` applies to `.wasm`, an extension already rejected; and `inline`/`no-inline` only pick
  base64-versus-file for something that already matched `raw`/`url`, so `./a.tsx?inline` is served as the module's own
  source. Rejecting an id that does carry source is the expensive direction — the transform declines, its atoms never
  reach the reachability set, pruning removes their rules, and the generated runtime still returns the class names, so
  elements render unstyled with nothing logged.

  Whether it bit depended on which of the two ids Rollup transformed last, so the same project could build, then stop
  building because an import moved — and a project that hit it had no way to reach the cause from the message, which
  names the consumer and blames its source.

  The filter is a deny list of those wrappers rather than an allow list of benign queries, because dev ids carry `?t=`
  after an edit and `?import` when a dynamic import is rewritten: rejecting an unrecognised query would silently stop
  folding the file someone just saved, by that same mechanism.

  Three benign ids are pinned by tests beside the rejected ones, `?worker_file` among them — that is how dev serves a
  worker's _real_ source, it contains "worker", and it is the obvious thing for someone to add to the list later.
  Removing the guard fails six tests. The real-build test imports a consumer on either side of the `?raw` line, since
  only a consumer folded after the wrapper lands is exposed and which that is depends on the order Rollup transforms in.
  - @bamboocss/config@1.38.0
  - @bamboocss/core@1.38.0
  - @bamboocss/extractor@1.38.0
  - @bamboocss/logger@1.38.0
  - @bamboocss/node@1.38.0
  - @bamboocss/shared@1.38.0
  - @bamboocss/types@1.38.0

## 1.37.13

### Patch Changes

- 2489e01: Stop pruning the stylesheet against half a build.

  A project on Vike reported rarely-used classes silently not applying — `md:{display:inline-block}` among them — with
  **39% of its atoms missing** from the stylesheet its pages link. The workaround was
  `bamboocss({ renameCssAsset: false })`, which disables pruning outright.

  **The sheet is pruned when the environment that imports it finishes, which is not when the build finishes.** An SSR
  framework builds a client bundle and a server bundle. The client imports `virtual:bamboo.css`, so the client's
  `generateBundle` is where the stylesheet is finalized — and the client builds _first_, before the server environment
  has transformed a single module. Reachability is therefore incomplete at exactly the moment it is used to delete
  rules, and every atom only the server graph reaches loses its rule from the one copy that ships. The sheet is emitted
  once, not twice.

  Pruning now waits until every environment of the run has been compiled. Being last is not the common case — frameworks
  build the client first — so those builds now ship the full extracted stylesheet, and print one line saying which
  environment they are still waiting on. That is the same output `renameCssAsset: false` produces, so the workaround can
  be dropped without the sheet changing size. A framework that builds its server bundle first does get pruned output.

  **A second cause, found while reproducing it: there was no shared session to accumulate into.** Vite re-reads the
  config file once per environment and calls the plugin factory again, so a project listing `bamboocss()` in
  `vite.config.ts` — every project — got a _fresh instance per environment_, each with its own compilation session,
  context and ts-morph project. Nothing an environment established could be seen by the next one. Both plugins now
  declare `sharedDuringBuild: true`, which is the premise the 1.37.2 fix was already written against. It also means the
  config load, extraction and parse happen once per build rather than once per environment.

  Verified by probing Vite directly: with the plugin coming from a config file, a plugin without the flag reported
  instance #3 for the client environment and #5 for ssr; with it, one instance served both.

  **Where the run does not say how many environments it has, the build fails rather than ships.** `vite build` announces
  them, and so does any config setting `builder`. A script calling `builder.build(environment)` itself announces
  nothing, and the first environment cannot know it is not the last — so it prunes, and the next environment throws when
  it finds a class it just compiled already pruned out of a finalized sheet. The message names the classes and the three
  ways to fix it. Green build, real class names in the markup, unstyled elements is the failure this whole change is
  about; it is not worth trading one path back into it.

  **A third, found by testing the order that now works.** The two strict-build guards — "compiled classes were produced
  but `virtual:bamboo.css` was not imported", and "compiled modules are outside the CSS extraction graph" — both read
  state that only the environment serving the stylesheet fills in, and both ran at every environment's `buildEnd`. Asked
  of an environment that builds before that one they are not early but wrong: a build with the server bundle first
  failed with "virtual:bamboo.css was not imported" for a client bundle importing it on the next line. They are
  statements about a finished run, and now wait for one.

  Also: `session.sourcemap` was written by every environment's `configResolved` and read at `generateBundle`, so with
  one shared instance a rename could rewrite chunk text against another environment's sourcemap mode. It is now read
  from the environment being generated.

  What this does not do is recover pruning for client-first SSR builds. Doing that needs per-file attribution of
  extracted atoms, so that atoms from modules outside the current environment's graph can be held back while everything
  else is still pruned — the recipe-variant explosion, which is the bulk of what pruning removes, is attributable to
  modules that _are_ in the graph. That is a change to the encoder and the extraction pass, and it is not this one.

  Emitted CSS is unchanged for a single-environment build, measured rather than reasoned: a real `vite build` of a
  fixture using `css()`, a recipe with a variant nothing selects, a condition and a pseudo-element, taken before and
  after on the same tree. The stylesheet is byte-identical (1,151 bytes, same SHA-1), the asset name — which carries a
  hash of the pruned bytes — is unchanged, and so is the emitted JS. The unselected variant is still pruned, so pruning
  is running, not merely producing the same output by being skipped.

  Nothing on a per-module path moved, so `fold.bench.ts` does not apply; the added work is one set difference per
  environment at `generateBundle`.
  - @bamboocss/config@1.37.13
  - @bamboocss/core@1.37.13
  - @bamboocss/extractor@1.37.13
  - @bamboocss/logger@1.37.13
  - @bamboocss/node@1.37.13
  - @bamboocss/shared@1.37.13
  - @bamboocss/types@1.37.13

## 1.37.12

### Patch Changes

- 6291021: Walk a module's identifiers at most once while reporting surviving runtime bindings, and not at all when
  there is nothing to look up.

  `reportRuntimeBindings` ran two full identifier traversals of every module it was given. The first built an index for
  the recipe-binding scan, above the loop that reads it — so a module declaring and importing no recipe, which is most
  of them, paid for an index nothing read. The second was a separate pass looking for reads of a watched import,
  wrapping every identifier in the file a second time to find at most a handful.

  The index is now built on first use and shared, and the watched-import scan reads the buckets it needs out of it
  rather than re-walking. A module with no recipe binding and no watched import now walks nothing; one with either walks
  once.

  Nothing changes about what is reported. Survivors from the watched-import scan are sorted back into document order
  before being recorded — grouping by name is an artefact of reading an index keyed on names, and these are read as a
  list of positions to go and fix.

  Measured on real Vite builds, three alternating A/B pairs each:

  | app                                      | before              | after               | ratio              |
  | ---------------------------------------- | ------------------- | ------------------- | ------------------ |
  | 6,307 files, every module imports bamboo | 29.3 / 28.9 / 28.9s | 27.3 / 27.5 / 27.7s | 0.93 / 0.95 / 0.96 |
  | 9,307 files, a third import nothing      | 33.7 / 34.1 / 34.3s | 30.6 / 31.3 / 31.3s | 0.91 / 0.92 / 0.91 |

  So **5% off a build where the deferral never fires, 9% where it does** — the two halves of the change, separated.
  Emitted CSS is byte-identical on both (3,611 bytes), asset names — which carry content hashes — unchanged, and the
  compile summary the same in every arm.

  `fold.bench.ts` moved within noise, controls included; it folds one module at a time, where a second identifier walk
  over a small file is not resolvable against a ±5% band.
  - @bamboocss/node@1.37.12
  - @bamboocss/config@1.37.12
  - @bamboocss/core@1.37.12
  - @bamboocss/extractor@1.37.12
  - @bamboocss/logger@1.37.12
  - @bamboocss/shared@1.37.12
  - @bamboocss/types@1.37.12

## 1.37.11

### Patch Changes

- c2f36fa: Stop caching ts-morph nodes across passes, which threw on a re-transformed module.

  1.37.10 indexed a module's identifiers once instead of walking the tree per recipe binding, and memoized that index
  against the source text — copying the cache beside it, which holds module-scope _names_. Strings outlive anything;
  nodes do not. `addSourceFile` overwrites, and overwriting forgets every node previously taken from that file, so the
  next read of a cached node threw `Attempted to get information from a node that was removed or forgotten`.

  Identical text is the dangerous case rather than changed text: a changed file misses the cache and rebuilds, so this
  only bit when nothing appeared to have happened — a watch rebuild, a second build environment, a re-request in dev.

  The index is now built once per pass and handed to each lookup, which keeps the walk-once win without holding nodes
  between passes. A test re-transforms byte-identical source three times and fails with that exact error when the cache
  is restored.
  - @bamboocss/config@1.37.11
  - @bamboocss/core@1.37.11
  - @bamboocss/extractor@1.37.11
  - @bamboocss/logger@1.37.11
  - @bamboocss/node@1.37.11
  - @bamboocss/shared@1.37.11
  - @bamboocss/types@1.37.11

## 1.37.10

### Patch Changes

- 74689fe: Remove two costs that grew with the size of the thing being compiled.
  - **Survivor bookkeeping was quadratic.** Every transform scanned the whole survivor list to forget its own file's
    entries, then rebuilt the dedupe key set from scratch — O(modules x survivors) across a build, and worst exactly
    when a build is already failing and someone is iterating on it. One project reported 736 survivors across 9,461
    modules, which is seven million string builds discarded immediately. They are now indexed by file, so forgetting one
    is a single map delete.
  - **The reference walk repeated per binding.** `localReferencesTo` walked every identifier in the module for each
    recipe binding, so a module declaring ten recipes walked its identifiers ten times. One walk now answers for all of
    them, and the index is cached against the source text like the module-scope names beside it, so re-transforming
    unchanged text reuses it.

  Neither changes what is emitted; both are the same answers computed once.

  Measured on a real Vite build with each plugin hook instrumented, at 100/200/400 generated component files: the
  per-module transform is the linear cost (~0.8ms/file), config and context setup a fixed ~100ms, and pruning and
  renaming together under 3ms. The largest remaining item is structural rather than algorithmic — the compiler and the
  stylesheet build separate contexts with separate ts-morph projects, so the same files are parsed twice.
  - @bamboocss/config@1.37.10
  - @bamboocss/core@1.37.10
  - @bamboocss/extractor@1.37.10
  - @bamboocss/logger@1.37.10
  - @bamboocss/node@1.37.10
  - @bamboocss/shared@1.37.10
  - @bamboocss/types@1.37.10

## 1.37.9

### Patch Changes

- ffcea2f: Prune a merged rule per selector instead of keeping it whole.

  The optimizer collapses rules sharing a body into one selector list, so an atom nothing can reach routinely ends up
  beside a reachable one — `content: ""` is written by every `_before` and `_after` in a project, and they merge into a
  single rule. Reachability judged the rule as a whole and skipped anything naming more than one class, so all of them
  survived. That is dead CSS pruning exists to remove, and it grows with exactly the declarations that repeat most.

  Each selector in the list is now judged on its own: unreachable ones are dropped and the rule is removed only when
  none survive. On a rule merging twenty pseudo-element atoms of which two are reachable, that is 648B to 152B.

  A selector naming more than one class is still left alone. A compound variant selects on classes the element already
  carries, so no single atom owns the rule and dropping it would take a style the element still needs.
  - @bamboocss/config@1.37.9
  - @bamboocss/core@1.37.9
  - @bamboocss/extractor@1.37.9
  - @bamboocss/logger@1.37.9
  - @bamboocss/node@1.37.9
  - @bamboocss/shared@1.37.9
  - @bamboocss/types@1.37.9

## 1.37.8

### Patch Changes

- 1f28013: Assert the size and the duplication of the emitted stylesheet.

  Nothing measured CSS output. Every change to atomisation, pruning or naming moves it, and the only way anyone noticed
  was by grepping a shipped bundle — which is how a bug that removed every `::before` rule reached production.

  The fixture authors the same declarations five ways: a bare `css()` call, a recipe base, a recipe variant, a second
  recipe, and a condition. Two assertions with different jobs:
  - **Duplication counts**, which are the stable half. Global atom sharing means a declaration authored five ways
    reaches the stylesheet once, and that holds regardless of formatting, minifier or token values. It fails the moment
    sharing breaks.
  - **A byte ceiling**, deliberately loose at roughly double what the fixture emits. Its job is to catch a step change —
    sharing breaking, a layer emitted twice, pruning stopping — not to police ordinary drift. It prints the real figure,
    so raising it is a one-line decision rather than an investigation.

  Asserted rather than benchmarked because bytes are deterministic, so this runs in CI where a wall-clock measurement
  would only be flaky.
  - @bamboocss/config@1.37.8
  - @bamboocss/core@1.37.8
  - @bamboocss/extractor@1.37.8
  - @bamboocss/logger@1.37.8
  - @bamboocss/node@1.37.8
  - @bamboocss/shared@1.37.8
  - @bamboocss/types@1.37.8

## 1.37.7

### Patch Changes

- c19a89f: Resolve the query forms of `virtual:bamboo.css`, so `?url` works.

  `import href from 'virtual:bamboo.css?url'` — Vite's convention for asking any CSS module for its URL rather than its
  contents — did not resolve at all and failed as an unresolvable path. Neither did `?raw` or `?inline`.

  The query is now carried onto the resolved id and the stylesheet is served for whatever it is, letting Vite's CSS
  pipeline do what it already knows how to do rather than reimplementing it here. That also covers the `?transform-only`
  import Vite's own `?url` handling generates against the already-resolved id, which is what made the first attempt at
  this fail on an import nobody wrote.

  Worth knowing before reaching for it: `?url` makes the stylesheet an asset of its own rather than part of whatever
  stylesheet the importing module belongs to. That is what `?url` means rather than a shortcoming — but a project that
  concatenates Bamboo's CSS into one global stylesheet does not want it, because it splits that back apart. It is for a
  `<link>` you write yourself, a preload hint, or an href handed to something outside the bundler.
  - @bamboocss/config@1.37.7
  - @bamboocss/core@1.37.7
  - @bamboocss/extractor@1.37.7
  - @bamboocss/logger@1.37.7
  - @bamboocss/node@1.37.7
  - @bamboocss/shared@1.37.7
  - @bamboocss/types@1.37.7

## 1.37.6

### Patch Changes

- 4c4e364: Bring the documentation back in line with what the compiler now does.
  - **Class names in every example were the compact format that no longer exists.** Six pages showed `'_4p9d _7bc2'` as
    what a compiled call emits. Since `denseClassNames` was removed, a compiled call emits the semantic atom names, or
    hashed ones when `hash` is on.
  - **`renameCssAsset` and `BAMBOO_DIAGNOSTIC_LIMIT` were undocumented**, both added recently. The first now explains
    why it exists — `[hash]` is expanded before pruning, so the name describes the stylesheet as it was beforehand — and
    that turning it off skips the pruning too, rather than only the rename.
  - **Pre-rendering guidance described a setting that is gone.** It said to use stable compact names when server and
    client are built separately. Names are now derived from the declarations themselves, so the two agree without
    coordination.
  - **`hash` was described as extraction-only** in two places, written while a second Vite-only shortening layer
    existed. It is now the only thing that shortens names, and it applies to every build path.
  - @bamboocss/config@1.37.6
  - @bamboocss/core@1.37.6
  - @bamboocss/extractor@1.37.6
  - @bamboocss/logger@1.37.6
  - @bamboocss/node@1.37.6
  - @bamboocss/shared@1.37.6
  - @bamboocss/types@1.37.6

## 1.37.5

### Patch Changes

- 4cb392e: Match a class by its name rather than by how it happens to be spelled, so custom properties keep their rules.

  The same class reaches the stylesheet either escaped or not. `--bottom-mask-size_16px` is a valid selector exactly as
  written — a CSS ident may begin with `--` — while `esc` produces the escaped `\--…` form that reachability keys are
  stored in. Every comparison in the reachability pass was on the raw spelling, so a key written one way missed a rule
  written the other, and pruning removed the atom with its rule sitting in the stylesheet all along.

  It could only affect names that need an escape — custom properties, vendor-prefixed properties, anything with a
  leading dash — which is why it presented as every `--*` and `-webkit-*` declaration losing its rule at once while flat
  ones were untouched, and why it appeared only under `hash: false`, where names are semantic rather than opaque.

  Pruning, the retained-class check and the compact-name pass now all compare on the escape-free name. Stripping
  backslashes is unambiguous, because a semantic atom name never contains a literal one.

  Found from a user's build output rather than from a reproduction: the diagnostic added in 1.37.3 reported
  `a rule exists under "--bottom-mask-size_16px"` against an escaped key, which named the mismatch exactly.
  - @bamboocss/config@1.37.5
  - @bamboocss/core@1.37.5
  - @bamboocss/extractor@1.37.5
  - @bamboocss/logger@1.37.5
  - @bamboocss/node@1.37.5
  - @bamboocss/shared@1.37.5
  - @bamboocss/types@1.37.5

## 1.37.4

### Patch Changes

- 9fbd7c4: Escape a reachability key at most once, so custom properties keep their rules.

  `esc` is idempotent for a name that needs no escaping and not otherwise. `d_flex` survives any number of passes;
  `--scrollbar-width_10px` becomes `\--scrollbar-width_10px` and then `\\--scrollbar-width_10px`. A key escaped twice
  matches no rule in the emitted sheet, so reachability pruning removes the atom and the elements carrying it render
  unstyled.

  It affects only names that need escaping — custom properties, vendor-prefixed properties, anything with a leading dash
  or a condition prefix — which is why it presented as every `--*` and `-webkit-*` declaration losing its rule while
  flat ones were untouched, with the rule plainly present in the stylesheet the whole time.

  A semantic atom name never contains a literal backslash, so one is an unambiguous signal that a name is already in
  selector form. `markClassUsed` now leaves those alone rather than escaping them again.
  - @bamboocss/config@1.37.4
  - @bamboocss/core@1.37.4
  - @bamboocss/extractor@1.37.4
  - @bamboocss/logger@1.37.4
  - @bamboocss/node@1.37.4
  - @bamboocss/shared@1.37.4
  - @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- 90f6bc6: Make the orphaned-class error say enough to diagnose without a second build.

  A report of twelve orphaned classes — every one a CSS custom property or a vendor-prefixed name, so every one a class
  whose leading dash needs escaping — could not be reproduced from the names alone, because the names looked identical
  on both sides of the comparison. The error printed what was missing and nothing about why.

  Each entry now says where it is missing from, which is what separates the two possible causes:
  - `NOT extracted` — the atom was never emitted, so the mismatch is in what the compiler marked used;
  - `in the extracted atoms; no rule in the sheet` — it was extracted but no rule survived, so the mismatch is in
    emission or pruning;
  - `a rule exists under "…"` — a rule is present under a spelling this did not recognise, which points at escaping
    rather than at either of the above, and is invisible when only the missing name is printed.

  The last one is the case that matters most and was the hardest to see: two names differing only in escaping look the
  same in a list.
  - @bamboocss/config@1.37.3
  - @bamboocss/core@1.37.3
  - @bamboocss/extractor@1.37.3
  - @bamboocss/logger@1.37.3
  - @bamboocss/node@1.37.3
  - @bamboocss/shared@1.37.3
  - @bamboocss/types@1.37.3

## 1.37.2

### Patch Changes

- 35a689c: Fix three things a multi-environment build, a watch rebuild, and a racing delete each broke.

  **An SSR environment no longer fails the build.** `buildStart` fires once per environment, and it reset the whole
  compilation session each time — so a framework building a client and an SSR bundle against one plugin instance had the
  second discard everything the first established. `cssLoaded` went false, and an SSR bundle that legitimately never
  imports the stylesheet (the client build emits it) failed the "not imported" check outright. The reset now happens per
  _run_: seeing the same environment twice is what marks a new one. The lost-stylesheet guard is likewise scoped to the
  environment that actually served the sheet, since only that one can lose it.

  **A watch rebuild sweeps files it no longer generates.** `prune` ran only when the artifact list was unfiltered, and
  every incremental rebuild passes a filter — so a pattern dropped from the config left its generated module behind,
  resolving and returning class names for rules that no longer existed. Pruning now recomputes the complete list rather
  than reading the written subset as the whole truth. A `codegen:prepare` hook that returns a subset still suppresses
  it, because nothing can tell that apart from a hook adding artifacts.

  **A file disappearing mid-build is skipped rather than fatal.** A file can vanish between being globbed and being read
  — a watch rebuild racing a delete, a branch switch. It has no styles left to contribute, so it is not a build to fail.
  Only `ENOENT` is swallowed.

  Note on the second: recomputing the full artifact list costs work on every filtered rebuild that previously skipped
  it. That is deliberate — a stale generated module that still resolves is worse than a slower rebuild.

- Updated dependencies [35a689c]
  - @bamboocss/node@1.37.2
  - @bamboocss/config@1.37.2
  - @bamboocss/core@1.37.2
  - @bamboocss/extractor@1.37.2
  - @bamboocss/logger@1.37.2
  - @bamboocss/shared@1.37.2
  - @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- ad937fb: Rename the pruned stylesheet on Rolldown too, and never prune without renaming.

  `[hash]` is expanded before `generateBundle`, so pruning after it leaves the name describing the unpruned bytes. A
  change to _reachability alone_ — which is what a Bamboo upgrade is — then leaves identical source CSS under an
  identical name with different content, and a CDN holding that key serves the old stylesheet past the deploy. One
  project hit that twice and worked around it by versioning the filename itself.

  1.35.4 disabled the rename under Rolldown because renaming dropped the asset there. That was the wrong half to keep:
  the build still pruned, so Rolldown — which is every Vite 8 build — got exactly the unsafe combination.

  Two changes:
  - **The rename works on Rolldown.** Dropping the asset was caused by re-keying the `bundle` object, not by the rename.
    `fileName` is now mutated in place; Rollup and Rolldown both write an asset to its `fileName`, and the recorded
    references are carried across as before. Verified against real builds on both.
  - **`renameCssAsset: false` now skips pruning as well.** The two are one operation. Shipping a larger stylesheet is a
    better failure than shipping a stale one, so where the name cannot move, the bytes do not either.

  A project working around this by putting a release segment in the CSS filename no longer needs to.
  - @bamboocss/config@1.37.1
  - @bamboocss/core@1.37.1
  - @bamboocss/extractor@1.37.1
  - @bamboocss/logger@1.37.1
  - @bamboocss/node@1.37.1
  - @bamboocss/shared@1.37.1
  - @bamboocss/types@1.37.1

## 1.37.0

### Minor Changes

- ba244f7: Remove `denseClassNames`. Class-name compaction is the core `hash` option's job.

  Two independent mechanisms shortened class names at different layers: core `hash`, which applies to every build path,
  and this Vite-only rename applied after pruning. The overlap was never documented, and the second one contributed to
  three separate defects — the reachability key that lost every `::before` rule went through its semantic lookup, its
  `local` mode allocates names from a counter and so produced different names per build environment, and because compact
  names contain no characters needing CSS escaping, every configuration using it left the escaping paths untested.

  That last point was load-bearing in a way that was invisible: an existing assertion checked that each class a compiled
  recipe returns has a rule, by looking for `.${token} {` in the sheet. The sheet spells a class escaped. Compact names
  had nothing to escape, so the comparison passed without ever exercising the transform it depends on. With semantic
  names it fails until the check goes through `esc`, which is now what it does.

  Projects wanting short class names should set `hash: true` in `bamboo.config.ts`, which covers CLI and PostCSS output
  too. Removing the option is a behaviour change for every Vite build: class names in the emitted CSS and JavaScript are
  now the semantic ones unless `hash` says otherwise.

### Patch Changes

- @bamboocss/config@1.37.0
- @bamboocss/core@1.37.0
- @bamboocss/extractor@1.37.0
- @bamboocss/logger@1.37.0
- @bamboocss/node@1.37.0
- @bamboocss/shared@1.37.0
- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- f553264: Correct the `runtime-binding` guidance, which described a constraint 1.36.0 removed.

  Until 1.36.0 the declaring module answered for references it found anywhere in the project, so an exported inline
  recipe failed even when every consumer compiled cleanly. The message and the recipes page both told people the fix was
  to move the recipe into `theme.extend.recipes` — and at least one team migrated every shared recipe in their
  application on that advice.

  Since 1.36.0 each module answers only for its own text. Calling an inline recipe from another module compiles like any
  other call; what fails is _reading the binding_ rather than calling it — `const alias = badge`, `badge.raw(...)`, a
  bare re-export — because the declaration is erased and the value is `undefined`. The message now says that, and names
  the read as the thing to change.

  The recipes page carried a section asserting the old constraint outright, and its comparison table said an inline
  recipe could not be imported by another module. Both are corrected, and two rows of that table that a previous edit
  had absorbed into the surrounding prose are restored.
  - @bamboocss/config@1.36.5
  - @bamboocss/core@1.36.5
  - @bamboocss/extractor@1.36.5
  - @bamboocss/logger@1.36.5
  - @bamboocss/node@1.36.5
  - @bamboocss/shared@1.36.5
  - @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- 89196e5: Normalize what config loading throws, in both hooks that reach it during dev.

  `ensureContext` loads and evaluates the user's config file and its hooks, so what it throws is outside this plugin's
  control — and `buildStart` and `transform` both awaited it unguarded. A primitive from there still reached Vite's dev
  error middleware, which puts what it is handed into a `WeakSet` and throws `TypeError: Invalid value used in weak set`
  on anything that is not an object, replacing the real failure.

  This is the last serve-path entry point that was not going through `asError`; `transform`'s fold and the virtual
  stylesheet's `load` were covered in 1.36.2 and 1.36.3.

  Worth knowing when a weak-set error persists after this: the value can also arrive from a middleware that is not
  Bamboo's. A stack whose frames pass through another plugin's request handler before `viteErrorMiddleware` means that
  handler forwarded a non-object to `next()`, and no amount of normalizing here can reach it.
  - @bamboocss/config@1.36.4
  - @bamboocss/core@1.36.4
  - @bamboocss/extractor@1.36.4
  - @bamboocss/logger@1.36.4
  - @bamboocss/node@1.36.4
  - @bamboocss/shared@1.36.4
  - @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- 0d67416: Normalize thrown values in the virtual stylesheet's `load`, not only in `transform`.

  1.36.2 wrapped non-`Error` throws from the module transform, but a request for the stylesheet reaches `load` instead,
  which awaited generation unguarded. Anything under it that threw a primitive — a dependency, a config hook — still
  reached Vite's dev error middleware, which puts what it is handed into a `WeakSet` to deduplicate it and throws
  `TypeError: Invalid value used in weak set` on anything that is not an object. The real failure was replaced by a
  stack trace about weak sets, and the request that revealed it was a stylesheet fetch rather than a module load.

  Both hooks now share one `asError` helper, so they cannot drift again, and the original value is kept as `cause`. A
  test pins the invariant directly: every shape a hook may throw is normalized into something `WeakSet.add` accepts.
  - @bamboocss/config@1.36.3
  - @bamboocss/core@1.36.3
  - @bamboocss/extractor@1.36.3
  - @bamboocss/logger@1.36.3
  - @bamboocss/node@1.36.3
  - @bamboocss/shared@1.36.3
  - @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- 41d67a1: Stop a compile failure in dev from being replaced by an error about weak sets.

  The transform rethrew what it caught, and `catch` binds `unknown` — anything under the fold, including a dependency or
  a config hook, may throw a primitive rather than an `Error`. Vite's dev error middleware puts what it is handed into a
  `WeakSet` to deduplicate it, which throws `TypeError: Invalid value used in weak set` for anything that is not an
  object. The real failure was then lost behind a stack trace about weak sets, in the one mode where the terminal is the
  only place it would have been seen.

  Non-`Error` throws are now wrapped, keeping the original message in the text and the original value as `cause`. Build
  mode was never affected: it returns rather than rethrowing, which is why this only appeared locally.
  - @bamboocss/config@1.36.2
  - @bamboocss/core@1.36.2
  - @bamboocss/extractor@1.36.2
  - @bamboocss/logger@1.36.2
  - @bamboocss/node@1.36.2
  - @bamboocss/shared@1.36.2
  - @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- fba77e0: Stop reachability pruning from deleting the rules behind multi-declaration conditional styles.

  A folded call reports one entry per call site, and a call producing several atoms reports them **space-joined**.
  `markClassUsed` escaped that whole string as a single key, so it matched no class, every atom in it stayed unmarked,
  and reachability pruning removed their rules. The class names still reached the JS and the markup, the stylesheet was
  still emitted and still carried its marker, and the build exited 0 — the elements simply rendered unstyled. It was
  found by grepping a shipped bundle.

  The damage followed declaration count rather than condition type, which is what made it look categorical:
  - `content` almost always travels with another property, so **every** `::before` and `::after` rule disappeared from
    one application's stylesheet.
  - A single-declaration `_hover`, `md:` or `[data-…]` is one atom and survived; the multi-declaration ones did not.
  - An atom that PostCSS had merged into a multi-class selector escaped the prune by accident, because a rule carrying
    more than one class is skipped — which left some rules standing and others gone under the same condition.

  `allocateClassString`, in the same object, already split on spaces. `markClassUsed` now does too.

  Two things now make this class of bug loud rather than silent:
  - **The pruned sheet is verified against what the compiler emitted.** Any compiled class left without a rule fails the
    build and names the classes. It also rejects a malformed reachability key outright — a class name cannot contain
    whitespace, and an entry that does stands for atoms that are about to be pruned. That second check exists because
    the first one alone did not catch this bug: the malformed key matched nothing in the prunable set and was skipped.
  - **Conditional atoms are covered by a real Vite build.** The existing assertions matched `` `.${token} {` ``, which
    only ever matches a flat rule, so no conditional atom was checked by anything. The new test asserts both directions:
    every condition has a rule, and every class emitted into the JS has a selector.
  - @bamboocss/config@1.36.1
  - @bamboocss/core@1.36.1
  - @bamboocss/extractor@1.36.1
  - @bamboocss/logger@1.36.1
  - @bamboocss/node@1.36.1
  - @bamboocss/shared@1.36.1
  - @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- 8a64ed1: Stop the compiler issuing TypeScript language-service queries, which bound the whole project into the
  bundler's heap.

  The survivor scan resolved a recipe binding's references with `findReferencesAsNodes()`. That is a language-service
  query, and the first one forces `synchronizeHostData` -> `createProgram`, which resolves, parses and binds the entire
  transitive `.d.ts` closure of the project. `createTsProject` sets `skipAddingFilesFromTsConfig`,
  `skipFileDependencyResolution` and `skipLoadingLibFiles` precisely to avoid that cost, and none of them govern
  `createProgram` — so one query undid all three.

  On a 2,278-file application that meant **24,081 `SourceFileObject` instances and 4.4 GB of AST and symbols, 80% of the
  heap**, and the build OOMed at a 6 GB cap. The largest retained strings were `googleapis`, `typescript` and
  `@vue/compiler-sfc`, none of which can contain a reference to a recipe binding. The note on `resolveDeclaration` in
  `@bamboocss/extractor` had already documented this exact failure and predicted its shape: "a slow build and then an
  OOM".

  A recipe binding is module-scoped or imported, so every read of it is in one file. The scan is now a syntactic walk of
  that file. Measured against project size, the scan cost went from 4ms over 200 files and 24ms over 3,200 — linear in
  project size, paid once per module, so quadratic overall — to **0ms at every size**.

  Two behavioural consequences, both improvements:
  - **An inline recipe consumed from another module compiles.** The declaring module used to search the whole project
    and report any reference it found outside its own rewritten ranges, so an exported recipe failed even when every
    consumer compiled cleanly. Each module now answers only about its own text: a consumer that reads the binding
    unsafely — `export const alias = badge`, `badge.raw(...)` — reports itself, and one whose calls all compiled reports
    nothing.
  - **Diagnostics always index the file they name.** Offsets from another module used to be reported against the module
    being folded, yielding a line past its end.

  `no-language-service.test.ts` asserts the invariant directly, so any future `getDefinitions`, `getType` or
  `findReferences` in the compile path fails there rather than in a customer's heap.

  `@bamboocss/parser` gains `ParserResult.importedRecipes`: the inline recipe bindings a module imported, whether or not
  it calls one. A module that only reads an imported recipe produces no call, so nothing downstream could previously
  tell that the binding was a recipe at all.
  - @bamboocss/node@1.36.0
  - @bamboocss/config@1.36.0
  - @bamboocss/core@1.36.0
  - @bamboocss/extractor@1.36.0
  - @bamboocss/logger@1.36.0
  - @bamboocss/shared@1.36.0
  - @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- e0ec396: Resolve a recipe binding's references once per module instead of once per declined call.

  `reportRuntimeBindings` called `findReferencesAsNodes()` inside a `some` over every call the module had already
  declined, and again afterwards for the survivor. The result cannot change between those calls, so the answer is now
  computed once and reused.

  This is strictly less work, but measuring it showed it is **not** where the time in a large build goes: ts-morph
  caches within a program generation, so the cost is the first search per module rather than the repeats. The real cost
  is that the search is project-wide at all — the transform adds each module to the ts-morph project, which invalidates
  the TypeScript program, so the next search re-binds everything. Isolated against project size, the scan costs 4ms over
  200 files and 24ms over 3,200 while the rest of the fold stays near zero, and it is paid once per module that declares
  a recipe. That is quadratic in project size and is still present.

  The fix for it is to avoid the project-wide search for a binding that is not exported, whose references can only be in
  its own module — 98% of recipes in the codebase this was measured against. That is not in this release.
  - @bamboocss/config@1.35.5
  - @bamboocss/core@1.35.5
  - @bamboocss/extractor@1.35.5
  - @bamboocss/logger@1.35.5
  - @bamboocss/node@1.35.5
  - @bamboocss/shared@1.35.5
  - @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- 8f7721d: Stop scanning every emitted asset for the stylesheet marker.

  Both the prune pass and the lost-stylesheet guard added in 1.35.3 decoded **every** asset in the bundle to a UTF-8
  string in order to search it — fonts, images, wasm and sourcemaps included — so the cost scaled with total asset bytes
  rather than with CSS, and the guard paid it a second time. On a project with a large asset graph that is seconds of
  decode and a lot of garbage per build.

  The filename is now checked first. The marker is a CSS custom property, so it cannot occur in anything but CSS, and
  nothing about which assets are inspected changes.
  - @bamboocss/config@1.35.4
  - @bamboocss/core@1.35.4
  - @bamboocss/extractor@1.35.4
  - @bamboocss/logger@1.35.4
  - @bamboocss/node@1.35.4
  - @bamboocss/shared@1.35.4
  - @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- 4902f2b: Stop losing the stylesheet under Rolldown, and compile recipes in files that import the generated helpers by
  subpath.
  - **A Rolldown build shipped no stylesheet and exited 0.** The late asset rename replaces an entry in `bundle`, which
    Rolldown does not support — it logs that the assignment is ignored and drops the asset, so `dist/` contained no
    generated CSS at all and the app rendered unstyled. The rename is now skipped when Rolldown is detected, keeping the
    pruned bytes under Vite's own content hash.
  - **A lost stylesheet is now a hard error rather than a green build.** If modules were compiled to Bamboo class values
    and no emitted asset carries the generated sheet, `generateBundle` fails — the same spirit as the existing
    unimported-`virtual:bamboo.css` check. Any other plugin that drops or replaces the CSS asset is caught by it too.
  - **`renameCssAsset: false`** opts out of the rename explicitly, for a framework that relocates assets itself and
    loses track of the new name — react-router's SSR build among them.
  - **Importing the generated helpers by subpath no longer fails every runtime recipe selection.**
    `import { cva } from 'styled-system/css/cva.js'` gave the compiler no import declaration to attach `cvaMap` to,
    since that module does not export it, so the calls declined under a reason that said nothing about imports. The
    helper is now imported from the sibling module that does export it, preserving the caller's spelling and extension.
  - **`runtime-binding` explains itself.** The message now says the value was read outside a compiled call, that an
    inline recipe imported by another module is the usual cause, that the fix is a config recipe, and that the location
    given is the reference rather than the declaration. Every diagnostic also points at `BAMBOO_DIAGNOSTIC_LIMIT=all`.
  - **Documented that an inline recipe cannot be shared across modules**, as its own section on the recipes page rather
    than a row reading "can be shared in a preset".
  - @bamboocss/config@1.35.3
  - @bamboocss/core@1.35.3
  - @bamboocss/extractor@1.35.3
  - @bamboocss/logger@1.35.3
  - @bamboocss/node@1.35.3
  - @bamboocss/shared@1.35.3
  - @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- eb3025a: Report a surviving recipe reference where it actually is, and make diagnostic truncation raisable.
  - **`runtime-binding` pointed at the wrong file and an impossible line.** The surviving reference is found through the
    project-wide symbol graph, so it is usually in a module other than the one being folded. Its offsets index that file
    and were reported against the folded one, which produced a line number derived from text that does not contain it —
    `app/styles.ts:841` on a file with fewer lines than that. The reference's own file and line are now carried and
    reported, so the message names the call site that has to change rather than the declaration.
  - **`BAMBOO_DIAGNOSTIC_LIMIT` raises the findings cap**, or set it to `all` for every one. A capped list is right for
    reading one failure and wrong for scoping a migration: "… and 13 more files" left no way to drive the list to zero
    except by fixing what was shown and rebuilding to reveal the next batch. It overrides a caller's explicit limit too,
    and a malformed value falls back to the default rather than replacing the diagnostic with a complaint about the
    variable.
  - **The unimported-stylesheet error now says the import has to be JavaScript.** `@import 'virtual:bamboo.css'` from a
    stylesheet fails as an unresolvable path, because Vite resolves CSS `@import` before plugin resolution. The previous
    wording sent people to try it.
  - **Documented what actually decides whether an inline recipe compiles**: every reference to the binding has to be a
    compiled call. Neither the declaring module nor a runtime variant selection is what fails — reading the binding
    itself is, since the declaration is erased.

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/config@1.35.2
  - @bamboocss/core@1.35.2
  - @bamboocss/extractor@1.35.2
  - @bamboocss/node@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

- d787e82: Stop the late CSS asset rename from crashing on a bundle entry without `referencedFiles`.

  `optimizeStaticCssAssets` walks a bundle Vite hands the plugin, and rewrote `referencedFiles` on every chunk in it.
  Rollup's type declares that field as required, so this typechecked, but the peer range is `vite: ">=5"` — which covers
  a Rollup-compatible bundler — and any plugin can add a chunk-shaped entry to the bundle before the hook runs. Either
  one produced `TypeError: Cannot read properties of undefined (reading 'map')` at the end of a production build.
  - The list mirrors references the chunk's own code already carries, and those are rewritten separately, so an absent
    list means there is nothing further to update.
  - Covered by unit tests that drive the function over hand-built bundles, including shapes Rollup does not produce. The
    end-to-end rename was previously only exercised against real Rollup, which cannot express this case.

  Nothing else changes: the asset is still renamed to a hash of its pruned bytes, which is what keeps late reachability
  pruning safe to cache.
  - @bamboocss/config@1.35.1
  - @bamboocss/core@1.35.1
  - @bamboocss/extractor@1.35.1
  - @bamboocss/logger@1.35.1
  - @bamboocss/node@1.35.1
  - @bamboocss/shared@1.35.1
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
  - @bamboocss/node@1.35.0
  - @bamboocss/types@1.35.0
  - @bamboocss/config@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/extractor@1.35.0
  - @bamboocss/shared@1.35.0

## 1.34.1

### Patch Changes

- Updated dependencies [e2ec2ae]
  - @bamboocss/core@1.34.1
  - @bamboocss/node@1.34.1
  - @bamboocss/config@1.34.1
  - @bamboocss/extractor@1.34.1
  - @bamboocss/logger@1.34.1
  - @bamboocss/shared@1.34.1
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

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [09d4203]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/shared@1.34.0
  - @bamboocss/node@1.34.0
  - @bamboocss/types@1.34.0
  - @bamboocss/core@1.34.0
  - @bamboocss/config@1.34.0
  - @bamboocss/extractor@1.34.0
  - @bamboocss/logger@1.34.0

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
- Updated dependencies [61561a0]
- Updated dependencies [ac54258]
- Updated dependencies [f640a68]
  - @bamboocss/types@1.33.0
  - @bamboocss/core@1.33.0
  - @bamboocss/config@1.33.0
  - @bamboocss/node@1.33.0
  - @bamboocss/logger@1.33.0
  - @bamboocss/extractor@1.33.0
  - @bamboocss/shared@1.33.0

## 1.32.0

### Minor Changes

- c29044f: Fail the build when a file cannot be extracted, instead of logging it and exiting 0.

  ```
  error during build:
  [bamboocss:css] Could not load virtual:bamboo.css: 1 file(s) could not be extracted:

  src/Timeline.tsx
    `{colors.brand.purple/35}` in the value `0 0 0 2px {colors.brand.purple/35}` is the retired
    token reference syntax. Write `token(colors.brand.purple/35)` instead.

  Nothing emits a rule for a file the build could not read, so every style in these is absent from
  the stylesheet and the classes their components ask for have nothing behind them.
  ```

  Extraction caught, logged, and carried on. The file's styles never reach the encoder, so every rule it would have
  contributed is simply gone — one retired token spelling in one component dropped that component's css and left a green
  build behind it. Three error-level lines, exit 0, and `built` printed at the end.

  **The two integrations disagreed about the same source.** `bamboo cssgen` exited 1 on a file it could not extract,
  because it went through the one entry point that let the throw out; every bundler build went through the one that
  caught it. CI running a build passed what CI running `cssgen` rejected. Both now go through the same path, so the
  question is settled once rather than per integration.

  Every broken file is named in one error rather than the first one aborting the pass, and a failure is keyed by file so
  it survives the incremental passes that skip an unchanged one — otherwise a rebuild of identical, still-broken source
  came back green. It is dropped once the file parses, is deleted, or leaves `include`, since a context outlives
  rebuilds and all three of those are fixes. A watch rebuild still reports and keeps watching; only a build fails.

  **`failOnUnfolded` counts a module the fold threw on.** A throw in the vite transform was caught and the module
  returned unchanged, which is safe — its runtime call still works — but it landed in neither the folded column nor the
  declined one. The coverage summary reported 100% over the files that did not throw, and the survivor check saw a file
  that was never there, so the option's whole guarantee held vacuously over it. It now reports as `fold-failed`. Unknown
  counts as survives: the claim is that _nothing_ still calls `css()`, and a module nobody could look at cannot support
  it. Without `failOnUnfolded` it stays a logged error and a declined module, as before.

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

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
- Updated dependencies [591a0f1]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [b2b4173]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/node@1.32.0
  - @bamboocss/shared@1.32.0
  - @bamboocss/config@1.32.0
  - @bamboocss/types@1.32.0
  - @bamboocss/core@1.32.0
  - @bamboocss/extractor@1.32.0
  - @bamboocss/logger@1.32.0

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

### Patch Changes

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [232a83a]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [9c32b00]
- Updated dependencies [9fdce28]
- Updated dependencies [dd9d6dc]
- Updated dependencies [678bdee]
- Updated dependencies [a72eb09]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/config@1.31.0
  - @bamboocss/core@1.31.0
  - @bamboocss/node@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0
  - @bamboocss/extractor@1.31.0

## 1.30.1

### Patch Changes

- Updated dependencies [2634909]
  - @bamboocss/node@1.30.1
  - @bamboocss/config@1.30.1
  - @bamboocss/core@1.30.1
  - @bamboocss/extractor@1.30.1
  - @bamboocss/logger@1.30.1
  - @bamboocss/shared@1.30.1
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
- Updated dependencies [009294f]
- Updated dependencies [242b24c]
  - @bamboocss/core@1.30.0
  - @bamboocss/extractor@1.30.0
  - @bamboocss/types@1.30.0
  - @bamboocss/node@1.30.0
  - @bamboocss/shared@1.30.0
  - @bamboocss/config@1.30.0
  - @bamboocss/logger@1.30.0

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

- Updated dependencies [5e6eafe]
- Updated dependencies [a137758]
- Updated dependencies [0dbe9c4]
- Updated dependencies [f2c61d7]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/node@1.29.0
  - @bamboocss/types@1.29.0
  - @bamboocss/extractor@1.29.0
  - @bamboocss/core@1.29.0
  - @bamboocss/config@1.29.0
  - @bamboocss/logger@1.29.0
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
  - @bamboocss/core@1.28.1
  - @bamboocss/config@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/node@1.28.1
  - @bamboocss/extractor@1.28.1
  - @bamboocss/shared@1.28.1

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

- 8a69586: Make `strict` answer the question it claims to.

  `strict` failed a build on entries in the skip ledger, and the ledger holds only calls something recognised — so the
  guarantee was worth exactly what the recogniser was, and said nothing about the rest. A shape nothing looked at
  appeared in neither the folded nor the skipped column, and the build passed while the module still imported the
  engine. That is how a project shipped ~380 runtime recipe calls under a clean `strict` run.

  Under `strict` the fold now also reports bindings the rewrite left behind: a value imported from a bamboo module that
  is still referenced once every replacement is applied, whatever the ledger says. It catches a binding passed on rather
  than called, one handed to a function the build cannot follow, and a module whose only bamboo usage produced no parser
  result at all — each of which used to be skipped before the fold saw it.

  It also covers `export { css } from 'styled-system/css'`, which keeps the engine without importing it — the shape a
  wrapper module takes.

  Reported as `runtime-binding`, and only where the ledger already fails on that binding: a call declined as `dynamic`
  needs no second complaint, while one declined as `not-imported` or `not-foldable` passes the build and so must not
  suppress anything. The helpers the fold itself writes (`cx`, `cvaPick`, `splitProps`, the leaf helper) are excluded,
  since they live in `cx` and pull no engine — as are `cva` and `sva`, whose definitions keep the recipe runtime rather
  than the css engine and which `strict` has always accepted.

  Only genuine value references count. A name is also an intrinsic JSX tag, an object key, a property, a method and a
  declaration, and `button`, `input`, `label`, `select`, `table`, `dialog` and `form` are all ordinary recipe names — so
  counting every identifier failed builds on modules that had folded completely, because of their markup. Type positions
  are excluded too: they are erased, and the import with them.

  A partial fold is covered too, and it needed saying separately: it writes its runtime half into the output through
  magic-string rather than into the module's AST, so the walk cannot see it — and the call produced no skip entry in the
  first place, because it _did_ fold. Splitting `css({ color: 'red.300', _hover: { color: tone } })` still leaves
  `css({ _hover: … })` in the bundle. The plan now reports that half. A split that leaves no call behind reports
  nothing.

  What is still not reported is a reference _inside_ a rewritten call — a partial fold copies its dynamic half and its
  ternary conditions across verbatim, so a bamboo binding mentioned there survives unreported. That is deliberate rather
  than pending: the check ignores everything inside a range it rewrote, and narrowing that to the text actually removed
  would report bindings the fold had resolved away, such as a `token(...)` folded into the static half. A false failure
  on a module that folded correctly is worse than a missed one, for a gate with no per-call override.

  Expect builds that used to pass to fail, in three shapes: a partial fold with a dynamic remainder (above); a module
  keeping any other value from the css module, such as `fallback(...)` inside a `cva` config or `recipe.variantKeys`;
  and a wrapper module re-exporting the css API. Each genuinely retains the engine — `strict` was wrong before, not now
  — but each is a green build turning red on upgrade. `strict` is off by default and this changes nothing for builds
  without it.

  Off unless `strict` is on. The walk measured ~5x on the per-module fold of a 400-line module that imports bamboo; a
  module that imports none of it costs nothing, since the check returns before walking. Default builds are unaffected.

### Patch Changes

- 750fff0: Fold partially-static calls in files that import the css module with an explicit extension.

  `outExtension: 'js'` under NodeNext resolution makes a file write `styled-system/css/index.js`, which the fold's
  module check compared against a bare `styled-system/css` by equality or tail — matching neither. Extraction was
  unaffected, since `ImportMap.match` is substring-based, so the call folded while the `cx` insert was refused and the
  result was reported as `dynamic`. A project spelling the import that way lost partial folding in every file at once,
  with nothing in the diagnostics to distinguish it from a genuinely dynamic call.

  The specifier is now reduced to the module it names before comparison, stripping a module extension and a trailing
  `/index`. The equality the check is built on is unchanged: a sibling module such as `styled-system/css/css` still
  matches nothing, so `cx` is still never added to a module that may not export it.

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/node@1.28.0
  - @bamboocss/config@1.28.0
  - @bamboocss/core@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/extractor@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Minor Changes

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

### Patch Changes

- 8f0cabc: Stop lowering config recipe calls whose selection is decided at runtime — it dropped responsive variants.

  `1.26.0` extended the wrapper lowering from inline `cva` recipes to `defineRecipe` ones. That was unsound, and the
  failure was silent:

  ```tsx
  button({ visual: { base: 'solid', md: 'outline' } })

  // runtime : "button button--visual_solid md:button--visual_outline"
  // folded  : "button"
  ```

  Both classes were lost, so a responsive variant rendered unstyled in a production build while working in dev.

  **Why it cannot be patched.** The two recipe kinds resolve a selection differently. `cva` reads a variant value as a
  key through `getRecipeClassNames`, so a conditional value finds no entry and names no class — which is exactly what
  the `cvaPick` helper does, and why lowering an inline recipe is sound. A config recipe routes its selection through
  `createCss`, which _expands_ a conditional into one class per condition. For a dynamic axis the build cannot know
  which kind of value will arrive, so a table lookup is wrong whenever the caller passes a conditional — and responsive
  variants are a documented, type-permitted feature of config recipes.

  Unaffected: statically resolvable config recipe calls still fold, `buttonStyle()` with no arguments still folds, and
  inline `cva` recipes — including the wrapper shape — still lower, because `cva` cannot take a conditional in the first
  place.

  The parity suite now evaluates the lowered expression against the recipe the codegen emitted for conditional and
  responsive values, not scalars alone, which is what would have caught this.
  - @bamboocss/node@1.27.0
  - @bamboocss/config@1.27.0
  - @bamboocss/core@1.27.0
  - @bamboocss/extractor@1.27.0
  - @bamboocss/logger@1.27.0
  - @bamboocss/shared@1.27.0
  - @bamboocss/types@1.27.0

## 1.26.0

### Minor Changes

- b3aecf7: Lower config recipe calls in wrapper components, not just inline ones.

  The previous release lowered `input(variantProps)` for recipes bound with `cva`. A recipe declared with `defineRecipe`
  and reached through the generated `recipes/` barrel did not lower, because the candidate map was built from the
  module's own `cva` definitions. That left the most common way to ship a design system — a vendored preset, wrapped by
  components — as the one shape that could not fold:

  ```tsx
  export const Input = ({ className, ...props }: InputProps) => {
    const [variantProps, rest] = input.splitVariantProps(props)
    return <ark.input className={cx(input(variantProps), className)} {...rest} />
  }
  ```

  Both halves now lower for config recipes exactly as they do for inline ones — the call to one `cvaPick` term per
  declared variant, and `splitVariantProps` to the `splitProps` it already called.

  **Restricted to a selection that provably holds declared variants only**, which in practice means the output of
  `<recipe>.splitVariantProps(...)` for that same recipe. This is not conservatism for its own sake: the generated
  `createRecipe` names a class for **any** prop it is handed —

  ```js
  return { className: `${name}--${prop}_${value}` } // no check that the variant is declared
  ```

  — where `cva` skips a value the config does not declare. The two runtimes therefore disagree about an undeclared key,
  and a lowering derived from the config cannot produce a class for a key it cannot enumerate. `splitVariantProps`
  filters to `Object.keys(variants)`, so its output cannot contain one. An arbitrary object, or a selection split from a
  _different_ recipe, still declines.

  A parity suite compares the lowered expression against the recipe the codegen actually emitted — `createRecipe`, not
  `cva` — across defaults, multi-axis selections and compound variants. Slot recipes still decline: they resolve to one
  class per slot rather than to a string.

### Patch Changes

- Updated dependencies [5e8814c]
  - @bamboocss/node@1.26.0
  - @bamboocss/config@1.26.0
  - @bamboocss/core@1.26.0
  - @bamboocss/extractor@1.26.0
  - @bamboocss/logger@1.26.0
  - @bamboocss/shared@1.26.0
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

- @bamboocss/node@1.25.0
- @bamboocss/config@1.25.0
- @bamboocss/core@1.25.0
- @bamboocss/extractor@1.25.0
- @bamboocss/logger@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Minor Changes

- 10f811d: Lower inline recipe calls whose selection could run something, instead of declining them.

  `badge({ tone: getTone() })` used to keep the whole recipe. The reasoning was sound for folding to a literal — that
  deletes the argument, so `getTone()` would never run — but it was applied to the wrong path. Lowering does not delete
  the expression; it re-emits it as the helper's argument:

  ```ts
  const cls =
    'cva_1a2b3c' +
    cvaPick(getTone(), {
      info: ' cva_1a2b3c--tone_info',
      warn: ' cva_1a2b3c--tone_warn',
    })
  ```

  `getTone()` runs exactly once, where it did before. The call is preserved **and** the recipe config still leaves the
  bundle.

  Inertness is now decided per property rather than for the whole argument. A property whose expression could run
  something always takes the runtime path — never resolved to a literal, even when the build _can_ resolve it, and never
  dropped for naming no variant, since either would delete the call.

  Cases that still decline, so that nothing an expression would have run is lost:
  - More than one property could run something, and their relative order would change. `badge({ size: a(), tone: b() })`
    where the config declares `tone` first would evaluate `b()` before `a()`.
  - A property that could run something names no variant the config declares — there is no term to re-emit it into.
    Checked as an own key, so `badge({ __proto__: pick() })` and `badge({ toString: pick() })` decline rather than
    appearing to name a real variant and then being dropped.
  - The same key written twice. The value is last-wins, but an earlier expression still runs, so emitting only the
    winner would delete it. A type error in TypeScript, reachable in the `.js` and `.jsx` this transform also handles.

  Separately, the fold's copy of the runtime's variant-skip condition now makes the same own-key check, so
  `badge({ tone: 'toString' })` emits no class rather than one the runtime never produces and no rule backs.

  Measured across an application with 1,752 inline recipe invocations, against the previous release:

  |                          | before        | after             |
  | ------------------------ | ------------- | ----------------- |
  | invocations lowered      | 82.2%         | **99.7%**         |
  | bindings lowered in full | 1,024 / 1,271 | **1,266 / 1,271** |
  | recipe config freed      | 62.0 kB gzip  | **76.9 kB gzip**  |

  Of the 307 call sites the old rule blocked, 297 have a single effect-bearing property and the remaining 10 already
  agree with the config's order — so none are lost to the ordering rule.

### Patch Changes

- @bamboocss/config@1.24.0
- @bamboocss/core@1.24.0
- @bamboocss/extractor@1.24.0
- @bamboocss/logger@1.24.0
- @bamboocss/node@1.24.0
- @bamboocss/shared@1.24.0
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

### Patch Changes

- Updated dependencies [f4a2824]
- Updated dependencies [b041398]
- Updated dependencies [087b884]
  - @bamboocss/core@1.23.0
  - @bamboocss/types@1.23.0
  - @bamboocss/shared@1.23.0
  - @bamboocss/node@1.23.0
  - @bamboocss/config@1.23.0
  - @bamboocss/logger@1.23.0
  - @bamboocss/extractor@1.23.0

## 1.22.0

### Minor Changes

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

- 0e6a4ee: `@bamboocss/vite` now emits the stylesheet itself, so a Vite project needs no PostCSS setup.

  Import the virtual module wherever you used to import the file carrying the `@layer` statement:

  ```ts
  // vite.config.ts
  import bamboocss from '@bamboocss/vite'

  export default defineConfig({
    plugins: [bamboocss(), react()],
  })
  ```

  ```ts
  // src/main.tsx
  import 'virtual:bamboo.css'
  ```

  ```ts
  // src/vite-env.d.ts
  /// <reference types="@bamboocss/vite/client" />
  ```

  `bamboocss()` now returns **two** plugins rather than one: the CSS emitter, which runs in dev and build alike, and the
  build-only fold. If you were reaching into the returned object — `bamboocss().transform`, say — it is now an array.

  **Why a virtual module rather than a written file**

  Vite already owns both things a file would have to reimplement. In dev it injects CSS over the websocket and replaces
  it in place, so a style edit repaints without reloading and without losing component state. In build it hashes the
  content into the asset graph and decides where it lands. Writing `styles.css` and asking the project to import it
  means the build reads a file the same process just wrote, which is a race on every watch rebuild.

  The stylesheet carries its own `@layer reset, base, tokens, recipes, utilities;` statement, which the PostCSS path
  takes from the file it injects into. That statement is what fixes layer _order_ — without it, layers are ordered by
  first appearance.

  **PostCSS still works.** This is an addition, not a replacement; nothing about the existing setup changes. Use one or
  the other, though — configuring both puts two copies of the sheet in the bundle.

  Also adds `Builder.toCss()` for anything that wants the finished stylesheet as a string rather than injected into a
  PostCSS root.

- 2b896a2: Add `strict` to `@bamboocss/vite`: fail the build when a `css()` call is left for the runtime.

  ```ts
  plugins: [bamboocss({ strict: true })]
  ```

  The fold's payoff was never the per-call CPU it saves. It is that a bundle where _every_ `css()` call folded stops
  importing `styled-system/css`, and the engine behind it drops out — on the `vite-ts` example that is 1.3 kB gzipped of
  `css.mjs`, plus whatever of `helpers` goes with it. One survivor keeps all of it, so 99% folded and 0% folded cost the
  same, and a coverage percentage cannot tell you which you have. This can.

  The error names every survivor with its file, line and reason:

  ```
  bamboocss: 2 call(s) could not be folded, and `strict` is on.

    /app/src/Card.tsx
      14: css() — dynamic
      31: cssLeaf — lowered-leaf
  ```

  **`cssLeaf` counts, and it is the one that matters.** `css({ color: tone })` _folds_ — to
  `cssLeaf("c_", "color", tone)` — so it reports no skip at all. But `cssLeaf` falls back to `css({ [prop]: value })`
  for a value that is not a scalar, which the build cannot rule out, so the module still imports the engine. Without
  counting it, `strict` would pass on the most common dynamic shape while the thing it exists to guarantee quietly
  failed.

  **`cva`/`sva` do not count.** A `cva(...)` definition returns a function and can never collapse to a class string, so
  failing on it would make the option unusable for anyone writing recipes. Recipes keep their own runtime, which is a
  different and much smaller module than the css engine.

  Worth knowing before turning it on: a component that takes a style-bearing prop will trip it, because that is exactly
  the shape `cssLeaf` exists for. Reaching zero is realistic for an app whose variation lives in `cva` variants, and
  hard for a library whose components accept arbitrary values.

### Patch Changes

- Updated dependencies [39c699f]
- Updated dependencies [edb97e2]
- Updated dependencies [fe62614]
- Updated dependencies [1036258]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
- Updated dependencies [43ae8a7]
- Updated dependencies [0e6a4ee]
  - @bamboocss/core@1.22.0
  - @bamboocss/node@1.22.0
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/config@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/extractor@1.22.0

## 1.21.0

### Minor Changes

- 766aa64: Turn the build-time fold on by default.

  `transform` now defaults to `true`. Statically-resolvable `css()` and pattern calls are rewritten into literal class
  strings, so they cost nothing at runtime. Set `transform: false` to restore the previous behaviour.

  ```js
  bamboocss({ transform: false })
  ```

  Still build-only — the plugin declares `apply: 'build'` and never runs in `vite dev`, where the re-parse would land on
  every hot update and a dev bundle gains nothing from pre-resolved calls.

  **What the trade actually is**

  This buys per-call CPU, not bytes, and it is worth being explicit that bundle size moves slightly the wrong way:
  measured on `sandbox/runtime-perf`, **-0.8% raw and +1.0% gzipped**. Class literals are all distinct where the
  repeated `css({ … })` calls they replace compressed almost to nothing. The runtime still ships either way — dropping
  it would need every call site in the module graph to fold, which does not happen in an app with dynamic components.

  Builds get slower by the cost of re-parsing each module with `ts-morph`: roughly 0.3ms for a small component and 3ms
  for a 147-line file with 24 call sites, so somewhere under a second and a half for a 500-module app.

  Turning it off costs nothing: with `transform: false` the plugin resolves no config and rewrites nothing, which is
  covered by its own test rather than assumed.

  **Correctness**

  The folded string is computed through the same runtime `css` your app would have called, rebuilt in-process from your
  resolved config, so the substitution is behaviour-preserving by construction rather than by a reimplementation that
  could drift. `pnpm test:browser` builds the sandbox twice — folded and unfolded — and compares what Chromium computed,
  which is the only check that shows a folded class actually resolves.

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/config@1.21.0
  - @bamboocss/core@1.21.0
  - @bamboocss/extractor@1.21.0
  - @bamboocss/node@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/node@1.20.4
- @bamboocss/config@1.20.4
- @bamboocss/core@1.20.4
- @bamboocss/extractor@1.20.4
- @bamboocss/logger@1.20.4
- @bamboocss/shared@1.20.4
- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- Updated dependencies [fa63a80]
  - @bamboocss/core@1.20.3
  - @bamboocss/node@1.20.3
  - @bamboocss/config@1.20.3
  - @bamboocss/extractor@1.20.3
  - @bamboocss/logger@1.20.3
  - @bamboocss/shared@1.20.3
  - @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- Updated dependencies [8a73d2a]
  - @bamboocss/node@1.20.2
  - @bamboocss/config@1.20.2
  - @bamboocss/core@1.20.2
  - @bamboocss/extractor@1.20.2
  - @bamboocss/logger@1.20.2
  - @bamboocss/shared@1.20.2
  - @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- Updated dependencies [559924f]
  - @bamboocss/node@1.20.1
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
  - @bamboocss/node@1.20.0
  - @bamboocss/types@1.20.0
  - @bamboocss/shared@1.20.0
  - @bamboocss/extractor@1.20.0
  - @bamboocss/config@1.20.0
  - @bamboocss/logger@1.20.0

## 1.19.0

### Patch Changes

- Updated dependencies [510cdd3]
  - @bamboocss/core@1.19.0
  - @bamboocss/node@1.19.0
  - @bamboocss/config@1.19.0
  - @bamboocss/extractor@1.19.0
  - @bamboocss/logger@1.19.0
  - @bamboocss/shared@1.19.0
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
  - @bamboocss/node@1.18.0
  - @bamboocss/config@1.18.0
  - @bamboocss/extractor@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0

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
