---
'@bamboocss/vite': patch
---

Stop a compile failure in dev from being replaced by an error about weak sets.

The transform rethrew what it caught, and `catch` binds `unknown` — anything under the fold, including a dependency or a
config hook, may throw a primitive rather than an `Error`. Vite's dev error middleware puts what it is handed into a
`WeakSet` to deduplicate it, which throws `TypeError: Invalid value used in weak set` for anything that is not an
object. The real failure was then lost behind a stack trace about weak sets, in the one mode where the terminal is the
only place it would have been seen.

Non-`Error` throws are now wrapped, keeping the original message in the text and the original value as `cause`. Build
mode was never affected: it returns rather than rethrowing, which is why this only appeared locally.
