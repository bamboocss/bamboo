---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/core': minor
---

Narrow `styled-system/css` to the authoring API.

The barrel was four `export *` lines, so every binding its modules happened to export became part of the public API.
Seven were plumbing:

```text
what `import { … } from 'styled-system/css'` offered before:

  css, css.raw, cx, cva, sva, fallback, viewTransition, auditSlotScopes
  cssLeaf, cvaPick, splitProps           <- written by the source transform, never by hand
  mergeCss, assignCss, mergeCssUncached  <- internal merge plumbing
```

The barrel is now a deliberate list. `cssLeaf`, `cvaPick` and `splitProps` are still exported at runtime — the fold adds
them to whatever `styled-system/css` import a file already has, so that is the specifier its emitted calls resolve
against — but the declaration file omits them. Folded code is rewritten in memory during the bundler's transform and
never typechecked, so a declaration bought nothing beyond an autocomplete entry advertising them as API. Each stays
typed in the module that defines it.

**`mergeCss` and `mergeCssUncached` leave the barrel.** They remain at `styled-system/css/merge-css`, which is where
`cva` imports them from. `css.raw(...)` is the authoring API for merging style objects and always was the documented
one: it is `mergeCss` plus the clone that makes a shared, memoized result safe to hand back, so the uncloned function
beside it was a footgun under a second name.

**`assignCss` is removed.** It had no callers — not in the runtime, the artifacts, the sandboxes or the docs — and no
documented purpose.

The runtime/declaration split was already there and pointing the other way: `css.mjs` re-exported the merge trio while
`css.d.ts` never declared it, so `mergeCss` was importable but untyped through the barrel. That is now consistent.

A test pins the half that nothing else could catch. The barrel is a hand-written list, the emitted calls are never
typechecked, and a bundler only _warns_ about an import naming a missing export — so dropping `cvaPick` from the list
would leave the fold emitting calls that silently receive `undefined`. The test asserts every name the fold can inject
is exported by the barrel's runtime, and that none of them is declared in its types.
