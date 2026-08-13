---
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
---

Add `strictTokens: 'unknown-tokens'`, a setting between "nothing is checked" and "only tokens".

On the default, `css({ color: 'mutedd' })` is accepted by TypeScript and by the build. It ships as `color: mutedd`,
which parses, so nothing objects — the browser drops the declaration at compute time and the style is simply absent. It
surfaces as a colour that never applied, a long way from the typo.

`strictTokens: true` catches it, and rejects every raw CSS value with it: `468` errors on one otherwise-correct
five-page app, three of which were the class of mistake it was turned on for. That makes it a day-one decision, and a
project that did not make it then is realistically stuck with the unchecked default.

`'unknown-tokens'` costs no migration for a literal value. `'14px'`, `'100vh'`, `'1px solid red'`, `'rgb(0 0 0)'` and
every keyword a property enumerates stay writable; what it rejects is a bare identifier that is neither a token nor a
keyword — `'mutedd'`, `'accnt'`, `'colors.acent'`. The test is shape: a token path is an identifier, possibly dotted, so
anything starting with a digit, `#` or `-`, or containing a space, a comma or a call, cannot be one.

Properties whose values _are_ identifiers you invent are left out of it — `animationName`, `gridArea`, `counterReset`,
`containerName`, `viewTransitionName`, `fontFamily`, `listStyleType`, `transitionProperty`, `willChange`, `content` and
the rest — because there is nothing to check them against, and a `@keyframes` name declared in CSS is an ordinary thing
to write.

Two costs follow from the rule being about shape, and both are documented rather than fixed: a typo shaped like a value
passes (`'2xll'` starts with a digit exactly as `'2rem'` does), and a value typed `string` is rejected, since nothing
distinguishes it from a misspelled token — the same as under `strictTokens: true`, and no new restriction under the Vite
compiler, which rejects an open runtime value whatever the types say. Over 600 `css()` call sites, `tsc` took 0.48s on
the default, 0.59s under `strictTokens: true` and 0.70s under this setting.

Nothing changes for a project that does not set it: the property types emitted under `false` and `true` are unchanged,
and the only difference in those artifacts is two new exported helper aliases in `prop-type.d.ts` and the import line
that references them.
