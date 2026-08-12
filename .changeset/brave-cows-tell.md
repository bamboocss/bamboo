---
'@bamboocss/vite': patch
---

Make the orphaned-class error say enough to diagnose without a second build.

A report of twelve orphaned classes — every one a CSS custom property or a vendor-prefixed name, so every one a class
whose leading dash needs escaping — could not be reproduced from the names alone, because the names looked identical on
both sides of the comparison. The error printed what was missing and nothing about why.

Each entry now says where it is missing from, which is what separates the two possible causes:

- `NOT extracted` — the atom was never emitted, so the mismatch is in what the compiler marked used;
- `in the extracted atoms; no rule in the sheet` — it was extracted but no rule survived, so the mismatch is in emission
  or pruning;
- `a rule exists under "…"` — a rule is present under a spelling this did not recognise, which points at escaping rather
  than at either of the above, and is invisible when only the missing name is printed.

The last one is the case that matters most and was the hardest to see: two names differing only in escaping look the
same in a list.
