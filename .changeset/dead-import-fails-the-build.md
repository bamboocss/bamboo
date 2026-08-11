---
'@bamboocss/core': minor
'@bamboocss/parser': minor
'@bamboocss/node': minor
'@bamboocss/shared': minor
---

Fail the build on a call to a binding the pattern or recipe entrypoint no longer exports.

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
`assertExtracted` already fails on, reached from the other direction, so it now reports the same way — every file named
in one pass, dropped once the file is fixed, deleted, or leaves `include`, and surviving the incremental passes that
skip an unchanged file.

**Reported per call, not per import.** Both entrypoints export types beside their functions — `FlexProperties` from
`patterns`, `ButtonVariantProps` from `recipes` — and neither is a pattern or a recipe, so an import-only test reports
every file that types a prop. TypeScript lets those be written without the `type` keyword and elides them either way, so
the keyword is not a filter this can rely on. A type is never called, which is. A binding nobody calls is left alone for
the same reason: nothing asked it for a class, so no rule is missing.

Not governed by a severity option, unlike `unresolvedToken`. That one infers a mistake from a value's shape and can be
wrong about a literal; this is read off the entrypoint's own export list.
