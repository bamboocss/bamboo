---
'@bamboocss/node': patch
---

Cover `pruneUnusedTokens: 'strict'` against a real stylesheet, and pin that a failed rebuild reports itself.

Every existing test of the flag stubbed `pruneTokens` and asserted the arguments it was handed, which proves the
accounting decided correctly and nothing about what ships. No example app sets the flag either, so the path had never
run against a real sheet — which is why a throw swallowed by the file watcher survived to a reviewer: nothing executed
the code, only its inputs.

The new tests build a real sheet, prune it, and read the css: a resolved path keeps its token and drops the rest, a
bounded path keeps its category, an unresolvable path fails the build, and no `var()` in the surviving stylesheet is
left without a declaration behind it. The watch case is driven through `watchFiles` with a fake emitter, because the
defect lived in the wiring — a test of the extracted catch passes with that wiring deleted.

Still not covered, since a reader would otherwise assume it is: parser css never runs here, so recipe, slot and
composition layers are absent, and the non-failing decline branch — the warn-and-defer path that makes `strict` safe to
offer — has no css-level assertion.
