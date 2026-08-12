---
'@bamboocss/vite': patch
---

Stop the late CSS asset rename from crashing on a bundle entry without `referencedFiles`.

`optimizeStaticCssAssets` walks a bundle Vite hands the plugin, and rewrote `referencedFiles` on every chunk in it.
Rollup's type declares that field as required, so this typechecked, but the peer range is `vite: ">=5"` — which covers a
Rollup-compatible bundler — and any plugin can add a chunk-shaped entry to the bundle before the hook runs. Either one
produced `TypeError: Cannot read properties of undefined (reading 'map')` at the end of a production build.

- The list mirrors references the chunk's own code already carries, and those are rewritten separately, so an absent
  list means there is nothing further to update.
- Covered by unit tests that drive the function over hand-built bundles, including shapes Rollup does not produce. The
  end-to-end rename was previously only exercised against real Rollup, which cannot express this case.

Nothing else changes: the asset is still renamed to a hash of its pruned bytes, which is what keeps late reachability
pruning safe to cache.
