---
'@bamboocss/extractor': patch
---

Stop re-export cycles crashing the build.

Importing a name that does not resolve inside a cycle of re-exporting files — a typo, a stale import, a type-only
export, or a name that lives outside the cycle — made export lookup walk the cycle until the stack overflowed, failing
the whole build with `RangeError: Maximum call stack size exceeded`.

`export * from './other'` is the worst case, since a star re-export matches every name and so every unresolved lookup
traverses the entire graph. A barrel that re-exports itself hit it with a single file.

Lookup now tracks the files it has already searched and stops on revisit, so such an import degrades to unresolvable
like any other rather than throwing. Names that do resolve through a cycle are still found.
