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

Bounded twice over, because the cost of being wrong is a deleted file rather than a stale one. Only the directories a
codegen actually wrote to are read, so a directory bamboo does not generate into is never touched. Within them, only
files carrying an extension this codegen wrote _there_ are eligible: `patterns/` received `.mjs` and `.d.ts` files, so a
leftover `stack.mjs` is stale, while a `.gitignore`, a `README.md` or a `styles.css` is not the kind of thing bamboo
puts there and is none of its business. Subdirectories are left alone.

Reasoning from what was written, rather than from a list of known exceptions. A denylist has to name every file someone
might legitimately keep in an output directory, and the failure mode when it misses one is silent deletion — it missed
the `.gitignore` that ships inside a generated directory.

Skipped for a partial codegen and for a `codegen:prepare` hook that replaced the artifact list — neither can say what a
directory should contain, and reading a filtered list as the whole truth would delete every artifact it held back.
