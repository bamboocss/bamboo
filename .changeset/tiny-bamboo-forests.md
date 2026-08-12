---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
---

Replace Vite's runtime styling and named-recipe output with mandatory whole-program compilation.

The compiler resolves `css`, `cva`, `sva`, config recipes, static `viewTransition` bags, and statically analyzable `cx`
composition before allocating classes. Recipe identity no longer enters declaration identity, so identical declarations
share one global atom across every API and source file. Production builds omit recipe layers, prune unreachable graph
atoms and transition rules, compile finite runtime recipe selections into reduced decision tables, and use deterministic
or build-local compact class names. Compilation now runs in development too, and unresolved runtime styling is always an
error. The former transform, partial-folding, runtime-fallback, and opt-in compatibility options have been removed.
