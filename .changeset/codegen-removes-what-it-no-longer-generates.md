---
'@bamboocss/node': patch
'@bamboocss/types': patch
---

Delete artifacts codegen no longer generates, instead of leaving them on disk.

Codegen was write-only. An artifact that stopped being produced stayed where it was: dropping a pattern from the config
rewrote `patterns/index.mjs` without it and left `patterns/stack.mjs` beside it. Importing through the barrel then
failed loudly, which is fine — a deep import resolved, ran, returned a class name and emitted no css. A stale artifact
is worse than a missing one, because it answers.

`--clean` was the only sweep, and it empties the whole directory rather than reconciling it.

Scoped to the directories a codegen actually wrote to, so a directory bamboo does not generate into is never read.
Within them the produced file list is exhaustive by construction, which is what makes the question decidable without
keeping a manifest. Subdirectories are left alone, as are the files codegen does not own: `styles.css` comes from
`writeCss`, and `package.json` is co-owned with `emit-pkg` and with whoever edits it.

Skipped for a partial codegen and for a `codegen:prepare` hook that replaced the artifact list — neither can say what a
directory should contain, and reading a filtered list as the whole truth would delete every artifact it held back.
