---
'@bamboocss/core': patch
'@bamboocss/vite': patch
---

Diagnose unresolved composition values instead of failing late with the wrong advice.

A composition value spelled with a slash — `mixin: 'text-ol/regular'` — is a membership question against a closed
vocabulary, but the unresolved-value warning's identifier gate rejected the slash before consulting the enumeration. A
misspelled mixin therefore warned nowhere, produced no rule, and surfaced only at the end of a production build as a
class the compiled output names with no rule behind it — reported, wrongly, as a stale-generation problem to file as a
compiler bug.

- The warning now fires for a missing member of any slashed vocabulary, exactly like a dotted token path, and stays
  silent where a vocabulary has no slashed members, since CSS spells real values that way.
- The output guard's error now distinguishes its two situations. When every orphaned class was extracted, the guidance
  points at the value that generated no declarations and at `unresolvedToken: 'error'` for failing fast at the call; the
  rebuild-your-outputs and report-a-bug guidance is reserved for the mixed-generation case it was written for.
