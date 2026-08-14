---
'@bamboocss/generator': major
'@bamboocss/core': major
'@bamboocss/types': major
'@bamboocss/config': major
'@bamboocss/dev': major
---

Remove `strictTokens: 'unknown-tokens'`. The build checks names now, and it is better at it.

The setting existed to make `css({ color: 'mutedd' })` a type error, by narrowing every generated prop type: keep the
keywords csstype enumerates, drop the open `string` it ends with. That worked, and it was the wrong layer.

- It could not tell `top: 'navH'` from `animationName: 'fadeIn'`. csstype describes both as `… | (string & {})`, one
  because it takes lengths and the other because it takes a `<custom-ident>`, so the generator carried a hand-written
  list of 29 property names to know the difference.
- That trailing `(string & {})` is csstype declining to say a list is exhaustive, and it declines for **70%** of the
  properties it describes. Narrowing them anyway rejects `width: 'stretch'` and `imageRendering: 'optimizeSpeed'`.
- It only ever saw TypeScript. Two of the four findings on this repo's own documentation site are in **config recipes**,
  which `tsc` does not check — and none of it reaches a `.vue` template or a project not using TypeScript.
- It could not say anything useful. A type error reports that a string is not assignable to a union of two hundred
  members and guesses a near-miss by spelling, which is how `transitionProperty: 'color'` came to be rejected in favour
  of `'colors'` — a utility value that emits seven declarations instead of one.

The build answers all four, against the real CSS grammar, and says where the name actually lives:

```
`top: navH` — `navH` is declared under `sizes`, but `top` reads `spacing`.
It is emitted as written, and the browser will drop it.
Use a `spacing` token, or write `[navH]` to mean it literally.
```

**What this costs, measured** on this repo's documentation site with `tsc --extendedDiagnostics`. Deterministic counts,
not wall clock:

|                | with the narrowing | without        |
| -------------- | ------------------ | -------------- |
| Types          | 40,995             | 33,393 (−19%)  |
| Instantiations | 181,030            | 130,059 (−28%) |

**Migration.** Delete the setting; the check it bought is on by default and needs no configuration. `strictTokens` is
now a boolean and means only what its `true` always meant — every raw CSS value must be written `[14px]` — which is a
design-system policy rather than a correctness check, so `bamboo init` no longer writes it. A config still naming
`'unknown-tokens'` is reported by validation rather than silently read as `true`, which truthiness would otherwise make
it.

Also gone from the generated `styled-system`: `KnownKeywords`, `CssValueShape`, and the author-identifier property list.
