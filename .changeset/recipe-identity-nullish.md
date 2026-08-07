---
'@bamboocss/shared': patch
---

Fix an inline `cva`/`sva` losing every style when a declaration has no value.

The same divergence as the whitespace fix, reached a second way. Extraction drops a nullish declaration, so

```ts
cva({ base: { color: undefined, padding: '4' } })
```

is recorded as `{ base: { padding: '4' } }` and the stylesheet emits a rule under that name. The browser hashes the
config as authored, keeps the `color` key, and derives a different name — so the element carries a class no rule matches
and renders with **none** of the recipe's styles. `null` behaves the same way.

Reaching it does not take anything exotic: a placeholder left in place, or spreading an object that happens to hold an
undefined value.

The identity now omits nullish declarations before hashing, matching what the build records. Build-side names are
unchanged, so no emitted CSS moves; only the browser's derivation moves onto them. A config whose `base` is entirely
nullish now hashes as an empty one, which is what the build already emitted for it.

Found by comparing the two derivations directly across a spread of value shapes, which is now a test —
`recipe-identity-agreement.test.ts` parses each shape as a real file and checks the extracted config and the authored
one hash alike. It covers numbers, floats, negatives, template literals, escape sequences, empty strings, booleans,
responsive arrays including one with a hole, deeply nested conditions, numeric variant keys, and nullish declarations
nested inside variants and compound variants.

That file exists because `checkNamingAgreement` structurally cannot cover this: it compares the two derivations for one
fixed canary, so it sees divergence in the shared naming logic and nothing about how a particular call site was written.
Both bugs of this shape were invisible to it.
