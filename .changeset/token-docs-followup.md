---
'@bamboocss/types': patch
'@bamboocss/generator': patch
'@bamboocss/node': patch
'@bamboocss/parser': patch
---

Correct the `pruneUnusedTokens` documentation for `token()` returning a css variable.

The JSDoc every editor shows on hover still described the old contract, and inverted the advice for exactly the failure
the new one introduces: it said `token(key)` was "safe for any path, because javascript receives a literal", and pointed
users at `token.var()` as the form needing `staticCss`. `token()` now returns `var(--x)`, and the form that returns a
literal is `token.value()`, which the text never mentioned.

It also quantifies the bluntness rather than repeating the old figure: a project reaching for a token from javascript
keeps 468 declarations on the default preset where the narrower exemption kept 68.

`bamboo init`'s scaffold comment said `token.var()` with a computed path; it is `token()`. The token spec now offers
`token.value()` unconditionally, since the `varRef` guard it inherited asked a question only the `token.var()` alias
cared about.
