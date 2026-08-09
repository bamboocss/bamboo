---
'@bamboocss/vite': patch
---

Stop lowering config recipe calls whose selection is decided at runtime — it dropped responsive variants.

`1.26.0` extended the wrapper lowering from inline `cva` recipes to `defineRecipe` ones. That was unsound, and the
failure was silent:

```tsx
button({ visual: { base: 'solid', md: 'outline' } })

// runtime : "button button--visual_solid md:button--visual_outline"
// folded  : "button"
```

Both classes were lost, so a responsive variant rendered unstyled in a production build while working in dev.

**Why it cannot be patched.** The two recipe kinds resolve a selection differently. `cva` reads a variant value as a key
through `getRecipeClassNames`, so a conditional value finds no entry and names no class — which is exactly what the
`cvaPick` helper does, and why lowering an inline recipe is sound. A config recipe routes its selection through
`createCss`, which _expands_ a conditional into one class per condition. For a dynamic axis the build cannot know which
kind of value will arrive, so a table lookup is wrong whenever the caller passes a conditional — and responsive variants
are a documented, type-permitted feature of config recipes.

Unaffected: statically resolvable config recipe calls still fold, `buttonStyle()` with no arguments still folds, and
inline `cva` recipes — including the wrapper shape — still lower, because `cva` cannot take a conditional in the first
place.

The parity suite now evaluates the lowered expression against the recipe the codegen emitted for conditional and
responsive values, not scalars alone, which is what would have caught this.
