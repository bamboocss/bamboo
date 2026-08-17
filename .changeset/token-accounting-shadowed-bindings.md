---
'@bamboocss/node': patch
---

`prune: { tokens: 'accounted' }` no longer declines on a local binding named `token`.

The accounting walk keyed on the spelling of an identifier, so `items.map((token) => token.value)` — token _objects_,
and the obvious name for them — declined once per read as an `unresolved-reference`. One decline anywhere keeps every
token declaration in the project, so a single such component was the difference between `accounted` pruning and
`accounted` emitting the same stylesheet the default does.

A binding this file declares itself is now resolved and skipped: parameters (destructuring included), catch variables,
function and class declarations, named function and class expressions, and a variable destructured off one of those —
`const { token } = props`. A type or class member named `token` is likewise a declaration name rather than a reference,
and no longer reaches the resolver that could not read it.

What still declines is unchanged, and deliberately so: `const token = …` in general, since its initializer can be
anything, including the artifact reached through a barrel or a `require`; a destructure off a namespace or imported
object, for the same reason; and a property _name_ on an object this pass never bound, since `theme.token(k)` can reach
the artifact whatever else the file declares.

On this repository's own documentation site this was 40 declines across seven components, none of them a token call. The
token layer goes from 500 declarations to the 146 that are referenced, and the stylesheet from 86,644 B to 73,773 B raw
— 12,829 B to 10,903 B brotli, −15.0%.

The default (`prune: { tokens: 'reachable' }`) is unaffected: the accounting pass does not run there, and a cold
`cssgen` over that site measures 65.0 ms before and 66.0 ms after.
