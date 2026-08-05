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

The extractor evaluates the call, including under an alias (`import { fallback as fb }`), so the value reaching `css()`
is the same literal either way. A project's own local `fallback` function is left alone — only an identifier that
resolves to the `styled-system/css` import is treated as this helper.

The candidates are still not individually type-checked, the same trade the `[...]` escape hatch makes.
