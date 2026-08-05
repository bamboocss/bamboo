---
'@bamboocss/core': patch
---

Look up a recipe node by name instead of scanning every recipe.

`recipes.details` is a getter that materializes the whole node list, so finding one by name built an array of every
recipe in the theme and then linear-scanned it. `baseName` is the key the node is already stored under, so `getNode`
reads it straight from the map.

Two callers did this: the parser, once per recipe-component usage in the source (via `Recipes.splitProps`), and
`staticCss`, once per recipe in the static config.

The lookup itself, against recipe count:

| recipes | scan   | map    |
| ------- | ------ | ------ |
| 2       | 16 ns  | 6.0 ns |
| 30      | 95 ns  | 6.0 ns |
| 120     | 288 ns | 6.3 ns |

It is flat where the scan is linear, so the saving grows with the size of the design system. The repo's `static-css`
benchmarks are unmoved by it, and should be: their config names one recipe, so a `process()` run does a single lookup —
tens of nanoseconds against a 52 µs operation.

`getNode` is deliberately not memoized, unlike the neighbouring `getRecipe`: the node map is module-level state that
`saveOne` and `remove` write to, so reading through keeps the freshness the scan had.
