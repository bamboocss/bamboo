---
'@bamboocss/generator': minor
'@bamboocss/token-dictionary': minor
'@bamboocss/extractor': minor
'@bamboocss/parser': minor
'@bamboocss/core': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
'@bamboocss/node': minor
---

`token()` now returns the css variable reference for every token, and `token.value()` returns the resolved literal.

```ts
token('colors.red.300') // "var(--colors-red-300)"  — was "#fca5a5"
token.value('colors.red.300') // "#fca5a5"
token.var('colors.red.300') // unchanged; now an alias of token()
```

**Why.** `token()` used to return the literal for a plain token and the variable reference for a virtual or conditional
one, so the kind of thing you got back was decided by the theme rather than by the call. Adding a `_dark` variant to a
token silently changed what every caller received — same call, same path, a colour before and a variable after, both
typed `string`, with nothing to catch it. Always-a-reference is the predictable half and the one that keeps responding
to the cascade, so it takes the short name; the literal has to be asked for, which is also the honest signal, since it
is the form that stops tracking the theme.

`token.value()` keeps the old per-token split rather than always returning a literal: a virtual or conditional token has
no single literal, so its `var()` is still the only truthful answer.

**Migrating.** Rename any call whose result goes somewhere a css variable will not resolve — a `<canvas>` fill, a
charting library, `<meta name="theme-color">`, or arithmetic on the value — to `token.value()`. Everything else can stay
as it is and gets better behaviour for free. Nothing throws and no type changes, since both forms return `string`, so
this is worth grepping for rather than waiting on.

**Extraction and folding.** `token()`, `token.var()` and `token.value()` are all recognised by the parser and folded at
build time, including paths built from a constant or template literal the extractor can follow. `token()` is now the
trivially foldable form: no condition to read and no non-string case to decline.

**Fixed along the way: negative tokens lost their sign.** A negative token has no css variable of its own — its `varRef`
names the positive counterpart, and the negation survives only in the value — so a token whose positive counterpart
carried a condition resolved to a _positive_ length. `token.value('spacing.-gutter')` returned `var(--spacing-gutter)`
where it should return `calc(var(--spacing-gutter) * -1)`. Both halves now read through the token view, so the generated
runtime, the extractor and the build-time fold cannot disagree.

**Stylesheet size.** This makes `pruneUnusedTokens` coarser in one case. Because `token()` can hand back a `var()` for
any token, a project that reaches for a token from javascript at all now keeps every token declaration, where before it
kept only the virtual, conditional and negative ones. A project that never imports the tokens artifact is unaffected,
and one whose paths all resolve statically will be too once the reachability gate is narrowed to distinguish them —
tracked as follow-up work.
