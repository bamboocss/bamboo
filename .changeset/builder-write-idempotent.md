---
'@bamboocss/node': patch
---

Stop the PostCSS plugin appending a second copy of the stylesheet when a root reaches it twice.

`Builder.write` appended the generated css to the user's root, and what it appended carries the
`@layer reset, base, tokens, recipes, utilities;` declaration that `isValidRoot` looks for. So the guard deciding
whether to inject was satisfied by the result of injecting, and nothing removed or replaced a previous injection. A root
that reached `write` twice — a plugin registered in both `postcss.config.js` and the bundler config, or a chain that
re-processes emitted css — accumulated a whole copy each time: 101 rules became 201, 22.8 kB became 45.5 kB.

Nothing downstream took those apart. Each copy is internally consistent and only duplicated against the other, so
`postcss-discard-duplicates` never sees a duplicate within the sheet it is given. That is how a production stylesheet
came to carry 402 byte-identical rules in identical contexts — 21 kB, 11% of the file — concentrated entirely in
Bamboo's own layers while the app's own layers were clean.

The injection is now bracketed by `/* bamboocss:start */` and `/* bamboocss:end */`, and `write` removes a previous
block before appending. Comments rather than a flag on the node, because the root can be stringified and re-parsed
between two plugins in the same chain and nothing on the node survives that round trip.

Removal is bounded by the end marker rather than running to the end of the root, so anything a later plugin appended
after the injection stays where it is. A start marker with no end — what an uneven comment strip would leave — removes
nothing, which is the safe direction: a duplicate costs bytes, dropping a user's css does not fail loudly.

If you were hitting this, the duplicates are worth looking for: they survive minification, since each copy is valid css.
