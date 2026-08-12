---
'@bamboocss/parser': minor
'@bamboocss/vite': patch
---

Stop the compiler issuing TypeScript language-service queries, which bound the whole project into the bundler's heap.

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

- **An inline recipe consumed from another module compiles.** The declaring module used to search the whole project and
  report any reference it found outside its own rewritten ranges, so an exported recipe failed even when every consumer
  compiled cleanly. Each module now answers only about its own text: a consumer that reads the binding unsafely —
  `export const alias = badge`, `badge.raw(...)` — reports itself, and one whose calls all compiled reports nothing.
- **Diagnostics always index the file they name.** Offsets from another module used to be reported against the module
  being folded, yielding a line past its end.

`no-language-service.test.ts` asserts the invariant directly, so any future `getDefinitions`, `getType` or
`findReferences` in the compile path fails there rather than in a customer's heap.

`@bamboocss/parser` gains `ParserResult.importedRecipes`: the inline recipe bindings a module imported, whether or not
it calls one. A module that only reads an imported recipe produces no call, so nothing downstream could previously tell
that the binding was a recipe at all.
