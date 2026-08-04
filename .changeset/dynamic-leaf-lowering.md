---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/vite': minor
---

Lower a single dynamic style value to a class the runtime builds by concatenation, instead of leaving a `css()` call
behind.

`css({ margin: '2', color: tone })` folded to `cx("m_2", css({ color: tone }))`. It now folds to
`cx("m_2", cssLeaf("c_", "color", tone))`, where `c_` is resolved at build time and the runtime only appends the value.
Measured against the `css()` call it replaces: 2.2x when the memo would have hit, 43x when it would have missed — which
is every SSR render, and any value that cycles past the memo's 1000-entry ceiling.

This is sound because `css()` already builds the class from the value alone. `utility.transform` is string construction
over a table fixed at build time and nothing consults which rules were emitted, so `css({ color: tone })` already
returns `c_<tone>` for a value the extractor never saw, with no CSS behind it. The lowered form produces the same string
in the same cases.

Three shapes do not reduce to one class and fall back to `css()` at runtime, so nothing is lost: a responsive array, a
condition object, and any non-scalar. `null` and `undefined` produce no class, as before. A value carrying whitespace or
`!important` still resolves correctly but takes a regex path that is slower than a memo hit, so a call whose value
always has one is better left alone.

It applies to a top-level property of a single-argument `css()` call, with `hash` and `cssMode: 'grouped'` declining
automatically — neither produces a class the value is merely appended to. Condition keys are declined too, since their
value is an object in every real use. Turn it off with `partial: false`, alongside the rest of the splitting.

Two notes for upgrades. `cssLeaf` is emitted by the generator, so a project whose `styled-system/` was generated before
this release must be regenerated — the transform emits an import of it, and a stale runtime has no such export. And
`sanitize` is now exported from `@bamboocss/shared`, so the class-name pipeline has one implementation rather than a
copy in `leafClass`.
