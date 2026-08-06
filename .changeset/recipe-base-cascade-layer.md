---
'@bamboocss/core': patch
---

Fix a recipe's base styles losing to its variants under a condition, silently dropping hover, focus and dark-mode
styling.

Base rules were emitted into a nested `@layer _base` inside `@layer recipes`, with the variant rules unlayered alongside
them. A layer's own unlayered rules always beat its nested sublayers, whatever their selectors say — **layer order
outranks specificity**. So a base declaration written under a condition lost to an unconditional variant declaration
_even while the condition held_:

```ts
base: { boxShadow: '4px…', _hover: { boxShadow: '6px…' } },
variants: { color: { black: { boxShadow: 'none' } } }
```

`<Button color="black">` computed `box-shadow: none` at rest **and while hovering** — verified in Chromium. The hover
style was unreachable. The identical config expressed as a `cva` merges in JS and keeps it, so the two pipelines
disagreed on the same input.

Base rules now go into the recipe layer directly, ahead of the variants. In one layer the ordinary cascade applies
again: the conditional selector wins on specificity, and two equal-specificity declarations fall back to source order —
which is why base is emitted first, so an unconditional variant still overrides an unconditional base.

The emitted CSS changes for every config recipe: `@layer recipes { @layer _base { … } … }` becomes
`@layer recipes { … }` with the same rules in the same order, one level shallower. Slot recipes get the same treatment.
