---
'@bamboocss/core': patch
---

Make the naming-agreement check actually cover compound variants.

`checkNamingAgreement` fails a build when the stylesheet and the runtime derive different class names, and its recipe
canary has always carried a `compoundVariants` entry — with a comment saying the canary "has to carry one or that half
is unchecked". That half was unchecked.

A compound's rule selects on the classes the element already has, `.btn--size_sm.btn--tone_a`, and contributes none of
its own. The check compared class names: `filterClassNames` returns none for a compound, and the build side is then
narrowed to the runtime's set, so nothing about one survived on either side. Adding the compound to the canary changed
nothing that was compared.

That matters because a compound's selector is assembled from class names rather than produced by `createCss`, which is
exactly how it came to skip `hash.className` and `prefix` once already — rules emitted for `.btn--size_sm.btn--tone_a`
while the runtime asked for `.pfx-btn--size_sm`, every compound silently not applying, and the guard meant to catch it
reporting success.

The check now reads the compound's selector — `getAtomic` folds it into the rule's own style-object key, so a compound
is the rule whose key is something other than its class — and verifies every class it selects on is one the runtime
returns for the selection that activates it. Re-introducing the original defect now fails the check under `hash`,
`prefix`, and both together, and correctly still passes without them, where a raw name and a formatted one are the same
string.

`naming-agreement.test.ts` also states the invariant directly, across every combination of `cssMode`, `hash`, `prefix`
and `separator`: every class a compound selects on must be one the build emitted a rule for. It asserts a compound was
found before checking it, so it cannot pass on an empty list — which is how the canary went quiet in the first place.
