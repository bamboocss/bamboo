---
'@bamboocss/shared': minor
'@bamboocss/node': patch
'@bamboocss/generator': patch
'@bamboocss/vite': patch
---

Cap the diagnostic lists, and group a dead call by the binding rather than by the file.

A build error's job is to name the mistake, and every list in one was joined whole. A pattern dropped from a preset and
called across an app produced **400 identical blocks and 1,221 lines of stderr** carrying one line of information, with
the paragraph explaining the failure scrolled off the top. The same error is now six lines:

```txt
ERR_BAMBOO_DEAD_IMPORT: 400 call(s) name a binding that does not exist:

`stack` is not a pattern — `../styled-system/patterns` does not export it.
  400 file(s): src/comp-0.tsx, src/comp-1.tsx, src/comp-10.tsx, src/comp-100.tsx, src/comp-101.tsx, … and 395 more

Both entrypoints are generated from your config, so what they export moves when it does — …
```

Grouping is by the binding because that is the unit of the mistake; two distinct dead bindings stay two findings. Files
within a group are deduplicated, since one module can call the same one twice.

The other three unbounded lists are capped rather than grouped, each carrying a distinct message with nothing to
collapse: files that could not be extracted, unresolved token values (25, being one line each), and the `failOnUnfolded`
survivor list. In every case the count is of what was withheld, and a list that fits is joined exactly as before.

`truncateList` and `groupBy` are exported from `@bamboocss/shared`.
