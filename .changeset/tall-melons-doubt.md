---
'@bamboocss/vite': patch
---

Match a class by its name rather than by how it happens to be spelled, so custom properties keep their rules.

The same class reaches the stylesheet either escaped or not. `--bottom-mask-size_16px` is a valid selector exactly as
written — a CSS ident may begin with `--` — while `esc` produces the escaped `\--…` form that reachability keys are
stored in. Every comparison in the reachability pass was on the raw spelling, so a key written one way missed a rule
written the other, and pruning removed the atom with its rule sitting in the stylesheet all along.

It could only affect names that need an escape — custom properties, vendor-prefixed properties, anything with a leading
dash — which is why it presented as every `--*` and `-webkit-*` declaration losing its rule at once while flat ones were
untouched, and why it appeared only under `hash: false`, where names are semantic rather than opaque.

Pruning, the retained-class check and the compact-name pass now all compare on the escape-free name. Stripping
backslashes is unambiguous, because a semantic atom name never contains a literal one.

Found from a user's build output rather than from a reproduction: the diagnostic added in 1.37.3 reported
`a rule exists under "--bottom-mask-size_16px"` against an escaped key, which named the mismatch exactly.
