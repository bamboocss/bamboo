---
'@bamboocss/core': minor
'@bamboocss/generator': minor
---

Say which elements `preflight.prune` removed the reset for.

The pass drops reset rules for elements your source never renders, and its one real objection is that being wrong is
silent: an element rendered by a dependency's component, by markdown, or through `dangerouslySetInnerHTML` is invisible
to the scan, loses its reset, and reports nothing — the page just looks slightly off, usually on one route, usually
later. The docs' answer was "check the result", with nothing to check it against: the pass logged counts, at debug
level, which no one has on.

It now names them, at info level, which only a project that opted in ever sees:

```
🎋 info [prune:preflight] Reset rules removed for 20 element(s) your source never renders: abbr, audio, b, canvas,
dialog, embed, h5, h6, iframe, input, menu, object, optgroup, progress, samp, select, small, sub, sup, textarea.
```

That is a list a reader can check against what they know their own app renders, which a count is not — so it is not
truncated, and it is printed once per project rather than once per watch rebuild and once per environment of a build.
The sample above is this repo's own documentation site, where `h5` is on the list and the docs render one.

The list says a rule for that element went, not that nothing styles it any more: a reset naming `table` both alone and
as `.prose table` loses only the first and still reports it. The cost is one `Set.add` per removed selector part — at
most 41, once per build.
