---
'@bamboocss/node': patch
---

Stop token accounting from materializing the token tree to find identifiers.

`SyntaxKind.Identifier` is 80 and sorts below `SyntaxKind.FirstNode` (167), the boundary between tokens and parse-tree
nodes. ts-morph therefore cannot search the parse tree for it and falls back to building the whole **token** tree — and
`usedAsValue` asked once per name, so a file was re-scanned in full for every binding the pass enquired about.

Replaced with a raw `ts.forEachChild` walk that tests the name on the compiler node and builds a ts-morph wrapper only
for the survivors, which is the expensive half. Measured at 18.8x on the pattern actually changed (177ms to 9.4ms across
400 real source files, same 565 nodes found), and 27.7x for the identifier scan alone.

Behaviour is unchanged, including the part that is easy to get wrong: `ts.forEachChild` does not descend into JSDoc
while `getDescendantsOfKind` does, and 72 of the 1,116 source files here carry an identifier visible only that way.
Dropping those would not have declined or accounted anything — the reference would simply not exist, and the artifact
would prune as though the file never mentioned the token. The JSDoc descent is restored explicitly and pinned by two
tests that fail without it.
