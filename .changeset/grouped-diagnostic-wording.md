---
'@bamboocss/node': patch
---

Correct the `cssMode: 'grouped'` unresolved-value warning, which described the behaviour it had before the atomic
fallback landed.

It said the element "renders with no styles at all". It no longer does — the call falls back to naming each declaration
separately and keeps the ones the build could resolve. The warning now says that, and says what to do about it.
