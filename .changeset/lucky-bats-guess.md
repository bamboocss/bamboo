---
'@bamboocss/vite': patch
---

Rename the pruned stylesheet on Rolldown too, and never prune without renaming.

`[hash]` is expanded before `generateBundle`, so pruning after it leaves the name describing the unpruned bytes. A
change to _reachability alone_ — which is what a Bamboo upgrade is — then leaves identical source CSS under an identical
name with different content, and a CDN holding that key serves the old stylesheet past the deploy. One project hit that
twice and worked around it by versioning the filename itself.

1.35.4 disabled the rename under Rolldown because renaming dropped the asset there. That was the wrong half to keep: the
build still pruned, so Rolldown — which is every Vite 8 build — got exactly the unsafe combination.

Two changes:

- **The rename works on Rolldown.** Dropping the asset was caused by re-keying the `bundle` object, not by the rename.
  `fileName` is now mutated in place; Rollup and Rolldown both write an asset to its `fileName`, and the recorded
  references are carried across as before. Verified against real builds on both.
- **`renameCssAsset: false` now skips pruning as well.** The two are one operation. Shipping a larger stylesheet is a
  better failure than shipping a stale one, so where the name cannot move, the bytes do not either.

A project working around this by putting a release segment in the CSS filename no longer needs to.
