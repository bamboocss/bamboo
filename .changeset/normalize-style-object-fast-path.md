---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Stop rebuilding style objects that are already normal.

Normalizing renames a shorthand to its longhand, expands a responsive array into a breakpoint object, and drops nullish
leaves. A flat object of plain values written in longhand needs none of the three — which is most of what `css()` is
handed — but it was still walked and rebuilt, with a path array allocated per key.

- Normalizing a flat object, measured through `mergeCss`: **-22% to -26%**, and **-28%** for one carrying twenty
  properties
- A flat `css()` cache miss end to end: **1825 → 1685 ns** (-7.7%)
- Class names are unchanged across a 27,000-object corpus

An object that does need normalizing pays for the check that found out, which measures between +2% and +7% depending on
how late the first dirty key appears. The nested case is around -4% overall, since the same objects tend to have flat
blocks inside them.

The result may now be the argument itself rather than a fresh object, so callers have to treat it as read-only. Every
one already does: merging accumulates into its own object, and `css.raw()` and `cva.raw()` clone at the boundary.
