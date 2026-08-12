---
'@bamboocss/vite': patch
---

Normalize thrown values in the virtual stylesheet's `load`, not only in `transform`.

1.36.2 wrapped non-`Error` throws from the module transform, but a request for the stylesheet reaches `load` instead,
which awaited generation unguarded. Anything under it that threw a primitive — a dependency, a config hook — still
reached Vite's dev error middleware, which puts what it is handed into a `WeakSet` to deduplicate it and throws
`TypeError: Invalid value used in weak set` on anything that is not an object. The real failure was replaced by a stack
trace about weak sets, and the request that revealed it was a stylesheet fetch rather than a module load.

Both hooks now share one `asError` helper, so they cannot drift again, and the original value is kept as `cause`. A test
pins the invariant directly: every shape a hook may throw is normalized into something `WeakSet.add` accepts.
