---
'@bamboocss/core': patch
---

Remove empty nodes in one pass per container, instead of one sibling scan per removal.

`postcss-discard-empty` removes each node through `Node.remove()`, which postcss resolves with `Container.removeChild` —
an `indexOf` over the parent's children, then a splice. That is linear per removal, so a pass costs removals × siblings.
Hand-written CSS never notices. A generated stylesheet does: every condition's block sits under one cascade layer as a
sibling of every other, and `mergeRules` runs immediately before, leaving empty `@media` shells behind. A 663 kB sheet
reaches this pass with 6,005 shells under one layer, so both factors grow with the config and the cost is their product.

Measured over a sibling group half of which is empty, against a parse-only control, all three interleaved in one process
and taken as best of seven:

| siblings | control | before  | after  | before/control | after/control |
| -------- | ------- | ------- | ------ | -------------- | ------------- |
| 8,000    | 8.5ms   | 26.8ms  | 18.8ms | 3.2×           | 2.2×          |
| 16,000   | 11.8ms  | 54.0ms  | 29.0ms | 4.6×           | 2.5×          |
| 32,000   | 25.7ms  | 369.0ms | 53.9ms | 14.4×          | 2.1×          |

The last two columns are the point rather than the speedup: the replacement stays a fixed multiple of the control across
the range, the way a linear pass does, and what it replaces does not.

Output is byte-identical — same predicate, same depth-first order, and the same `raws.before` transfer `Root` performs
when a first child is dropped. `discard-empty.test.ts` pins all of that against upstream, which stays as a devDependency
for exactly that purpose.

`optimize-css.bench.ts` could not have caught this. Both of its cases are well-formed throughout, so the removal pass
walked them and removed nothing; it now carries a case that arrives the way a real sheet does, each paired with a
size-matched control that has nothing to remove.
