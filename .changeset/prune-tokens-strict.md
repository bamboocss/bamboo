---
'@bamboocss/node': minor
'@bamboocss/types': minor
---

Add `pruneUnusedTokens: 'strict'`, which prunes the token layer for projects whose token paths all resolve at build
time.

Since `token()` returns a css variable reference for every token, a path the build cannot read could name any of them,
so every declaration has to be kept — and the check for that is all-or-nothing: one token call or `/tokens` import
anywhere under `include` keeps the lot. On the default preset that is 468 declarations instead of 68.

`'strict'` is an assertion rather than a cleverer inference. You state that every token path is spelled out at the call;
Bamboo accounts for each reference, keeps by name only what is asked for, and prints everything it could not read:

```
⚠ tokens:strict  2 token reference(s) could not be resolved, so every token declaration is kept.

  src/chart.tsx
    14: unresolved-reference
  src/theme.ts
    3: unclassified-import
```

A reference it cannot read is never pruned — it falls back to whatever the default would have answered for that project.
So `strict` is never less safe and never larger than the default, and it says why when it cannot prune.

Two things keep it inert rather than wrong: any file whose parsed tree carries syntax errors declines, which includes
every `.ts` file using a generic arrow (`<T>(x: T) => x`) or an old-style assertion, since Bamboo hands every file to
the parser as TSX; and a `.vue` or `.svelte` file mentioning `token` anywhere declines, because a single-file component
is stored post-transform and the tree is not the code that ships.

What resolves: a string literal path, either half (`token`, `token.var`, `token.value`), an aliased import, a namespace
import. What is reported: a path built at runtime or from a constant, a binding that escapes (`const t = token`), a
re-export, a `require`, and an import from a module Bamboo cannot classify as the artifact — which covers a barrel
re-exporting it.

The one thing it cannot check is a caller **outside** `include`, since that scopes style extraction rather than
everything that may import. Confirm `include` covers every file reaching for a token before turning this on; the default
remains unchanged.
