---
'@bamboocss/vite': major
---

Replace `renameCssAsset` with `pruneCss`. **Breaking:** `renameCssAsset` is removed;
`bamboocss({ renameCssAsset: false })` becomes `bamboocss({ pruneCss: false })`.

The option never controlled what its name said. Since 1.37.1, `renameCssAsset: false` skipped the _pruning_ as well —
because prune-without-rename is the stale-CDN failure the rename exists to prevent — so the flag's larger effect was the
one it did not mention. That mismatch had a cost: a project losing rules to the cross-environment pruning bug fixed in
1.37.13 reached for a rename flag to fix it, which worked, and left the real bug undiagnosed for eleven releases.

The two operations were never independently meaningful in either direction. Prune-without-rename is unsafe. And
rename-without-prune was already a no-op: `optimizeStaticCssAssets` returns early on `optimized === source`, so a sheet
nothing was removed from keeps its name because its bytes are unchanged. Renaming is a consequence of having changed the
bytes, not a feature. So the `rename` argument is gone from `optimizeStaticCssAssets` too, and the unsafe combination is
now unrepresentable rather than merely unreachable.

Setting the old name now throws instead of being ignored. Vite loads `vite.config.ts` through esbuild, which strips
types without checking them, so a removed option is not a type error to anyone who does not separately run `tsc` over
their config — it is a key that quietly stops doing anything. A project that set `renameCssAsset: false` because a
renamed asset breaks something downstream would otherwise have had both halves switched back on by upgrading, which is
the same class of silent reversal this whole change is about.

Pruning also no longer goes off in silence. A build with `pruneCss: false` prints one line saying so, matching the line
1.37.13 added for an environment that has not compiled yet, and the user's own setting is the one reported when both
apply. Four tests cover those branches; before this, deleting either line broke nothing.

`pruneCss: false` also declines more than `renameCssAsset: false` did, and this is a fix rather than a side effect. The
old flag ran the prune pass and then put the original bytes back, so the pass's assertion — every compiled class has a
rule in the sheet — still ran and could still fail the build. That made the escape hatch not an escape: 1.37.13's advice
to reach for it when reachability accounting goes wrong did not actually work. The whole pass is now skipped, so the
setting cannot fail a build over reachability. The cost is that a project running with it off forfeits that assertion,
which is the right trade for a switch whose purpose is to take this machinery out of the picture.

The documented reason to reach for it is narrower and more honest than "something cannot follow a renamed asset": what
pruning breaks is anything deriving an artifact from the stylesheet's _content_ during `generateBundle` before Bamboo
runs. Subresource integrity is the clear case — `integrity` is a digest of the bytes rather than a filename, so the
reference rewriting cannot carry it across, and a browser handed a stale digest refuses the stylesheet outright.
Renaming is irrelevant there; only declining to prune helps. Where such a consumer can be moved after Bamboo instead
(`order: 'post'`, `writeBundle`, `closeBundle`), the docs now say to do that and keep the pruning.

Emitted CSS is unchanged at the default, and `pruneCss: false` emits what `renameCssAsset: false` emitted.
