---
'@bamboocss/token-dictionary': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/parser': minor
'@bamboocss/generator': minor
'@bamboocss/preset-base': minor
'@bamboocss/config': minor
---

Remove `token(path, fallback)`. A token is referenced one way: `token(path)`.

The fallback bundled two unrelated behaviours under one spelling — "resolve this, or use the literal if it names no
token", answered at build time, and "emit `var(--x, fallback)`", answered by the browser. The call site could not say
which it was getting, and the build-time half silently masked a typo'd path, which is the same reason the `fallback`
argument was removed from `token.value()`.

**Patterns resolve tokens directly now.** `PatternHelpers` gains `token(path, fallback)`:

```ts
// before — deferred into a string for the css pipeline to parse later
const val = isCssUnit(v) ? v : `token(spacing.${v}, ${v})`

// after — answered where it can be answered
const val = isCssUnit(v) ? v : token(`spacing.${v}`, v)
```

Same semantics: `spacer({ size: '4' })` resolves to `var(--spacing-4)`, `spacer({ size: 'auto' })` to `auto`. The build,
the extractor and the browser answer identically — the browser through the generated tokens artifact, so it cannot
disagree with the build about a variable's name.

**What this buys.** `expand-token-references.ts` was a 180-line character-state parser, and every line of it existed for
the fallback and its nesting. It is now **22 lines and one regex**. That also closes a live bug for free: `token(path)`
in a theme or semantic token value was never expanded — it landed in the stylesheet as literal text, with no warning —
because the parser's shape forced a reference regex that could not see it.

**Breaking.** A retired form now fails rather than emitting text: in a token value the build stops and names the token
and its replacement; in a style value it throws where it is used.

`spacer`, `grid` and `bleed` emit `var(--spacing-4)` where they emitted `token(spacing.4, 4)`, so their declarations
lose a now-redundant css fallback and the class names derived from those values change. Apps not using those three
patterns are byte-identical — verified on an example app.

Cost: a pattern module now imports the generated tokens artifact, shared with any other `token()` use in the app.
