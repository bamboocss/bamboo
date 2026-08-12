---
'@bamboocss/vite': patch
---

Normalize what config loading throws, in both hooks that reach it during dev.

`ensureContext` loads and evaluates the user's config file and its hooks, so what it throws is outside this plugin's
control — and `buildStart` and `transform` both awaited it unguarded. A primitive from there still reached Vite's dev
error middleware, which puts what it is handed into a `WeakSet` and throws `TypeError: Invalid value used in weak set`
on anything that is not an object, replacing the real failure.

This is the last serve-path entry point that was not going through `asError`; `transform`'s fold and the virtual
stylesheet's `load` were covered in 1.36.2 and 1.36.3.

Worth knowing when a weak-set error persists after this: the value can also arrive from a middleware that is not
Bamboo's. A stack whose frames pass through another plugin's request handler before `viteErrorMiddleware` means that
handler forwarded a non-object to `next()`, and no amount of normalizing here can reach it.
