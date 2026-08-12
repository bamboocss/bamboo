---
'@bamboocss/vite': patch
---

Walk a module's identifiers at most once while reporting surviving runtime bindings, and not at all when there is
nothing to look up.

`reportRuntimeBindings` ran two full identifier traversals of every module it was given. The first built an index for
the recipe-binding scan, above the loop that reads it — so a module declaring and importing no recipe, which is most of
them, paid for an index nothing read. The second was a separate pass looking for reads of a watched import, wrapping
every identifier in the file a second time to find at most a handful.

The index is now built on first use and shared, and the watched-import scan reads the buckets it needs out of it rather
than re-walking. A module with no recipe binding and no watched import now walks nothing; one with either walks once.

Nothing changes about what is reported. Survivors from the watched-import scan are sorted back into document order
before being recorded — grouping by name is an artefact of reading an index keyed on names, and these are read as a list
of positions to go and fix.

Measured on real Vite builds, three alternating A/B pairs each:

| app                                      | before              | after               | ratio              |
| ---------------------------------------- | ------------------- | ------------------- | ------------------ |
| 6,307 files, every module imports bamboo | 29.3 / 28.9 / 28.9s | 27.3 / 27.5 / 27.7s | 0.93 / 0.95 / 0.96 |
| 9,307 files, a third import nothing      | 33.7 / 34.1 / 34.3s | 30.6 / 31.3 / 31.3s | 0.91 / 0.92 / 0.91 |

So **5% off a build where the deferral never fires, 9% where it does** — the two halves of the change, separated.
Emitted CSS is byte-identical on both (3,611 bytes), asset names — which carry content hashes — unchanged, and the
compile summary the same in every arm.

`fold.bench.ts` moved within noise, controls included; it folds one module at a time, where a second identifier walk
over a small file is not resolvable against a ±5% band.
