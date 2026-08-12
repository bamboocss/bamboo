---
'@bamboocss/vite': patch
---

Resolve a recipe binding's references once per module instead of once per declined call.

`reportRuntimeBindings` called `findReferencesAsNodes()` inside a `some` over every call the module had already
declined, and again afterwards for the survivor. The result cannot change between those calls, so the answer is now
computed once and reused.

This is strictly less work, but measuring it showed it is **not** where the time in a large build goes: ts-morph caches
within a program generation, so the cost is the first search per module rather than the repeats. The real cost is that
the search is project-wide at all — the transform adds each module to the ts-morph project, which invalidates the
TypeScript program, so the next search re-binds everything. Isolated against project size, the scan costs 4ms over 200
files and 24ms over 3,200 while the rest of the fold stays near zero, and it is paid once per module that declares a
recipe. That is quadratic in project size and is still present.

The fix for it is to avoid the project-wide search for a binding that is not exported, whose references can only be in
its own module — 98% of recipes in the codebase this was measured against. That is not in this release.
