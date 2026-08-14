---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/types': minor
---

`unresolvedToken` now fails the build on a misspelled token, and only warns when the grammar is the one objecting.

A warning in a build log is close to invisible, and this check exists to catch something that is otherwise invisible —
`color: 'mutedd'` ships as `color: mutedd`, which parses, and which the browser discards. Defaulting it to `warn` was
doing very little work.

But the two halves of the check are not equally certain, and one severity flattened them:

| half      | when                                                                    | decided by               | default |
| --------- | ----------------------------------------------------------------------- | ------------------------ | ------- |
| `token`   | the property draws from a token category, or the value is a dotted path | bamboo's own bookkeeping | `error` |
| `grammar` | a bare name on a property with no token category                        | the CSS grammar          | `warn`  |

`top: 'navH'` is the first — `top` reads `spacing`, `navH` is declared under `sizes`, and no third party is consulted to
know that. `containerType: 'scroll-state'` is the second: valid CSS that the grammar's data has not caught up with.

The split is measured, not guessed. Sweeping all 10,128 (property, keyword) pairs csstype enumerates through the grammar
found **8 disagreements — 0.08% — and every one of them on a property with no token category**:
`container-type: scroll-state`, `dominant-baseline: text-bottom`/`text-top`, `stroke-linejoin: arcs`/`miter-clip`,
`text-justify: distribute`, `text-orientation: sideways-right`, `glyph-orientation-vertical: auto`. So the half that now
fails a build is the half with no measured false positives in it, and a stale grammar can still only warn.

A single severity applies to both, as before — `unresolvedToken: 'warn'` restores the old behaviour exactly.

It found three more real ones on the way in: `color: 'neutra.200'` in this repo's own card recipe, `rounded: 'none'` in
its global CSS — `border-radius: none` is not CSS, so the declaration was dropped and inline-code rounding leaked into
fenced blocks — and a `boxShadow: 'outline'` in a test fixture named "token reference", referencing a token that does
not exist.
