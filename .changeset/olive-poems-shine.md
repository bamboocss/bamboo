---
'@bamboocss/node': patch
'@bamboocss/parser': patch
'@bamboocss/vite': patch
---

Fix three things a multi-environment build, a watch rebuild, and a racing delete each broke.

**An SSR environment no longer fails the build.** `buildStart` fires once per environment, and it reset the whole
compilation session each time — so a framework building a client and an SSR bundle against one plugin instance had the
second discard everything the first established. `cssLoaded` went false, and an SSR bundle that legitimately never
imports the stylesheet (the client build emits it) failed the "not imported" check outright. The reset now happens per
_run_: seeing the same environment twice is what marks a new one. The lost-stylesheet guard is likewise scoped to the
environment that actually served the sheet, since only that one can lose it.

**A watch rebuild sweeps files it no longer generates.** `prune` ran only when the artifact list was unfiltered, and
every incremental rebuild passes a filter — so a pattern dropped from the config left its generated module behind,
resolving and returning class names for rules that no longer existed. Pruning now recomputes the complete list rather
than reading the written subset as the whole truth. A `codegen:prepare` hook that returns a subset still suppresses it,
because nothing can tell that apart from a hook adding artifacts.

**A file disappearing mid-build is skipped rather than fatal.** A file can vanish between being globbed and being read —
a watch rebuild racing a delete, a branch switch. It has no styles left to contribute, so it is not a build to fail.
Only `ENOENT` is swallowed.

Note on the second: recomputing the full artifact list costs work on every filtered rebuild that previously skipped it.
That is deliberate — a stale generated module that still resolves is worse than a slower rebuild.
