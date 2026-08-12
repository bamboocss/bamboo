---
'@bamboocss/vite': patch
---

Escape a reachability key at most once, so custom properties keep their rules.

`esc` is idempotent for a name that needs no escaping and not otherwise. `d_flex` survives any number of passes;
`--scrollbar-width_10px` becomes `\--scrollbar-width_10px` and then `\\--scrollbar-width_10px`. A key escaped twice
matches no rule in the emitted sheet, so reachability pruning removes the atom and the elements carrying it render
unstyled.

It affects only names that need escaping — custom properties, vendor-prefixed properties, anything with a leading dash
or a condition prefix — which is why it presented as every `--*` and `-webkit-*` declaration losing its rule while flat
ones were untouched, with the rule plainly present in the stylesheet the whole time.

A semantic atom name never contains a literal backslash, so one is an unambiguous signal that a name is already in
selector form. `markClassUsed` now leaves those alone rather than escaping them again.
