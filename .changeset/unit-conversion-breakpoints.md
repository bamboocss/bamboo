---
'@bamboocss/shared': patch
'@bamboocss/config': patch
'@bamboocss/core': patch
---

Stop breakpoints in an unrecognised unit being read as pixels.

`getUnit` matched anywhere in a string and only in lower case, and the conversions ran `parseFloat` over the raw value.
`parseFloat` returns a number for plenty of strings that are not a pixel count, so a unit the conversion did not
recognise was silently treated as one. Two ways to reach it, both producing valid CSS that matches the wrong viewports
or none:

| breakpoints        | `mdOnly` emitted                               | should be                                        |
| ------------------ | ---------------------------------------------- | ------------------------------------------------ |
| `50EM`             | `(min-width: 40EM) and (max-width: 3.1225rem)` | `(min-width: 40rem) and (max-width: 49.9975rem)` |
| `calc(40em + 0px)` | `(min-width: NaNrem)`                          | the value, unchanged                             |
| `50vw`             | `(max-width: 3.1225rem)`                       | `(max-width: 50vw)`                              |

`40EM` is as valid as `40em`; CSS units are case-insensitive. Reading it as `40px` made the range sixteen times too
small, so `min-width: 640px` and `max-width: 50px` matched nothing at all. `validateBreakpoints` did not catch any of
it, because it asked the same function and fell back to `px` for whatever came back empty — a theme written entirely in
`EM`, or mixing `em` with `vw`, passed the same-unit check.

Now:

- Unit matching is anchored and case-insensitive, so a unit inside a larger expression is not mistaken for the value's
  own, and `40EM` converts exactly as `40em` does. The number accepts what CSS accepts, including `.5rem` and `1e3px`.
- The numeric half is read from the match rather than by `parseFloat` over the raw string, so a value that is not a
  number and a unit is passed through untouched instead of becoming `NaN`.
- Breakpoint arithmetic only steps a value down when it is in a unit that converts to pixels. Anything else — `vw`,
  `ch`, a `calc()` — is emitted as written. That costs an overlap of one unit between adjacent ranges, against a range
  that previously matched nothing.
- `validateBreakpoints` reads the unit generically, so it can tell `em` from `EM` from `vw` and its same-unit check
  works for units bamboo does not convert.

`unit-conversion.ts` had no test file. It has one now, along with breakpoint cases for each shape above.
