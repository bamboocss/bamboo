---
'@bamboocss/node': patch
---

Fix a watch rebuild keeping `@property` registrations a full build strips.

`pruneUnusedTokens: false` still drops the `@property` registrations a preset's utilities declare — those are not tokens
and the reachability problem the flag exists for does not apply to them. Three of the four build paths did that; the
watch rebuild skipped `pruneTokens` entirely, so the stylesheet you developed against carried a preset's whole filter
and gradient set while the one you shipped did not.

The conditional was written out four times, and two of the copies pointed at the one that had lost its `else` for the
reasoning. It is now a single `pruneTokensForBuild` that every path calls.

Also stop `runtime.fs.glob` from mutating `config.exclude` in place. `exclude: []` — the shape the examples in this
repository all use — had `'**/*.d.ts'` pushed onto the user's own array, so the second glob of a session saw a non-empty
exclude list and behaved differently from the first.
