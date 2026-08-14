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

The last four are the ones a type union cannot get right. csstype describes `top` and `animationName` identically — both
end in `(string & {})`, one because it takes lengths and the other because it takes a `<custom-ident>` — so
`strictTokens` had to carry a hand-written list of 29 properties to know the difference, and still rejected
`transitionProperty: 'color'` while suggesting `'colors'`, which emits seven declarations instead of one.

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
