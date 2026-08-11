---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/vite': minor
---

Add opt-in Vite static composition for globally deduplicated recipe and utility declarations.

The compiler now resolves `css`, `cva`, `sva`, config recipes, and statically analyzable `cx` composition to symbolic
style sets before allocating classes. Production builds can omit legacy recipe layers, prune unreachable source-graph
atoms, compile finite runtime recipe selections into reduced decision tables, and use deterministic or build-local
compact class names. Strict graph checks prevent a transformed class from being emitted without corresponding CSS.
