---
'@bamboocss/shared': patch
---

Terminate hex escapes in class selectors, so a digit-led class name still matches its element.

A CSS escape consumes up to **six** hex digits, then one optional whitespace that ends it. `esc` emitted the escape
without that terminator, so whenever the character after it was itself a hex digit it was read as part of the escape:

| class name | selector emitted | the browser reads |
| ---------- | ---------------- | ----------------- |
| `640:p_4`  | `\3640\:p_4`     | `㙀:p_4`          |
| `3d:p_4`   | `\33d\:p_4`      | `̽:p_4`            |
| `12:p_4`   | `\312\:p_4`      | `̒:p_4`            |
| `0a`       | `\30a`           | `̊`                |

The element's `class` attribute still said `640:p_4`, so the selector matched nothing and it rendered unstyled — with no
error, and invisible to any check that escapes both sides through this same function.

Stock breakpoints escape their leading digit too and were unaffected only by luck: `2xl:bg_red` becomes `\32xl…`, and
`x` is not a hex digit, so the escape ended where it should. Reaching the bug takes a breakpoint or condition named
numerically (`640`, `12`) or as a digit followed by `a`–`f` (`3d`), or any digit-led class name whose next character is
a hex digit.

The terminator is now emitted, matching `CSS.escape` and the `jQuery.escapeSelector` this came from. A parser consumes
the space as part of the escape, so it never reads as a descendant combinator, and escapes that already worked keep
their meaning — `\30\.5` becomes `\30 \.5`, and both are `0.5`.

`esc.test.ts` compared against recorded strings, which cannot tell a correct escape from one that names a different
character, and had pinned `\30a` as expected output. It now also decodes each result the way a parser does and asserts
the round trip.
