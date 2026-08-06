---
'@bamboocss/shared': patch
---

Add `knownGroups` to `createCss`, so a grouped call the build never saw can fall back to atomic class names instead of
returning a class with no rule behind it.

Grouping names a class after a whole `css()` call, which means the build has to have seen that exact call to emit its
rule. When it has not — a value it could not resolve, a combination it declined to enumerate — the element renders with
**no** styles rather than losing a single declaration.

Given the set of group classes the build actually emitted, the runtime now notices the miss and names each declaration
atomically instead. That is not a complete recovery: an atomic class only helps where a rule for it exists. But it
degrades to the partial styling `cssMode: 'atomic'` would have produced, rather than to nothing.

The fallback shares its naming with the atomic branch, so a group that misses is named exactly as `cssMode: 'atomic'`
would have named the same object — two spellings could drift, and the fallback would then reach for rules the stylesheet
does not carry. Declarations are collected during the existing walk but not transformed until a miss actually happens,
so a hit costs a set lookup rather than the naming work it avoids.

Omitting `knownGroups` leaves the runtime exactly as it was, at no cost. Membership must be exact: a probabilistic
structure trades a false positive for size, and a false positive here returns a class with no rule — the failure this
exists to remove.
