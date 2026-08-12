---
'@bamboocss/vite': patch
---

Prune a merged rule per selector instead of keeping it whole.

The optimizer collapses rules sharing a body into one selector list, so an atom nothing can reach routinely ends up
beside a reachable one — `content: ""` is written by every `_before` and `_after` in a project, and they merge into a
single rule. Reachability judged the rule as a whole and skipped anything naming more than one class, so all of them
survived. That is dead CSS pruning exists to remove, and it grows with exactly the declarations that repeat most.

Each selector in the list is now judged on its own: unreachable ones are dropped and the rule is removed only when none
survive. On a rule merging twenty pseudo-element atoms of which two are reachable, that is 648B to 152B.

A selector naming more than one class is still left alone. A compound variant selects on classes the element already
carries, so no single atom owns the rule and dropping it would take a style the element still needs.
