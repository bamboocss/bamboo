---
'@bamboocss/core': patch
---

Stop serializing the stylesheet only to parse it straight back, and stop the optimize pipeline from rewriting the
context's own layer tree.

`Stylesheet.toCss` built its css text and handed it to `optimizeCss`, which parsed it into the tree it needed. On a 432
kB sheet that round trip cost 13.0ms; cloning the tree instead costs 6.8ms.

The round trip was doing something else as well, by accident. `Layers.insert()` returns the `Layers` instance's own
`Root`, and everything downstream rewrites what it is handed — `expandScreenAtRule`, `sortMediaQueries`, the
cascade-layer polyfill, and then the whole optimize pipeline, which merges rules and drops nodes. A string cannot be
mutated, so the serialization was the only thing keeping the context's layers intact between calls. Cloning does it
deliberately, and covers the two plugins that ran against the shared tree even before:

**Fixes `toCss()` returning different css the second time it is called.** With `config.polyfill` on, a second call
returned 7,837 bytes where the first returned 4,283 — the polyfill re-applied itself to a tree it had already rewritten.
Both calls now agree, with the polyfill on or off.

The exported `optimizeCss` still serializes a `Root` it is given, so it continues to leave the caller's tree alone; the
consuming variant is internal and used only by `toCss`, on the clone it owns.

`dedupeNodes` folded `raws.before` into its dedupe key in a way that distinguished absent from empty — every node in a
_parsed_ tree has one, so this could not arise while the plugin only ever saw re-parsed css, and it can now that it sees
a tree built directly. Two identical nodes landing on opposite sides of that split would both have survived.

One output change, in non-minified css only: a nested `@layer`'s closing brace now indents to match its opening (two
spaces rather than four). `diff -w` against the previous output on an 85 kB sheet reports no differences, and minified
output is byte-identical.
