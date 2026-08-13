---
'@bamboocss/vite': patch
---

Apply an edit to a recipe, or to any module a compiled call reads from, without restarting the dev server.

The compiler erases an inline `cva`/`sva` declaration and compiles each **call site** into a literal class string, so
the class for a recipe lives in the module that calls it. Vite's dev server only _soft_-invalidates a module that
statically imports the changed one — it keeps that module's cached transform result and rewrites nothing but the
timestamps on its import specifiers — and the class string is inside that cached result. Editing a recipe therefore
updated the stylesheet and never the markup: Vite logged its update, Bamboo logged a fresh extraction, the new rule was
emitted, and every element kept the class it had before. Only restarting the server applied the edit.

`css(sharedObject)` across modules failed the same way. It surfaced less often because a consumer that compiles _nothing
but_ recipe calls has its import erased, and an erased import is not a static one, so Vite hard-invalidated it and the
staleness disappeared — which is also why the smallest reproduction of the bug does not reproduce it.

The Vite plugin now tracks which modules compiled a value out of which other module, and invalidates those consumers
itself when the dependency changes. Builds are unaffected: Rollup already discards a module whose watched dependency
changed.
