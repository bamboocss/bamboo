---
'@bamboocss/config': minor
'@bamboocss/node': minor
---

Rebuild the themes artifact when a theme variant changes, and carry the original errors on a failed extraction.

**`theme.variants` rebuilt nothing.** The watch rebuild decides which artifacts to regenerate by matching the changed
config path against a per-artifact list, and the themes artifact still watched `themes` — the option's name before it
became `theme.variants`. `ConfigPath` ends in `(string & {})`, so the stale path typechecked and simply stopped
matching.

Nothing reported it. The diff saw the change, no matcher claimed it, and the affected set came back empty — which is not
"rebuild everything": `getMatchingArtifacts` filters on `ids.includes(...)`, and an empty list includes nothing. So
editing or adding a theme variant regenerated no artifact at all and kept serving the previous `theme-*.json`. `eject`
was stale in the same list, left by the same round of renames.

A test now checks every watched path against the removed-option table, so an option that is renamed and not updated here
fails at the commit that renames it rather than silently detaching an artifact from its trigger.

**`ERR_BAMBOO_EXTRACT_FAILED` carries its causes.** The aggregate named every file it could not extract but kept only
their messages, so a caller acting on the failure could not tell a retired token spelling from a syntax error. It now
sets `cause` to an `AggregateError` of the originals — always, one file or six, so reading `cause.errors` never has to
test how many there were first.
