---
'@bamboocss/generator': patch
---

Name a config recipe's classes by lookup when its variants are scalars.

Every config recipe call rebuilt its class string through `createCss` — merge defaults, filter against the variant map,
walk conditions, prefix, hash — to arrive at the recipe's own class plus one per selected variant. That is what
`getRecipeClassNames` already returns for an inline `cva`, so a scalar selection now takes the same route.

Measured on a three-variant recipe, in one run so the two share a machine:

| path                        | before     | after                    |
| --------------------------- | ---------- | ------------------------ |
| scalar variants, unmemoized | 720,958 hz | 2,278,994 hz (**3.16x**) |
| conditional variant         | 569,009 hz | unchanged                |
| memoized re-call            | 11.5M hz   | unchanged                |

The gain lands on a `memo` miss — the first call for each variant combination — since a hit never reaches the body at
all. So it is cold render and variant-heavy trees that get it, not steady-state re-renders. `packages/generator`'s
`recipe.bench.ts` is new: nothing covered the config recipe path, and `cva.bench.ts` covers only the inline one.

Responsive and conditional variants are untouched: `button({ visual: { base: 'solid', _hover: 'outline' } })` still
resolves through `createCss`, because its classes carry condition prefixes a lookup cannot build. The gate is "no
object-typed value", which also routes `null` — kept by `compact` — down the same path it took before.

A side effect worth having: the build's fold and the browser now derive a config recipe's class names from one function
rather than two. That duplication is what `naming-agreement.ts` exists to police, and there is one less of it.

Emitted css is unchanged, and so are the class names — verified against the generated artifacts and byte-identical
cssgen on an example app.
