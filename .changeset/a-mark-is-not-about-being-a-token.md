---
'@bamboocss/generator': patch
---

Let an important mark decorate a keyword, not only a token, under `strictTokens: 'unknown-tokens'`.

```ts
css({ color: 'blue.300!' }) //  ✅
css({ boxShadow: 'none!' }) //  ❌ was a type error
css({ display: 'flex!' }) //    ❌ was a type error
```

`WithEscapeHatch` is what carries `!` and `/`, and it wrapped the tokens alone — so whether a mark was allowed depended
on whether the value happened to be a token, which is about the value and not about the mark. `none` is a csstype
keyword and `blue.300` is a token; nothing an author can see distinguishes them at the point of writing `!`. The
keywords are now held out of the plain union and wrapped alongside the tokens.

It buys back no looseness. Only values that were already allowed can carry a mark, so `color: 'mutedd!'` is still an
error exactly as `color: 'mutedd'` is — and the spaced form, `'none !important'`, which was the workaround, still works.

It does cost. The keyword lists are the larger union — `color` alone enumerates every named colour — and `WithModifier`
distributes over them. Measured with `tsc --extendedDiagnostics` over this repo's documentation site, which now runs
this setting:

|                | before  | after            |
| -------------- | ------- | ---------------- |
| Types          | 37,916  | 40,995 (+8.1%)   |
| Instantiations | 150,252 | 181,030 (+20.5%) |

Deterministic counts rather than wall clock, for the reason `escape-hatch-shape.test.ts` gives: a time is a property of
the machine. That test still holds — one distributing form, and its brand intact — so this is a proportional increase
rather than the 12.8x cliff losing either of those causes.

An `authorIdentProperty` — `animationName`, `gridArea`, `fontFamily`, `content` — keeps its open `string` _outside_ the
wrapper, unchanged. Everything inside it is what a mark may decorate, so wrapping an open string would make a mark
excuse anything.
