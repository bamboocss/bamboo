---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Assemble class names without the throwaway arrays.

Every style leaf of every `css()` cache miss built an array for the prefix, filtered it and joined it — and most configs
set no prefix, so that array only ever held the class it started with. Conditions were spread into a second array and
joined even when there were none.

- A flat `css()` cache miss end to end: **1710 → 1443 ns** (-15.6%)
- One with conditions and a responsive value: **2675 → 2589 ns** (-3.2%)
- Measured on the assembly alone, with the memo forced to miss: **+25%** flat, **+10%** with a condition, **+14%** with
  a condition and a prefix
- Class names are unchanged across a 27,000-object corpus, and across 43,008 combinations of prefix, class, condition
  and hashing

The prefix is now read once when the `css` function is built rather than per leaf. It is set in the `Utility`
constructor and the `utility:created` hook can only replace `toHash`, so there is nothing to re-read.
