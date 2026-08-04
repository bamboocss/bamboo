---
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/shared': minor
---

Add `pruneUnusedTokens`, dropping token css variables nothing can reach.

The token layer declares every token in the theme. An app uses a fraction of them, so most of what it declares is dead
weight in the one stylesheet that blocks first paint. On the `vite-ts` sandbox, with the default preset, this takes
`styles.css` from 24,433 to 12,293 bytes — 6,398 to 3,504 gzipped. It scales with the size of the design system rather
than the app: `preset-bamboo` declares 432 variables, `preset-atlaskit` 837, `preset-open-props` 898.

It is **off by default** and changes nothing until switched on.

A variable is kept when the generated css references it, when a kept variable's own value references it, or when it is
named by `token()` or `token.var()` or a literal `var(--x)` anywhere under `include`. Tokens that javascript receives as
a reference rather than a literal are always kept, because `token('colors.text')` hands the caller a `var()` whether or
not the css mentions it. That covers virtual tokens, any token carrying a condition, and negative tokens — `spacing.-4`
resolves to `calc(var(--spacing-4) * -1)`, so what has to survive is the _positive_ token's declaration, not its own. So
is anything a theme refers to: a theme is a separate artifact injected at runtime, so nothing in the sheet points at
what it needs.

The negative-token rule is the one with a visible price, and there is no opt-out. A spacing scale generates one negative
per entry, so the whole scale is pinned whether or not the app uses it: on the default preset an app referencing a
single colour keeps 37 spacing variables, about a third of everything that survives. Presets with large spacing scales
therefore see less than the numbers above.

The walk follows any custom property, not only the removable ones. A colour palette is what forces that:
`colorPalette: 'red'` emits `--colors-color-palette-300: var(--colors-red-300)`, and those palette properties are
virtual, so stopping at them would leave the rule pointing at colours that had been removed.

Two limits are deliberate:

- Only custom properties the token system declares are eligible. `globalCss` output is never touched. `preset-base`
  declares the filter and gradient composition properties on the universal selector precisely so a parent's value cannot
  inherit into a descendant; they look unreferenced, and removing them would change rendering. The `styles.css`
  post-processing this option replaces does remove them.
- Reachability cannot be proven for every reference. A token named by a path the source does not spell out as a string
  literal — `token.var(key)` — one used only from a stylesheet outside `include`, or one consumed by a separate package
  treating the output as design tokens, is invisible. Keep those with `staticCss`.

Pruning runs wherever a complete stylesheet is assembled — `bamboo`, `bamboo cssgen`, watch mode and the PostCSS plugin
— and never on a partial one such as `cssgen tokens`, where nothing would be left to reference the tokens. Collecting
the references reads every source file, so that work stays behind the flag.
