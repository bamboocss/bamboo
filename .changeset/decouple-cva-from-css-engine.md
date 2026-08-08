---
'@bamboocss/generator': minor
'@bamboocss/core': minor
---

Split `mergeCss` and the utility table out of `styled-system/css`, so `cva` no longer imports the `css()` engine.

`cva` needs exactly one thing from `css.mjs`: `mergeCss`, to resolve shorthands while merging a base with its active
variants. Importing it pulled in `createCss`, `cssLeaf`, `viewTransition` and the property→className table alongside —
which meant `css.mjs` could never be tree-shaken out of a bundle using recipes, however completely
[`@bamboocss/vite`](https://bamboocss.com/docs/guides/source-transformation) folded that bundle's `css()` calls away.

Three modules now, where there was one:

| module              | holds                                                    |
| ------------------- | -------------------------------------------------------- |
| `css/utilities.mjs` | the utility table, `classNameByProp`, `resolveShorthand` |
| `css/merge-css.mjs` | `mergeCss`, `assignCss`, `mergeCssUncached`              |
| `css/css.mjs`       | `css()`, `cva`-independent, re-exports the merge         |

**No API change.** `css.mjs` re-exports `mergeCss`/`assignCss`/`mergeCssUncached`, so every import that worked before
works now.

**No cost today, and a measurable one avoided.** The obvious version of this — giving `mergeCss` its own shorthand-only
table — measured **+402 B gzipped**, because the naming half and the shorthand half share every property name and
splitting spells the list twice. Sharing one table between the two readers instead, the `vite-ts` example app went from
221.24 kB / 70.83 kB gzipped to **220.79 kB / 70.62 kB**, with byte-identical CSS.

**What it enables.** Once every `css()` call in a bundle folds, `css.mjs` — 1.3 kB gzipped of engine — can now drop out
of it, where before `cva` held it in. That is the point of the change; it does nothing on its own.
