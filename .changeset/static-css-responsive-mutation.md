---
'@bamboocss/core': patch
---

Stop `staticCss` rules with `responsive: true` mutating the config they came from.

Appending the breakpoints to a rule's `conditions` pushed into the array in place. The `|| []` default only stands in
when the field is absent, so a rule setting both `conditions` and `responsive` had the user's own array grown — and both
callers of `process` pass `ctx.config.staticCss` itself, so it grew again on every run:

```
before:  ["light"]
after 1: ["light","sm","md","lg","xl","2xl"]
after 2: ["light","sm","md","lg","xl","2xl","sm","md","lg","xl","2xl"]
```

Under `recipes: '*'` the rule being destructured is the recipe's own `variantKeyMap`, so a recipe with a variant named
`conditions` had that variant's list of values appended to instead — and `variantKeyMap` is module-level state that is
stringified into the generated recipe artifact, so the damage reached emitted code.

Affected the `css`, `patterns` and `recipes` forms alike. Nothing covered `responsive` before this; every example in the
docs sets it on a rule with no `conditions`, where the default hid the aliasing.
