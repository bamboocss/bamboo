---
'@bamboocss/node': minor
'@bamboocss/shared': patch
---

`pruneUnusedTokens: 'strict'` now fails the build on a reference it cannot resolve, instead of warning.

`strict` is an assertion — you are stating that every token path in the project resolves at build time. When that turned
out to be false it printed a warning and quietly kept every token declaration, which leaves you believing the layer was
pruned when it was not. That is the same silence the flag exists to remove.

Only that one fails. Everything else is **reported** and keeps the layer exactly as the default would — a `.vue` or
`.svelte` component stored post-transform, a file it could not parse, a barrel it cannot classify, a dynamic `import()`.
Those reasons exist because declining used to be free, so the accounting declined anything it could not prove; several
of them have nothing to do with tokens, and failing a build over a route-splitting `import()` would be indefensible.

A failed _rebuild_ now reports itself too. A throw inside a watch callback was discarded by the file watcher, surfaced
as an internal `Unhandled rejection`, left the exit code at 0, and was invisible at `logLevel: 'silent'`.

The error is `TOKEN_REFERENCE_UNRESOLVED`, and names every unresolved reference with its file and line.
