---
'@bamboocss/generator': patch
'@bamboocss/vite': minor
---

A config recipe no longer names a class for a variant its config does not declare.

`createRecipe`'s transform was `${name}--${prop}_${value}` with no check that the variant exists, so any prop handed to
a recipe became a class:

```ts
button({ nope: 'x' }) // → "button button--nope_x"   ← no rule was ever emitted for it
button({ visual: 'bogus' }) // → "button button--visual_bogus"
```

The build emits rules only for values the config declares, so those classes styled nothing. `cva` already skipped them —
`getRecipeClassNames` checks the declared values — which left the two recipe kinds returning different class strings for
the same call.

Both now agree, and **the stylesheet is unchanged**: nothing backed those classes, so removing them removes only dead
markup.

Scalars only. A conditional or responsive value is an object of leaves and the leaves are what name classes, so those
pass through as before — including the case where a conditional variant on a recipe with compound variants throws, which
still throws where the author put it.

**This is what unblocks folding config recipes generally.** A lowering derived from the config can reproduce a class for
a declared variant, never for a key it cannot enumerate — so while the two runtimes disagreed, the fold had to restrict
itself to selections that provably held no undeclared key, meaning the output of `splitVariantProps`. With them in
agreement that restriction is gone, and a config recipe call lowers on the same terms as an inline one:

```tsx
const [variantProps, rest] = button.splitVariantProps(props)
cx(button(variantProps), className) // ✅ lowered
cx(button({ size })) // ✅ lowered — was declined before
```

The build-side resolver the transform uses for static recipe calls applies the identical filter, so folded output and
the browser continue to agree; a parity suite compares the two across defaults, multi-axis selections, compound variants
and conditional values.
