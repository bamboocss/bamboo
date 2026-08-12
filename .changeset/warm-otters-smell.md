---
'@bamboocss/vite': patch
---

Stop caching ts-morph nodes across passes, which threw on a re-transformed module.

1.37.10 indexed a module's identifiers once instead of walking the tree per recipe binding, and memoized that index
against the source text — copying the cache beside it, which holds module-scope _names_. Strings outlive anything; nodes
do not. `addSourceFile` overwrites, and overwriting forgets every node previously taken from that file, so the next read
of a cached node threw `Attempted to get information from a node that was removed or forgotten`.

Identical text is the dangerous case rather than changed text: a changed file misses the cache and rebuilds, so this
only bit when nothing appeared to have happened — a watch rebuild, a second build environment, a re-request in dev.

The index is now built once per pass and handed to each lookup, which keeps the walk-once win without holding nodes
between passes. A test re-transforms byte-identical source three times and fails with that exact error when the cache is
restored.
