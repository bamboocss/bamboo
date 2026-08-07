---
'@bamboocss/preset-base': patch
---

Emit `dropShadow` as a filter function, so it stops invalidating the whole `filter`.

`dropShadow` passed its value straight through, unlike every other filter utility — `blur` writes `blur(…)`, `sepia`
writes `sepia(…)`, and so on. So `dropShadow: '0 1px 2px black'` set `--drop-shadow: 0 1px 2px black`, and `filter`,
which composes nine variables into one declaration, resolved to:

```css
filter: blur(4px) 0 1px 2px black;
```

A filter list is invalid **as a whole** if any function in it is, so this did not merely fail to draw a shadow — it
dropped every filter on the element, including ones set by a different utility. An element with `blur` and `dropShadow`
lost its blur too.

The value is now wrapped: `--drop-shadow: drop-shadow(0 1px 2px black)`. A value that was already written as
`drop-shadow(…)` — the only form that happened to work before — should now be given without the wrapper.

Also removed `values: 'dropShadows'` from the utility. `dropShadows` is not a token category: it appears in neither
`TokenDataTypes` nor the category map in `@bamboocss/token-dictionary`, so nothing ever resolved through it and the raw
value was emitted. Every filter utility without a token category declares none, which is now true of this one as well.
The utilities table in the docs listed `dropShadows` as its category and has been corrected.

Nothing caught either of these because nothing ran the code: `effects.ts` sat at 10% statement coverage, with every
`transform` body in the untested part, and no test in the repo used `dropShadow`. `filter-utilities.test.ts` now asserts
that each of the nine filter and nine backdrop-filter utilities contributes something shaped like a filter function —
with `backdropOpacity`, which takes a bare number, stated as the exception rather than folded in.
