---
'@bamboocss/core': patch
---

Expand `staticCss` conditions without rescanning the condition list.

Two things in the same inner loop, which runs once per condition per computed value:

- `formatCondition` asked whether a name is a known condition with `Array.prototype.includes` over
  `Object.keys(config.conditions)`. The base preset alone declares 107 of them, and a container query — never in that
  list — scanned all 107 before missing. It reads a `Set` now.
- `getConditionalValues` spread its accumulator per condition, building a fresh object of growing size for each. It
  assigns into one object now.

Rule expansion, measured on its own rather than through `process()`, which is dominated by encoding and css generation:

| rule (40 values)        | before     | after      |        |
| ----------------------- | ---------- | ---------- | ------ |
| five interactive states | 32,620 hz  | 300,303 hz | 9.2x   |
| four container queries  | 43,625 hz  | 325,252 hz | 7.5x   |
| no conditions (control) | 725,933 hz | 737,085 hz | 1.015x |

`static-css-real-world.bench.ts` now carries those three cases, the last as the control — they are the only benchmarks
that isolate this from the rest of a `process()` run.

Output is unchanged, key order included. A condition named `__proto__` is still defined rather than assigned, so it
stays an own key instead of reparenting the object it lands on.
