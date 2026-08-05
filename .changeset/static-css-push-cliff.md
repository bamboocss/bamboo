---
'@bamboocss/core': patch
---

Append rule results without spreading them into `push`.

`sorted.push(...withSelectorsOnly, ...withAtRules)` and the four `results.*.push(...)` calls in `staticCss` pass every
element as a separate argument. That is the quicker way to append while the array is small, and it stops being so
abruptly — measured here, per element:

| elements | ns/element |
| -------- | ---------- |
| 10,750   | 0.88       |
| 11,000   | 4.37       |

Past that it eventually throws rather than slowing down, because the arguments stop fitting on the stack. There is no
single size where that happens: ~124,000 from an empty stack, ~16,000 from nine thousand frames down.

Both sites are reachable on inputs that are large rather than absurd. A `staticCss` rule naming every utility with a
wildcard expands to ~15,000 objects against this repo's own fixture, and `sortStyleRules` — which runs on every build,
over every rule in the stylesheet — gets several times more from the same input.

Both now append with a loop, and the cost of that is real but small. Rules shaped like the ones in the real-world
benchmark append 87, 562 and 147 objects, and doing so with a loop takes `getStyleObjects` from 0.116 ms to 0.122 ms —
5% of a step that is a fraction of a millisecond inside a build measured in hundreds. In exchange the cost stays linear
at every size instead of inverting and then failing.

A threshold that kept the spread below a few thousand elements was the first attempt, and was dropped: it cannot make
the ceiling safe, only less likely to be met, and it left two branches where one is enough — including one where
appending an array to itself would not terminate.
