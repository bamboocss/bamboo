---
'@bamboocss/vite': patch
---

The fold reads a module's AST as often as it has questions to answer, rather than once per question it could have been
asked.

Profiling a dev server over 24 real HMR edits put ts-morph at 87ms per edit against 2.4ms of extraction, with half the
ts-morph time inside descendant iterators. Every `getDescendantsOfKind` and `forEachDescendant` visits each node in the
file and wraps it, so the cost is whole-tree reads. There were five, and none of them was conditional on the module
containing anything to find.

- The `cx` walk is skipped when the module imports no `cx`. `cxBindings` is a strict precondition of the loop body's own
  test, so an empty set made the walk's predicate constant-false.
- The `splitVariantProps` walk is skipped when the name cannot appear. It ran for _every_ styled module, because its
  `if (recipeSourceFile)` guard is true whenever the module holds any candidate at all.
- The runtime-binding scan reads its two node kinds from one traversal instead of two.
- `identifierIndex` walks compiler nodes and wraps only the buckets a caller reads. `SyntaxKind.Identifier` sorts below
  `SyntaxKind.FirstNode`, which is what ts-morph tests before it may search the parse tree — so for that kind it
  materialises the whole _token_ tree, every brace and comma, on the way to the identifiers. Parse plus index build
  measures 6.6x faster on 20KB of real tsx, and the deferral that used to protect most modules from it no longer does:
  `css` is not in `PERMITTED_BINDINGS`, so the index is built for every module importing `css`.

A styled module now pays no whole-tree reads where it paid two, and one where it paid five.

Output is unchanged, checked node-for-node rather than asserted: `identifier-index.test.ts` holds the index to the
output of the walk it replaced across every sandbox source file, and `fold-traversal.test.ts` pins the read counts so
they cannot drift back one walk at a time.

Two guards are text scans, and both are necessary conditions rather than sufficient ones — the name inside a comment
costs the walk it always cost. Both also have to allow a unicode escape through: `access.getName()` and
`Identifier.getText()` return the name as the compiler resolves it, so `badge.splitVariantProps(p)` matches while the
literal appears nowhere in the source. Guarding on the literal alone left that call unlowered against an erased binding,
and dropping JSDoc from the identifier walk lost names mentioned only in a `@type` annotation. Both are fixed and
pinned.
