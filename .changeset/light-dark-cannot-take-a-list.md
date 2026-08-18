---
'@bamboocss/generator': patch
---

Stop folding a semantic token into `light-dark()` when either arm is a comma-separated list.

`light-dark()` takes exactly two arguments, and CSS has no way to group a list into one of them — there is no
parenthesized form of a shadow list. A token whose light or dark value was itself a list therefore splatted into three
or more arguments:

```css
/* --shadows-sm: { base: '0 1px 2px …, 0 1px 3px …', _osDark: '0 1px 2px …' } */
--shadows-sm: light-dark(0 1px 2px rgb(16 19 26 / 0.06), 0 1px 3px rgb(16 19 26 / 0.04), 0 1px 2px rgb(0 0 0 / 0.3));
```

The function is invalid, so the browser drops the whole declaration. The failure is silent and total: every element
referencing the token renders with no shadow at all, while the class naming it looks perfectly correct and the token
appears in the sheet. Nothing errors.

A realistic elevation scale is almost always two shadows per step, so this took out whole design systems at once rather
than an edge case — `sm`, `md` and `lg` together. `transition` and `background` lists are the same shape.

Such a token now keeps the `@media (prefers-color-scheme: dark)` mechanism, which expresses a list perfectly well.
Tokens that can fold still do, including in the same sheet — the guard is per-token, and it is depth- and quote-aware,
so `rgb(16, 19, 26)` and a `"Foo, Bar"` font stack are unaffected.

Reaching it takes a semantic token you defined with both an `_osDark` arm and a list value; no preset ships one, so a
project on stock tokens was never affected. Present since 1.20.0, which introduced the fold.
