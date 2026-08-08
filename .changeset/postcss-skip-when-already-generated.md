---
'@bamboocss/node': patch
---

Stop the PostCSS plugin injecting a second copy of the stylesheet into a file that already imports it.

`isValidRoot` reads only the `@layer` statement, and that statement is ordinary CSS — listing every layer in order is
what a project has to write once it has layers of its own beside Bamboo's. So this file satisfies the guard while
already holding the sheet:

```css
@import '#app/styled-system/styles.css'; /* copy 1 — inlined by postcss-import first */
@layer reset, base, tokens, recipes, utilities, overrides, syntaxHighlighter; /* triggers copy 2 */
```

Vite puts `postcss-import` at the front of the chain, so the `cssgen` artifact is inlined before any plugin runs.
`isValidLayerParams` then sees all five Bamboo layers among the seven names, returns true, and `write` appends a freshly
generated copy. The config is correct; the guard was wrong.

`write` now checks for the `--made-with-bamboo` declaration that `generateGlobalCss` emits unconditionally, and skips
with a warning when generated CSS is already present. A declaration rather than a comment, because the copy already in
the root may have been minified before this runs and comments do not survive that — which also makes it a better signal
than the markers added in 1.20.1, so those are gone again.

**Why it went unnoticed**

The duplication does not look like duplication by the time it ships. A minifier merges the two `@layer X{}` blocks and
dedupes most of the collision; what survives is what it cannot merge — rules nested inside `@media`, `@supports` or
`@scope`, where each copy contributes its own sub-block, plus top-level pseudo-element rules split out of selector
lists. On one production stylesheet that residue was 402 rules and 21 kB: 11% of the file, reading as a rounding error
rather than as the whole sheet twice.

If you have both an `@import` of `styles.css` and the `@layer` statement, keep one. The warning now says which.
