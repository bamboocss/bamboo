---
'@bamboocss/core': minor
'@bamboocss/generator': patch
---

The build now catches a misspelled token, and says where the name actually lives.

`color: 'mutedd'` walked straight through the build. The check required a dot — it saw `color: 'blue.3000'` and nothing
else — so the single typo the whole feature is sold on was invisible to it, and only the type layer caught it. That is
why checking values has meant narrowing every generated prop type.

The dot is gone. A bare identifier is a mistake when the property enumerates keywords, does not accept an identifier the
author invents, and neither the tokens nor the keywords contain it:

```
color: 'mutedd'                  reported
display: 'flexx'                 reported
zIndex: 'overlay'                reported   (no zIndex tokens declared)
transform: 'auto'                reported   (bamboo has no such sugar; `transform: auto` is not css)

display: 'flex'                  fine       (a keyword the property enumerates)
color: 'rebeccapurple'           fine
top: 'auto'                      fine       (a keyword on a property that also takes tokens)
transitionProperty: 'color'      fine       (the grammar asks for a property name here)
animationName: 'fadeIn'          fine
gridArea: 'sidebar'              fine
```

The last four are the ones a type union cannot get right, and the reason the question is put to the real grammar —
`css-tree`'s `matchProperty` — rather than to csstype's unions:

- csstype describes `top` and `animationName` identically, both ending in `(string & {})`, one because it takes lengths
  and the other because it takes a `<custom-ident>`. `strictTokens` needed a hand-written list of 29 property names to
  tell them apart, and still rejected `transitionProperty: 'color'` while suggesting `'colors'` — a utility value that
  emits seven declarations instead of one.
- That trailing `(string & {})` is csstype declining to say the list is exhaustive, and it declines for **70%** of the
  properties it enumerates. Read as closed, those lists reject `width: 'stretch'` and `imageRendering: 'optimizeSpeed'`
  — ordinary css csstype has not caught up with.
- Reaching `<custom-ident>` is not the same as admitting one: `gridTemplateColumns` reaches it through
  `'[' <custom-ident>* ']'`, where it is legal only inside literal brackets.

Two known gaps, both in the safe direction for a setting that defaults to `warn`. `css-tree` follows the current spec,
so a value a spec deleted but browsers still honour is reported — the 23 `DeprecatedSystemColor` names are allowed back
explicitly, since that set is closed by history, but a value like `userSelect: 'contain'` its data has not reached yet
is not. Write `[value]` for either.

**The diagnostic is the point.** The resolver knows where a name lives; a type error can only say a string is not
assignable to a union of two hundred members and guess a near-miss by spelling:

```
`top: sm` — `sm` is declared under `radii`, `fontSizes` and 4 more, but `top` reads `spacing`.
It is emitted as written, and the browser will drop it. Use a `spacing` token, or write `[sm]`
to mean it literally.
```

`warn` and `error` now build that sentence from one function, so the two modes cannot describe one mistake differently —
which they have done before, over whether `!` was part of the value.

Perf-neutral on `static-css-real-world`: every case within ±7% and both signs represented, which is noise at this repo's
~5% run-to-run agreement. The check opens with a character-code test, so a value starting with a digit, `#`, `-` or a
quote — most CSS — is rejected before anything else runs, and the property lookups behind it are memoised.
