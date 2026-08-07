---
'@bamboocss/core': patch
'@bamboocss/node': minor
---

Keep the token a custom property outside the token layer points at, and scaffold pruning into new projects.

`pruneUnusedTokens` decided reachability by following references found in the stylesheet. A custom property the token
system did not declare is never removed — it is not pruning's to remove — but it was only treated as reachable if
something else in the sheet referenced it. Exporting a value is precisely the case where nothing does:

```ts
globalCss: {
  ':root': { '--brand': '{colors.blue.500}' },
}
```

`--brand` survived; `--colors-blue-500` did not. The result was a `var()` with no declaration behind it, which resolves
to the guaranteed-invalid value — so a colour falls back to _inherited_ rather than to nothing. Silently wrong rather
than visibly missing, and invisible in a css diff unless you were looking for it.

Any custom property pruning will not remove is now a root of the reachability walk, so what it references is kept with
it. Costs nothing: measured byte-identical output across the website and every sandbox, none of which declares one.

`bamboo init` now scaffolds `pruneUnusedTokens` and `pruneUnusedKeyframes` as `true`, with a note on when to turn them
off. They stay `false` by default, so no existing project changes. A new project gets 50-60% off its stylesheet on day
one, when it has no styles yet and anything unexpected is immediately visible — measured 5,304 -> 2,213 bytes gzipped on
a stock Next.js app, 5,566 -> 2,601 on Remix, and 15,619 -> 13,017 on this repo's own docs site.

The config docs also now say which `token()` form actually needs `staticCss`: `token(key)` is safe for any path, because
javascript receives a literal for a plain token. It is `token.var(key)` that hands back a reference and needs the
declaration to survive.
