---
'@bamboocss/vite': patch
---

Remove two costs that grew with the size of the thing being compiled.

- **Survivor bookkeeping was quadratic.** Every transform scanned the whole survivor list to forget its own file's
  entries, then rebuilt the dedupe key set from scratch — O(modules x survivors) across a build, and worst exactly when
  a build is already failing and someone is iterating on it. One project reported 736 survivors across 9,461 modules,
  which is seven million string builds discarded immediately. They are now indexed by file, so forgetting one is a
  single map delete.
- **The reference walk repeated per binding.** `localReferencesTo` walked every identifier in the module for each recipe
  binding, so a module declaring ten recipes walked its identifiers ten times. One walk now answers for all of them, and
  the index is cached against the source text like the module-scope names beside it, so re-transforming unchanged text
  reuses it.

Neither changes what is emitted; both are the same answers computed once.

Measured on a real Vite build with each plugin hook instrumented, at 100/200/400 generated component files: the
per-module transform is the linear cost (~0.8ms/file), config and context setup a fixed ~100ms, and pruning and renaming
together under 3ms. The largest remaining item is structural rather than algorithmic — the compiler and the stylesheet
build separate contexts with separate ts-morph projects, so the same files are parsed twice.
