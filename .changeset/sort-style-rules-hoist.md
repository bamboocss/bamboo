---
'@bamboocss/core': patch
---

Hoist the work `sortStyleRules` was repeating inside its comparator.

This runs on every build, for every project. The CSS emitted from extracted app source goes through
`Stylesheet.processDecoder`, and `StyleDecoder.collectAtomic` sorts before that — so every atomic style the extractor
finds is sorted twice, whether or not `staticCss` is configured. It is also on the fold's path, through
`filterClassNames`.

A comparison sort of N rules calls its comparator on the order of N log N times, so anything derived inside one is
recomputed roughly thirteen times per rule at the sizes a real project reaches. Three things were being derived per
comparison rather than per rule:

- `flatten` allocated a fresh array for **both** operands on every call. It now runs once per rule, ahead of the sort,
  and the comparator receives them already flattened.
- `sortCSSmq` ran six regexes and a length parse over each of its two query strings. Those facts are now derived once
  per distinct query and cached on the text, so two rules carrying the same breakpoint share the entry.
- `pseudoSelectorScore` scanned its seven-entry table per comparison, over a set of selectors that is small and repeats.

All three are pure functions of their input, so no comparison can return a different answer and the sorted order is
identical — the full suite passes unchanged, CSS output snapshots included.

Measured on 10,000 rules, against a control of the same sort with no conditions that held at 1.00x across the pair:

| sort                | before   | after   |         |
| ------------------- | -------- | ------- | ------- |
| at-rule conditions  | 26.854ms | 3.967ms | 6.77x   |
| selector conditions | 8.298ms  | 4.064ms | 2.04x   |
| no conditions       | 2.672ms  | 2.661ms | control |

What this is worth end to end is not certified. The workload that made the cost visible was a `staticCss` config large
enough to produce 13,350 atoms in a single rule set, and at the whole build level the effect read directionally positive
but the machine would not hold still long enough to put a number on it. Worth re-taking on an idle machine.

Adds `sort-style-rules.bench.ts`, which sorts a shuffled input rather than the decoder's already-ordered output. That
distinction is what hid the cost: a nearly-sorted array costs TimSort far fewer comparisons, and measuring it flattered
the comparator by about 4x.
