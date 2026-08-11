---
'@bamboocss/generator': minor
'@bamboocss/core': patch
---

Resolve the path under a token modifier, and stop paying five templates per token to describe one.

`unresolvedToken` tested the value as written, so a path wearing `!important` or a `/opacity` modifier failed the shape
test on the modifier's own punctuation and was reported as fine. `color: red.3000!` shipped a declaration the browser
drops with nothing said about it. The normalization existed, but it lived in `assertNoUnresolvedTokens` rather than in
the shared predicate — so `unresolvedToken: 'error'` could see through `!` while `'warn'` could not, and neither could
see through `/`. It moves into `isUnresolvedTokenValue`, where both modes read it:

- `accent.default!`, `accent.default !important` and `accent.default/50` all resolve as `accent.default`, and report
  once between them rather than not at all.
- The opacity modifier is stripped only for a property drawing on `colors`, so a slash stays part of the value in
  `font: 12px/1.5 serif` or `gridArea: 1 / 2 / 3 / 4`.
- A resolvable path wearing a modifier is still fine, which is the half that would break first.

With the build seeing those forms, the generated types no longer have to spell each one out. `WithColorOpacityModifier`
and the per-token `WithImportant` are replaced by a single `WithModifier<T>` covering `/`, `!` and ` !` as one
open-ended tail.

A template literal distributes over a union in every placeholder, so `` `${T}` `` against a 258-token colour palette is
258 members and `` `${T}${Important}` `` was four times that. Between them the two modifier forms were 5N of a
~1,560-member union for `color` alone. Folding them to 3N is **14.5% off `tsc`** — 7.09s against 8.29s over 4,000 call
sites, with a control repeat agreeing to 3.5%.

What that gives up is the tail: `red.300!nonsense` typechecks now, where five exact templates rejected it. The build
still reports it, so the diagnostic moves rather than disappears, and only for a value nobody writes on purpose.

CSS output is unchanged — this grades reports and types, not what is emitted.

One thing worth knowing before tidying the generated types: the `& { __modifier?: true }` and `& { __important?: true }`
brands look like dead weight and nothing reads them, but they are what stops TypeScript attempting subtype reduction
across the union these expand into. Removing them costs **12.8x** on `tsc` — 87.2s against 6.8s on the same fixture.
There is now a comment saying so at the definition.
