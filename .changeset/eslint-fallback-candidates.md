---
'@bamboocss/eslint-plugin': patch
---

`no-escape-hatch` now looks inside `fallback(...)` candidates.

The rule tests whether the value as a whole is an escape hatch, and a fallback wraps its candidates — so
`fallback([stretch], 100%)` slipped past it even though `[stretch]` is exactly what the rule exists to catch. Each
candidate is now checked on its own.

No autofix is offered in that case: the existing suggestion strips the first and last character of the value, which
would leave `allback(...` behind. The report still points at the value.
