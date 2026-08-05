---
'@bamboocss/generator': minor
'@bamboocss/parser': minor
'@bamboocss/core': minor
---

Export a `fallback()` helper from `styled-system/css`.

`fallback(...)` previously existed only as a string, which meant no import to discover, no autocomplete and no hover.
The helper builds the same string, so the two forms are interchangeable:

```js
import { css, fallback } from '../styled-system/css'

css({ height: fallback('100dvh', '100vh') })
css({ height: 'fallback(100dvh, 100vh)' }) // identical
```

The extractor evaluates the call, including under an alias (`import { fallback as fb }`). A project's own local
`fallback` function is left alone — only an identifier that resolves to a bamboo import is treated as this helper.

One case where the forms differ: a candidate built by another call, such as `token()`, cannot be resolved from inside
the helper. Use the string form there — `` `fallback(${token('sizes.4')}, 100vh)` `` — which interpolates before the
extractor sees it. The helper is not emitted for `syntax: 'template-literal'`.

The candidates are still not individually type-checked, the same trade the `[...]` escape hatch makes.
