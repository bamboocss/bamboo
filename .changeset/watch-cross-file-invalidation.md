---
'@bamboocss/parser': minor
'@bamboocss/node': patch
---

Re-parse importers when a shared style file changes in watch mode.

Cross-file extraction folds an imported value into the importing file's output, so editing `styles.ts` had to re-parse
everyone importing it — watch only re-parsed and rebundled the changed file, leaving consumers emitting the previous
styles until the process restarted.

The parser now records a reverse dependency graph while parsing, covering both imports and re-exports, and exposes
`project.getDependents(filePath)` for the transitive set. Watch rebundles those alongside the changed file. Edges are
rebuilt on each parse, so removing an import stops forcing a rebuild of the file it no longer depends on.
