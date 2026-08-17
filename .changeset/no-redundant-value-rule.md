---
'@bamboocss/eslint-plugin': minor
---

New rule: `no-redundant-value`, reporting an edge or pair value written longer than it needs to be.

Bamboo names an atomic class from the value as written, so two spellings of the same value are two classes and two
rules. A production build measured for this carried one padding as `16px`, `16px 16px` and `16px 16px 0 16px`, and one
box-shadow written four ways — 304 groups of atoms emitting byte-identical declarations, about 1.6% of the stylesheet
under brotli.

The rule covers the two families where CSS defines the omitted values as copies of the ones given: edge properties
(`padding`, `margin`, `inset`, `borderWidth`, `borderColor`, `borderStyle`, `scrollMargin`, `scrollPadding`, and
Bamboo's `p` and `m`) and pair properties (`gap`, `gridGap`, `overflow`, `overscrollBehavior`). A zero length is
normalised first, since `0px` and `0` are otherwise two atoms — that alone quadrupled what the rule catches.

It is an allowlist rather than a test on the shape of the value, because the shape is not enough to know a collapse is
sound: `backgroundPosition: '0 0'` is left-top while `'0'` is left-centre, which is the same shape and a different
element position. Values are split with parentheses respected, so `calc(1rem + 2px) calc(1rem + 2px)` reads as two
identical edges; an unbalanced parenthesis declines.

Reported as a suggestion rather than an autofix, and left out of `recommended` — nothing renders wrongly, the sheet is
just carrying the drift of a large codebase.

Measured against the build it was written from, it unifies 24 of those 304 groups. The larger remainder is a design
token spelled against its own literal — `p: '4'` beside `p: '4px'` — which wants its own rule alongside
`no-hardcoded-color`, since the advice there is "use the token" rather than "this is redundant".
