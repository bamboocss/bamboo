---
'@bamboocss/generator': minor
---

Give `mergeCss` a shorthand-only table, so `cva` stops carrying the class-name map it never reads.

A bundle using only recipes is **33.9% smaller**: 6,769 → **4,477 B gzipped** on `sandbox/vite-ts`, measured as a
tree-shaken production build of an entry that calls `cva` and `cx`.

**Why it was there.** `cva` reaches `mergeCss` through `raw()` and `merge()` — properties on the object `cva()` returns,
so neither can be shaken away — and while class names and shorthands shared one table, that pulled the _naming_ half
into every bundle using recipes. It measured 2,786 B gzipped of a 6,769 B `cva`-only bundle: 41% of it, for a map the
recipe path never touches. `cvaFn` names classes through `getRecipeClassNames`, semantically, from the config.

**What it costs.** The two halves share every property name, so each now spells the property list. A bundle that still
calls `css()` at runtime grows by **93 B gzipped** — 8,453 → 8,546 B. That is the trade, and it points the right way: a
surviving `css()` call already costs 1,684 B for the engine behind it, and
[`strict`](https://bamboocss.com/docs/guides/source-transformation) exists to drive that count to zero.

No API change. `css.mjs` re-exports the merge, and `resolveShorthand` moves with it.
