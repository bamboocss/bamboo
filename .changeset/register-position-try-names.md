---
'@bamboocss/core': minor
---

Register `globalPositionTry` names as values `positionTryFallbacks` and `positionTry` accept.

```ts
globalPositionTry: { 'bottom-scrollable': { alignSelf: 'stretch' } }

css({ positionTryFallbacks: '--bottom-scrollable' }) // autocompletes, and typechecks under strictTokens
```

The same trade `globalFontface` already made for `fontFamily`: declaring the rule is what makes its name known. A rule
written as a raw `@position-try` in `globalCss` still ships, but its name stays unknown to the generated types — which
is now the single reason to prefer either typed option over the raw at-rule, rather than a different reason for each.

Names are registered under the dashed spelling, because that is what the properties take: `position-try-fallbacks: flip`
is invalid css. `GlobalPositionTry.names` is normalised for the same reason, so it says what the stylesheet declares
rather than what the config was keyed by — the two disagreeing would autocomplete a name with no rule behind it.

`positionTryOrder` is left alone: it takes keywords, not a name. Emitted css is unchanged.
