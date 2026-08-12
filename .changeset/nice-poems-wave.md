---
'@bamboocss/vite': patch
---

Resolve the query forms of `virtual:bamboo.css`, so `?url` works.

`import href from 'virtual:bamboo.css?url'` — Vite's convention for asking any CSS module for its URL rather than its
contents — did not resolve at all and failed as an unresolvable path. Neither did `?raw` or `?inline`.

The query is now carried onto the resolved id and the stylesheet is served for whatever it is, letting Vite's CSS
pipeline do what it already knows how to do rather than reimplementing it here. That also covers the `?transform-only`
import Vite's own `?url` handling generates against the already-resolved id, which is what made the first attempt at
this fail on an import nobody wrote.

Worth knowing before reaching for it: `?url` makes the stylesheet an asset of its own rather than part of whatever
stylesheet the importing module belongs to. That is what `?url` means rather than a shortcoming — but a project that
concatenates Bamboo's CSS into one global stylesheet does not want it, because it splits that back apart. It is for a
`<link>` you write yourself, a preload hint, or an href handed to something outside the bundler.
