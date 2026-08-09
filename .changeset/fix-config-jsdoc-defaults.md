---
'@bamboocss/types': patch
---

Correct two stale `@default` annotations on `Config`, which shipped in the published types and showed the wrong value in
editor IntelliSense.

- `cssVarRoot` documented `':where(:host, :root)'`; the resolved default is `':where(:root, :host)'`.
- `importMap` documented a `jsx: 'styled-system/jsx'` entry, which no longer exists — the JSX factory was removed — and
  omitted the `tokens` entry the default actually carries.
