---
'@bamboocss/core': patch
'@bamboocss/extractor': patch
---

Fix three smaller defects found while investigating recipe cascade ordering.

**`inferSlots` collected variant values as slot names.** `variants` nests one level deeper than `base` does —
`{ size: { sm: { root: {…} } } }` — and the inference read the keys of `{ sm: … }`. A slot recipe with a `size.sm`
variant grew a phantom `sm` slot, and rules were emitted for it.

**`processAtomicSlotRecipe` mutated the config it was given.** It assigned the inferred slot list back onto
`recipe.slots`, and that object is the extractor's own `ResultItem.data`, so the config stayed changed for everything
downstream. It now works on a copy. Snapshots that recorded a `slots` key the source never declared have been updated.

**A non-static string concatenation produced a wrong value rather than no value.** `css({ padding: '2' + n })` with an
unresolved `n` extracted as the literal `'2undefined'` — not an unresolvable box and not a dropped key — and reached the
stylesheet as `.p_2undefined { padding: 2undefined }`. The evaluator's fallback stringifies an operand it could not
resolve; that result is now treated as unresolved. A concatenation the build _can_ resolve is unaffected.
