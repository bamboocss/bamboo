---
'@bamboocss/extractor': patch
---

The compiled-jsx context stops reading every module twice looking for bundler output.

`extract` builds this context for every module it processes, and two of its walks hunt for things a bundler emits —
Parcel's module registry, and Vue, Solid or Preact runtime helpers inlined into the output. Neither can match
hand-written source, which is nearly every module a project has, so both read the whole tree and wrapped every call
expression and every function declaration in it to find nothing. On the arena app that was 7.6ms of a 120ms per-module
transform.

Both are now guarded on the module containing at least one marker that some branch of the matchers requires — the Parcel
callee, or one of the substrings `resolveBundledHelperImport` tests per framework. A necessary condition rather than a
sufficient one: a marker inside a comment opens the walk, which then costs what it always cost.

The list also allows a unicode escape through, because the Parcel callee is compared through `getText()`, which returns
an identifier as the compiler resolves it — `parcelRegister` matches the walk while the plain name appears nowhere in
the source.

`extract.test.ts` already carries 158 fixtures of real bundler output across react, preact, vue and solid, so a guard
that skipped too much fails there. `compiled-jsx-walks.test.ts` holds the other direction, which nothing covered: that
hand-written source is not walked at all, and that inlined helpers, a Parcel registry and an escaped callee still are.
