---
'@bamboocss/eslint-plugin': minor
---

`no-invalid-token-paths` now reports what the build reports, in the editor.

Deleting the type-level narrowing took the red squiggle with it: `css({ color: 'mutedd' })` was a type error, and is now
a build warning you see when you build. This closes that, by asking the resolver the same question rather than
reimplementing it — the rule prints the build's own sentence, so the two cannot describe one mistake differently.

```ts
css({ color: 'mutedd' }) //               reported
css({ display: 'flexx' }) //              reported
css({ top: 'navH' }) //                   reported, and says `navH` is a `sizes` token

css({ display: 'flex' }) //               fine
css({ animationName: 'fadeIn' }) //       fine
css({ transitionProperty: 'color' }) //   fine
css({ color: 'currentcolor' }) //         fine
```

The existing check is kept alongside rather than replaced. It reads `token(…)` references out of a composite value —
`token(sizes.4000) 20px` — where the value as a whole is ordinary CSS; the new one judges the value as a whole against
its property, which is the only way a value with no dot in it is decidable at all. Neither subsumes the other.

Nothing to configure: the rule was already on in the recommended set.
