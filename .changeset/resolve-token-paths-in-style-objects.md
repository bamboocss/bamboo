---
'@bamboocss/extractor': patch
'@bamboocss/core': patch
'@bamboocss/parser': patch
'@bamboocss/generator': patch
---

Resolve token paths inside style objects that are not spelled out at the call.

`css({ color: token(BRAND) })` emitted nothing for that property, while `const c = token(BRAND)` outside a style object
resolved fine — the fold follows a constant or a template literal into a token path, and the in-style-object resolution
required a string literal. Nothing errored; the declaration simply never existed. Same for a namespaced call,
`css({ color: ds.token('colors.red.300') })`, which asked whether the _namespace_ was a token function.

Both now resolve, through the same machinery every other extracted value already uses. A path that genuinely only exists
at runtime is still left alone.

Also `??` rather than `||` in the generated `token()` and `token.value()`. The fallback is for a path that names no
token, and `||` also swallowed a token whose value is legitimately falsy — `zIndex: { base: { value: 0 } }` returned the
fallback instead of `0`. No token in the default preset has a falsy value, so this only ever bit a custom theme.

Verified byte-identical CSS output on the example apps, which spell their token paths at the call.
