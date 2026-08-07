---
'@bamboocss/extractor': patch
---

Follow imports without a TypeScript type checker, fixing a large extraction slowdown in 1.17.

1.17.0 taught the extractor to resolve a style helper called from another module, by handing the evaluator a TypeScript
type checker. Asking for a single symbol makes TypeScript bind and check the **entire program**, every reachable `.d.ts`
included — so the cost is paid once by the whole build and grows with the size of the codebase rather than with the
number of style calls.

Measured on a 400-file project, `bamboo cssgen` end to end:

|             | user CPU | peak RSS |
| ----------- | -------- | -------- |
| 1.16        | 1.31s    | 386 MB   |
| 1.17        | 2.12s    | 504 MB   |
| this change | 1.31s    | 388 MB   |

A project reported extraction going from 2.6s to 14.3s and peak build memory rising 2.45 GiB, enough to OOM a 7.8 GiB CI
runner. That report attributed it to the slot-recipe folding in the same release; that change lives in
`@bamboocss/vite`, is off unless `transform` is set, and never runs under the PostCSS plugin. This is the actual cause.

None of the checker was necessary. Following an import is two cheap steps this package already had — resolve the
specifier to a file with `ts.resolveModuleName`, a path lookup, then read that file's exported declaration — and the
evaluator resolves everything _within_ a module by walking scopes on its own. Crossing the import boundary was the only
thing the checker was doing, and `resolve-imported-value.ts` now does it directly.

Resolution is attempted only after an evaluation has already failed. Everything that resolves today does so on the first
attempt, so no working call pays for it, and an expression reaching an unresolvable import was dropped outright before —
so nothing that pays for it was working.

Behaviour is unchanged, including the project boundary: a call into `node_modules` is still left alone, because a
dependency's code is not ours to run at build time. The tests that pinned the 1.17 behaviour pass untouched.

The benchmark that should have caught this could not: `extract-speed` runs one inlined sample through a project holding
nothing else, where checking the whole program is free, and it measured **0%** difference across the regression.
`cross-file-cost.bench.ts` now works over a project of 60 files instead. It is a tripwire rather than a measurement —
reintroducing the checker slows the inline _control_ by 44% and takes `rme` from ±0.75% to ±11.9%, because the cost
lands as GC pressure across the process — and its docblock says so, and says that peak RSS over a real project is the
signal that actually resolves this class.
