---
'@bamboocss/vite': patch
---

Count a module once in the compiler's coverage summary, and print the summary once.

1.37.13 gave both plugins `sharedDuringBuild: true`, so one instance now serves every environment of a build rather than
one instance per environment. The summary's totals were accumulated as the transforms arrived, which was correct when
each environment had its own counters and is not correct now: both environments transform the modules they have in
common, which in a real app is most of them, and each of those was counted once per environment.

A fixture of one shared module and one entry each — three files, one `css()` call — reported:

```
Compiled 1/1 (100%) across 1/2 files      <- client, partial
Compiled 2/2 (100%) across 2/4 files      <- both, double-counted
```

It now reports `Compiled 1/1 (100%) across 1/3 files`, once. Coverage describes the source rather than how many times a
bundler handed the same file over, so results are kept per file and summed at the end, and the line waits for the last
environment the way the reachability judgements beside it already do.

Two things follow from keeping results per file rather than summing as they arrive.

**Dev stops inflating too.** Every HMR re-transform of a file counted as another file, so a long session's totals grew
without bound. They now describe the modules, however many times each was handed over.

**Waiting for the last environment is a build-only rule.** Dev satisfies its premise in name only: a resolved config
always lists both `client` and `ssr`, so a project configuring `builder` announces two environments — while the dev
server only ever starts the client one, since `perEnvironmentStartEndDuringDev` is off by default. Deferring to an
environment that was never going to start suppressed the summary outright, for exactly the framework projects that
configure `builder`. The gate is scoped to `command === 'build'`, and a test pins it.

Nothing about compilation changes — this is only what gets printed. The regression was cosmetic but misleading in the
one direction that matters for this number: a project reading the summary to find out how much of its source compiles
would have seen inflated file counts, and a partial line for the client scrolling past before the real one.

The summary is still skipped for a build that declares an environment it never builds, which is the same gap the
reachability judgements beside it have.
