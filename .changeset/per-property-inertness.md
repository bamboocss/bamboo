---
'@bamboocss/vite': minor
---

Lower inline recipe calls whose selection could run something, instead of declining them.

`badge({ tone: getTone() })` used to keep the whole recipe. The reasoning was sound for folding to a literal — that
deletes the argument, so `getTone()` would never run — but it was applied to the wrong path. Lowering does not delete
the expression; it re-emits it as the helper's argument:

```ts
const cls = 'cva_1a2b3c' + cvaPick(getTone(), { info: ' cva_1a2b3c--tone_info', warn: ' cva_1a2b3c--tone_warn' })
```

`getTone()` runs exactly once, where it did before. The call is preserved **and** the recipe config still leaves the
bundle.

Inertness is now decided per property rather than for the whole argument. A property whose expression could run
something always takes the runtime path — never resolved to a literal, even when the build _can_ resolve it, and never
dropped for naming no variant, since either would delete the call.

Cases that still decline, so that nothing an expression would have run is lost:

- More than one property could run something, and their relative order would change. `badge({ size: a(), tone: b() })`
  where the config declares `tone` first would evaluate `b()` before `a()`.
- A property that could run something names no variant the config declares — there is no term to re-emit it into.
  Checked as an own key, so `badge({ __proto__: pick() })` and `badge({ toString: pick() })` decline rather than
  appearing to name a real variant and then being dropped.
- The same key written twice. The value is last-wins, but an earlier expression still runs, so emitting only the winner
  would delete it. A type error in TypeScript, reachable in the `.js` and `.jsx` this transform also handles.

Separately, the fold's copy of the runtime's variant-skip condition now makes the same own-key check, so
`badge({ tone: 'toString' })` emits no class rather than one the runtime never produces and no rule backs.

Measured across an application with 1,752 inline recipe invocations, against the previous release:

|                          | before        | after             |
| ------------------------ | ------------- | ----------------- |
| invocations lowered      | 82.2%         | **99.7%**         |
| bindings lowered in full | 1,024 / 1,271 | **1,266 / 1,271** |
| recipe config freed      | 62.0 kB gzip  | **76.9 kB gzip**  |

Of the 307 call sites the old rule blocked, 297 have a single effect-bearing property and the remaining 10 already agree
with the config's order — so none are lost to the ordering rule.
