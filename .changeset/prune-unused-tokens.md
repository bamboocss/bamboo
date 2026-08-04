---
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
---

Add `pruneUnusedTokens`, dropping token css variables nothing can reach.

The token layer declares every token in the theme. An app uses a fraction of them, so most of what it declares is dead
weight in the one stylesheet that blocks first paint. On the `vite-ts` sandbox, with the default preset, this takes
`styles.css` from 24,431 to 11,514 bytes — 6,401 to 3,325 gzipped. It scales with the size of the design system rather
than the app: `preset-bamboo` declares 432 variables, `preset-atlaskit` 837, `preset-open-props` 898.

It is **off by default** and changes nothing until switched on.

A variable is kept when the generated css references it, when a kept variable's own value references it, or when it is
named by `token()` or `token.var()` or a literal `var(--x)` anywhere under `include`. Tokens that javascript receives as
a reference rather than a literal — virtual tokens, and any token carrying a condition — are always kept, because
`token('colors.text')` hands the caller a `var()` whether or not the css mentions it.

Two limits are deliberate:

- Only custom properties the token system declares are eligible. `globalCss` output is never touched. `preset-base`
  declares the filter and gradient composition properties on the universal selector precisely so a parent's value cannot
  inherit into a descendant; they look unreferenced, and removing them would change rendering. The `styles.css`
  post-processing this option replaces does remove them.
- Reachability cannot be proven for every reference. A token used only from a stylesheet outside `include`, or by a
  separate package treating the output as design tokens, is invisible. Keep those with `staticCss`.

Pruning runs wherever a complete stylesheet is assembled — `bamboo`, `bamboo cssgen`, watch mode and the PostCSS plugin
— and never on a partial one such as `cssgen tokens`, where nothing would be left to reference the tokens. Collecting
the references reads every source file, so that work stays behind the flag.
