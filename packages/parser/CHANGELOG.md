# @bamboocss/parser

## 1.45.5

### Patch Changes

- Updated dependencies [ba5a94a]
  - @bamboocss/core@1.45.5
  - @bamboocss/config@1.45.5
  - @bamboocss/extractor@1.45.5
  - @bamboocss/logger@1.45.5
  - @bamboocss/shared@1.45.5
  - @bamboocss/types@1.45.5

## 1.45.4

### Patch Changes

- @bamboocss/config@1.45.4
- @bamboocss/core@1.45.4
- @bamboocss/extractor@1.45.4
- @bamboocss/logger@1.45.4
- @bamboocss/shared@1.45.4
- @bamboocss/types@1.45.4

## 1.45.3

### Patch Changes

- @bamboocss/config@1.45.3
- @bamboocss/core@1.45.3
- @bamboocss/extractor@1.45.3
- @bamboocss/logger@1.45.3
- @bamboocss/shared@1.45.3
- @bamboocss/types@1.45.3

## 1.45.2

### Patch Changes

- 00e7af9: Drop a file's old rules when it is read again, instead of keeping every version it ever had.

  `StyleEncoder` only ever added. It is built once with the context, a context outlives rebuilds, and nothing on it
  could remove a hash — so a long-lived process accumulated: each save of an edited file put its new atoms in and left
  the previous version's behind, for the life of the dev server. The orphans were valid CSS and internally consistent,
  which is why nothing caught them; one session ended with 22 classes no element could ever carry.

  Every parse is now attributed to an owner, and reading the same file again replaces what its last reading encoded
  rather than adding to it. Ownership is refcounted per hash, so a declaration two files share survives one of them
  dropping it; asking the question any other way would mean scanning the project on every keystroke, which is the cost
  the mechanism exists to avoid. The retain of the new reading runs before the release of the old one, so a declaration
  a file keeps across its own edit goes 1 -> 2 -> 1 and never passes through the zero that would delete it. All five
  collections are covered — atomic styles, recipe variants, recipe bases, compound variants and view transitions — as
  are the utility atoms a static build interns for a recipe, which an inline `cva` renames on every edit of its styles.

  Two things are deliberately never released. Anything encoded outside a file — a `staticCss` safelist, a restored
  encoder dump — answers to config rather than to source, so no file may take it away. And the extraction pass and a
  bundler transform hold their readings of the same module separately, because the two can legitimately see different
  source and neither should be able to narrow the other.

  Deletion is covered only where the encoder that emits the stylesheet is the one told about the delete.
  `Project.removeSourceFile` now releases the file, which reaches `bamboo --watch` and the PostCSS-driven watch — both
  call it on the context they go on to build from. The Vite dev server does not: its two plugins hold a `BambooContext`
  each, and `watchChange` releases on the compiler's while the stylesheet comes from the CSS plugin's. A file deleted
  under `vite dev` keeps its rules until the process restarts, exactly as before. That split predates this change and is
  left alone here.

  `bamboo --watch` is improved rather than finished, for a related reason. Its first pass reads every file through
  `parseFiles` and each rebuild re-reads only the changed ones through `parseSourceFile` — different entry points, so
  different owners, and the first reading is never replaced. A watch session is therefore bounded at two readings of a
  file rather than one per keystroke, which is not yet "the last reading replaces the one before it".

  Build output is unchanged. Every file is read once in a build, so nothing is ever released and no ordering or content
  can move: verified byte-identical across the emitted stylesheets of every sandbox, through the CLI and through a Vite
  production build, with the generator artifacts regenerating identically.

  Per-edit cost is unmeasured. The machine available ran at load 12–16 throughout, where run-to-run spread on the
  extraction benchmarks exceeds any effect this could have — a reading taken there would be noise reported as a result.
  A benchmark for the path this adds is included (`extract-modes`, `css() calls, re-read into the same encoder`), so the
  measurement can be taken on a quiet machine.

- Updated dependencies [00e7af9]
  - @bamboocss/core@1.45.2
  - @bamboocss/config@1.45.2
  - @bamboocss/extractor@1.45.2
  - @bamboocss/logger@1.45.2
  - @bamboocss/shared@1.45.2
  - @bamboocss/types@1.45.2

## 1.45.1

### Patch Changes

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
- @bamboocss/shared@1.45.0
- @bamboocss/types@1.45.0

## 1.44.1

### Patch Changes

- Updated dependencies [632b75c]
  - @bamboocss/extractor@1.44.1
  - @bamboocss/types@1.44.1
  - @bamboocss/config@1.44.1
  - @bamboocss/core@1.44.1
  - @bamboocss/logger@1.44.1
  - @bamboocss/shared@1.44.1

## 1.44.0

### Patch Changes

- Updated dependencies [78b4de5]
  - @bamboocss/types@1.44.0
  - @bamboocss/core@1.44.0
  - @bamboocss/config@1.44.0
  - @bamboocss/logger@1.44.0
  - @bamboocss/extractor@1.44.0
  - @bamboocss/shared@1.44.0

## 1.43.1

### Patch Changes

- Updated dependencies [698bd49]
  - @bamboocss/core@1.43.1
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
  - @bamboocss/config@1.43.0
  - @bamboocss/logger@1.43.0
  - @bamboocss/extractor@1.43.0
  - @bamboocss/shared@1.43.0

## 1.42.0

### Patch Changes

- Updated dependencies [4fcae37]
- Updated dependencies [6fa8d1a]
- Updated dependencies [5c33622]
- Updated dependencies [0ca4f32]
  - @bamboocss/core@1.42.0
  - @bamboocss/types@1.42.0
  - @bamboocss/config@1.42.0
  - @bamboocss/shared@1.42.0
  - @bamboocss/logger@1.42.0
  - @bamboocss/extractor@1.42.0

## 1.41.1

### Patch Changes

- @bamboocss/config@1.41.1
- @bamboocss/core@1.41.1
- @bamboocss/extractor@1.41.1
- @bamboocss/logger@1.41.1
- @bamboocss/shared@1.41.1
- @bamboocss/types@1.41.1

## 1.41.0

### Patch Changes

- @bamboocss/config@1.41.0
- @bamboocss/core@1.41.0
- @bamboocss/extractor@1.41.0
- @bamboocss/logger@1.41.0
- @bamboocss/shared@1.41.0
- @bamboocss/types@1.41.0

## 1.40.1

### Patch Changes

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
  - @bamboocss/config@1.40.0
  - @bamboocss/core@1.40.0
  - @bamboocss/extractor@1.40.0
  - @bamboocss/logger@1.40.0
  - @bamboocss/shared@1.40.0
  - @bamboocss/types@1.40.0

## 1.39.1

### Patch Changes

- Updated dependencies [4734709]
  - @bamboocss/shared@1.39.1
  - @bamboocss/config@1.39.1
  - @bamboocss/core@1.39.1
  - @bamboocss/extractor@1.39.1
  - @bamboocss/types@1.39.1
  - @bamboocss/logger@1.39.1

## 1.39.0

### Patch Changes

- Updated dependencies [4d27ba4]
  - @bamboocss/types@1.39.0
  - @bamboocss/core@1.39.0
  - @bamboocss/config@1.39.0
  - @bamboocss/logger@1.39.0
  - @bamboocss/extractor@1.39.0
  - @bamboocss/shared@1.39.0

## 1.38.0

### Patch Changes

- @bamboocss/config@1.38.0
- @bamboocss/core@1.38.0
- @bamboocss/extractor@1.38.0
- @bamboocss/logger@1.38.0
- @bamboocss/shared@1.38.0
- @bamboocss/types@1.38.0

## 1.37.13

### Patch Changes

- @bamboocss/config@1.37.13
- @bamboocss/core@1.37.13
- @bamboocss/extractor@1.37.13
- @bamboocss/logger@1.37.13
- @bamboocss/shared@1.37.13
- @bamboocss/types@1.37.13

## 1.37.12

### Patch Changes

- 2828ee9: Stop treating a re-add of a file's own text as an edit.

  A bundler adds every module to the project before parsing it, handing back the text the extractor already read off
  disk. Measured on a 6,307-file Vite build, **6,001 of 6,001** `addSourceFile` calls from the Vite transform passed
  byte-identical content — none differing, none absent. Each one paid twice: `createSourceFile` overwrites, which
  re-parses the file and forgets every node previously taken from it, and `invalidate` drops both caches memoized
  against _other_ files' contents.

  The second is what hurt. The imported-recipe walk runs one line later, inside `parseSourceFile`, so emptying its memo
  here meant every module re-walked the whole export closure of every barrel it imports — the opposite of the "a barrel
  imported by two hundred files is walked once" the cache exists for. `addSourceFile` now returns the existing
  `SourceFile` when its full text already equals the incoming content, invalidating nothing.

  On that build:

  |                     | before                | after                 |
  | ------------------- | --------------------- | --------------------- |
  | `walkExports` calls | 1,866,610             | 36,610                |
  | module resolutions  | 3,734,123             | 98,123                |
  | build wall-clock    | 62.6s / 48.1s / 47.6s | 35.7s / 29.9s / 30.5s |

  Three alternating A/B pairs, ratio 0.57 / 0.62 / 0.64 — **a ~38% shorter build**. Ratios rather than seconds because
  the machine was under load and the absolutes swung 40% for the same tree; the call counts do not depend on load.
  Emitted CSS is byte-identical (3,611 bytes both arms) and the asset names, which carry content hashes, are unchanged.

  The comparison is textual, not semantic, so a whitespace-only edit still invalidates. A file whose text
  `parser:before` replaced no longer matches its own source, falls through, and is overwritten exactly as before.

  `packages/vite/__tests__/fold.bench.ts` is unmoved (every case within noise, controls +1.1% and +1.7%) and cannot see
  this either way: it hands out a fresh path per iteration, so the file never already exists and the guard never fires.
  The two new tests in `packages/parser/__tests__/watch-invalidation.test.ts` count resolutions rather than timing them,
  so the guarantee holds in CI — without the guard the second consumer of a barrel costs exactly what the first did.
  - @bamboocss/config@1.37.12
  - @bamboocss/core@1.37.12
  - @bamboocss/extractor@1.37.12
  - @bamboocss/logger@1.37.12
  - @bamboocss/shared@1.37.12
  - @bamboocss/types@1.37.12

## 1.37.11

### Patch Changes

- @bamboocss/config@1.37.11
- @bamboocss/core@1.37.11
- @bamboocss/extractor@1.37.11
- @bamboocss/logger@1.37.11
- @bamboocss/shared@1.37.11
- @bamboocss/types@1.37.11

## 1.37.10

### Patch Changes

- @bamboocss/config@1.37.10
- @bamboocss/core@1.37.10
- @bamboocss/extractor@1.37.10
- @bamboocss/logger@1.37.10
- @bamboocss/shared@1.37.10
- @bamboocss/types@1.37.10

## 1.37.9

### Patch Changes

- @bamboocss/config@1.37.9
- @bamboocss/core@1.37.9
- @bamboocss/extractor@1.37.9
- @bamboocss/logger@1.37.9
- @bamboocss/shared@1.37.9
- @bamboocss/types@1.37.9

## 1.37.8

### Patch Changes

- @bamboocss/config@1.37.8
- @bamboocss/core@1.37.8
- @bamboocss/extractor@1.37.8
- @bamboocss/logger@1.37.8
- @bamboocss/shared@1.37.8
- @bamboocss/types@1.37.8

## 1.37.7

### Patch Changes

- @bamboocss/config@1.37.7
- @bamboocss/core@1.37.7
- @bamboocss/extractor@1.37.7
- @bamboocss/logger@1.37.7
- @bamboocss/shared@1.37.7
- @bamboocss/types@1.37.7

## 1.37.6

### Patch Changes

- @bamboocss/config@1.37.6
- @bamboocss/core@1.37.6
- @bamboocss/extractor@1.37.6
- @bamboocss/logger@1.37.6
- @bamboocss/shared@1.37.6
- @bamboocss/types@1.37.6

## 1.37.5

### Patch Changes

- @bamboocss/config@1.37.5
- @bamboocss/core@1.37.5
- @bamboocss/extractor@1.37.5
- @bamboocss/logger@1.37.5
- @bamboocss/shared@1.37.5
- @bamboocss/types@1.37.5

## 1.37.4

### Patch Changes

- @bamboocss/config@1.37.4
- @bamboocss/core@1.37.4
- @bamboocss/extractor@1.37.4
- @bamboocss/logger@1.37.4
- @bamboocss/shared@1.37.4
- @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/config@1.37.3
- @bamboocss/core@1.37.3
- @bamboocss/extractor@1.37.3
- @bamboocss/logger@1.37.3
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
  - @bamboocss/config@1.37.2
  - @bamboocss/core@1.37.2
  - @bamboocss/extractor@1.37.2
  - @bamboocss/logger@1.37.2
  - @bamboocss/shared@1.37.2
  - @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/config@1.37.1
- @bamboocss/core@1.37.1
- @bamboocss/extractor@1.37.1
- @bamboocss/logger@1.37.1
- @bamboocss/shared@1.37.1
- @bamboocss/types@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/config@1.37.0
- @bamboocss/core@1.37.0
- @bamboocss/extractor@1.37.0
- @bamboocss/logger@1.37.0
- @bamboocss/shared@1.37.0
- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/config@1.36.5
- @bamboocss/core@1.36.5
- @bamboocss/extractor@1.36.5
- @bamboocss/logger@1.36.5
- @bamboocss/shared@1.36.5
- @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/config@1.36.4
- @bamboocss/core@1.36.4
- @bamboocss/extractor@1.36.4
- @bamboocss/logger@1.36.4
- @bamboocss/shared@1.36.4
- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/config@1.36.3
- @bamboocss/core@1.36.3
- @bamboocss/extractor@1.36.3
- @bamboocss/logger@1.36.3
- @bamboocss/shared@1.36.3
- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/config@1.36.2
- @bamboocss/core@1.36.2
- @bamboocss/extractor@1.36.2
- @bamboocss/logger@1.36.2
- @bamboocss/shared@1.36.2
- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/config@1.36.1
- @bamboocss/core@1.36.1
- @bamboocss/extractor@1.36.1
- @bamboocss/logger@1.36.1
- @bamboocss/shared@1.36.1
- @bamboocss/types@1.36.1

## 1.36.0

### Minor Changes

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

### Patch Changes

- @bamboocss/config@1.36.0
- @bamboocss/core@1.36.0
- @bamboocss/extractor@1.36.0
- @bamboocss/logger@1.36.0
- @bamboocss/shared@1.36.0
- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/config@1.35.5
- @bamboocss/core@1.35.5
- @bamboocss/extractor@1.35.5
- @bamboocss/logger@1.35.5
- @bamboocss/shared@1.35.5
- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/config@1.35.4
- @bamboocss/core@1.35.4
- @bamboocss/extractor@1.35.4
- @bamboocss/logger@1.35.4
- @bamboocss/shared@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/config@1.35.3
- @bamboocss/core@1.35.3
- @bamboocss/extractor@1.35.3
- @bamboocss/logger@1.35.3
- @bamboocss/shared@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/config@1.35.2
  - @bamboocss/core@1.35.2
  - @bamboocss/extractor@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/config@1.35.1
- @bamboocss/core@1.35.1
- @bamboocss/extractor@1.35.1
- @bamboocss/logger@1.35.1
- @bamboocss/shared@1.35.1
- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/core@1.35.0
  - @bamboocss/types@1.35.0
  - @bamboocss/config@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/extractor@1.35.0
  - @bamboocss/shared@1.35.0

## 1.34.1

### Patch Changes

- Updated dependencies [e2ec2ae]
  - @bamboocss/core@1.34.1
  - @bamboocss/config@1.34.1
  - @bamboocss/extractor@1.34.1
  - @bamboocss/logger@1.34.1
  - @bamboocss/shared@1.34.1
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

### Patch Changes

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
  - @bamboocss/logger@1.33.0
  - @bamboocss/extractor@1.33.0
  - @bamboocss/shared@1.33.0

## 1.32.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [b2b4173]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
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
- Updated dependencies [232a83a]
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
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0
  - @bamboocss/extractor@1.31.0

## 1.30.1

### Patch Changes

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
- Updated dependencies [242b24c]
  - @bamboocss/core@1.30.0
  - @bamboocss/extractor@1.30.0
  - @bamboocss/types@1.30.0
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

- 3dd3fc1: Parse `.ts` files as TypeScript instead of TSX, so styles written after a generic arrow are extracted.

  Every file was handed to the parser as `ScriptKind.TSX`, which is not a superset of `TS` — the two disagree wherever
  `<` is ambiguous. Under TSX a generic arrow `<T>(value: T) => value` and an old-style assertion
  `<HTMLElement>document.body` parse as a _JSX element_, whose children then swallow the rest of the file.

  Nothing looks wrong: the source is valid TypeScript, the bytes are untouched, and no error is reported. But every
  `css()`, `cva()` or `token()` call below that line has stopped existing as far as extraction is concerned, so its
  rules are silently never emitted.

  Only `.ts`, `.mts` and `.cts` change. A `.ts` file cannot legally contain JSX, so parsing one as TSX could only ever
  mis-parse. `.js` and `.jsx` keep parsing as TSX because they routinely carry JSX in projects that never adopted
  TypeScript, and `.vue`/`.svelte` keep it because they are stored as tsx after `parser:before` rewrites them.

  Verified byte-identical CSS output on the example apps, which use `.tsx` throughout.

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

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/config@1.28.0
  - @bamboocss/core@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/extractor@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/config@1.27.0
- @bamboocss/core@1.27.0
- @bamboocss/extractor@1.27.0
- @bamboocss/logger@1.27.0
- @bamboocss/shared@1.27.0
- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- 5e8814c: Report `css(recipe.raw(props), …)`, which silently loses the recipe's styles.

  `.raw` on a **recipe or a pattern** takes props and returns styles. The build reads it as the identity that `css.raw`
  means — so it composes the _props_ instead:

  ```ts
  css(textInput.raw(), { fontFamily: 'monospace' })

  // the browser asks for : c_red.300  p_4  ff_monospace
  // the build emits      : —          —    ff_monospace
  ```

  The recipe's own declarations never reach the stylesheet, and for a call with variants the variant names are handed to
  the encoder as though they were properties. The element then renders without those styles, and nothing said so. It
  survives in practice only when some other component happens to emit the same atomic classes, so it breaks when an
  unrelated file stops using them.

  This does not resolve the composition — running the recipe during extraction to get it right is a larger change, and
  emitting the wrong styles would be worse than emitting none. **CSS output is unchanged.** What changes is that the
  build now says:

  ```
  textInput.raw() composes its own props rather than its styles, so textInput's declarations
  will not reach the stylesheet
    Call it instead — cx(textInput(props), css({ … })) — or move the overrides into textInput itself.
  ```

  Reported for inline recipes, config recipes and patterns alike. `css.raw()` composition is unaffected: identity is
  exactly what it means, and it reaches the stylesheet correctly.
  - @bamboocss/config@1.26.0
  - @bamboocss/core@1.26.0
  - @bamboocss/extractor@1.26.0
  - @bamboocss/logger@1.26.0
  - @bamboocss/shared@1.26.0
  - @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/config@1.25.0
- @bamboocss/core@1.25.0
- @bamboocss/extractor@1.25.0
- @bamboocss/logger@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/config@1.24.0
- @bamboocss/core@1.24.0
- @bamboocss/extractor@1.24.0
- @bamboocss/logger@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/types@1.24.0

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

### Patch Changes

- Updated dependencies [f4a2824]
- Updated dependencies [b041398]
- Updated dependencies [087b884]
  - @bamboocss/core@1.23.0
  - @bamboocss/types@1.23.0
  - @bamboocss/shared@1.23.0
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

### Patch Changes

- Updated dependencies [39c699f]
- Updated dependencies [fe62614]
- Updated dependencies [1036258]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/core@1.22.0
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/config@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/extractor@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/config@1.21.0
  - @bamboocss/core@1.21.0
  - @bamboocss/extractor@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

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

  We introduced a bug in [v0.34.2](https://github.com/gajus/bamboocss/blob/main/CHANGELOG.md#0342---2024-03-08) where
  the `Tabs.Trigger` component was not being matched to the `tabs` slot recipe, due to the
  [new namespace import feature](https://github.com/gajus/bamboocss/pull/2371).

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

  issue: https://github.com/gajus/bamboocss/issues/1315

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
