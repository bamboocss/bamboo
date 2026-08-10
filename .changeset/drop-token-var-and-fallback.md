---
'@bamboocss/generator': minor
'@bamboocss/core': minor
'@bamboocss/extractor': minor
'@bamboocss/parser': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
'@bamboocss/node': minor
---

Remove `token.var()` and the token `fallback` parameter.

`token.var` was `token.var = token` — a literal alias, so two spellings for one behaviour, which is the redundancy the
`token()` change exists to remove. `token()` is the reference.

The second `fallback` argument is gone too: `token(path) ?? fallback` says the same thing in the language, and the
parameter had to be proved side-effect-free before a build could fold the call away. A path naming no token resolves to
nothing, and the property is dropped — at build time and at runtime alike, which they did not previously agree on.

`token()` and `token.value()` return `string`. Their parameters are the closed sets of paths the theme declares, so a
call that typechecks always answers.
