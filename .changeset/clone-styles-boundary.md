---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Stop charging every merge for a copy only `raw()` needs.

Merged style objects are cached, so `css.raw()` and `cva.raw()` have to hand out something independent — a caller
mutating what it received would otherwise change what every later caller reads. That guarantee was previously supplied
by making `mergeProps` copy nested objects, which put the cost on every merge instead of the two places that need it.

Merging runs on every `css()` cache miss, and on every render of a pattern component under `jsxStyleProps: 'minimal'`.
Copying there cost roughly twice as much as merging alone for a realistic style object — five base properties and four
condition blocks — and the overhead scales with nesting, so it fell on exactly the styles people write.

`mergeProps` is a merge again, and a new `cloneStyles` helper supplies the copy at the two boundaries where the value
reaches user code. The independence guarantee is unchanged; the call site now says what it is doing.

The template-literal `css.raw()` also routes through `cloneStyles`, so both syntaxes offer the same guarantee. It
previously relied on the merge copying for it.
