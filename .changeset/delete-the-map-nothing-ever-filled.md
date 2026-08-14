---
'@bamboocss/core': patch
---

Delete a private `Map` in the layer assembly that nothing ever wrote to.

`Layers.utilityRuleMap` was declared, iterated once in `getLayerRoot('utilities')`, and populated nowhere — so the loop
body could never execute. Removing it and its loop changes no output; the `forEach` was over an empty map on every build
since it was written.

Worth recording how it survived, because the gap is general. Three static checks run in CI and none of them could see
this:

- **knip** has no class-member analysis at all in v6 — `--include classMembers` errors with "Invalid issue type". It
  existed in v5 and was dropped.
- **`tsc --noUnusedLocals`** reports a private member that is never _read_. This one was read.
- **`no-unused-private-class-members`** asks the same question, and oxlint does not implement it.

Every one of them answers "is this symbol referenced?". It was — by the loop. "Never written, therefore always empty" is
a dataflow property, and the only signal in the repo that can see it is coverage, which nothing ran.
