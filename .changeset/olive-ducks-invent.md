---
'@bamboocss/vite': patch
---

Stop reachability pruning from deleting the rules behind multi-declaration conditional styles.

A folded call reports one entry per call site, and a call producing several atoms reports them **space-joined**.
`markClassUsed` escaped that whole string as a single key, so it matched no class, every atom in it stayed unmarked, and
reachability pruning removed their rules. The class names still reached the JS and the markup, the stylesheet was still
emitted and still carried its marker, and the build exited 0 — the elements simply rendered unstyled. It was found by
grepping a shipped bundle.

The damage followed declaration count rather than condition type, which is what made it look categorical:

- `content` almost always travels with another property, so **every** `::before` and `::after` rule disappeared from one
  application's stylesheet.
- A single-declaration `_hover`, `md:` or `[data-…]` is one atom and survived; the multi-declaration ones did not.
- An atom that PostCSS had merged into a multi-class selector escaped the prune by accident, because a rule carrying
  more than one class is skipped — which left some rules standing and others gone under the same condition.

`allocateClassString`, in the same object, already split on spaces. `markClassUsed` now does too.

Two things now make this class of bug loud rather than silent:

- **The pruned sheet is verified against what the compiler emitted.** Any compiled class left without a rule fails the
  build and names the classes. It also rejects a malformed reachability key outright — a class name cannot contain
  whitespace, and an entry that does stands for atoms that are about to be pruned. That second check exists because the
  first one alone did not catch this bug: the malformed key matched nothing in the prunable set and was skipped.
- **Conditional atoms are covered by a real Vite build.** The existing assertions matched `` `.${token} {` ``, which
  only ever matches a flat rule, so no conditional atom was checked by anything. The new test asserts both directions:
  every condition has a rule, and every class emitted into the JS has a selector.
