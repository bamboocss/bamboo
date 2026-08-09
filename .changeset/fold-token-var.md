---
'@bamboocss/core': patch
'@bamboocss/parser': patch
'@bamboocss/types': patch
'@bamboocss/vite': patch
---

Fold `token.var()` at build time, and record it during extraction.

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
